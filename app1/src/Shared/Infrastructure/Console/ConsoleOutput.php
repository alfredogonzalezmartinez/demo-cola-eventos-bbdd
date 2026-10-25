<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Console;

/**
 * Salida SAPI-safe: STDOUT/STDERR solo existen en CLI, así que en el ciclo
 * web (php -S) redirigimos a error_log, que acaba en los logs del contenedor.
 */
final class ConsoleOutput
{
    public static function write(string $message): void
    {
        if (self::isCli()) {
            fwrite(STDOUT, $message);
        } else {
            error_log($message);
        }
    }

    public static function writeError(string $message): void
    {
        if (self::isCli()) {
            fwrite(STDERR, $message);
        } else {
            error_log($message);
        }
    }

    private static function isCli(): bool
    {
        return \PHP_SAPI === 'cli';
    }
}
