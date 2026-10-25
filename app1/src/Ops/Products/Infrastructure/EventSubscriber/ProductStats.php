<?php

declare(strict_types=1);

namespace App\Ops\Products\Infrastructure\EventSubscriber;

use App\Commerce\Domain\Event\ProductViewedDomainEvent;
use App\Ops\Products\Domain\ProductsRepository;
use App\Shared\Domain\Event\DomainEvent;
use App\Shared\Domain\Event\DomainEventSubscriber;

/**
 * Suscriptor `ProductStats` (docs/04): `product_viewed` →
 * `UPDATE comercio.products SET views = views + amount`.
 */
final class ProductStats implements DomainEventSubscriber
{
    public function __construct(private readonly ProductsRepository $products) {}

    public function on(DomainEvent $event): void
    {
        \assert($event instanceof ProductViewedDomainEvent);

        $this->products->increaseViews($event->id, $event->amount);
    }

    public function subscribedTo(): array
    {
        return [ProductViewedDomainEvent::class];
    }

    public function name(): string
    {
        return 'ProductStats';
    }
}
