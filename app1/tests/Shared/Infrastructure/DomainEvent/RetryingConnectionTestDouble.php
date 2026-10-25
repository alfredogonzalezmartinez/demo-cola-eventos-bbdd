<?php

declare(strict_types=1);

namespace App\Tests\Shared\Infrastructure\DomainEvent;

use App\Shared\Infrastructure\DomainEvent\DomainEventSubscriberNameToEventNames;
use App\Shared\Infrastructure\Persistence\DoctrineConnection;

/**
 * Conexión de test para el mecanismo de retry del `publish` (docs/05): no
 * abre ninguna conexión MySQL; simula fallos transitivos y cuenta intentos
 * (equivalente al `vi.spyOn(sql, "begin")` de la suite de app2).
 */
final class RetryingConnectionTestDouble extends DoctrineConnection
{
    public function __construct(private readonly int $failures = 0)
    {
    }

    public int $attempts = 0;

    public function fetchAll(string $sql, array $params = []): array
    {
        return [];
    }

    public function insert(string $table, array $data): void {}

    public function transactional(callable $fn): mixed
    {
        $this->attempts++;

        if ($this->attempts <= $this->failures) {
            throw new \RuntimeException('Database connection failed');
        }

        return $fn($this);
    }
}
