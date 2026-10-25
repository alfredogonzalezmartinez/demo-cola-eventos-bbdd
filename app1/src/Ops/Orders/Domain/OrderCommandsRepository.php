<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain;

/**
 * Registro de comandos emitidos a app2 (BD `ops`, docs/05): mecanismo
 * PROPIO del back-office — el indicador de "pendiente" NUNCA consulta la
 * cola de eventos (hoy MySQL, mañana puede ser cualquier otro sistema).
 */
interface OrderCommandsRepository
{
    public function add(OrderCommand $command): void;

    /**
     * ¿Hay algún comando emitido cuyo efecto aún no se vea reflejado en la
     * proyección? Condición de token: `requested_status` no aplicado, o
     * `status_changed_at` anterior al `requested_at` del comando.
     */
    public function hasPending(string $orderId): bool;
}
