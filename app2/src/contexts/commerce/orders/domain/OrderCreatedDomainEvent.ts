import { DomainEvent } from "../../../shared/domain/event/DomainEvent";
import type { DomainEventAttributes } from "../../../shared/domain/event/DomainEvent";

/** Payload de docs/04: id, email, totalAmount, totalCurrency, items (camelCase) */
export class OrderCreatedDomainEvent extends DomainEvent {
  public static readonly eventName = "commerce.order_created_domain_event";

  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly totalAmount: number,
    public readonly totalCurrency: string,
    public readonly items: { productId: string; quantity: number }[],
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(OrderCreatedDomainEvent.eventName, id, eventId, occurredAt);
  }

  toPrimitives(): DomainEventAttributes {
    return {
      id: this.id,
      email: this.email,
      totalAmount: this.totalAmount,
      totalCurrency: this.totalCurrency,
      items: this.items.map((item) => ({ ...item })),
    };
  }

  static fromPrimitives(
    aggregateId: string,
    eventId: string,
    occurredAt: Date,
    attributes: DomainEventAttributes,
  ): OrderCreatedDomainEvent {
    return new OrderCreatedDomainEvent(
      aggregateId,
      attributes.email as string,
      attributes.totalAmount as number,
      attributes.totalCurrency as string,
      attributes.items as { productId: string; quantity: number }[],
      eventId,
      occurredAt,
    );
  }
}
