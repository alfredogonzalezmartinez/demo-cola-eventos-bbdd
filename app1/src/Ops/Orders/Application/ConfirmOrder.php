<?php

declare(strict_types=1);

namespace App\Ops\Orders\Application;

use App\Ops\Orders\Domain\Event\OrderConfirmedDomainEvent;
use App\Ops\Orders\Domain\OrderNotFoundException;
use App\Ops\Orders\Domain\OrderStatusChangeNotAllowedException;
use App\Ops\Orders\Domain\OrdersRepository;
use App\Shared\Domain\Event\EventBus;

/**
 * Publica `order_confirmed` tras validar el estado previo (semántica Fase 6:
 * fail-fast — nada se publica si el pedido no está en `created`).
 */
final class ConfirmOrder
{
    public function __construct(
        private readonly OrdersRepository $orders,
        private readonly EventBus $eventBus,
    ) {}

    /** @throws OrderNotFoundException|OrderStatusChangeNotAllowedException */
    public function __invoke(string $orderId): void
    {
        $order = $this->orders->find($orderId);

        if ($order === null) {
            throw new OrderNotFoundException($orderId);
        }

        if ($order->status !== 'created') {
            throw new OrderStatusChangeNotAllowedException($order->id, $order->status, 'created');
        }

        $this->eventBus->publish([
            new OrderConfirmedDomainEvent(
                $order->id,
                $order->email,
                (new \DateTimeImmutable())->setTimezone(new \DateTimeZone('UTC'))
                    ->format("Y-m-d\\TH:i:s\\Z"),
            ),
        ]);
    }
}
