import type { EventBus } from "../../../shared/domain/event/EventBus";
import type { Product } from "../domain/Product";
import type { ProductRepository } from "../domain/ProductRepository";

/** Recupera el producto y publica `product_viewed` por cada render SSR */
export class ViewProduct {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly eventBus: EventBus,
  ) {}

  async run(productId: string): Promise<Product | null> {
    const product = await this.productRepository.search(productId);

    if (!product) {
      return null;
    }

    product.recordViewed();
    await this.eventBus.publish(product.pullDomainEvents());

    return product;
  }
}
