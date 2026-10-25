<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain;

/**
 * Registro local de un comando enviado a app2 (patrón versión/token, docs/05):
 * sólo hay fila si app2 aceptó el comando (200). `requestedAt` es el instante
 * en que app2 escribió el estado — el token que la proyección de app1
 * comparará para saber si el comando ya se refleja.
 */
final readonly class OrderCommand
{
    /**
     * @param 'confirm'|'ship'                      $action
     * @param 'confirmed'|'shipped'                 $requestedStatus
     */
    public function __construct(
        public string $id,
        public string $orderId,
        public string $action,
        public string $requestedStatus,
        public \DateTimeImmutable $requestedAt,
    ) {}
}
