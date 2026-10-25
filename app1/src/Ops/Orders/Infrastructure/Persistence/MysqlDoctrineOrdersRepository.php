<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure\Persistence;

use App\Ops\Orders\Domain\Order;
use App\Ops\Orders\Domain\OrdersRepository;
use App\Shared\Infrastructure\Persistence\ComercioDoctrineConnection;

/** Lecturas del read model en la BD `comercio` (dueño: app2) */
final class MysqlDoctrineOrdersRepository implements OrdersRepository
{
    public function __construct(private readonly ComercioDoctrineConnection $comercio) {}

    public function find(string $orderId): ?Order
    {
        $rows = $this->comercio->fetchAll(
            'SELECT id, email, total_amount, total_currency, status, created_at'
            .' FROM orders WHERE id = ?',
            [$orderId],
        );

        return reset($rows) === false ? null : $this->hydrate($rows[0]);
    }

    public function all(): array
    {
        return array_map(
            fn (array $row): Order => $this->hydrate($row),
            $this->comercio->fetchAll(
                'SELECT id, email, total_amount, total_currency, status, created_at'
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
        );
    }
}
