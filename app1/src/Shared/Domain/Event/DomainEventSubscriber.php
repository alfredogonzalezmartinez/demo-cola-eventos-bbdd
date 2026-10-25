<?php

declare(strict_types=1);

namespace App\Shared\Domain\Event;

/** Contrato de docs/04 — igual a `DomainEventSubscriber` de la referencia */
interface DomainEventSubscriber
{
    /** Lógica de negocio */
    public function on(DomainEvent $event): void;

    /** Qué eventos escucha */
    public function subscribedTo(): array;

    /** Nombre único global de la cola (llave en `domain_events_routing`, docs/04) */
    public function name(): string;
}
