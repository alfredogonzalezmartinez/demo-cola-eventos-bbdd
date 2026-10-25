<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain;

/**
 * Escrituras de la proyección `ops.orders` que ejecuta el suscriptor
 * `OrderProjection` (docs/04): insert del `order_created` con upsert y
 * `applyStatus` para los eventos `ops.order_*`.
 */
interface OrderProjectionRepository
{
    public function upsertCreated(
        string $orderId,
        string $email,
        float $totalAmount,
        string $totalCurrency,
        \DateTimeImmutable $occurredAt,
    ): void;

    /** Guard por fechas: un evento duplicado o desordenado (anterior al último aplicado) no retrocede la proyección */
    public function applyStatus(string $orderId, string $status, \DateTimeImmutable $occurredAt): void;
}
