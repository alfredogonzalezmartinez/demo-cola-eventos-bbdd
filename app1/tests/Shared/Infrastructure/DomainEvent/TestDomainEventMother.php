<?php

declare(strict_types=1);

namespace App\Tests\Shared\Infrastructure\DomainEvent;

use Symfony\Component\Uid\Uuid;

/** Port del `TestDomainEventMother` de app2 (faker → valores por defecto) */
final class TestDomainEventMother
{
    /**
     * @param array{aggregateId?: string, testData?: string, description?: string, eventId?: string, occurredAt?: \DateTimeImmutable} $params
     */
    public static function create(array $params = []): TestDomainEvent
    {
        return new TestDomainEvent(
            $params['aggregateId'] ?? Uuid::v4()->toRfc4122(),
            $params['testData'] ?? 'lorem',
            $params['description'] ?? 'lorem ipsum dolor',
            $params['eventId'] ?? null,
            $params['occurredAt'] ?? null,
        );
    }
}
