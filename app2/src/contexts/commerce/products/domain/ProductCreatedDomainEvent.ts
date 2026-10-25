import { DomainEvent, type DomainEventAttributes } from "../../../shared/domain/event/DomainEvent";

/**
 * Inbound del remodelado (contrato docs/04): `ops.product_created` lo
 * publica app1 (dueño del catálogo en BD `ops`) y app2 mantiene su
 * proyección `comercio.products` al consumirlo. No viajan las `views`
 * (métrica local de app1).
 */
export class ProductCreatedDomainEvent extends DomainEvent {
  public static readonly eventName = "ops.product_created_domain_event";

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly priceAmount: number,
    public readonly priceCurrency: string,
    eventId?: string,
    occurredAt?: Date,
  ) {
    super(ProductCreatedDomainEvent.eventName, id, eventId, occurredAt);
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
  ): ProductCreatedDomainEvent {
    return new ProductCreatedDomainEvent(
      aggregateId,
      attributes.name as string,
      Number(attributes.priceAmount),
      attributes.priceCurrency as string,
      eventId,
      occurredAt,
    );
  }
}
