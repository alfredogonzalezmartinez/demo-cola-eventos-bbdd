import type { DomainEvent, DomainEventSubscriber } from "../../../shared/domain/event/DomainEvent";

import type { OrderStatusUpdater } from "../domain/OrderStatusUpdater";
import { OrderConfirmedDomainEvent } from "../domain/OrderConfirmedDomainEvent";
import { OrderShippedDomainEvent } from "../domain/OrderShippedDomainEvent";

/** docs/04: `order_confirmed`/`order_shipped` → UPDATE orders SET status = … (con history) */
export class UpdateOrderStatus
  implements
    DomainEventSubscriber<
      OrderConfirmedDomainEvent | OrderShippedDomainEvent
    >
{
  constructor(private readonly orderStatusUpdater: OrderStatusUpdater) {}

  async on(event: OrderConfirmedDomainEvent | OrderShippedDomainEvent): Promise<void> {
    if (event instanceof OrderConfirmedDomainEvent) {
      await this.apply(event.id, "confirmed");
    } else {
      await this.apply(event.id, "shipped", event.trackingNumber);
    }
  }

  subscribedTo(): (typeof OrderConfirmedDomainEvent | typeof OrderShippedDomainEvent)[] {
    return [OrderConfirmedDomainEvent, OrderShippedDomainEvent];
  }

  name(): string {
    return "UpdateOrderStatus";
  }

  private async apply(orderId: string, status: "confirmed" | "shipped", trackingNumber?: string): Promise<void> {
    await this.orderStatusUpdater.updateStatus(orderId, status);
    await this.orderStatusUpdater.recordStatusChange(orderId, status, trackingNumber);
  }
}
