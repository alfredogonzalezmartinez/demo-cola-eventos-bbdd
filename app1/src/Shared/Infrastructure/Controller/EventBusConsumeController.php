<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Controller;

use App\Shared\Infrastructure\Console\ConsoleOutput;
use App\Shared\Infrastructure\DomainEvent\MysqlDoctrineEventBus;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Mismo contrato que la API route de consume de app2 (docs/07):
 * `subscribers` (CSV o `*`, default `*`) y `limit` (default `10`) por query
 * param, con Bearer `CRON_SECRET`.
 */
#[AsController]
final class EventBusConsumeController
{
    public function __construct(private readonly MysqlDoctrineEventBus $eventBus) {}

    #[Route('/api/event-bus/consume', name: 'shared_event_bus_consume', methods: ['GET'])]
    public function __invoke(Request $request): Response
    {
        // variables_order por defecto (GPCS) no llena $_SERVER con el entorno:
        // getenv() lee el proceso real y funciona en CLI y web.
        if ($request->headers->get('authorization') !== 'Bearer '.(getenv('CRON_SECRET') ?: '')) {
            return new Response('', 401);
        }

        $subscribersParam = $request->query->get('subscribers');
        $subscribers = $subscribersParam === null || $subscribersParam === '*'
            ? '*'
            : array_values(array_map('trim', explode(',', (string) $subscribersParam)));
        $limit = (int) ($request->query->get('limit') ?? '10');

        try {
            $this->eventBus->consume($subscribers, $limit);

            return new Response('', 200);
        } catch (\Throwable $error) {
            ConsoleOutput::writeError('Error consuming events: '.$error->getMessage()."\n");

            return new Response('', 500);
        }
    }
}
