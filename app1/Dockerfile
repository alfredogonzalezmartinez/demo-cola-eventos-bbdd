FROM php:8.3-cli

WORKDIR /app

# Un solo modelo de conexiones con PDO MySQL (socket nativo de PHP 8.3)
RUN docker-php-ext-install pdo_mysql

# Composer necesita unzip para instalar los paquetes
RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Deps instaladas en la imagen; el código fuente va montado por compose (dev).
# El volumen de compose sobre /app/vendor siembra este vendor en el primer up:
# cambiar dependencias después exige `docker exec app1 composer install`.
COPY composer.json ./
RUN composer install --no-interaction --no-progress

EXPOSE 8000
CMD ["php", "-S", "0.0.0.0:8000", "-t", "public", "public/router.php"]
