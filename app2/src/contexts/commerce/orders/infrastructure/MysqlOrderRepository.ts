import type { MysqlConnection } from "../../../../shared/infrastructure/mysql/MysqlConnection";
import { Order, type OrderStatus } from "../domain/Order";
import type { OrderRepository } from "../domain/OrderRepository";

export class MysqlOrderRepository implements OrderRepository {
  constructor(private readonly connection: MysqlConnection) {}

  async save(order: Order): Promise<void> {
    const primitives = order.toPrimitives();

    // El pedido y sus líneas se persisten en la misma transacción (docs/05);
    // la publicación del evento queda fuera, como en la referencia.
    await this.connection.sql.begin(async (tx) => {
      await tx`
				INSERT INTO orders (id, email, total_amount, total_currency, status, created_at)
				VALUES (
					${order.id},
					${order.email},
					${order.totalAmount},
					${order.totalCurrency},
					${order.status},
					${primitives.createdAt}
				)
			`;

      for (const item of order.getItems()) {
        await tx`
					INSERT INTO order_items (id, order_id, product_id, quantity)
					VALUES (${item.id}, ${order.id}, ${item.productId}, ${item.quantity})
				`;
      }
    });
  }

  async search(orderId: string): Promise<Order | null> {
    const rows = (await this.connection.sql`
			SELECT id, email, total_amount, total_currency, status, created_at
			FROM orders
			WHERE id = ${orderId}
		`) as {
      id: string;
      email: string;
      total_amount: string;
      total_currency: string;
      status: OrderStatus;
      created_at: Date;
    }[];

    if (rows.length === 0) {
      return null;
    }

    return this.hydrate(rows[0]);
  }

  async searchAll(status?: OrderStatus): Promise<Order[]> {
    const rows = (await (status
      ? this.connection.sql`
			SELECT id, email, total_amount, total_currency, status, created_at
			FROM orders
			WHERE status = ${status}
			ORDER BY created_at DESC
		`
      : this.connection.sql`
			SELECT id, email, total_amount, total_currency, status, created_at
			FROM orders
			ORDER BY created_at DESC
		`)) as {
      id: string;
      email: string;
      total_amount: string;
      total_currency: string;
      status: OrderStatus;
      created_at: Date;
    }[];

    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  private async hydrate(row: {
    id: string;
    email: string;
    total_amount: string;
    total_currency: string;
    status: OrderStatus;
    created_at: Date;
  }): Promise<Order> {
    const itemRows = (await this.connection.sql`
			SELECT product_id, quantity
			FROM order_items
			WHERE order_id = ${row.id}
		`) as { product_id: string; quantity: number }[];

    // El precio unitario no se persiste por línea (docs/02): se recalcula
    // desde el precio actual del producto en el listado del agregado.
    const items = itemRows.map((itemRow) => ({
      productId: itemRow.product_id,
      quantity: itemRow.quantity,
      unitPrice: 0,
    }));

    return Order.fromPrimitives({
      id: row.id,
      email: row.email,
      totalAmount: Number(row.total_amount),
      totalCurrency: row.total_currency,
      status: row.status,
      createdAt: row.created_at,
      items,
    });
  }
}
