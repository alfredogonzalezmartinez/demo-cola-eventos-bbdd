-- Fase 0 · BD de dominio del escenario e-commerce (ver docs/02-escenario-demo.md)
CREATE DATABASE IF NOT EXISTS comercio;
USE comercio;

CREATE TABLE orders (
    id             CHAR(36) PRIMARY KEY NOT NULL,
    email          VARCHAR(255) NOT NULL,
    total_amount   DECIMAL(10, 2) NOT NULL,
    total_currency CHAR(3) NOT NULL,
    status         ENUM('created', 'confirmed', 'shipped') NOT NULL DEFAULT 'created',
    created_at     TIMESTAMP NOT NULL
);

CREATE TABLE order_items (
    id         CHAR(36) PRIMARY KEY NOT NULL,
    order_id   CHAR(36) NOT NULL,
    product_id CHAR(36) NOT NULL,
    quantity   INT NOT NULL,
    INDEX idx__order_items__order_id (order_id)
);

CREATE TABLE products (
    id             CHAR(36) PRIMARY KEY NOT NULL,
    name           VARCHAR(255) NOT NULL,
    price_amount   DECIMAL(10, 2) NOT NULL,
    price_currency CHAR(3) NOT NULL,
    views          INT NOT NULL DEFAULT 0
);

CREATE TABLE order_status_history (
    id         CHAR(36) PRIMARY KEY NOT NULL,
    order_id   CHAR(36) NOT NULL,
    status     VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP NOT NULL,
    INDEX idx__order_status_history__order_id (order_id)
);

-- Acceso de las apps al dominio e-commerce
GRANT ALL PRIVILEGES ON `comercio`.* TO 'demo'@'%';
