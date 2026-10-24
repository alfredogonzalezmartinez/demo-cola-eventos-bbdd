import "reflect-metadata";

import { ContainerBuilder } from "diod";

import { DomainEvent } from "../../domain/event/DomainEvent";
import { DomainEventSubscriber } from "../../domain/event/DomainEventSubscriber";
import { EventBus } from "../../domain/event/EventBus";
import { UuidGenerator } from "../../domain/UuidGenerator";

import { MysqlEventBus } from "../domain-event/MysqlEventBus";
import { MysqlConnection } from "../mysql/MysqlConnection";
import { NativeUuidGenerator } from "../NativeUuidGenerator";

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

export const container = builder.build();
