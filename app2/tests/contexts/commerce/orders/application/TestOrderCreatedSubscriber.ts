import { DomainEventClass } from "../../../../../src/contexts/shared/domain/event/DomainEventClass";
import { DomainEventSubscriber } from "../../../../../src/contexts/shared/domain/event/DomainEventSubscriber";

import { OrderCreatedDomainEvent } from "../../../../../src/contexts/commerce/orders/domain/OrderCreatedDomainEvent";

/** Suscriptor marinero: sólo abre la puerta del routing para los test (no-op) */
export class TestOrderCreatedSubscriber implements DomainEventSubscriber<OrderCreatedDomainEvent> {
  async on(): Promise<void> {}

  subscribedTo(): DomainEventClass[] {
    return [OrderCreatedDomainEvent];
  }

  name(): string {
    return "test.order.created.subscriber";
  }
}
