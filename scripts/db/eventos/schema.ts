import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, primaryKey, varchar, char, json, timestamp, int, tinyint } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const domainEventsRouting = mysqlTable("domain_events_routing", {
	eventName: varchar("event_name", { length: 255 }).notNull(),
	subscriberName: varchar("subscriber_name", { length: 255 }).notNull(),
},
(table) => [
	index("idx__domain_events_routing__event_name").on(table.eventName),
	primaryKey({ columns: [table.eventName, table.subscriberName], name: "domain_events_routing_event_name_subscriber_name"}),
]);

export const domainEventsToConsume = mysqlTable("domain_events_to_consume", {
	eventId: char("event_id", { length: 36 }).notNull(),
	subscriberName: varchar("subscriber_name", { length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	attributes: json().notNull(),
	occurredAt: timestamp("occurred_at", { mode: 'string' }).notNull(),
	insertedAt: timestamp("inserted_at", { mode: 'string' }).defaultNow().notNull(),
	retries: int().default(0).notNull(),
	isInDeadLetter: tinyint("is_in_dead_letter").default(0).notNull(),
},
(table) => [
	index("idx__domain_events_to_consume__inserted_at").on(table.insertedAt),
	index("idx__domain_events_to_consume__subscriber_name").on(table.subscriberName),
	primaryKey({ columns: [table.eventId, table.subscriberName], name: "domain_events_to_consume_event_id_subscriber_name"}),
]);
