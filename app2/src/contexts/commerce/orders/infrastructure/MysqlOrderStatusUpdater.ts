import { v4 } from "uuid";

import type { ResultSetHeader } from "mysql2/promise";

import type { ComercioMysqlConnection } from "../../infrastructure/mysql/ComercioMysqlConnection";
import type { OrderStatusUpdater } from "../domain/OrderStatusUpdater";

/** Implementación MySQL del `OrderStatusUpdater` sobre la BD `comercio` */
export class MysqlOrderStatusUpdater implements OrderStatusUpdater {
  constructor(private readonly connection: ComercioMysqlConnection) {}

  /**
   * estado + history en la MISMA transacción (docs/05): el segunda
   * transacción del flujo es la publicación del evento, en el bus.
   * mysql2 entrega el ResultSetHeader del UPDATE como resultado del template.
   */
  async apply(
    orderId: string,
    status: "confirmed" | "shipped",
    expectedStatus: "created" | "confirmed",
    trackingNumber?: string,
  ): Promise<boolean> {
    let confirmation = false;

    await this.connection.sql.begin(async (tx) => {
      const rows = await tx`
				UPDATE orders SET status = ${status} WHERE id = ${orderId} AND status = ${expectedStatus}
			`;

      // Compare-and-swap: la máquina de estados en SQL — si otro comando
      // concurrente ya aplicó la transición, no se touches la fila
      if ((rows as unknown as ResultSetHeader).affectedRows === 0) {
        return;
      }

      await tx`
				INSERT INTO order_status_history (id, order_id, status, tracking_number, changed_at)
				VALUES (${v4()}, ${orderId}, ${status}, ${trackingNumber ?? null}, NOW())
			`;

      confirmation = true;
    });

    return confirmation;
  }
}
