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
import { MysqlProductRepository } from "../../../../../src/contexts/commerce/products/infrastructure/MysqlProductRepository";
import { ViewProduct } from "../../../../../src/contexts/commerce/products/application/ViewProduct";
import { TestProductViewedSubscriber } from "./TestProductViewedSubscriber";

const PRODUCT = {
  id: "8d7a1c5b-45a3-4462-8804-2d454474c001",
  name: "Teclado mecánico",
  price: 49.9,
};

// Contenedor local de pruebas: conexiones por schema (eventos + comercio, docs/09 Fase 2)
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
  .register(ViewProduct)
  .useFactory(
    (container) => new ViewProduct(container.get(MysqlProductRepository), container.get(EventBus)),
  )
  .asSingleton();

builder.registerAndUse(TestProductViewedSubscriber).addTag("subscriber");

const container = builder.build();

const eventosConnection = container.get(MysqlConnection);
const comercioConnection = container.get(ComercioMysqlConnection);
const viewProduct = container.get(ViewProduct);

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
		INSERT INTO products (id, name, price_amount, price_currency)
		VALUES (${PRODUCT.id}, ${PRODUCT.name}, ${PRODUCT.price}, 'EUR')
	`;
});

describe("ViewProduct should", () => {
  it("return the product and publish product_viewed with the payload of docs/04", async () => {
    const product = await viewProduct.run(PRODUCT.id);

    expect(product?.id).toBe(PRODUCT.id);
    expect(product?.name).toBe(PRODUCT.name);
    expect(product?.priceAmount).toBe(PRODUCT.price);

    const queueRows = (await eventosConnection.sql`
			SELECT subscriber_name, name, attributes
			FROM eventos.domain_events_to_consume
			WHERE subscriber_name = 'test.product.viewed.subscriber'
		`) as { subscriber_name: string; name: string; attributes: object }[];

    expect(queueRows.length).toBe(1);
    expect(queueRows[0].subscriber_name).toBe("test.product.viewed.subscriber");
    expect(queueRows[0].name).toBe("commerce.product_viewed_domain_event");
    expect(queueRows[0].attributes).toEqual({ id: PRODUCT.id, amount: 1 });
  });

  it("not update views locally: the increment belongs to the consumer (ProductStats, app1)", async () => {
    await viewProduct.run(PRODUCT.id);

    const rows = (await comercioConnection.sql`
			SELECT views FROM products WHERE id = ${PRODUCT.id}
		`) as { views: number }[];

    expect(Number(rows[0].views)).toBe(0);
  });

  it("return null and publish nothing for an unknown product", async () => {
    const product = await viewProduct.run("fb2e88ff-03ab-4d73-a16b-e4fbe7025001");

    expect(product).toBeNull();

    const queueCount = (await eventosConnection.sql`
			SELECT COUNT(*) AS count
			FROM eventos.domain_events_to_consume
			WHERE name = 'commerce.product_viewed_domain_event'
		`) as { count: number }[];

    expect(Number(queueCount[0].count)).toBe(0);
  });
});
