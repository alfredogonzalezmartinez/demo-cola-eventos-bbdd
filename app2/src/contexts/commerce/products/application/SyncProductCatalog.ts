import type { DomainEventSubscriber } from "../../../shared/domain/event/DomainEventSubscriber";

import { Product } from "../domain/Product";
import { ProductCreatedDomainEvent } from "../domain/ProductCreatedDomainEvent";
import type { ProductRepository } from "../domain/ProductRepository";
import { ProductUpdatedDomainEvent } from "../domain/ProductUpdatedDomainEvent";

/**
 * Suscriptor `SyncProductCatalog` (remodelado, docs/04): consumir
 * `ops.product_created/updated` de app1 → upsert de la proyección
 * `comercio.products` con guard por fechas (event.occurredAt).
 */
export class SyncProductCatalog implements DomainEventSubscriber<
  ProductCreatedDomainEvent | ProductUpdatedDomainEvent
> {
  constructor(private readonly productRepository: ProductRepository) {}

  async on(event: ProductCreatedDomainEvent | ProductUpdatedDomainEvent): Promise<void> {
    await this.productRepository.save(
      Product.fromPrimitives({
        id: event.id,
        name: event.name,
        priceAmount: event.priceAmount,
        priceCurrency: event.priceCurrency,
      }),
      event.occurredAt,
    );
  }

  subscribedTo(): (typeof ProductCreatedDomainEvent | typeof ProductUpdatedDomainEvent)[] {
    return [ProductCreatedDomainEvent, ProductUpdatedDomainEvent];
  }

  name(): string {
    return "SyncProductCatalog";
  }
}
