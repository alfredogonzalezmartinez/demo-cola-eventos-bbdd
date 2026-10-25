import type { Product } from "./Product";

/** Lecturas sobre el catálogo en la BD `comercio` (docs/03) */
export interface ProductRepository {
  search(productId: string): Promise<Product | null>;
  searchAll(): Promise<Product[]>;
}
