<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure\EventSubscriber;

use App\Commerce\Domain\Event\OrderCreatedDomainEvent;
use App\Shared\Domain\Event\DomainEvent;
use App\Shared\Domain\Event\DomainEventSubscriber;
use App\Shared\Infrastructure\Console\ConsoleOutput;

/**
 * Suscriptor `OrderConfirmationEmail` (docs/04): `order_created` → email de
 * confirmación al cliente. Mock como línea de log (cierre de la Fase 6):
 * visible en `make consume-a1` o en los logs del contenedor.
 */
final class OrderConfirmationEmail implements DomainEventSubscriber
{
    public function on(DomainEvent $event): void
    {
        \assert($event instanceof OrderCreatedDomainEvent);

        ConsoleOutput::write(
            "📧 Confirmation email sent to {$event->email} (order {$event->id}, "
            ."{$event->totalAmount} {$event->totalCurrency})\n",
        );
    }

    public function subscribedTo(): array
    {
        return [OrderCreatedDomainEvent::class];
    }

    public function name(): string
    {
        return 'OrderConfirmationEmail';
    }
}
