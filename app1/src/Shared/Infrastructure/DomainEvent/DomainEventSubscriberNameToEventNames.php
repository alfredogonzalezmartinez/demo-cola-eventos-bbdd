<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\DomainEvent;

use App\Shared\Domain\Event\DomainEventSubscriber;

/** Mapa `subscriberName → [eventNames]` que alimenta el sync-routing (docs/05) */

/** @param list<DomainEventSubscriber> $subscribers */
final class DomainEventSubscriberNameToEventNames
{
    /** @var array<string, list<string>> */
    private array $subscriberNameToEventNames = [];

    /** @param list<DomainEventSubscriber> $subscribers */
    public function __construct(array $subscribers)
    {
        foreach ($subscribers as $subscriber) {
            $this->subscriberNameToEventNames[$subscriber->name()] =
                array_map(static fn (string $eventClass): string => $eventClass::EVENT_NAME,
                    $subscriber->subscribedTo());
        }
    }

    /** @return array<string, list<string>> */
    public function all(): array
    {
        return $this->subscriberNameToEventNames;
    }
}
