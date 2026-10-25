import { DomainEvent, type DomainEventAttributes } from "../../../shared/domain/event/DomainEvent";

/** Evento `ops.order_confirmed` (contrato docs/04): lo publica app2 al
 * aplicar el comando síncrono del back-office (remodelado docs/05); su
 * consumidor en app1 actualiza la proyección `ops.orders`. */
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
