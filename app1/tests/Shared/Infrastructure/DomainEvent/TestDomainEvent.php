<?php

declare(strict_types=1);

namespace App\Tests\Shared\Infrastructure\DomainEvent;

use App\Shared\Domain\Event\DomainEvent;

/** Port directo del `TestDomainEvent` de app2 con el mismo payload */
final readonly class TestDomainEvent extends DomainEvent
{
    public const EVENT_NAME = 'test.domain.event';

    public function __construct(
        string $aggregateId,
        public readonly string $testData,
        public readonly string $description,
        ?string $eventId = null,
        ?\DateTimeImmutable $occurredAt = null,
    ) {
        parent::__construct(self::EVENT_NAME, $aggregateId, $eventId, $occurredAt);
    }

    /** @return array<string, mixed> */
    public function toPrimitives(): array
    {
        return [
            'aggregateId' => $this->aggregateId,
            'testData' => $this->testData,
            'description' => $this->description,
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
            (string) $attributes['testData'],
            (string) $attributes['description'],
            $eventId,
            $occurredAt,
        );
    }
}
