import { DomainEvent, type DomainEventAttributes } from "../../../shared/domain/event/DomainEvent";

/** Evento `ops.order_shipped` (contrato docs/04): lo publica app2 al
 * aplicar el comando síncrono del back-office (remodelado docs/05); su
 * consumidor en app1 actualiza la proyección `ops.orders`. */
export class OrderShippedDomainEvent extends DomainEvent {
  public static readonly eventName = "ops.order_shipped_domain_event";

  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly trackingNumber: string,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(OrderShippedDomainEvent.eventName, id, eventId, occurredAt);
  }

  toPrimitives(): DomainEventAttributes {
    return {
      id: this.id,
      email: this.email,
      trackingNumber: this.trackingNumber,
    };
  }

  static fromPrimitives(
    aggregateId: string,
    eventId: string,
    occurredAt: Date,
    attributes: DomainEventAttributes,
  ): OrderShippedDomainEvent {
    return new OrderShippedDomainEvent(
      aggregateId,
      attributes.email as string,
      attributes.trackingNumber as string,
      eventId,
      occurredAt,
    );
  }
}
