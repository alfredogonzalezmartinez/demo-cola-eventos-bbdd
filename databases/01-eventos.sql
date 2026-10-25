-- Fase 0 · BD de la cola de eventos compartida (infraestructura, ver docs/04-modelo-eventos.md)
-- El cliente del initdb corre con charset `auto` (latin1 en la práctica):
-- SET NAMES fija la sesión para leer el fichero UTF-8 sin doble encode.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS eventos;
USE eventos;

CREATE TABLE domain_events_to_consume (
    event_id        CHAR(36)     NOT NULL,
    subscriber_name VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    attributes      JSON         NOT NULL,
    occurred_at     TIMESTAMP(6) NOT NULL,
    inserted_at     TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    retries         INT          NOT NULL DEFAULT 0,
    is_in_dead_letter BOOLEAN    NOT NULL DEFAULT FALSE,
    PRIMARY KEY (event_id, subscriber_name),
    INDEX idx__domain_events_to_consume__inserted_at (inserted_at),
    INDEX idx__domain_events_to_consume__subscriber_name (subscriber_name)
);

CREATE TABLE domain_events_routing (
    event_name      VARCHAR(255) NOT NULL,
    subscriber_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (event_name, subscriber_name),
    INDEX idx__domain_events_routing__event_name (event_name)
);

-- Acceso de las apps a la cola (el usuario demo ya existe cuando se ejecuta este script)
GRANT ALL PRIVILEGES ON `eventos`.* TO 'demo'@'%';
