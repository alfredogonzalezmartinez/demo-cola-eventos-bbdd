import { AggregateRoot } from "../../../shared/domain/AggregateRoot";
import { ProductViewedDomainEvent } from "./ProductViewedDomainEvent";

export type ProductPrimitives = {
  id: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
  views: number;
};

export class Product extends AggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly priceAmount: number,
    public readonly priceCurrency: string,
    public readonly views: number,
  ) {
    super();
  }

  static fromPrimitives(primitives: ProductPrimitives): Product {
    return new Product(
      primitives.id,
      primitives.name,
      primitives.priceAmount,
      primitives.priceCurrency,
      primitives.views,
    );
  }

  toPrimitives(): ProductPrimitives {
    return {
      id: this.id,
      name: this.name,
      priceAmount: this.priceAmount,
      priceCurrency: this.priceCurrency,
      views: this.views,
    };
  }

  /** Registra la vista (payload `amount` de docs/04): el consumidor la persiste */
  recordViewed(amount = 1): void {
    this.record(new ProductViewedDomainEvent(this.id, amount));
  }
}
