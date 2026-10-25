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
     * contador de `ops.products` (fuente del catálogo, docs/03).
     */
    public function increaseViews(string $productId, int $amount): void;

    /** Escritura de la fuente del catálogo: alta en el back-office (docs/05) */
    public function save(Product $product, \DateTimeImmutable $changedAt): void;

    /** Escritura de la fuente del catálogo: actualización en el back-office (docs/05) */
    public function update(string $productId, string $name, float $priceAmount, string $priceCurrency, \DateTimeImmutable $changedAt): void;
}
