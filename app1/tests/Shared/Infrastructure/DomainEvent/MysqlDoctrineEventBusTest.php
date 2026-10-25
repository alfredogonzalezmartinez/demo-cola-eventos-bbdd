<?php

declare(strict_types=1);

namespace App\Tests\Shared\Infrastructure\DomainEvent;

use App\Shared\Infrastructure\DomainEvent\DomainEventSubscriberNameToEventNames;
use App\Shared\Infrastructure\DomainEvent\MysqlDoctrineEventBus;
use App\Shared\Infrastructure\Persistence\DoctrineConnection;
use PHPUnit\Framework\TestCase;

final class MysqlDoctrineEventBusTest extends TestCase
{
    private DoctrineConnection $connection;
    private MysqlDoctrineEventBus $eventBus;
    private TestDomainEventSubscriber $testSubscriber;
    private AnotherTestDomainEventSubscriber $anotherSubscriber;

    protected function setUp(): void
    {
        $this->connection = new DoctrineConnection($_ENV['EVENTOS_DSN']);

        // Contenedor local de pruebas: misma pieza que el diod de shared pero
        // con los suscriptores de test taggeados (1:1 con app2). El sync del
        // routing REPLICA al comando: subscribedTo() + name(), nada a mano.
        $this->testSubscriber = new TestDomainEventSubscriber();
        $this->anotherSubscriber = new AnotherTestDomainEventSubscriber();
        $this->eventBus = new MysqlDoctrineEventBus(
            $this->connection,
            [$this->testSubscriber, $this->anotherSubscriber],
        );

        // truncateAll equivalente + sync de routing antes de cada caso (app2)
        $this->connection->execute('DELETE FROM eventos.domain_events_to_consume');
        $this->connection->execute('DELETE FROM eventos.domain_events_routing');

        $subscriberToEvents = (new DomainEventSubscriberNameToEventNames(
            [$this->testSubscriber, $this->anotherSubscriber],
        ))->all();

        foreach ($subscriberToEvents as $subscriberName => $eventNames) {
            foreach ($eventNames as $eventName) {
                $this->connection->execute(
                    'INSERT IGNORE INTO eventos.domain_events_routing'
                    .' (event_name, subscriber_name) VALUES (?, ?)',
                    [$eventName, $subscriberName],
                );
            }
        }
    }

    protected function tearDown(): void
    {
        $this->connection->close();
    }

    public function testShouldPublishASingleEventToEachSubscriber(): void
    {
        $event = TestDomainEventMother::create();

        $this->eventBus->publish([$event]);

        $result = $this->connection->fetchAll(
            'SELECT event_id, subscriber_name, name, attributes, occurred_at'
            .' FROM eventos.domain_events_to_consume'
            .' WHERE event_id = ? ORDER BY subscriber_name',
            [$event->eventId],
        );

        self::assertCount(2, $result);

        foreach ($result as $row) {
            self::assertSame($event->eventId, (string) $row['event_id']);
            self::assertSame($event::EVENT_NAME, (string) $row['name']);
            self::assertEquals($event->toPrimitives(), json_decode((string) $row['attributes'], true));
            self::assertSame(
                $this->connection->formatTimestamp($event->occurredAt),
                (string) $row['occurred_at'],
            );
        }
    }

    public function testShouldDoNothingWhenPublishingAnEmptyArray(): void
    {
        $this->eventBus->publish([]);

        $result = $this->connection->fetchAll(
            'SELECT COUNT(*) AS count FROM eventos.domain_events_to_consume',
        );

        self::assertSame(0, (int) $result[0]['count']);
    }

    public function testShouldRetryUpToThreeTimesOnFailure(): void
    {
        $connection = new RetryingConnectionTestDouble(failures: 99);
        $event = TestDomainEventMother::create();
        $bus = new MysqlDoctrineEventBus($connection, [$this->testSubscriber]);

        try {
            $bus->publish([$event]);
            self::fail('Expected the publish to fail after 3 attempts');
        } catch (\RuntimeException $error) {
            self::assertSame('Database connection failed', $error->getMessage());
        }

        self::assertSame(3, $connection->attempts);
    }

    public function testShouldSucceedOnSecondAttempt(): void
    {
        $connection = new RetryingConnectionTestDouble(failures: 1);
        $event = TestDomainEventMother::create();
        $bus = new MysqlDoctrineEventBus($connection, [$this->testSubscriber]);

        $bus->publish([$event]);

        self::assertSame(2, $connection->attempts);
    }

    public function testShouldConsumeAndDeleteEventsForAllSubscribersWithWildcard(): void
    {
        $event = TestDomainEventMother::create();
        $this->eventBus->publish([$event]);

        $this->eventBus->consume('*', 100);

        $result = $this->connection->fetchAll(
            'SELECT event_id FROM eventos.domain_events_to_consume WHERE event_id = ?',
            [$event->eventId],
        );
        self::assertCount(0, $result);

        self::assertCount(1, $this->testSubscriber->executedEvents);
        self::assertCount(1, $this->anotherSubscriber->executedEvents);
    }

    public function testShouldConsumeOnlyEventsForSpecifiedSubscriber(): void
    {
        $event = TestDomainEventMother::create();
        $this->eventBus->publish([$event]);

        $this->eventBus->consume(['test.domain.event.subscriber'], 100);

        $remaining = $this->connection->fetchAll(
            'SELECT subscriber_name FROM eventos.domain_events_to_consume WHERE event_id = ?',
            [$event->eventId],
        );

        self::assertNotContains(
            'test.domain.event.subscriber',
            array_column($remaining, 'subscriber_name'),
        );
        self::assertSame(
            ['test.another.subscriber'],
            array_column($remaining, 'subscriber_name'),
        );
    }

    public function testShouldNotConsumeUnknownEvents(): void
    {
        $unknownEventId = '00000000-0000-0000-0000-000000000001';

        $this->connection->execute(
            'INSERT INTO eventos.domain_events_to_consume'
            .' (event_id, subscriber_name, name, attributes, occurred_at)'
            ." VALUES (?, 'test.subscriber', 'unknown.event.name', '{\"data\": \"test\"}', NOW(6))",
            [$unknownEventId],
        );

        $this->eventBus->consume('*', 10);

        $unknownEvent = $this->connection->fetchAll(
            'SELECT event_id FROM eventos.domain_events_to_consume WHERE event_id = ?',
            [$unknownEventId],
        );

        self::assertCount(1, $unknownEvent);
    }

    public function testShouldDoNothingWhenThereAreNoEvents(): void
    {
        $before = $this->connection->fetchAll(
            'SELECT COUNT(*) AS count FROM eventos.domain_events_to_consume',
        );

        $this->eventBus->consume('*', 10);

        $after = $this->connection->fetchAll(
            'SELECT COUNT(*) AS count FROM eventos.domain_events_to_consume',
        );

        self::assertSame((int) $before[0]['count'], (int) $after[0]['count']);
    }
}
