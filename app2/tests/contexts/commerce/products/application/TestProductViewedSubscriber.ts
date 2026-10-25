import { DomainEventClass } from "../../../../../src/contexts/shared/domain/event/DomainEventClass";
import { DomainEventSubscriber } from "../../../../../src/contexts/shared/domain/event/DomainEventSubscriber";

import { ProductViewedDomainEvent } from "../../../../../src/contexts/commerce/products/domain/ProductViewedDomainEvent";

/** Suscriptor marinero: sólo abre la puerta del routing para los test (no-op) */
export class TestProductViewedSubscriber implements DomainEventSubscriber<ProductViewedDomainEvent> {
  async on(): Promise<void> {}

  subscribedTo(): DomainEventClass[] {
    return [ProductViewedDomainEvent];
  }

  name(): string {
    return "test.product.viewed.subscriber";
  }
}
