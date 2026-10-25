<?php

declare(strict_types=1);

namespace App\Ops\Products\Domain\Event;

use App\Shared\Domain\Event\DomainEvent;

/** Evento nativo del catálogo (contrato docs/04, remodelado): actualización en la fuente `ops.products` */
final readonly class ProductUpdatedDomainEvent extends DomainEvent
{
    public const EVENT_NAME = 'ops.product_updated_domain_event';

    public function __construct(
        public string $id,
        public string $name,
        public float $priceAmount,
        public string $priceCurrency,
        ?string $eventId = null,
        ?\DateTimeImmutable $occurredAt = null,
    ) {
        parent::__construct(self::EVENT_NAME, $id, $eventId, $occurredAt);
    }

    /** @return array<string, mixed> */
    public function toPrimitives(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'priceAmount' => $this->priceAmount,
            'priceCurrency' => $this->priceCurrency,
        ];
    }

    /** @param array<string, mixed> $attributes */
    public static function fromPrimitives(
        string $aggregateId,
        string $eventId,
        \DateTimeImmutable $occurredAt,
        array $attributes,
    ): static {
        return new self(
            $aggregateId,
            (string) $attributes['name'],
            (float) $attributes['priceAmount'],
            (string) $attributes['priceCurrency'],
            $eventId,
            $occurredAt,
        );
    }
}
