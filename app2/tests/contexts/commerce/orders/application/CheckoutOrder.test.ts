import "reflect-metadata";

import { ContainerBuilder } from "diod";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Carga .env.test ANTES de nada que lea DSNs: prioridad sobre el entorno heredado
import { loadTestEnv } from "../../../../setup-env";
loadTestEnv();

import { EventBus } from "../../../../../src/contexts/shared/domain/event/EventBus";
import { DomainEvent } from "../../../../../src/contexts/shared/domain/event/DomainEvent";
import type { DomainEventSubscriber } from "../../../../../src/contexts/shared/domain/event/DomainEventSubscriber";
import { MysqlConnection } from "../../../../../src/contexts/shared/infrastructure/mysql/MysqlConnection";
import { MysqlEventBus } from "../../../../../src/contexts/shared/infrastructure/domain-event/MysqlEventBus";
import { ComercioMysqlConnection } from "../../../../../src/contexts/commerce/infrastructure/mysql/ComercioMysqlConnection";
import { MysqlOrderRepository } from "../../../../../src/contexts/commerce/orders/infrastructure/MysqlOrderRepository";
import { MysqlProductRepository } from "../../../../../src/contexts/commerce/products/infrastructure/MysqlProductRepository";
import { CheckoutOrder } from "../../../../../src/contexts/commerce/orders/application/CheckoutOrder";
import { TestOrderCreatedSubscriber } from "./TestOrderCreatedSubscriber";

const PRODUCT_A = { id: "63c40f38-9c75-47e0-9d44-a6e32822f001", name: "Mochila", price: 10 };
const PRODUCT_B = { id: "be277faf-c339-4e70-9a6f-0de3ae4f5002", name: "Auriculares", price: 29.5 };

// Contenedor local de pruebas: conexiones por schema (eventos + comercio,
// docs/09 Fase 2) con los suscriptores de test taggeados
const builder = new ContainerBuilder();

builder
  .register(MysqlConnection)
  .useFactory(
    () =>
      new MysqlConnection(
        process.env.MYSQL_EVENTOS_URL ?? "mysql://demo:demo@localhost:3307/eventos",
      ),
  )
  .asSingleton();

builder
  .register(ComercioMysqlConnection)
  .useFactory(
    () =>
      new ComercioMysqlConnection(
        process.env.MYSQL_COMERCIO_URL ?? "mysql://demo:demo@localhost:3307/comercio",
      ),
  )
  .asSingleton();

builder
  .register(MysqlOrderRepository)
  .useFactory((container) => new MysqlOrderRepository(container.get(ComercioMysqlConnection)))
  .asSingleton();

builder
  .register(MysqlProductRepository)
  .useFactory((container) => new MysqlProductRepository(container.get(ComercioMysqlConnection)))
  .asSingleton();

builder.register(MysqlEventBus).useFactory((container) => {
  const eventSubscribersGetter = (): DomainEventSubscriber<DomainEvent>[] =>
    container
      .findTaggedServiceIdentifiers<DomainEventSubscriber<DomainEvent>>("subscriber")
      .map((id) => container.get(id) as DomainEventSubscriber<DomainEvent>);

  return new MysqlEventBus(container.get(MysqlConnection), eventSubscribersGetter);
});

builder
  .register(EventBus)
  .useFactory((deps) => deps.get(MysqlEventBus))
  .asSingleton();

builder
  .register(CheckoutOrder)
  .useFactory(
    (container) =>
      new CheckoutOrder(
        container.get(MysqlOrderRepository),
        container.get(MysqlProductRepository),
        container.get(EventBus),
      ),
  )
  .asSingleton();

builder.registerAndUse(TestOrderCreatedSubscriber).addTag("subscriber");

const container = builder.build();

const eventosConnection = container.get(MysqlConnection);
const comercioConnection = container.get(ComercioMysqlConnection);
const checkoutOrder = container.get(CheckoutOrder);

// 1:1 con sync-domain-events-routing: inscribe routing desde
// subscribedTo() + name(); nada de INSERTs escritos a mano
const syncRouting = async (): Promise<void> => {
  const subscribers = container
    .findTaggedServiceIdentifiers<DomainEventSubscriber<DomainEvent>>("subscriber")
    .map((id) => container.get(id) as DomainEventSubscriber<DomainEvent>);

  for (const subscriber of subscribers) {
    for (const eventName of subscriber.subscribedTo().map((eventClass) => eventClass.eventName)) {
      await eventosConnection.sql`
				INSERT IGNORE INTO eventos.domain_events_routing (
					event_name, subscriber_name
				) VALUES (${eventName}, ${subscriber.name()})
			`;
    }
  }
};

afterAll(async () => {
  await eventosConnection.end();
  await comercioConnection.end();
});

beforeEach(async () => {
  // truncateAll es por schema: cada conexión limpia su BD (docs/09 Fase 2)
  await comercioConnection.truncateAll();
  await eventosConnection.truncateAll();
  await syncRouting();

  await comercioConnection.sql`
		INSERT INTO products (id, name, price_amount, price_currency, changed_at) VALUES
			(${PRODUCT_A.id}, ${PRODUCT_A.name}, ${PRODUCT_A.price}, 'EUR', NOW(6)),
			(${PRODUCT_B.id}, ${PRODUCT_B.name}, ${PRODUCT_B.price}, 'EUR', NOW(6))
	`;
});

describe("CheckoutOrder should", () => {
  it("persist order + items in comercio and publish order_created to each routed subscriber", async () => {
    const order = await checkoutOrder.run("cliente@example.com", [
      { productId: PRODUCT_A.id, quantity: 2 },
      { productId: PRODUCT_B.id, quantity: 1 },
    ]);

    const orderRows = (await comercioConnection.sql`
			SELECT id, email, total_amount, total_currency, status
			FROM orders WHERE id = ${order.id}
		`) as { email: string; total_amount: string; total_currency: string; status: string }[];

    expect(orderRows.length).toBe(1);
    expect(orderRows[0].email).toBe("cliente@example.com");
    expect(Number(orderRows[0].total_amount)).toBe(2 * PRODUCT_A.price + PRODUCT_B.price);
    expect(orderRows[0].total_currency).toBe("EUR");
    expect(orderRows[0].status).toBe("created");

    const itemRows = (await comercioConnection.sql`
			SELECT product_id, quantity
			FROM order_items WHERE order_id = ${order.id}
			ORDER BY product_id
		`) as { product_id: string; quantity: number }[];

    expect(itemRows).toEqual([
      { product_id: PRODUCT_A.id, quantity: 2 },
      { product_id: PRODUCT_B.id, quantity: 1 },
    ]);

    // Una fila por suscriptor en eventos: el event_id es el_uuid del evento,
    // no el aggregateId, así que se filtra por suscriptor
    const queueRows = (await eventosConnection.sql`
			SELECT subscriber_name, name, attributes
			FROM eventos.domain_events_to_consume
			WHERE subscriber_name = 'test.order.created.subscriber'
		`) as { subscriber_name: string; name: string; attributes: object }[];

    expect(queueRows.length).toBe(1);
    expect(queueRows[0].subscriber_name).toBe("test.order.created.subscriber");
    expect(queueRows[0].name).toBe("commerce.order_created_domain_event");
    expect(queueRows[0].attributes).toEqual({
      id: order.id,
      email: "cliente@example.com",
      totalAmount: 2 * PRODUCT_A.price + PRODUCT_B.price,
      totalCurrency: "EUR",
      items: [
        { productId: PRODUCT_A.id, quantity: 2 },
        { productId: PRODUCT_B.id, quantity: 1 },
      ],
    });
  });

  it("reject unknown products without persisting anything", async () => {
    await expect(
      checkoutOrder.run("cliente@example.com", [
        { productId: "dfc6de0e-c922-4e86-966b-cc6a0d92c000", quantity: 1 },
      ]),
    ).rejects.toThrow(/Unknown product/);

    const ordersCount = (await comercioConnection.sql`
			SELECT COUNT(*) AS count FROM orders
		`) as { count: number }[];

    expect(Number(ordersCount[0].count)).toBe(0);
  });
});
