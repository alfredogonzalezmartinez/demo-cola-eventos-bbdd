<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain\Event;

use App\Shared\Domain\Event\DomainEvent;

/**
 * Evento nativo del contexto `ops` (contrato docs/04): payload id del pedido
 * (aggregateId), email enriquecido del pedido leído en `comercio`, y
 * confirmedAt en ISO-8601 UTC.
 */
final readonly class OrderConfirmedDomainEvent extends DomainEvent
{
    public const EVENT_NAME = 'ops.order_confirmed_domain_event';

    /** @param non-empty-string $confirmedAtTimestamp ISO-8601 UTC, p. ej. 2026-10-23T12:00:00Z */
    public function __construct(
        public string $id,
        public string $email,
        public string $confirmedAtTimestamp,
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
            'confirmedAt' => $this->confirmedAtTimestamp,
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
            (string) $attributes['confirmedAt'],
            $eventId,
            $occurredAt,
        );
    }
}
