<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure\Persistence;

use App\Ops\Orders\Domain\OrderCommand;
use App\Ops\Orders\Domain\OrderCommandsRepository;
use App\Shared\Infrastructure\Persistence\OpsDoctrineConnection;

final class MysqlDoctrineOrderCommandsRepository implements OrderCommandsRepository
{
    public function __construct(private readonly OpsDoctrineConnection $ops) {}

    public function add(OrderCommand $command): void
    {
        $this->ops->insert('order_commands', [
            'id' => $command->id,
            'order_id' => $command->orderId,
            'action' => $command->action,
            'requested_status' => $command->requestedStatus,
            'requested_at' => $this->ops->formatTimestamp($command->requestedAt),
        ]);
    }

    public function hasPending(string $orderId): bool
    {
        $rows = $this->ops->fetchAll(
            'SELECT COUNT(*) AS pending FROM order_commands c'
            .' JOIN orders o ON o.id = c.order_id'
            .' WHERE c.order_id = ?'
            .' AND (o.status <> c.requested_status'
            .' OR o.status_changed_at IS NULL'
            .' OR o.status_changed_at < c.requested_at)',
            [$orderId],
        );

        return (int) ($rows[0]['pending'] ?? 0) > 0;
    }
}
