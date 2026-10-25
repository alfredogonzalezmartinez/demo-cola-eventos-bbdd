<?php

declare(strict_types=1);

namespace App\Tests\Shared\Infrastructure\DomainEvent;

use App\Shared\Domain\Event\DomainEvent;
use App\Shared\Domain\Event\DomainEventSubscriber;

/** Segundo suscriptor en cola para los tests de routing/consume selectivo */
final class AnotherTestDomainEventSubscriber implements DomainEventSubscriber
{
    /** @var list<TestDomainEvent> */
    public array $executedEvents = [];

    public function on(DomainEvent $event): void
    {
        \assert($event instanceof TestDomainEvent);
        $this->executedEvents[] = $event;
    }

    public function subscribedTo(): array
    {
        return [TestDomainEvent::class];
    }

    public function name(): string
    {
        return 'test.another.subscriber';
    }

    public function reset(): void
    {
        $this->executedEvents = [];
    }
}
