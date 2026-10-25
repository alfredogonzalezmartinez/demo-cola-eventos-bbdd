<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain\Event;

use App\Shared\Domain\Event\DomainEvent;

/**
 * Evento nativo del contexto `ops` (contrato docs/04): trackingNumber del
 * envío; el pedido va en estado previo `confirmed` (valida el caso de uso).
 */
final readonly class OrderShippedDomainEvent extends DomainEvent
{
    public const EVENT_NAME = 'ops.order_shipped_domain_event';

    public function __construct(
        public string $id,
        public string $email,
        public string $trackingNumber,
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
            'trackingNumber' => $this->trackingNumber,
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
            (string) $attributes['trackingNumber'],
            $eventId,
            $occurredAt,
        );
    }
}
