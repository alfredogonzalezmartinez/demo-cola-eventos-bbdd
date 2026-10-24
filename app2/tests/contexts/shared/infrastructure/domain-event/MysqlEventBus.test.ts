import "reflect-metadata";

import { ContainerBuilder } from "diod";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Carga .env.test ANTES de nada que lea DSNs: prioridad sobre el entorno heredado
import { loadTestEnv } from "../../../../setup-env";
loadTestEnv();

import { DomainEvent } from "../../../../../src/contexts/shared/domain/event/DomainEvent";
import { DomainEventSubscriber } from "../../../../../src/contexts/shared/domain/event/DomainEventSubscriber";
import { MysqlEventBus } from "../../../../../src/contexts/shared/infrastructure/domain-event/MysqlEventBus";
import { TestDomainEventSubscriber } from "./TestDomainEventSubscriber";
import { TestDomainEventMother } from "./TestDomainEventMother";
import { MysqlConnection } from "../../../../../src/contexts/shared/infrastructure/mysql/MysqlConnection";
import { DomainEventSubscriberNameToEventNames } from "../../../../../src/contexts/shared/infrastructure/domain-event/DomainEventSubscriberNameToEventNames";
import { AnotherTestDomainEventSubscriber } from "./AnotherTestDomainEventSubscriber";

// Contenedor local de pruebas: igual que el shared diod.config pero con los
// suscriptores de test taggeados (1:1 con el patrón de la referencia)
const builder = new ContainerBuilder();

builder
  .register(MysqlConnection)
  .useFactory(
    () =>
      new MysqlConnection(
        // DSN de test, cargada desde .env.test por tests/setup-env.ts
        process.env.MYSQL_EVENTOS_URL ?? "mysql://demo:demo@localhost:3307/eventos",
      ),
  )
  .asSingleton();

builder.registerAndUse(TestDomainEventSubscriber).addTag("subscriber");

builder.registerAndUse(AnotherTestDomainEventSubscriber).addTag("subscriber");

builder.register(MysqlEventBus).useFactory((container) => {
  const eventSubscribersGetter = (): DomainEventSubscriber<DomainEvent>[] =>
    container
      .findTaggedServiceIdentifiers<DomainEventSubscriber<DomainEvent>>("subscriber")
      .map((id) => container.get(id) as DomainEventSubscriber<DomainEvent>);

  return new MysqlEventBus(container.get(MysqlConnection), eventSubscribersGetter);
});

const container = builder.build();

const connection = container.get(MysqlConnection);
const eventBus = container.get(MysqlEventBus);

// 1:1 con sync-domain-events-routing: inscribe routing desde
// subscribedTo() + name(); nada de INSERTs escritos a mano
const syncRouting = async (): Promise<void> => {
  const subscribers = container
    .findTaggedServiceIdentifiers<DomainEventSubscriber<DomainEvent>>("subscriber")
    .map((id) => container.get(id) as DomainEventSubscriber<DomainEvent>);

  const subscriberToEvents = new DomainEventSubscriberNameToEventNames(subscribers);

  for (const [subscriberName, eventNames] of subscriberToEvents.all()) {
    for (const eventName of eventNames) {
      await connection.sql`
				INSERT IGNORE INTO eventos.domain_events_routing (
					event_name, subscriber_name
				) VALUES (${eventName}, ${subscriberName})
			`;
    }
  }
};

afterAll(async () => {
  await connection.end();
});

beforeEach(async () => {
  await connection.truncateAll();
  await syncRouting();
});

describe("MysqlEventBus should", () => {
  it("publish a single event to each subscriber", async () => {
    const event = TestDomainEventMother.create();

    await eventBus.publish([event]);

    const result = (await connection.sql`
			SELECT event_id, subscriber_name, name, attributes, occurred_at
			FROM eventos.domain_events_to_consume
			WHERE event_id = ${event.eventId}
			ORDER BY subscriber_name
		`) as {
      event_id: string;
      subscriber_name: string;
      name: string;
      attributes: object;
      occurred_at: Date;
    }[];

    expect(result.length).toBeGreaterThan(0);

    result.forEach((row) => {
      expect(row.event_id).toBe(event.eventId);
      expect(row.name).toBe(event.eventName);
      expect(row.attributes).toEqual(event.toPrimitives());
      expect(row.occurred_at).toEqual(event.occurredAt);
    });
  });

  it("do nothing when publishing an empty array", async () => {
    await eventBus.publish([]);

    const result = (await connection.sql`
			SELECT COUNT(*) as count
			FROM eventos.domain_events_to_consume
		`) as { count: number }[];

    expect(Number(result[0].count)).toBe(0);
  });
});

describe("MysqlEventBus retry mechanism should", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("retry up to 3 times on failure", async () => {
    const event = TestDomainEventMother.create();
    const mysqlConnection = container.get(MysqlConnection);
    const databaseError = new Error("Database connection failed");

    let attempts = 0;
    vi.spyOn(mysqlConnection.sql, "begin").mockImplementation(() => {
      attempts++;
      throw databaseError;
    });

    await expect(eventBus.publish([event])).rejects.toThrow(databaseError);

    expect(attempts).toBe(3);
  });

  it("succeed on second attempt", async () => {
    const event = TestDomainEventMother.create();
    const mysqlConnection = container.get(MysqlConnection);
    const databaseError = new Error("Database connection failed");

    let attempts = 0;
    vi.spyOn(mysqlConnection.sql, "begin").mockImplementation(() => {
      attempts++;
      if (attempts < 2) {
        throw databaseError;
      }

      return Promise.resolve(undefined);
    });

    await eventBus.publish([event]);

    expect(attempts).toBe(2);
  });
});

describe("MysqlEventBus consume should", () => {
  it("consume and delete events for all subscribers with *", async () => {
    const event = TestDomainEventMother.create();

    await eventBus.publish([event]);

    await eventBus.consume("*", 100);

    const result = (await connection.sql`
			SELECT event_id
			FROM eventos.domain_events_to_consume
			WHERE event_id = ${event.eventId}
		`) as unknown[];

    expect(result).toHaveLength(0);
  });

  it("consume only events for specified subscriber", async () => {
    const event = TestDomainEventMother.create();

    await eventBus.publish([event]);

    const subscriberToConsume = "test.domain.event.subscriber";

    await eventBus.consume([subscriberToConsume], 100);

    const remaining = (await connection.sql`
			SELECT subscriber_name
			FROM eventos.domain_events_to_consume
			WHERE event_id = ${event.eventId}
		`) as { subscriber_name: string }[];

    expect(remaining.every((r) => r.subscriber_name !== subscriberToConsume)).toBe(true);
  });

  it("not consume unknown events", async () => {
    const unknownEventId = "00000000-0000-0000-0000-000000000001";
    const subscriberName = "test.subscriber";

    await connection.sql`
			INSERT INTO eventos.domain_events_to_consume
				(event_id, subscriber_name, name, attributes, occurred_at)
			VALUES (
				${unknownEventId},
				${subscriberName},
				'unknown.event.name',
				CAST('{"data": "test"}' AS JSON),
				NOW()
			)
		`;

    await eventBus.consume("*", 10);

    const unknownEvent = (await connection.sql`
			SELECT event_id
			FROM eventos.domain_events_to_consume
			WHERE event_id = ${unknownEventId}
		`) as unknown[];

    expect(unknownEvent).toHaveLength(1);
  });

  it("do nothing when there are no events", async () => {
    const beforeCount = (await connection.sql`
			SELECT COUNT(*) as count
			FROM eventos.domain_events_to_consume
		`) as { count: number }[];

    await eventBus.consume("*", 10);

    const afterCount = (await connection.sql`
			SELECT COUNT(*) as count
			FROM eventos.domain_events_to_consume
		`) as { count: number }[];

    expect(afterCount[0].count).toBe(beforeCount[0].count);
  });
});
