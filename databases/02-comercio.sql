-- Fase 0 · BD de dominio del escenario e-commerce (ver docs/02-escenario-demo.md)
-- El cliente del initdb corre con charset `auto` (latin1 en la práctica):
-- SET NAMES fija la sesión para leer el fichero UTF-8 sin doble encode.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS comercio;
USE comercio;

CREATE TABLE orders (
    id             CHAR(36) PRIMARY KEY NOT NULL,
    email          VARCHAR(255) NOT NULL,
    total_amount   DECIMAL(10, 2) NOT NULL,
    total_currency CHAR(3) NOT NULL,
    status         ENUM('created', 'confirmed', 'shipped') NOT NULL DEFAULT 'created',
    created_at     TIMESTAMP(6) NOT NULL
);

CREATE TABLE order_items (
    id         CHAR(36) PRIMARY KEY NOT NULL,
    order_id   CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    quantity   INT NOT NULL,
    INDEX idx__order_items__order_id (order_id)
);

-- Proyección del catálogo (remodelado, docs/03): la fuente vive en `ops`
-- (back-office de app1) y este suscriptor la mantiene al día con los
-- eventos `ops.product_*` (guard por fechas contra `changed_at` del 03-ops.sql).
CREATE TABLE products (
    id             CHAR(36) PRIMARY KEY NOT NULL,
    name           VARCHAR(255) NOT NULL,
    price_amount   DECIMAL(10, 2) NOT NULL,
    price_currency CHAR(3) NOT NULL,
    changed_at     TIMESTAMP(6) NOT NULL
);

CREATE TABLE order_status_history (
    id              CHAR(36) PRIMARY KEY NOT NULL,
    order_id        CHAR(36) NOT NULL,
    status          VARCHAR(50) NOT NULL,
    tracking_number VARCHAR(255) NULL,
    changed_at      TIMESTAMP(6) NOT NULL,
    INDEX idx__order_status_history__order_id (order_id)
);

-- Acceso de las apps al dominio e-commerce
GRANT ALL PRIVILEGES ON `comercio`.* TO 'demo'@'%';

-- Seed de la demo (docs/02): catálogo fijo con precios en EUR.
-- Se ejecuta sólo al recrear el volumen del contenedor (initdb).
INSERT INTO products (id, name, price_amount, price_currency, changed_at) VALUES
    ('8d7a1c5b-45a3-4462-8804-2d454474c001', 'Teclado mecánico',   49.90, 'EUR', NOW(6)),
    ('5f7e42b3-0e42-4bb3-8c6a-6a1c4fd3c002', 'Ratón inalámbrico', 24.50, 'EUR', NOW(6)),
    ('c29e0774-1b46-4051-a2b8-72b7d4f0c003', 'Hub USB-C',          9.90, 'EUR', NOW(6));
