<?php

declare(strict_types=1);

namespace App\Shared\Domain;

/**
 * Port del `retry.ts` de la referencia: 3 intentos con backoff 30ms*largo
 * (docs/05: el `publish` del bus reintenta así).
 *
 * @template T
 *
 * @param callable(): T $fn
 * @param int           $maxAttempts
 * @param int           $delayMs
 *
 * @return T
 */
final class Retry
{
    public static function exec(callable $fn, int $maxAttempts = 3, int $delayMs = 30): mixed
    {
        $attempt = 1;

        while (true) {
            try {
                return $fn();
            } catch (\Throwable $error) {
                if ($attempt >= $maxAttempts) {
                    throw $error;
                }

                usleep($delayMs * 1000 * $attempt);
                $attempt++;
            }
        }
    }
}
