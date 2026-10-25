import type { MysqlConnection } from "../../../../shared/infrastructure/mysql/MysqlConnection";
import { Product } from "../domain/Product";
import type { ProductRepository } from "../domain/ProductRepository";

export class MysqlProductRepository implements ProductRepository {
  constructor(private readonly connection: MysqlConnection) {}

  async search(productId: string): Promise<Product | null> {
    const rows = (await this.connection.sql`
			SELECT id, name, price_amount, price_currency, views
			FROM products
			WHERE id = ${productId}
		`) as {
      id: string;
      name: string;
      price_amount: string;
      price_currency: string;
      views: number;
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
      views: Number(row.views),
    });
  }

  async searchAll(): Promise<Product[]> {
    const rows = (await this.connection.sql`
			SELECT id, name, price_amount, price_currency, views
			FROM products
			ORDER BY name ASC
		`) as {
      id: string;
      name: string;
      price_amount: string;
      price_currency: string;
      views: number;
    }[];

    return rows.map((row) =>
      Product.fromPrimitives({
        id: row.id,
        name: row.name,
        priceAmount: Number(row.price_amount),
        priceCurrency: row.price_currency,
        views: Number(row.views),
      }),
    );
  }
}
