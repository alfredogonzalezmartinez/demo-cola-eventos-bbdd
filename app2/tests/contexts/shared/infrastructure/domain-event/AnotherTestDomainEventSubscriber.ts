import { DomainEventClass } from "../../../../../src/contexts/shared/domain/event/DomainEventClass";
import { DomainEventSubscriber } from "../../../../../src/contexts/shared/domain/event/DomainEventSubscriber";

import { TestDomainEvent } from "./TestDomainEvent";

/** Segundo suscriptor en cola para los tests de routing/consume selectivo */
export class AnotherTestDomainEventSubscriber implements DomainEventSubscriber<TestDomainEvent> {
  public executedEvents: TestDomainEvent[] = [];

  async on(event: TestDomainEvent): Promise<void> {
    this.executedEvents.push(event);
  }

  subscribedTo(): DomainEventClass[] {
    return [TestDomainEvent];
  }

  name(): string {
    return "test.another.subscriber";
  }

  reset(): void {
    this.executedEvents = [];
  }
}
