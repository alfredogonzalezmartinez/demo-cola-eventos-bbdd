<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Console;

use App\Shared\Infrastructure\DomainEvent\MysqlDoctrineEventBus;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

use const STDOUT;

/**
 * Ronda de consume: mismo algoritmo y args que `import-consumv` events de la
 * referencia y de app2 (`subscribers` CSV o `*`, `limit`, docs/06).
 */
#[AsCommand(name: 'events:consume')]
final class EventsConsumeCommand extends Command
{
    public function __construct(private readonly MysqlDoctrineEventBus $eventBus)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('subscribers', InputArgument::OPTIONAL, 'CSV de suscriptores o *', '*');
        $this->addArgument('limit', InputArgument::OPTIONAL, 'Máximo de filas por ronda', '10');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $subscribers = $this->parseSubscribers((string) $input->getArgument('subscribers'));
        $limit = (int) $input->getArgument('limit');

        fwrite(STDOUT, "🚀 Starting MySQL event consumer...\n\n");
        fwrite(STDOUT, '📋 Subscribers: '.(is_string($subscribers) ? 'all' : implode(', ', $subscribers))."\n");
        fwrite(STDOUT, "📊 Limit: {$limit}\n\n");

        try {
            $this->eventBus->consume($subscribers, $limit);
        } catch (\Throwable $error) {
            fwrite(STDERR, '❌ Error during event consumption: '.$error->getMessage()."\n");

            return Command::FAILURE;
        }

        fwrite(STDOUT, "\n✨ Consumption process finished\n");

        return Command::SUCCESS;
    }

    private function parseSubscribers(string $value): array|string
    {
        if ($value === '*' || $value === '') {
            return '*';
        }

        return array_values(array_filter(array_map('trim', explode(',', $value))));
    }
}
