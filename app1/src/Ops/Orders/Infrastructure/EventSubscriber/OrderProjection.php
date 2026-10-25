<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure\EventSubscriber;

use App\Commerce\Domain\Event\OrderCreatedDomainEvent;
use App\Ops\Orders\Domain\Event\OrderConfirmedDomainEvent;
use App\Ops\Orders\Domain\Event\OrderShippedDomainEvent;
use App\Ops\Orders\Domain\OrderProjectionRepository;
use App\Shared\Domain\Event\DomainEvent;
use App\Shared\Domain\Event\DomainEventSubscriber;

/**
 * Suscriptor `OrderProjection` (remodelado, docs/04): alimenta la proyección
 * propia del back-office `ops.orders` con `commerce.order_created` +
 * `ops.order_confirmed/order_shipped` (publicados por app2 tras el comando
 * síncrono). Guard por fechas contra duplicados/desorden: sólo se aplica
 * un evento cuya `occurredAt` sea posterior a la última ya proyectada.
 */
final class OrderProjection implements DomainEventSubscriber
{
    public function __construct(private readonly OrderProjectionRepository $projection) {}

    public function on(DomainEvent $event): void
    {
        switch (true) {
            case $event instanceof OrderCreatedDomainEvent:
                $this->projection->upsertCreated(
                    $event->id,
                    $event->email,
                    $event->totalAmount,
                    $event->totalCurrency,
                    $event->occurredAt,
                );
                break;

            case $event instanceof OrderConfirmedDomainEvent:
                $this->projection->applyStatus($event->id, 'confirmed', $event->occurredAt);
                break;

            case $event instanceof OrderShippedDomainEvent:
                $this->projection->applyStatus($event->id, 'shipped', $event->occurredAt);
                break;
        }
    }

    public function subscribedTo(): array
    {
        return [
            OrderCreatedDomainEvent::class,
            OrderConfirmedDomainEvent::class,
            OrderShippedDomainEvent::class,
        ];
    }

    public function name(): string
    {
        return 'OrderProjection';
    }
}
