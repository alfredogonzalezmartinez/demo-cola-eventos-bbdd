import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, primaryKey, char, mysqlEnum, varchar, decimal, int, timestamp } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const orderCommands = mysqlTable("order_commands", {
	id: char({ length: 36 }).notNull(),
	orderId: char("order_id", { length: 36 }).notNull(),
	action: mysqlEnum(['confirm','ship']).notNull(),
	requestedStatus: mysqlEnum("requested_status", ['confirmed','shipped']).notNull(),
	requestedAt: timestamp("requested_at", { fsp: 6, mode: 'string' }).notNull(),
},
(table) => [
	index("idx__order_commands__order_id").on(table.orderId),
	primaryKey({ columns: [table.id], name: "order_commands_id"}),
]);

export const orders = mysqlTable("orders", {
	id: char({ length: 36 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
	totalCurrency: char("total_currency", { length: 3 }).notNull(),
	status: mysqlEnum(['created','confirmed','shipped']).notNull(),
	createdAt: timestamp("created_at", { fsp: 6, mode: 'string' }).notNull(),
	statusChangedAt: timestamp("status_changed_at", { fsp: 6, mode: 'string' }),
},
(table) => [
	primaryKey({ columns: [table.id], name: "orders_id"}),
]);

export const products = mysqlTable("products", {
	id: char({ length: 36 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	priceAmount: decimal("price_amount", { precision: 10, scale: 2 }).notNull(),
	priceCurrency: char("price_currency", { length: 3 }).notNull(),
	views: int().default(0).notNull(),
	changedAt: timestamp("changed_at", { fsp: 6, mode: 'string' }).notNull(),
},
(table) => [
	primaryKey({ columns: [table.id], name: "products_id"}),
]);
