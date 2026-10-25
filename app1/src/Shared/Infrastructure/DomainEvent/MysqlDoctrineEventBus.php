<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\DomainEvent;

use App\Shared\Domain\Event\DomainEvent;
use App\Shared\Domain\Event\DomainEventSubscriber;
use App\Shared\Domain\Event\EventBus;
use App\Shared\Domain\Retry;
use App\Shared\Infrastructure\Console\ConsoleOutput;
use App\Shared\Infrastructure\Persistence\DoctrineConnection;

/**
 * Bus de la cola en tablas SQL, port 1:1 del `MysqlEventBus` de app2
 * (comportamiento de `PostgresEventBus.publish/consume` de la referencia,
 * docs/05 y docs/06), aquí sobre Doctrine DBAL.
 */
final class MysqlDoctrineEventBus implements EventBus
{
    private const MAX_RETRIES = 3;

    /**
     * Las tablas de la cola viven en la BD `eventos` (docs/04) y van
     * calificadas, como `public.` en la referencia.
     */
    private const SCHEMA = 'eventos';

    private ?DomainEventNameToClass $eventClassesCache = null;
    private ?DomainEventSubscriberNameToClass $subscriberClassesCache = null;

    private array $subscribers;

    /**
     * @param iterable<App\Shared\Domain\Event\DomainEventSubscriber> $subscribers
     *              Suscriptores taggeados `subscriber` en el DIC services.yaml
     */
    public function __construct(
        private readonly DoctrineConnection $connection,
        iterable $subscribers,
    ) {
        // El !tagged_iterator del DIC alimenta un RewindableGenerator: se
        // materializa a lista para los mapas (el bus de app2 usa listas 1:1).
        $this->subscribers = iterator_to_array($subscribers, false);
    }

    /** @param list<App\Shared\Domain\Event\DomainEvent> $events */
    public function publish(array $events): void
    {
        if ($events === []) {
            return;
        }

        Retry::exec(fn (): mixed => $this->publishEvents($events), 3, 30);
    }

    /** @param list<string>|'*' $subscribers */
    public function consume(array|string $subscribers, int $limit): void
    {
        $this->connection->transactional(function (DoctrineConnection $tx) use ($subscribers, $limit): void {
            $rows = $this->searchEventsToConsume($subscribers, $limit, $tx);

            foreach ($rows as $row) {
                $this->executeSubscriberForEvent($row, $tx);
            }
        });
    }

    /** @param list<App\Shared\Domain\Event\DomainEvent> $events */
    private function publishEvents(array $events): void
    {
        $this->connection->transactional(function (DoctrineConnection $tx) use ($events): void {
            foreach ($events as $event) {
                $subscriberNames = $this->searchSubscriberNamesForEvent($event->eventName, $tx);

                ConsoleOutput::write(
                    "\n📤 Publishing event `{$event->eventName}` to:\n"
                    .implode(',', array_map(
                        static fn (string $subscriberName): string => "\n\t→ {$subscriberName}",
                        $subscriberNames,
                    ))."\n",
                );

                foreach ($subscriberNames as $subscriberName) {
                    $this->insertEventForSubscriber($event, $subscriberName, $tx);
                }
            }
        });
    }

    /** @return list<string> */
    private function searchSubscriberNamesForEvent(string $eventName, DoctrineConnection $tx): array
    {
        $rows = $tx->fetchAll(\sprintf(
            'SELECT subscriber_name FROM %s.domain_events_routing WHERE event_name = ?',
            self::SCHEMA,
        ), [$eventName]);

        return array_column($rows, 'subscriber_name');
    }

    private function insertEventForSubscriber(
        DomainEvent $event,
        string $subscriberName,
        DoctrineConnection $tx,
    ): void {
        $tx->insert(
            sprintf('%s.domain_events_to_consume', self::SCHEMA),
            [
                'event_id' => $event->eventId,
                'subscriber_name' => $subscriberName,
                'name' => $event->eventName,
                'attributes' => json_encode($event->toPrimitives()),
                'occurred_at' => $this->connection->formatTimestamp($event->occurredAt),
            ],
        );
    }

    /**
     * @param  list<string>|string $subscribers "*"-wildcard o lista con los nombres de los suscriptores que esta app procesa
     * @return list<array{event_id: string, subscriber_name: string, name: string, attributes: mixed, occurred_at: string, retries: int}>
     */
    private function searchEventsToConsume(
        array|string $subscribers,
        int $limit,
        DoctrineConnection $tx,
    ): array {
        $sql = sprintf(
            'SELECT event_id, subscriber_name, name, attributes, occurred_at, retries
             FROM %s.domain_events_to_consume
             WHERE is_in_dead_letter = 0',
            self::SCHEMA,
        );
        $params = [];

        if (is_array($subscribers)) {
            $sql .= sprintf(
                ' AND subscriber_name IN (%s)',
                implode(', ', array_fill(0, count($subscribers), '?')),
            );
            $params = $subscribers;
        }

        // El limit es un int interno (no input externo): se interpola como la
        // referencia (el template de la cola lo interpola con el placeholder)
        $sql .= sprintf(' ORDER BY inserted_at ASC LIMIT %d FOR UPDATE SKIP LOCKED', $limit);

        return $tx->fetchAll($sql, $params);
    }

    /**
     * @param array{event_id: string, subscriber_name: string, name: string, attributes: mixed, occurred_at: string, retries: int} $row
     */
    private function executeSubscriberForEvent(array $row, DoctrineConnection $tx): void
    {
        $event = $this->eventNameToClass()->searchEvent(
            $row['event_id'],
            $row['name'],
            (array) json_decode((string) $row['attributes'], true),
            new \DateTimeImmutable((string) $row['occurred_at'], new \DateTimeZone('UTC')),
        );

        if ($event === null) {
            ConsoleOutput::writeError("\t❌ Unknown event type: {$row['name']}\n");

            return;
        }

        $subscriber = $this->subscriberNameToClass()->search($row['subscriber_name']);

        if ($subscriber === null) {
            ConsoleOutput::writeError("\t❌ Unknown subscriber: {$row['subscriber_name']}\n");

            return;
        }

        ConsoleOutput::write(
            "\n📥 Consuming event `{$event->eventName}` for subscriber `{$subscriber->name()}`"
            ."(retry {$row['retries']}/".self::MAX_RETRIES.")\n",
        );

        try {
            $subscriber->on($event);

            $tx->delete(
                sprintf('%s.domain_events_to_consume', self::SCHEMA),
                [
                    'event_id' => $row['event_id'],
                    'subscriber_name' => $row['subscriber_name'],
                ],
            );
        } catch (\Throwable $error) {
            ConsoleOutput::writeError(
                "\t❌ Error executing subscriber {$subscriber->name()} for {$event->eventName}: "
                .$error->getMessage()."\n",
            );

            if ($row['retries'] >= self::MAX_RETRIES - 1) {
                ConsoleOutput::writeError(
                    "\t💀 Moving event to dead letter after ".self::MAX_RETRIES." failed attempts\n",
                );

                $tx->update(
                    sprintf('%s.domain_events_to_consume', self::SCHEMA),
                    [
                        'is_in_dead_letter' => 1,
                        'retries' => $row['retries'] + 1,
                    ],
                    [
                        'event_id' => $row['event_id'],
                        'subscriber_name' => $row['subscriber_name'],
                    ],
                );
            } else {
                $tx->update(
                    sprintf('%s.domain_events_to_consume', self::SCHEMA),
                    ['retries' => $row['retries'] + 1],
                    [
                        'event_id' => $row['event_id'],
                        'subscriber_name' => $row['subscriber_name'],
                    ],
                );
            }
        }
    }

    private function eventNameToClass(): DomainEventNameToClass
    {
        return $this->eventClassesCache ??= DomainEventNameToClass::fromSubscribers(
            $this->subscribers,
        );
    }

    private function subscriberNameToClass(): DomainEventSubscriberNameToClass
    {
        return $this->subscriberClassesCache ??= new DomainEventSubscriberNameToClass(
            $this->subscribers,
        );
    }
}
