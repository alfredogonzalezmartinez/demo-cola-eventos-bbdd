<?php

declare(strict_types=1);

namespace App\Ops\Products\Application;

use App\Ops\Products\Domain\Event\ProductCreatedDomainEvent;
use App\Ops\Products\Domain\Product;
use App\Ops\Products\Domain\ProductsRepository;
use App\Shared\Domain\Event\EventBus;
use Symfony\Component\Uid\Uuid;

/**
 * Alta de producto en el back-office (remodelado, docs/05): app1 vuelve a
 * ser publicador — escribe la fuente `ops.products` (instrumentales de la
 * BD `ops`) y después publica `ops.product_created`, que app2 consume para
 * actualizar su proyección `comercio.products`.
 */
final class AddProduct
{
    public function __construct(
        private readonly ProductsRepository $products,
        private readonly EventBus $eventBus,
    ) {}

    public function __invoke(string $name, float $priceAmount, string $priceCurrency = 'EUR'): string
    {
        $id = Uuid::v4()->toRfc4122();
        $occurredAt = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));

        $this->products->save(new Product($id, $name, $priceAmount, $priceCurrency, 0), $occurredAt);
        $this->eventBus->publish([
            new ProductCreatedDomainEvent(
                $id,
                $name,
                $priceAmount,
                $priceCurrency,
                null,
                $occurredAt,
            ),
        ]);

        return $id;
    }
}
