<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure\Persistence;

use App\Ops\Orders\Domain\Order;
use App\Ops\Orders\Domain\OrdersRepository;
use App\Shared\Infrastructure\Persistence\OpsDoctrineConnection;

/** Lecturas del read model propio del back-office en la BD `ops` (docs/03) */
final class MysqlDoctrineOrdersRepository implements OrdersRepository
{
    public function __construct(private readonly OpsDoctrineConnection $ops) {}

    public function find(string $orderId): ?Order
    {
        $rows = $this->ops->fetchAll(
            'SELECT id, email, total_amount, total_currency, status, created_at, status_changed_at'
            .' FROM orders WHERE id = ?',
            [$orderId],
        );

        return $rows === [] ? null : $this->hydrate($rows[0]);
    }

    public function all(): array
    {
        return array_map(
            fn (array $row): Order => $this->hydrate($row),
            $this->ops->fetchAll(
                'SELECT id, email, total_amount, total_currency, status, created_at, status_changed_at'
                .' FROM orders ORDER BY created_at DESC',
            ),
        );
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): Order
    {
        return new Order(
            (string) $row['id'],
            (string) $row['email'],
            (float) $row['total_amount'],
            (string) $row['total_currency'],
            (string) $row['status'],
            new \DateTimeImmutable((string) $row['created_at'], new \DateTimeZone('UTC')),
            $row['status_changed_at'] === null
                ? null
                : new \DateTimeImmutable((string) $row['status_changed_at'], new \DateTimeZone('UTC')),
        );
    }
}
