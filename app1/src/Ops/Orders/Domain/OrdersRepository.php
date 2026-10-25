<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain;

/** Lectura de pedidos de `comercio` para ops (docs/03) */
interface OrdersRepository
{
    public function find(string $orderId): ?Order;

    /** @return list<Order> */
    public function all(): array;
}
