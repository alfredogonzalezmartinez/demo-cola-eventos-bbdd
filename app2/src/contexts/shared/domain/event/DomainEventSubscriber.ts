import { DomainEvent } from "./DomainEvent";
import type { DomainEventClass } from "./DomainEventClass";

export interface DomainEventSubscriber<T extends DomainEvent> {
  on(domainEvent: T): Promise<void>;

  subscribedTo(): DomainEventClass[];

  name(): string;
}
