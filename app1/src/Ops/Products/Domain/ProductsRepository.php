<?php

declare(strict_types=1);

namespace App\Ops\Products\Domain;

interface ProductsRepository
{
    public function find(string $productId): ?Product;

    /** @return list<Product> */
    public function all(): array;

    /**
     * Efecto del suscriptor `ProductStats` (docs/04): vistas sumadas al
     * contador de `comercio.products`.
     */
    public function increaseViews(string $productId, int $amount): void;
}
