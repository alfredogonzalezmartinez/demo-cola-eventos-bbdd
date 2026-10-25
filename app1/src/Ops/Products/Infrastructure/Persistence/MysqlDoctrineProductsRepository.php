<?php

declare(strict_types=1);

namespace App\Ops\Products\Infrastructure\Persistence;

use App\Ops\Products\Domain\Product;
use App\Ops\Products\Domain\ProductsRepository;
use App\Shared\Infrastructure\Persistence\OpsDoctrineConnection;

/** Fuente del catálogo en la BD `ops` del back-office (docs/03) */
final class MysqlDoctrineProductsRepository implements ProductsRepository
{
    public function __construct(private readonly OpsDoctrineConnection $ops) {}

    public function find(string $productId): ?Product
    {
        $rows = $this->ops->fetchAll(
            'SELECT id, name, price_amount, price_currency, views FROM products WHERE id = ?',
            [$productId],
        );

        return $rows === [] ? null : $this->hydrate($rows[0]);
    }

    public function all(): array
    {
        return array_map(
            fn (array $row): Product => $this->hydrate($row),
            $this->ops->fetchAll(
                'SELECT id, name, price_amount, price_currency, views FROM products ORDER BY name ASC',
            ),
        );
    }

    public function increaseViews(string $productId, int $amount): void
    {
        $this->ops->execute(
            'UPDATE products SET views = views + ? WHERE id = ?',
            [$amount, $productId],
        );
    }

    public function save(Product $product, \DateTimeImmutable $changedAt): void
    {
        $this->ops->insert('products', [
            'id' => $product->id,
            'name' => $product->name,
            'price_amount' => $product->priceAmount,
            'price_currency' => $product->priceCurrency,
            'views' => 0,
            'changed_at' => $this->ops->formatTimestamp($changedAt),
        ]);
    }

    public function update(string $productId, string $name, float $priceAmount, string $priceCurrency, \DateTimeImmutable $changedAt): void
    {
        $this->ops->update('products', [
            'name' => $name,
            'price_amount' => $priceAmount,
            'price_currency' => $priceCurrency,
            'changed_at' => $this->ops->formatTimestamp($changedAt),
        ], ['id' => $productId]);
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
