<?php

declare(strict_types=1);

namespace App\Tests\Shared\Infrastructure\DomainEvent;

use App\Shared\Domain\Event\DomainEvent;
use App\Shared\Domain\Event\DomainEventSubscriber;

final class TestDomainEventSubscriber implements DomainEventSubscriber
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
        return 'test.domain.event.subscriber';
    }

    public function reset(): void
    {
        $this->executedEvents = [];
    }
}
