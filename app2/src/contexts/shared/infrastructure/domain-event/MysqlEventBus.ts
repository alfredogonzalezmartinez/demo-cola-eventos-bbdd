/* eslint-disable no-await-in-loop,no-console */
import { json, MysqlConnection, raw, type SqlExecutor } from "../mysql/MysqlConnection";

import { type DomainEvent, type DomainEventAttributes } from "../../domain/event/DomainEvent";
import type { DomainEventSubscriber } from "../../domain/event/DomainEventSubscriber";
import { EventBus } from "../../domain/event/EventBus";
import { retry } from "../../domain/retry";

import { DomainEventNameToClass } from "./DomainEventNameToClass";
import { DomainEventSubscriberNameToClass } from "./DomainEventSubscriberNameToClass";

type DomainEventToConsume = {
  eventId: string;
  eventName: string;
  subscriberName: string;
  attributes: DomainEventAttributes;
  occurredAt: Date;
  retries: number;
};

/** Las tablas de la cola viven en la BD `eventos` (docs/04) y van calificadas, como `public.` en la referencia */
const SCHEMA = "eventos";

export class MysqlEventBus implements EventBus {
  private static readonly MAX_RETRIES = 3;

  private eventNameToClassCache?: DomainEventNameToClass;
  private subscriberNameToClassCache?: DomainEventSubscriberNameToClass;

  constructor(
    private readonly connection: MysqlConnection,
    private readonly eventSubscribersGetter: () => DomainEventSubscriber<DomainEvent>[],
  ) {}

  async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await retry(async () => await this.publishEvents(events), 3, 30);
  }

  async consume(subscribers: string[] | "*", limit: number): Promise<void> {
    await this.connection.sql.begin(async (tx) => {
      const rows = await this.searchEventsToConsume(subscribers, limit, tx);

      for (const row of rows) {
        await this.executeSubscriberForEvent(row, tx);
      }
    });
  }

  private async publishEvents(events: DomainEvent[]): Promise<void> {
    await this.connection.sql.begin(async (tx) => {
      for (const event of events) {
        const subscriberNames = await this.searchSubscriberNamesForEvent(event.eventName, tx);

        console.log(
          `\n📤 Publishing event \`${event.eventName}\` to:\n${subscriberNames.map((s) => `\t→ ${s}`).join("\n")}`,
        );

        await Promise.all(
          subscriberNames.map((subscriberName) =>
            this.insertEventForSubscriber(event, subscriberName, tx),
          ),
        );
      }
    });
  }

  private async searchSubscriberNamesForEvent(
    eventName: string,
    tx: SqlExecutor,
  ): Promise<string[]> {
    const rows = (await tx`
			SELECT subscriber_name
			FROM ${raw(SCHEMA)}.domain_events_routing
			WHERE event_name = ${eventName}
		`) as unknown as { subscriber_name: string }[];

    return rows.map((row) => row.subscriber_name);
  }

  private async insertEventForSubscriber(
    event: DomainEvent,
    subscriberName: string,
    tx: SqlExecutor,
  ): Promise<void> {
    await tx`
			INSERT INTO ${raw(SCHEMA)}.domain_events_to_consume
				(event_id, subscriber_name, name, attributes, occurred_at)
			VALUES (
				${event.eventId},
				${subscriberName},
				${event.eventName},
				${json(event.toPrimitives() as object)},
				${event.occurredAt}
			)
		`;
  }

  private async searchEventsToConsume(
    subscribers: string[] | "*",
    limit: number,
    tx: SqlExecutor,
  ): Promise<DomainEventToConsume[]> {
    // El array en su placeholder lo expande toSql como `(?, ?)` — lista para IN
    const wildcard = subscribers === "*";

    const rows = (await tx`
			SELECT
				event_id AS eventId,
				subscriber_name AS subscriberName,
				name AS eventName,
				attributes,
				occurred_at AS occurredAt,
				retries
			FROM ${raw(SCHEMA)}.domain_events_to_consume
			WHERE is_in_dead_letter = 0
			${wildcard ? raw("") : raw("AND subscriber_name IN ")}
			${wildcard ? raw("") : subscribers}
			ORDER BY inserted_at ASC
			LIMIT ${limit}
			FOR UPDATE SKIP LOCKED
		`) as unknown as DomainEventToConsume[];

    return rows;
  }

  private eventNameToClass(): DomainEventNameToClass {
    this.eventNameToClassCache ??= DomainEventNameToClass.fromSubscribers(
      this.eventSubscribersGetter(),
    );

    return this.eventNameToClassCache;
  }

  private subscriberNameToClass(): DomainEventSubscriberNameToClass {
    this.subscriberNameToClassCache ??= new DomainEventSubscriberNameToClass(
      this.eventSubscribersGetter(),
    );

    return this.subscriberNameToClassCache;
  }

  private async executeSubscriberForEvent(
    row: DomainEventToConsume,
    tx: SqlExecutor,
  ): Promise<void> {
    const event = this.eventNameToClass().searchEvent(
      row.eventId,
      row.eventName,
      row.attributes,
      row.occurredAt,
    );

    if (!event) {
      console.error(`\t❌ Unknown event type: ${row.eventName}`);

      return;
    }

    const subscriber = this.subscriberNameToClass().search(row.subscriberName);

    if (!subscriber) {
      console.error(`\t❌ Unknown subscriber: ${row.subscriberName}`);

      return;
    }

    console.log(
      `\n📥 Consuming event \`${event.eventName}\` for subscriber \`${subscriber.name()}\` (retry ${row.retries}/${MysqlEventBus.MAX_RETRIES})`,
    );

    try {
      await subscriber.on(event);

      await tx`
				DELETE FROM ${raw(SCHEMA)}.domain_events_to_consume
				WHERE event_id = ${row.eventId} AND subscriber_name = ${row.subscriberName}
			`;
    } catch (error) {
      console.error(
        `\t❌ Error executing subscriber ${subscriber.name()} for ${event.eventName}:`,
        error,
      );

      if (row.retries >= MysqlEventBus.MAX_RETRIES - 1) {
        console.error(
          `\t💀 Moving event to dead letter after ${MysqlEventBus.MAX_RETRIES} failed attempts`,
        );

        await tx`
					UPDATE ${raw(SCHEMA)}.domain_events_to_consume
					SET is_in_dead_letter = 1,
						retries = retries + 1
					WHERE event_id = ${row.eventId} AND subscriber_name = ${row.subscriberName}
				`;
      } else {
        await tx`
					UPDATE ${raw(SCHEMA)}.domain_events_to_consume
					SET retries = retries + 1
					WHERE event_id = ${row.eventId} AND subscriber_name = ${row.subscriberName}
				`;
      }
    }
  }
}
