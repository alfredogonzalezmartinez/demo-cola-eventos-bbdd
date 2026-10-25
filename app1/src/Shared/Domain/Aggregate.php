<?php

declare(strict_types=1);

namespace App\Shared\Domain;

use App\Shared\Domain\Event\DomainEvent;

/** Mismo patrón que `AggregateRoot` en la referencia (docs/05) */
abstract class Aggregate
{
    /** @var list<DomainEvent> */
    private array $domainEvents = [];

    public function record(DomainEvent $event): void
    {
        $this->domainEvents[] = $event;
    }

    /** @return list<DomainEvent> */
    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }
}
