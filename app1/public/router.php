<?php

declare(strict_types=1);

// Front controller del dev server embebido (`php -S ... router.php`, CMD del
// Dockerfile): los ficheros existentes se sirven tal cual y el resto entra
// por el kernel Symfony.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if ($path !== '/' && file_exists(__DIR__.$path)) {
    return false;
}

require __DIR__.'/index.php';
