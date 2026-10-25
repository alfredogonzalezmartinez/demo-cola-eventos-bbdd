<?php

declare(strict_types=1);

namespace App\Ops\Orders\Application;

use App\Ops\Orders\Domain\Event\OrderShippedDomainEvent;
use App\Ops\Orders\Domain\OrderNotFoundException;
use App\Ops\Orders\Domain\OrderStatusChangeNotAllowedException;
use App\Ops\Orders\Domain\OrdersRepository;
use App\Shared\Domain\Event\EventBus;

/**
 * Publica `order_shipped` tras validar el estado previo: sólo pedidos
 * `confirmed` pasan a `shipped` (semántica Fase 6: fail-fast).
 * El número de seguimiento es opcional — formato PLK-##### de docs/04.
 */
final class ShipOrder
{
    public function __construct(
        private readonly OrdersRepository $orders,
        private readonly EventBus $eventBus,
    ) {}

    /** @throws OrderNotFoundException|OrderStatusChangeNotAllowedException */
    public function __invoke(string $orderId, ?string $trackingNumber = null): void
    {
        $order = $this->orders->find($orderId);

        if ($order === null) {
            throw new OrderNotFoundException($orderId);
        }

        if ($order->status !== 'confirmed') {
            throw new OrderStatusChangeNotAllowedException($order->id, $order->status, 'confirmed');
        }

        $this->eventBus->publish([
            new OrderShippedDomainEvent(
                $order->id,
                $order->email,
                $trackingNumber ?? sprintf('PLK-%05d', random_int(0, 99999)),
            ),
        ]);
    }
}
