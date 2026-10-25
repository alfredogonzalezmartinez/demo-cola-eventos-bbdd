<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\Controller;

/**
 * Layout común de las páginas del back-office (HTML en strings, sin twig):
 * mismo look que las páginas SSR de app2 (Tailwind, tema slate oscuro).
 */
final class PageHtml
{
    public static function render(string $title, string $content): string
    {
        return <<<HTML
<!DOCTYPE html>
<html lang="es" class="bg-slate-950">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{$title}</title>
    <link rel="stylesheet" href="/app.css">
</head>
<body class="bg-slate-950 text-slate-200 font-sans p-6 min-h-screen">
    <main class="max-w-2xl mx-auto">{$content}</main>
</body>
</html>
HTML;
    }
}
