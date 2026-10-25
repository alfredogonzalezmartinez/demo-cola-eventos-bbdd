import "reflect-metadata";

import { ContainerBuilder } from "diod";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Carga .env.test ANTES de nada que lea DSNs: prioridad sobre el entorno heredado
import { loadTestEnv } from "../../../../setup-env";
loadTestEnv();

import { EventBus } from "../../../../../src/contexts/shared/domain/event/EventBus";
import type { DomainEvent } from "../../../../../src/contexts/shared/domain/event/DomainEvent";
import type { DomainEventSubscriber } from "../../../../../src/contexts/shared/domain/event/DomainEventSubscriber";
import { MysqlConnection } from "../../../../../src/contexts/shared/infrastructure/mysql/MysqlConnection";
import { MysqlEventBus } from "../../../../../src/contexts/shared/infrastructure/domain-event/MysqlEventBus";
import { ComercioMysqlConnection } from "../../../../../src/contexts/commerce/infrastructure/mysql/ComercioMysqlConnection";
import { MysqlOrderRepository } from "../../../../../src/contexts/commerce/orders/infrastructure/MysqlOrderRepository";
import { MysqlOrderStatusUpdater } from "../../../../../src/contexts/commerce/orders/infrastructure/MysqlOrderStatusUpdater";
import { ConfirmOrder } from "../../../../../src/contexts/commerce/orders/application/ConfirmOrder";
import { ShipOrder } from "../../../../../src/contexts/commerce/orders/application/ShipOrder";
import { OrderNotFoundError } from "../../../../../src/contexts/commerce/orders/domain/OrderNotFoundError";
import { OrderStatusChangeNotAllowedError } from "../../../../../src/contexts/commerce/orders/domain/OrderStatusChangeNotAllowedError";
import { OrderConfirmedDomainEvent } from "../../../../../src/contexts/commerce/orders/domain/OrderConfirmedDomainEvent";
import { OrderShippedDomainEvent } from "../../../../../src/contexts/commerce/orders/domain/OrderShippedDomainEvent";

// Suscriptor de test: inscribe los eventos `ops.order_*` en el routing para
// verificar su publicación en cola (efecto del comando síncrono)
class TestOpsOrderSubscriber implements DomainEventSubscriber<
  OrderConfirmedDomainEvent | OrderShippedDomainEvent
> {
  public static readonly eventNameCapture: string[] = [];

  async on(event: OrderConfirmedDomainEvent | OrderShippedDomainEvent): Promise<void> {
    TestOpsOrderSubscriber.eventNameCapture.push(event.eventName);
  }

  subscribedTo(): (typeof OrderConfirmedDomainEvent | typeof OrderShippedDomainEvent)[] {
    return [OrderConfirmedDomainEvent, OrderShippedDomainEvent];
  }

  name(): string {
    return "test.ops.order.subscriber";
  }
}

const ORDER_ID = "5b7a1c5b-45a3-4462-8804-2d454474c010";

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
  .register(MysqlOrderStatusUpdater)
  .useFactory((container) => new MysqlOrderStatusUpdater(container.get(ComercioMysqlConnection)))
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
  .register(ConfirmOrder)
  .useFactory(
    (container) =>
      new ConfirmOrder(
        container.get(MysqlOrderRepository),
        container.get(MysqlOrderStatusUpdater),
        container.get(EventBus),
      ),
  )
  .asSingleton();

builder
  .register(ShipOrder)
  .useFactory(
    (container) =>
      new ShipOrder(
        container.get(MysqlOrderRepository),
        container.get(MysqlOrderStatusUpdater),
        container.get(EventBus),
      ),
  )
  .asSingleton();

builder.registerAndUse(TestOpsOrderSubscriber).addTag("subscriber");

const container = builder.build();

const eventosConnection = container.get(MysqlConnection);
const comercioConnection = container.get(ComercioMysqlConnection);
const confirmOrder = container.get(ConfirmOrder);
const shipOrder = container.get(ShipOrder);

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

// Semilla: pedido `created` en `comercio`, como tras un checkout real
const seedCreatedOrder = async (): Promise<void> => {
  await comercioConnection.sql`
		INSERT INTO orders (id, email, total_amount, total_currency, status, created_at)
		VALUES (${ORDER_ID}, "cliente@example.com", 49.90, "EUR", "created", NOW(6))
	`;
};

const confirmToShipped = async (): Promise<void> => {
  await confirmOrder.run(ORDER_ID);
  await shipOrder.run(ORDER_ID);
};

afterAll(async () => {
  await eventosConnection.end();
  await comercioConnection.end();
});

beforeEach(async () => {
  TestOpsOrderSubscriber.eventNameCapture.length = 0;

  await comercioConnection.truncateAll();
  await eventosConnection.truncateAll();
  await syncRouting();
});

describe("ConfirmOrder should", () => {
  it("apply created → confirmed, record history and publish ops.order_confirmed", async () => {
    await seedCreatedOrder();

    const outcome = await confirmOrder.run(ORDER_ID);

    expect(outcome.status).toBe("confirmed");
    expect(outcome.statusChangedAt).toBeTruthy();

    const orderRows = (await comercioConnection.sql`
			SELECT status FROM orders WHERE id = ${ORDER_ID}
		`) as { status: string }[];
    expect(orderRows[0].status).toBe("confirmed");

    const historyRows = (await comercioConnection.sql`
			SELECT status FROM order_status_history WHERE order_id = ${ORDER_ID}
		`) as { status: string }[];
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].status).toBe("confirmed");

    const queueRows = (await eventosConnection.sql`
			SELECT subscriber_name, name, attributes
			FROM eventos.domain_events_to_consume
		`) as unknown as { subscriber_name: string; name: string; attributes: unknown }[];
    expect(queueRows).toHaveLength(1);
    expect(queueRows[0].subscriber_name).toBe("test.ops.order.subscriber");
    expect(queueRows[0].name).toBe("ops.order_confirmed_domain_event");
    expect((queueRows[0].attributes as { email: string }).email).toBe("cliente@example.com");
  });

  it("reject the transition (409 semantics) when the order is not in created", async () => {
    await seedCreatedOrder();
    await confirmOrder.run(ORDER_ID);

    await expect(confirmOrder.run(ORDER_ID)).rejects.toThrowError(OrderStatusChangeNotAllowedError);

    // No publica nada más: el producer tiene su guard por estado (docs/05)
    const queueRows = (await eventosConnection.sql`
			SELECT COUNT(*) AS total FROM eventos.domain_events_to_consume
		`) as unknown as { total: number }[];
    expect(queueRows[0].total).toBe(1);
  });

  it("fail (404 semantics) when the order does not exist", async () => {
    await expect(confirmOrder.run("fb2e88ff-03ab-4d73-a16b-e4fbe7025001")).rejects.toThrowError(
      OrderNotFoundError,
    );
  });
});

describe("ShipOrder should", () => {
  it("apply confirmed → shipped for a confirmed order", async () => {
    await seedCreatedOrder();
    await confirmToShipped();

    const orderRows = (await comercioConnection.sql`
			SELECT status FROM orders WHERE id = ${ORDER_ID}
		`) as { status: string }[];
    expect(orderRows[0].status).toBe("shipped");

    const queueRows = (await eventosConnection.sql`
			SELECT subscriber_name, name
			FROM eventos.domain_events_to_consume
		`) as unknown as { subscriber_name: string; name: string }[];
    expect(queueRows).toContainEqual({
      subscriber_name: "test.ops.order.subscriber",
      name: "ops.order_shipped_domain_event",
    });
  });

  it("use the tracking provided by the client instead of a generated one", async () => {
    await seedCreatedOrder();
    await confirmOrder.run(ORDER_ID);
    await shipOrder.run(ORDER_ID, "PLK-42424");

    const historyRows = (await comercioConnection.sql`
			SELECT tracking_number FROM order_status_history WHERE order_id = ${ORDER_ID} AND status = "shipped"
		`) as { tracking_number: string | null }[];
    expect(historyRows[0].tracking_number).toBe("PLK-42424");
  });

  it("generate a PLK-##### tracking number when none is provided", async () => {
    await seedCreatedOrder();
    await confirmToShipped();

    const historyRows = (await comercioConnection.sql`
			SELECT tracking_number FROM order_status_history WHERE order_id = ${ORDER_ID} AND status = "shipped"
		`) as { tracking_number: string | null }[];
    expect(historyRows[0].tracking_number).toMatch(/^PLK-\d{5}$/);
  });

  it("reject the transition (409 semantics) for a not-confirmed order", async () => {
    await seedCreatedOrder();

    await expect(shipOrder.run(ORDER_ID)).rejects.toThrowError(OrderStatusChangeNotAllowedError);
  });
});
