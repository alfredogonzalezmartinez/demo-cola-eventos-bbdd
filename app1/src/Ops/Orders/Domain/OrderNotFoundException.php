<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain;

final class OrderNotFoundException extends \RuntimeException
{
    public function __construct(string $orderId)
    {
        parent::__construct("Order not found: {$orderId}");
    }
}
