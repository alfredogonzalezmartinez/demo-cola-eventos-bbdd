<?php

declare(strict_types=1);

namespace App\Shared\Domain\Event;

/** Interfaz mínima de la referencia (`EventBus.ts`, docs/05) */
interface EventBus
{
    /** @param list<DomainEvent> $events */
    public function publish(array $events): void;
}
