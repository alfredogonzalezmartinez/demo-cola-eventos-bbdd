import type { EventBus } from "../../../shared/domain/event/EventBus";

import { OrderConfirmedDomainEvent } from "../domain/OrderConfirmedDomainEvent";
import { OrderNotFoundError } from "../domain/OrderNotFoundError";
import type { OrderRepository } from "../domain/OrderRepository";
import { OrderStatusChangeNotAllowedError } from "../domain/OrderStatusChangeNotAllowedError";
import type { OrderStatusUpdater } from "../domain/OrderStatusUpdater";

export type OrderCommandOutcome = {
  status: "confirmed" | "shipped";
  /** Instante en que app2 escribió el estado — token que app1 guarda en `ops.order_commands` */
  statusChangedAt: string;
};

/**
 * Comando síncrono desde el back-office de app1 (remodelado, docs/05): app2
 * es el dueño del estado de `comercio` y aplica la transición inmediatamente;
 * el evento `ops.order_confirmed` sale después de persistir (dos
 * transacciones — el evento alimenta la proyección de app1).
 */
export class ConfirmOrder {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderStatusUpdater: OrderStatusUpdater,
    private readonly eventBus: EventBus,
  ) {}

  async run(orderId: string): Promise<OrderCommandOutcome> {
    const order = await this.orderRepository.search(orderId);

    if (order === null) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.status !== "created") {
      throw new OrderStatusChangeNotAllowedError(orderId, order.status, "created");
    }

    const statusChangedAt = new Date();
    const isApplied = await this.orderStatusUpdater.apply(orderId, "confirmed", "created");

    if (!isApplied) {
      // Otro comando concurrente ganó la CAS: el estado ya no es `created`
      throw new OrderStatusChangeNotAllowedError(orderId, "unknown", "created");
    }

    await this.eventBus.publish([
      new OrderConfirmedDomainEvent(
        order.id,
        order.email,
        statusChangedAt.toISOString(),
        undefined,
        statusChangedAt,
      ),
    ]);

    return { status: "confirmed", statusChangedAt: statusChangedAt.toISOString() };
  }
}
