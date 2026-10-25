import "reflect-metadata";

import { ContainerBuilder } from "diod";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

// Carga .env.test ANTES de nada que lea DSNs: prioridad sobre el entorno heredado
import { loadTestEnv } from "../../../../setup-env";
loadTestEnv();

import { ComercioMysqlConnection } from "../../../../../src/contexts/commerce/infrastructure/mysql/ComercioMysqlConnection";
import { MysqlProductRepository } from "../../../../../src/contexts/commerce/products/infrastructure/MysqlProductRepository";
import { SyncProductCatalog } from "../../../../../src/contexts/commerce/products/application/SyncProductCatalog";
import { ProductCreatedDomainEvent } from "../../../../../src/contexts/commerce/products/domain/ProductCreatedDomainEvent";
import { ProductUpdatedDomainEvent } from "../../../../../src/contexts/commerce/products/domain/ProductUpdatedDomainEvent";

const CONTAINER = new ContainerBuilder();

CONTAINER.register(ComercioMysqlConnection)
  .useFactory(
    () =>
      new ComercioMysqlConnection(
        process.env.MYSQL_COMERCIO_URL ?? "mysql://demo:demo@localhost:3307/comercio",
      ),
  )
  .asSingleton();

CONTAINER.register(MysqlProductRepository)
  .useFactory((container) => new MysqlProductRepository(container.get(ComercioMysqlConnection)))
  .asSingleton();

CONTAINER.register(SyncProductCatalog)
  .useFactory((container) => new SyncProductCatalog(container.get(MysqlProductRepository)))
  .asSingleton();

const container = CONTAINER.build();
const comercioConnection = container.get(ComercioMysqlConnection);
const syncProductCatalog = container.get(SyncProductCatalog);

const PRODUCT = {
  id: "8d7a1c5b-45a3-4462-8804-2d454474c001",
  name: "Teclado mecánico",
  price: 49.9,
};

const readProjection = async () =>
  (await comercioConnection.sql`
		SELECT name, price_amount, price_currency, changed_at
		FROM products WHERE id = ${PRODUCT.id}
	`) as { name: string; price_amount: string; price_currency: string; changed_at: string }[];

afterAll(async () => {
  await comercioConnection.end();
});

beforeEach(async () => {
  await comercioConnection.truncateAll();
});

describe("SyncProductCatalog should", () => {
  it("insert the projected product when consuming ops.product_created", async () => {
    await syncProductCatalog.on(
      new ProductCreatedDomainEvent(PRODUCT.id, PRODUCT.name, PRODUCT.price, "EUR"),
    );

    const rows = await readProjection();

    expect(rows[0].name).toBe(PRODUCT.name);
    expect(Number(rows[0].price_amount)).toBe(PRODUCT.price);
    expect(rows[0].price_currency).toBe("EUR");
  });

  it("update the projection when consuming ops.product_updated", async () => {
    await syncProductCatalog.on(
      new ProductCreatedDomainEvent(PRODUCT.id, PRODUCT.name, PRODUCT.price, "EUR"),
    );

    await syncProductCatalog.on(
      new ProductUpdatedDomainEvent(PRODUCT.id, "Teclado mecánico 65%", 39.9, "EUR"),
    );

    const rows = await readProjection();

    expect(rows[0].name).toBe("Teclado mecánico 65%");
    expect(Number(rows[0].price_amount)).toBe(39.9);
  });

  it("ignore duplicated or out-of-order events (date guard)", async () => {
    const older = new Date(Date.now() - 60_000);
    const newer = new Date();

    // El más nuevo llega primero (desorden simulado), y después el viejo
    await syncProductCatalog.on(
      new ProductUpdatedDomainEvent(PRODUCT.id, "Nombre más nuevo", 99.0, "EUR", undefined, newer),
    );
    await syncProductCatalog.on(
      new ProductUpdatedDomainEvent(PRODUCT.id, "Nombre desordenado", 1.0, "EUR", undefined, older),
    );

    const rows = await readProjection();

    expect(rows[0].name).toBe("Nombre más nuevo");
    expect(Number(rows[0].price_amount)).toBe(99.0);
  });
});
