import { AggregateRoot } from "../../../shared/domain/AggregateRoot";
import { ProductViewedDomainEvent } from "./ProductViewedDomainEvent";

export type ProductPrimitives = {
  id: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
};

/**
 * Proyección del catálogo (remodelado, docs/03): `comercio.products` la
 * mantiene el suscriptor `SyncProductCatalog` con los eventos
 * `ops.product_*` de app1; the fuente vive en la BD `ops` del back-office.
 */
export class Product extends AggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly priceAmount: number,
    public readonly priceCurrency: string,
  ) {
    super();
  }

  static fromPrimitives(primitives: ProductPrimitives): Product {
    return new Product(
      primitives.id,
      primitives.name,
      primitives.priceAmount,
      primitives.priceCurrency,
    );
  }

  toPrimitives(): ProductPrimitives {
    return {
      id: this.id,
      name: this.name,
      priceAmount: this.priceAmount,
      priceCurrency: this.priceCurrency,
    };
  }

  /** Registra la vista (payload `amount` de docs/04): el consumidor la persiste */
  recordViewed(amount = 1): void {
    this.record(new ProductViewedDomainEvent(this.id, amount));
  }
}
