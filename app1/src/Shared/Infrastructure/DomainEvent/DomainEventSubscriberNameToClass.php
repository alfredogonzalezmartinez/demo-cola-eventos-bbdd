<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\DomainEvent;

use App\Shared\Domain\Event\DomainEvent;
use App\Shared\Domain\Event\DomainEventSubscriber;

/** Mapa `subscriberName → instancia` (port del `DomainEventSubscriberNameToClass`) */

/** @param list<DomainEventSubscriber> $subscribers */
final class DomainEventSubscriberNameToClass
{
    /** @var array<string, DomainEventSubscriber> */
    private array $subscriberNameToClass = [];

    /** @param list<DomainEventSubscriber> $subscribers */
    public function __construct(array $subscribers)
    {
        foreach ($subscribers as $subscriber) {
            $this->subscriberNameToClass[$subscriber->name()] = $subscriber;
        }
    }

    public function search(string $subscriberName): ?DomainEventSubscriber
    {
        return $this->subscriberNameToClass[$subscriberName] ?? null;
    }

    public function find(string $subscriberName): DomainEventSubscriber
    {
        $subscriber = $this->search($subscriberName);

        if ($subscriber === null) {
            throw new DomainEventSubscriberNotExistError($subscriberName);
        }

        return $subscriber;
    }
}
