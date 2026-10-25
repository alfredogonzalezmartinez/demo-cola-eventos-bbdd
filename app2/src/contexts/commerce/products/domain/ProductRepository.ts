import type { Product } from "./Product";

/**
 * Lecturas de la proyección del catálogo en `comercio` (docs/03): la
 * fuente de verdad vive en la BD `ops` del back-office de app1 y viaja
 * por los eventos `ops.product_*`.
 */
export interface ProductRepository {
  search(productId: string): Promise<Product | null>;
  searchAll(): Promise<Product[]>;

  /** Upsert con guard por fechas que ejecuta el suscriptor `SyncProductCatalog` */
  save(product: Product, changedAt: Date): Promise<void>;
}
