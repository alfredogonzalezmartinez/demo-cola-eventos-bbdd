-- Remodelado del escenario (ver docs/03-arquitectura.md): el back-office
-- (app1) posee una BD `ops` propia en el mismo servidor MySQL.
-- El cliente del initdb corre con charset `auto` (latin1 en la práctica):
-- SET NAMES fija la sesión para leer el fichero UTF-8 sin doble encode.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS ops;
USE ops;

-- Proyección de pedidos de app1: la alimentan los suscriptores que consumen
-- `commerce.order_created` + `ops.order_confirmed/order_shipped`. El guard
-- anti-duplicados/desorden compara contra `status_changed_at`.
CREATE TABLE orders (
    id                CHAR(36) PRIMARY KEY NOT NULL,
    email             VARCHAR(255) NOT NULL,
    total_amount      DECIMAL(10, 2) NOT NULL,
    total_currency    CHAR(3) NOT NULL,
    status            ENUM('created', 'confirmed', 'shipped') NOT NULL,
    created_at        TIMESTAMP(6) NOT NULL,
    status_changed_at TIMESTAMP(6) NULL
);

-- Registro local de comandos emitidos a app2 (patrón versión/token): sólo
-- guarda comandos que app2 aceptó (200). El indicador de "pendiente" del
-- back-office se deriva de comparar esta tabla con la proyección — nunca de
-- la cola de eventos (hoy MySQL, mañana cualquier otra infraestructura).
CREATE TABLE order_commands (
    id               CHAR(36) PRIMARY KEY NOT NULL,
    order_id         CHAR(36) NOT NULL,
    action           ENUM('confirm', 'ship') NOT NULL,
    requested_status ENUM('confirmed', 'shipped') NOT NULL,
    requested_at     TIMESTAMP(6) NOT NULL,
    INDEX idx__order_commands__order_id (order_id)
);

-- Fuente de verdad del catálogo: app1 lo escribe desde el back-office y
-- publica `ops.product_*`; `comercio.products` es una proyección de app2.
-- `views` es métrica local (la sube el consumidor de `commerce.product_viewed`).
CREATE TABLE products (
    id             CHAR(36) PRIMARY KEY NOT NULL,
    name           VARCHAR(255) NOT NULL,
    price_amount   DECIMAL(10, 2) NOT NULL,
    price_currency CHAR(3) NOT NULL,
    views          INT NOT NULL DEFAULT 0,
    changed_at     TIMESTAMP(6) NOT NULL
);

-- Acceso de las apps a esta BD de ops
GRANT ALL PRIVILEGES ON `ops`.* TO 'demo'@'%';

-- Seed dual: los 3 productos del catálogo arrancan en la fuente (ops) y en
-- la proyección de app2 (02-comercio.sql) para que la demo arranque coherente.
INSERT INTO products (id, name, price_amount, price_currency, views, changed_at) VALUES
    ('8d7a1c5b-45a3-4462-8804-2d454474c001', 'Teclado mecánico',   49.90, 'EUR', 0, NOW(6)),
    ('5f7e42b3-0e42-4bb3-8c6a-6a1c4fd3c002', 'Ratón inalámbrico', 24.50, 'EUR', 0, NOW(6)),
    ('c29e0774-1b46-4051-a2b8-72b7d4f0c003', 'Hub USB-C',          9.90, 'EUR', 0, NOW(6));
