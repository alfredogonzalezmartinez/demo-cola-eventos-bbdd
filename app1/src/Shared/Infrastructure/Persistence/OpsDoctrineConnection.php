<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Persistence;

/** Token de DI para la conexión a la BD `ops` del back-office (docs/03-07) */
final class OpsDoctrineConnection extends DoctrineConnection {}
