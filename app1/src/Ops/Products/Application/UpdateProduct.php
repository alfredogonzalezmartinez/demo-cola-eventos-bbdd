<?php

declare(strict_types=1);

namespace App\Ops\Products\Application;

use App\Ops\Products\Domain\Event\ProductUpdatedDomainEvent;
use App\Ops\Products\Domain\ProductNotFoundException;
use App\Ops\Products\Domain\ProductsRepository;
use App\Shared\Domain\Event\EventBus;

/**
 * Actualización de producto en el back-office (remodelado, docs/05):
 * escribe la fuente `ops.products` y publica `ops.product_updated`
 * para que app2 actualice su proyección del catálogo.
 */
final class UpdateProduct
{
    public function __construct(
        private readonly ProductsRepository $products,
        private readonly EventBus $eventBus,
    ) {}

    /** @throws ProductNotFoundException */
    public function __invoke(string $productId, string $name, float $priceAmount, string $priceCurrency = 'EUR'): void
    {
        $product = $this->products->find($productId);

        if ($product === null) {
            throw new ProductNotFoundException($productId);
        }

        $occurredAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        $this->products->update($productId, $name, $priceAmount, $priceCurrency, $occurredAt);
        $this->eventBus->publish([
            new ProductUpdatedDomainEvent(
                $productId,
                $name,
                $priceAmount,
                $priceCurrency,
                null,
                $occurredAt,
            ),
        ]);
    }
}
