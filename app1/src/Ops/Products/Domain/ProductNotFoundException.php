<?php

declare(strict_types=1);

namespace App\Ops\Products\Domain;

final class ProductNotFoundException extends \RuntimeException
{
    public function __construct(string $productId)
    {
        parent::__construct("Product not found: {$productId}");
    }
}
