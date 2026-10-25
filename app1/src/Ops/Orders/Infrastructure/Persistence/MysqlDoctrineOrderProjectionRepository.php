<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure\Persistence;

use App\Ops\Orders\Domain\OrderProjectionRepository;
use App\Shared\Infrastructure\Persistence\OpsDoctrineConnection;

final class MysqlDoctrineOrderProjectionRepository implements OrderProjectionRepository
{
    public function __construct(private readonly OpsDoctrineConnection $ops) {}

    public function upsertCreated(
        string $orderId,
        string $email,
        float $totalAmount,
        string $totalCurrency,
        \DateTimeImmutable $occurredAt,
    ): void {
        $occurred = $this->ops->formatTimestamp($occurredAt);

        // Duplicado o reordenado: sólo se actualiza si el evento es más
        // reciente que lo ya proyectado (el instante es de la app publicadora,
        // siempre la misma fuente de reloj en toda la cola)
        $this->ops->execute(
            'INSERT INTO orders (id, email, total_amount, total_currency, status, created_at, status_changed_at)'
            ." VALUES (?, ?, ?, ?, 'created', ?, ?)"
            .' ON DUPLICATE KEY UPDATE'
            .' email = IF(VALUES(status_changed_at) >= orders.status_changed_at, VALUES(email), email),'
            .' total_amount = IF(VALUES(status_changed_at) >= orders.status_changed_at, VALUES(total_amount), total_amount),'
            .' total_currency = IF(VALUES(status_changed_at) >= orders.status_changed_at, VALUES(total_currency), total_currency),'
            .' status = IF(VALUES(status_changed_at) >= orders.status_changed_at, VALUES(status), status),'
            .' created_at = IF(VALUES(status_changed_at) >= orders.status_changed_at, VALUES(created_at), created_at),'
            .' status_changed_at = IF(VALUES(status_changed_at) >= orders.status_changed_at, VALUES(status_changed_at), status_changed_at)',
            [$orderId, $email, $totalAmount, $totalCurrency, $occurred, $occurred],
        );
    }

    public function applyStatus(string $orderId, string $status, \DateTimeImmutable $occurredAt): void
    {
        // Sólo UPDATE: el `order_created` es quien siembra la fila. Si por
        // orden de consumo llegara antes un `ops.order_*`, la fila aún no
        // existe y este evento no la crea (afectedRows 0, sin efecto).
        $this->ops->execute(
            'UPDATE orders SET status = ?, status_changed_at = ?'
            .' WHERE id = ? AND (status_changed_at IS NULL OR status_changed_at < ?)',
            [$status, $this->ops->formatTimestamp($occurredAt), $orderId, $this->ops->formatTimestamp($occurredAt)],
        );
    }
}
