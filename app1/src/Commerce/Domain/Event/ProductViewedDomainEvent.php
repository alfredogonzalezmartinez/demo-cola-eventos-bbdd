<?php

declare(strict_types=1);

namespace App\Commerce\Domain\Event;

use App\Shared\Domain\Event\DomainEvent;

/**
 * Clase local espejo del `ProductViewedDomainEvent` de app2 (contrato docs/04):
 * payload id del producto (aggregateId) + amount de vistas.
 */
final readonly class ProductViewedDomainEvent extends DomainEvent
{
    public const EVENT_NAME = 'commerce.product_viewed_domain_event';

    public function __construct(
        public string $id,
        public int $amount,
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
            'amount' => $this->amount,
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
            (int) $attributes['amount'],
            $eventId,
            $occurredAt,
        );
    }
}
