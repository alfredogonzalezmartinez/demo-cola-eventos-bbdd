<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Console;

use App\Shared\Infrastructure\DomainEvent\DomainEventSubscriberNameToEventNames;
use App\Shared\Infrastructure\Persistence\DoctrineConnection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

use const STDOUT;

/**
 * Port del script sync-routing de la referencia (docs/05): inscribe
 * `(event_name, subscriber_name)` a partir de los suscriptores taggeados
 * `subscriber` en el DIC. `INSERT IGNORE` (el `ON CONFLICT ... DO NOTHING` de
 * MySQL) hace el sync idempotente.
 */
#[AsCommand(name: 'events:sync-routing')]
final class EventsSyncRoutingCommand extends Command
{
    private readonly DoctrineConnection $connection;
    private array $subscribers;

    /**
     * @param iterable<App\Shared\Domain\Event\DomainEventSubscriber> $subscribers
     *        Suscriptores taggeados `subscriber` (misma fuente que el bus)
     */
    public function __construct(
        DoctrineConnection $connection,
        iterable $subscribers,
    ) {
        $this->connection = $connection;
        // El !tagged_iterator del DIC alimenta un RewindableGenerator
        $this->subscribers = iterator_to_array($subscribers, false);
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $subscriberNameToEventNames =
            (new DomainEventSubscriberNameToEventNames($this->subscribers))->all();

        $count = count($this->subscribers);
        fwrite(STDOUT, "\n🔄 Syncing routing for {$count} subscribers...\n\n");

        try {
            foreach ($subscriberNameToEventNames as $subscriberName => $eventNames) {
                foreach ($eventNames as $eventName) {
                    $this->connection->execute(
                        'INSERT IGNORE INTO eventos.domain_events_routing'
                        .' (event_name, subscriber_name) VALUES (?, ?)',
                        [$eventName, $subscriberName],
                    );

                    fwrite(STDOUT, "  ✅ {$eventName} → {$subscriberName}\n");
                }
            }
        } catch (\Throwable $error) {
            fwrite(STDERR, '❌ Error during routing sync: '.$error->getMessage()."\n");

            return Command::FAILURE;
        }

        fwrite(STDOUT, "\n✨ Routing sync completed!\n");

        return Command::SUCCESS;
    }
}
