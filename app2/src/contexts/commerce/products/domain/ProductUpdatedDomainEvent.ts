import { DomainEvent, type DomainEventAttributes } from "../../../shared/domain/event/DomainEvent";

/** Inbound del remodelado (contrato docs/04): `ops.product_updated` de app1 */
export class ProductUpdatedDomainEvent extends DomainEvent {
  public static readonly eventName = "ops.product_updated_domain_event";

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly priceAmount: number,
    public readonly priceCurrency: string,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(ProductUpdatedDomainEvent.eventName, id, eventId, occurredAt);
  }

  toPrimitives(): DomainEventAttributes {
    return {
      id: this.id,
      name: this.name,
      priceAmount: this.priceAmount,
      priceCurrency: this.priceCurrency,
    };
  }

  static fromPrimitives(
    aggregateId: string,
    eventId: string,
    occurredAt: Date,
    attributes: DomainEventAttributes,
  ): ProductUpdatedDomainEvent {
    return new ProductUpdatedDomainEvent(
      aggregateId,
      attributes.name as string,
      Number(attributes.priceAmount),
      attributes.priceCurrency as string,
      eventId,
      occurredAt,
    );
  }
}
