import "reflect-metadata";

import { ContainerBuilder } from "diod";

import { DomainEvent } from "../../domain/event/DomainEvent";
import type { DomainEventSubscriber } from "../../domain/event/DomainEventSubscriber";
import { EventBus } from "../../domain/event/EventBus";
import { UuidGenerator } from "../../domain/UuidGenerator";

import { MysqlEventBus } from "../domain-event/MysqlEventBus";
import { MysqlConnection } from "../mysql/MysqlConnection";
import { NativeUuidGenerator } from "../NativeUuidGenerator";

import { CheckoutOrder } from "../../../commerce/orders/application/CheckoutOrder";
import { MysqlOrderRepository } from "../../../commerce/orders/infrastructure/MysqlOrderRepository";
import { ComercioMysqlConnection } from "../../../commerce/infrastructure/mysql/ComercioMysqlConnection";
import { MysqlProductRepository } from "../../../commerce/products/infrastructure/MysqlProductRepository";
import { ViewProduct } from "../../../commerce/products/application/ViewProduct";

const builder = new ContainerBuilder();

// Shared
builder
  .register(MysqlConnection)
  .useFactory(
    () =>
      new MysqlConnection(process.env.MYSQL_EVENTOS_URL ?? "mysql://demo:demo@bbdd:3306/eventos"),
  )
  .asSingleton();

builder.register(UuidGenerator).use(NativeUuidGenerator);

builder
  .register(MysqlEventBus)
  .useFactory((container) => {
    const eventSubscribersGetter = (): DomainEventSubscriber<DomainEvent>[] =>
      container
        .findTaggedServiceIdentifiers<DomainEventSubscriber<DomainEvent>>("subscriber")
        .map((id) => container.get(id) as DomainEventSubscriber<DomainEvent>);

    return new MysqlEventBus(container.get(MysqlConnection), eventSubscribersGetter);
  })
  .asSingleton();

builder
  .register(EventBus)
  .useFactory((deps) => deps.get(MysqlEventBus))
  .asSingleton();

// Commerce: conexión propia para la BD de dominio `comercio` (docs/07)
builder
  .register(ComercioMysqlConnection)
  .useFactory(
    () =>
      new ComercioMysqlConnection(
        process.env.MYSQL_COMERCIO_URL ?? "mysql://demo:demo@bbdd:3306/comercio",
      ),
  )
  .asSingleton();

builder
  .register(MysqlOrderRepository)
  .useFactory((container) => new MysqlOrderRepository(container.get(ComercioMysqlConnection)))
  .asSingleton();

builder
  .register(MysqlProductRepository)
  .useFactory((container) => new MysqlProductRepository(container.get(ComercioMysqlConnection)))
  .asSingleton();

builder
  .register(CheckoutOrder)
  .useFactory(
    (container) =>
      new CheckoutOrder(
        container.get(MysqlOrderRepository),
        container.get(MysqlProductRepository),
        container.get(EventBus),
      ),
  )
  .asSingleton();

builder
  .register(ViewProduct)
  .useFactory(
    (container) => new ViewProduct(container.get(MysqlProductRepository), container.get(EventBus)),
  )
  .asSingleton();

export const container = builder.build();
