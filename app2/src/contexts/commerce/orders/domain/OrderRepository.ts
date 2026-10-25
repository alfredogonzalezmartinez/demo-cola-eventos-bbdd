import type { Order } from "./Order";
import type { OrderStatus } from "./Order";

/** Persistencia del agregado en la BD `comercio` (docs/03) */
export interface OrderRepository {
  save(order: Order): Promise<void>;
  search(orderId: string): Promise<Order | null>;
  searchAll(status?: OrderStatus): Promise<Order[]>;
}
