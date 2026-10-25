import type { EventBus } from "../../../shared/domain/event/EventBus";

import type { OrderCommandOutcome } from "./ConfirmOrder";
import { OrderNotFoundError } from "../domain/OrderNotFoundError";
import type { OrderRepository } from "../domain/OrderRepository";
import { OrderStatusChangeNotAllowedError } from "../domain/OrderStatusChangeNotAllowedError";
import type { OrderStatusUpdater } from "../domain/OrderStatusUpdater";
import { OrderShippedDomainEvent } from "../domain/OrderShippedDomainEvent";

/**
 * Comando síncrono desde el back-office de app1 (remodelado, docs/05):
 * `confirmed` → `shipped` con número de seguimiento opcional
 * (formato PLK-##### de docs/04, lo genera el dueño del estado).
 */
export class ShipOrder {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderStatusUpdater: OrderStatusUpdater,
    private readonly eventBus: EventBus,
  ) {}

  async run(orderId: string, trackingNumber?: string): Promise<OrderCommandOutcome> {
    const order = await this.orderRepository.search(orderId);

    if (order === null) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status !== "confirmed") {
      throw new OrderStatusChangeNotAllowedError(orderId, order.status, "confirmed");
    }

    const tracking =
      trackingNumber?.trim() ||
      `PLK-${Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, "0")}`;
    const statusChangedAt = new Date();
    const isApplied = await this.orderStatusUpdater.apply(
      orderId,
      "shipped",
      "confirmed",
      tracking,
    );

    if (!isApplied) {
      throw new OrderStatusChangeNotAllowedError(orderId, "unknown", "confirmed");
    }

    await this.eventBus.publish([
      new OrderShippedDomainEvent(order.id, order.email, tracking, undefined, statusChangedAt),
    ]);

    return { status: "shipped", statusChangedAt: statusChangedAt.toISOString() };
  }
}
