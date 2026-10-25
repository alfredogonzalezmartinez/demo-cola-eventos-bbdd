<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain;

final class OrderStatusChangeNotAllowedException extends \RuntimeException
{
    public function __construct(string $orderId, string $currentStatus, string $expectedStatus)
    {
        parent::__construct("Order {$orderId} is in status {$currentStatus}: to advance it must be {$expectedStatus}");
    }
}
