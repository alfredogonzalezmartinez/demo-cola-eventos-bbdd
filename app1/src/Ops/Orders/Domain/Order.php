<?php

declare(strict_types=1);

namespace App\Ops\Orders\Domain;

/**
 * Proyección del pedido que vive en la BD `ops` del back-office (docs/03):
 * la alimenta el suscriptor `OrderProjection` con `commerce.order_created`
 * + `ops.order_confirmed/order_shipped`. `statusChangedAt` guarda el
 * instante del último evento aplicado — el token del guard anti-duplicados.
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
        public ?\DateTimeImmutable $statusChangedAt = null,
    ) {}
}
