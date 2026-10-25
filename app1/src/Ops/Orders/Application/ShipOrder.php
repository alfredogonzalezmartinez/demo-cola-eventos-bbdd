<?php

declare(strict_types=1);

namespace App\Ops\Orders\Application;

use App\Ops\Orders\Domain\OrderCommand;
use App\Ops\Orders\Domain\OrderCommandsRepository;
use App\Ops\Orders\Domain\OrderNotFoundException;
use App\Ops\Orders\Domain\OrderStatusChangeNotAllowedException;
use Symfony\Component\Uid\Uuid;

/**
 * Comando `Enviar` del back-office (remodelado, docs/05): llama SÍNCRONAMENTE
 * a app2 (dueño del estado de `comercio`) y registra el comando en
 * `ops.order_commands` con el token de app2 si aceptó (200). El número de
 * seguimiento es opcional — formato PLK-##### de docs/04.
 */
final class ShipOrder
{
    public function __construct(
        private readonly \App\Ops\Orders\Infrastructure\OpsApiClient $api,
        private readonly OrderCommandsRepository $commands,
    ) {}

    /** @throws OrderNotFoundException|OrderStatusChangeNotAllowedException */
    public function __invoke(string $orderId, ?string $trackingNumber = null): void
    {
        $response = $this->api->ship($orderId, $trackingNumber);
        $body = (array) json_decode($response['body'], true, flags: JSON_THROW_ON_ERROR) ?: [];

        switch ($response['statusCode']) {
            case 200:
                $this->commands->add(new OrderCommand(
                    Uuid::v4()->toRfc4122(),
                    $orderId,
                    'ship',
                    'shipped',
                    new \DateTimeImmutable((string) $body['statusChangedAt']),
                ));
                break;

            case 404:
                throw new OrderNotFoundException($orderId);

            case 409:
                throw new OrderStatusChangeNotAllowedException(
                    $orderId,
                    (string) ($body['currentStatus'] ?? 'unknown'),
                    (string) ($body['expectedStatus'] ?? 'confirmed'),
                );

            default:
                throw new \RuntimeException(
                    "Ops api rejected order command ({$response['statusCode']}): "
                    .((string) ($body['error'] ?? 'unknown error')),
                );
        }
    }
}
