import { DomainEvent, type DomainEventAttributes } from "../../../shared/domain/event/DomainEvent";

/**
 * Clase local espejo del `OrderConfirmedDomainEvent` de app1 (contrato docs/04):
 * los eventos `ops.*` los publica app1 y app2 los reconstruye con
 * `fromPrimitives` a partir de la fila de la cola.
 */
export class OrderConfirmedDomainEvent extends DomainEvent {
  public static readonly eventName = "ops.order_confirmed_domain_event";

  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly confirmedAt: string,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(OrderConfirmedDomainEvent.eventName, id, eventId, occurredAt);
  }

  toPrimitives(): DomainEventAttributes {
    return {
      id: this.id,
      email: this.email,
      confirmedAt: this.confirmedAt,
    };
  }

  static fromPrimitives(
    aggregateId: string,
    eventId: string,
    occurredAt: Date,
    attributes: DomainEventAttributes,
  ): OrderConfirmedDomainEvent {
    return new OrderConfirmedDomainEvent(
      aggregateId,
      attributes.email as string,
      attributes.confirmedAt as string,
      eventId,
      occurredAt,
    );
  }
}
