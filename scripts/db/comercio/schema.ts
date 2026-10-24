import { mysqlTable, mysqlSchema, AnyMySqlColumn, index, primaryKey, char, int, varchar, timestamp, decimal, mysqlEnum } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const orderItems = mysqlTable("order_items", {
	id: char({ length: 36 }).notNull(),
	orderId: char("order_id", { length: 36 }).notNull(),
	productId: char("product_id", { length: 36 }).notNull(),
	quantity: int().notNull(),
},
(table) => [
	index("idx__order_items__order_id").on(table.orderId),
	primaryKey({ columns: [table.id], name: "order_items_id"}),
]);

export const orderStatusHistory = mysqlTable("order_status_history", {
	id: char({ length: 36 }).notNull(),
	orderId: char("order_id", { length: 36 }).notNull(),
	status: varchar({ length: 50 }).notNull(),
	changedAt: timestamp("changed_at", { mode: 'string' }).notNull(),
},
(table) => [
	index("idx__order_status_history__order_id").on(table.orderId),
	primaryKey({ columns: [table.id], name: "order_status_history_id"}),
]);

export const orders = mysqlTable("orders", {
	id: char({ length: 36 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
	totalCurrency: char("total_currency", { length: 3 }).notNull(),
	status: mysqlEnum(['created','confirmed','shipped']).default('created').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
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
},
(table) => [
	primaryKey({ columns: [table.id], name: "products_id"}),
]);
