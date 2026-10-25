<?php

declare(strict_types=1);

namespace App\Commerce\Domain\Event;

use App\Shared\Domain\Event\DomainEvent;

/**
 * Clase local espejo del `OrderCreatedDomainEvent` de app2 (contrato docs/04):
 * payload id, email, totalAmount, totalCurrency, items (camelCase).
 * Contexto `commerce` — es el contexto emisor; en las clases entrantes de la
 * otra app el `fromPrimitives()` reconstruye a partir de la fila.
 */
final readonly class OrderCreatedDomainEvent extends DomainEvent
{
    public const EVENT_NAME = 'commerce.order_created_domain_event';

    /**
     * @param list<array{productId: string, quantity: int}> $items
     */
    public function __construct(
        public string $id,
        public string $email,
        public float $totalAmount,
        public string $totalCurrency,
        public array $items,
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
            'email' => $this->email,
            'totalAmount' => $this->totalAmount,
            'totalCurrency' => $this->totalCurrency,
            'items' => $this->items,
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
            (string) $attributes['email'],
            (float) $attributes['totalAmount'],
            (string) $attributes['totalCurrency'],
            (array) $attributes['items'],
            $eventId,
            $occurredAt,
        );
    }
}
