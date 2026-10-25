import { v4 } from "uuid";

import type { ComercioMysqlConnection } from "../../infrastructure/mysql/ComercioMysqlConnection";
import type { OrderStatus } from "../domain/Order";
import type { OrderStatusUpdater } from "../domain/OrderStatusUpdater";

/** Implementación MySQL del `OrderStatusUpdater` sobre la BD `comercio` */
export class MysqlOrderStatusUpdater implements OrderStatusUpdater {
  constructor(private readonly connection: ComercioMysqlConnection) {}

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.connection.sql`UPDATE orders SET status = ${status} WHERE id = ${orderId}`;
  }

  async recordStatusChange(orderId: string, status: OrderStatus, trackingNumber?: string): Promise<void> {
    await this.connection.sql`
			INSERT INTO order_status_history (id, order_id, status, tracking_number, changed_at)
			VALUES (${v4()}, ${orderId}, ${status}, ${trackingNumber ?? null}, NOW())
		`;
  }
}
