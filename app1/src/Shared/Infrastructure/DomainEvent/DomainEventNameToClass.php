<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\DomainEvent;

use App\Shared\Domain\Event\DomainEvent;
use App\Shared\Domain\Event\DomainEventSubscriber;

/**
 * Mapa `eventName → clase` de esta app. En PHP la referencia se traduce a
 * `class-string`s: cada evento expone la constante `EVENT_NAME` y un
 * constructor estático `fromPrimitives()` válido según el contrato.
 */

/** @param list<DomainEventSubscriber> $subscribers */
final class DomainEventNameToClass
{
    /** @var array<string, class-string<DomainEvent>> */
    private array $eventNameToClass = [];

    /** @param list<class-string<DomainEvent>> $eventClasses */
    public function __construct(array $eventClasses)
    {
        foreach ($eventClasses as $eventClass) {
            $this->eventNameToClass[$eventClass::EVENT_NAME] = $eventClass;
        }
    }

    /** Clases de los eventos que escuchan los suscriptores indicados */
    /** @param list<DomainEventSubscriber> $subscribers */
    public static function fromSubscribers(array $subscribers): self
    {
        $eventClasses = [];

        foreach ($subscribers as $subscriber) {
            $eventClasses = array_merge($eventClasses, $subscriber->subscribedTo());
        }

        return new self($eventClasses);
    }

    /**
     * @param array<string, mixed> $attributes
     */
    public function searchEvent(
        string $id,
        string $name,
        array $attributes,
        \DateTimeImmutable $occurredAt,
    ): ?DomainEvent {
        $eventClass = $this->eventNameToClass[$name] ?? null;

        if ($eventClass === null) {
            return null;
        }

        // Como la referencia: el `id` del payload manda como aggregateId
        return $eventClass::fromPrimitives(
            (string) ($attributes['id'] ?? $id),
            $id,
            $occurredAt,
            $attributes,
        );
    }
}
