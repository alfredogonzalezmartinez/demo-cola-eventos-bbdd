<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain;

/**
 * Read model del pedido que vive en `comercio` (dueño: app2). ops sólo lo
 * lee para validar el estado previo y enriquecer los eventos (docs/04, regla
 * 4): el evento es un *gist* y la BD de `comercio`, fuente de verdad.
 */
final readonly class Order
{
    /**
     * @param 'created'|'confirmed'|'shipped' $status
     */
    public function __construct(
        public string $id,
        public string $email,
        public float $totalAmount,
        public string $totalCurrency,
        public string $status,
        public \DateTimeImmutable $createdAt,
    ) {}
}
