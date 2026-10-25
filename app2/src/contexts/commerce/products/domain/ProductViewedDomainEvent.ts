import { DomainEvent } from "../../../shared/domain/event/DomainEvent";
import type { DomainEventAttributes } from "../../../shared/domain/event/DomainEvent";

/** Payload de docs/04: id del producto (aggregateId) + amount de vistas */
export class ProductViewedDomainEvent extends DomainEvent {
  public static readonly eventName = "commerce.product_viewed_domain_event";

  constructor(
    public readonly id: string,
    public readonly amount: number,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(ProductViewedDomainEvent.eventName, id, eventId, occurredAt);
  }

  toPrimitives(): DomainEventAttributes {
    return {
      id: this.id,
      amount: this.amount,
    };
  }

  static fromPrimitives(
    aggregateId: string,
    eventId: string,
    occurredAt: Date,
    attributes: DomainEventAttributes,
  ): ProductViewedDomainEvent {
    return new ProductViewedDomainEvent(
      aggregateId,
      attributes.amount as number,
      eventId,
      occurredAt,
    );
  }
}
