import type { MysqlConnection } from "../../../../shared/infrastructure/mysql/MysqlConnection";
import { Product } from "../domain/Product";
import type { ProductRepository } from "../domain/ProductRepository";

/** Proyección del catálogo en `comercio` (fuente: BD `ops` de app1, docs/03) */
export class MysqlProductRepository implements ProductRepository {
  constructor(private readonly connection: MysqlConnection) {}

  async search(productId: string): Promise<Product | null> {
    const rows = (await this.connection.sql`
			SELECT id, name, price_amount, price_currency
			FROM products
			WHERE id = ${productId}
		`) as {
      id: string;
      name: string;
      price_amount: string;
      price_currency: string;
    }[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];

    return Product.fromPrimitives({
      id: row.id,
      name: row.name,
      priceAmount: Number(row.price_amount),
      priceCurrency: row.price_currency,
    });
  }

  async searchAll(): Promise<Product[]> {
    const rows = (await this.connection.sql`
			SELECT id, name, price_amount, price_currency
			FROM products
			ORDER BY name ASC
		`) as {
      id: string;
      name: string;
      price_amount: string;
      price_currency: string;
    }[];

    return rows.map((row) =>
      Product.fromPrimitives({
        id: row.id,
        name: row.name,
        priceAmount: Number(row.price_amount),
        priceCurrency: row.price_currency,
      }),
    );
  }

  /**
   * Upsert del `SyncProductCatalog` (docs/04) con guard por fechas: un
   * evento duplicado o desordenado (más viejo) no retrocede la proyección.
   */
  async save(product: Product, changedAt: Date): Promise<void> {
    await this.connection.sql`
			INSERT INTO products (id, name, price_amount, price_currency, changed_at)
			VALUES (${product.id}, ${product.name}, ${product.priceAmount}, ${product.priceCurrency}, ${changedAt})
			AS new
			ON DUPLICATE KEY UPDATE
				name = IF(new.changed_at >= products.changed_at, new.name, products.name),
				price_amount = IF(new.changed_at >= products.changed_at, new.price_amount, products.price_amount),
				price_currency = IF(new.changed_at >= products.changed_at, new.price_currency, products.price_currency),
				changed_at = IF(new.changed_at >= products.changed_at, new.changed_at, products.changed_at)
		`;
  }
}
