<?php

declare(strict_types=1);

namespace App\Ops\Products\Domain;

final readonly class Product
{
    public function __construct(
        public string $id,
        public string $name,
        public float $priceAmount,
        public string $priceCurrency,
        public int $views,
    ) {}
}
