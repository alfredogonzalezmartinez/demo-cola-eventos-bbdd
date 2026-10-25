<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\DomainEvent;

/** Port ligero del `CodelyError` de la referencia (base del sistema de errores del shared) */
abstract class CodelyError extends \RuntimeException
{
}
