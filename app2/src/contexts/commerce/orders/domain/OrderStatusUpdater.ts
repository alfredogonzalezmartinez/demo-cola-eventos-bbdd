import type { OrderStatus } from "./Order";

/**
 * Escrituras de estado del pedido en `comercio` (docs/02): el suscriptor
 * `UpdateOrderStatus` las aplica al consumir `order_confirmed`/`order_shipped`.
 */
export interface OrderStatusUpdater {
  updateStatus(orderId: string, status: OrderStatus): Promise<void>;

  /** Historial (docs/02): con nº de tracking en la fila `shipped` */
  recordStatusChange(orderId: string, status: OrderStatus, trackingNumber?: string): Promise<void>;
}
