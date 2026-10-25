<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure;

/**
 * Cliente HTTP del comando síncrono confirm/ship hacia app2 (docs/05):
 * Bearer `OPS_API_TOKEN` contra la API interna de app2. Sin dependencias
 * extra: `file_get_contents` con contexto (la imagen php-cli no trae curl).
 */
final class OpsApiClient
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $token,
    ) {}

    /** @return array{statusCode: int, body: string} */
    public function confirm(string $orderId): array
    {
        return $this->post('/api/ops/orders/'.$orderId.'/confirm', '{}');
    }

    /** @return array{statusCode: int, body: string} */
    public function ship(string $orderId, ?string $trackingNumber): array
    {
        return $this->post(
            '/api/ops/orders/'.$orderId.'/ship',
            (string) json_encode(['tracking' => $trackingNumber]),
        );
    }

    /** @return array{statusCode: int, body: string} */
    private function post(string $path, string $jsonBody): array
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n"
                    .'Authorization: Bearer '.$this->token."\r\n",
                'content' => $jsonBody,
                'ignore_errors' => true,   // el 4xx llega como respuesta, no warning
                'timeout' => 5,
            ],
        ]);

        $body = file_get_contents($this->baseUrl.$path, false, $context);

        if ($body === false) {
            throw new \RuntimeException('Ops api request failed: '.$path);
        }

        return [
            'statusCode' => self::statusCode($http_response_header),
            'body' => $body,
        ];
    }

    /** @param list<string> $headers */
    private static function statusCode(array $headers): int
    {
        // La respuesta puede llevar cabecidas intermedias (redirects):
        // vale la última línea `HTTP/…`
        $statusLine = '';

        foreach ($headers as $header) {
            if (str_starts_with($header, 'HTTP/')) {
                $statusLine = $header;
            }
        }

        return (int) (explode(' ', $statusLine)[1] ?? 500);
    }
}
