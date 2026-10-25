<?php

declare(strict_types=1);

namespace App\Ops\Products\Infrastructure\Persistence;

use App\Ops\Products\Domain\Product;
use App\Ops\Products\Domain\ProductsRepository;
use App\Shared\Infrastructure\Persistence\ComercioDoctrineConnection;

final class MysqlDoctrineProductsRepository implements ProductsRepository
{
    public function __construct(private readonly ComercioDoctrineConnection $comercio) {}

    public function find(string $productId): ?Product
    {
        $rows = $this->comercio->fetchAll(
            'SELECT id, name, price_amount, price_currency, views FROM products WHERE id = ?',
            [$productId],
        );

        return $rows === [] ? null : $this->hydrate($rows[0]);
    }

    public function all(): array
    {
        return array_map(
            fn (array $row): Product => $this->hydrate($row),
            $this->comercio->fetchAll(
                'SELECT id, name, price_amount, price_currency, views FROM products',
            ),
        );
    }

    public function increaseViews(string $productId, int $amount): void
    {
        $this->comercio->execute(
            'UPDATE products SET views = views + ? WHERE id = ?',
            [$amount, $productId],
        );
    }

    /** @param array<string, mixed> $row */
    private function hydrate(array $row): Product
    {
        return new Product(
            (string) $row['id'],
            (string) $row['name'],
            (float) $row['price_amount'],
            (string) $row['price_currency'],
            (int) $row['views'],
        );
    }
}
