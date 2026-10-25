<?php

declare(strict_types=1);

namespace App\Shared\Domain\Event;

use Symfony\Component\Uid\Uuid;

/**
 * Contrato de docs/04 — clon del `DomainEvent.ts` de la referencia.
 *
 * @method static static fromPrimitives(string $aggregateId, string $eventId, \DateTimeImmutable $occurredAt, array $attributes)
 */
abstract readonly class DomainEvent
{
    public readonly string $eventId;
    public readonly \DateTimeImmutable $occurredAt;

    protected function __construct(
        public readonly string $eventName,
        public readonly string $aggregateId,
        ?string $eventId = null,
        ?\DateTimeImmutable $occurredAt = null,
    ) {
        $this->eventId = $eventId ?? Uuid::v4()->toRfc4122();
        $this->occurredAt = $occurredAt ?? new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
    }

    /** @return array<string, mixed> */
    abstract public function toPrimitives(): array;

    /** @param array<string, mixed> $attributes */
    abstract public static function fromPrimitives(
        string $aggregateId,
        string $eventId,
        \DateTimeImmutable $occurredAt,
        array $attributes,
    ): static;
}
