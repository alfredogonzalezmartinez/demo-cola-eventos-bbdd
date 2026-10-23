# Demo: cola de eventos en BBDD consumida por dos aplicaciones

Demo de un sistema de eventos de dominio persistidos en base de datos (cola sobre tablas SQL), consumido por **dos aplicaciones independientes**:

- **app2 (Node 26 + Astro SSR)** — la primera en implementarse, **copiando 1:1** los componentes del sistema de eventos del [repo de referencia de Codely](https://github.com/CodelyTV/infrastructure_design-eventbus-db-course/tree/main/06-to_prod/2-multiples_apps).
- **app1 (PHP 8.3 + Symfony)** — replica del mismo modelo de eventos en PHP.

Ambas apps **publican y consumen** de la misma cola de eventos en MySQL. Tres contenedores Docker: `app1`, `app2`, `bbdd`.

## Documentación

| Doc | Contenido |
|-----|-----------|
| [01-vision-general.md](01-vision-general.md) | Objetivo, decisión técnica, escenarios y guía de lectura |
| [02-escenario-demo.md](02-escenario-demo.md) | Escenario de ejemplo e-commerce: flujo end-to-end con diagrama de secuencia |
| [03-arquitectura.md](03-arquitectura.md) | Contenedores, bases de datos, DDD / arquitectura hexagonal, contextos acotados |
| [04-modelo-eventos.md](04-modelo-eventos.md) | Modelado de eventos de dominio: esquema de tablas, payload, naming y convenciones |
| [05-flujo-publicacion.md](05-flujo-publicacion.md) | Cómo publican las apps: componentes, contrato y comportamiento |
| [06-flujo-consumo.md](06-flujo-consumo.md) | Cómo consumen las apps: comando por cron, retries, dead letter, idempotencia |
| [07-infraestructura.md](07-infraestructura.md) | Docker, compose, Makefile, variables de entorno y puesta en marcha |
| [08-referencia-codely.md](08-referencia-codely.md) | Mapeo exacto con el repo de referencia y adaptaciones a MySQL |

## Resumen rápido

- **BBDD**: un servidor MySQL con dos bases de datos: `eventos` (cola compartida) y `comercio` (datos de dominio).
- **Cola**: tabla `eventos.domain_events_to_consume` con un registro por *(evento, suscriptor)*, más tabla de routing que decide quiénes reciben cada tipo de evento.
- **Consumo**: cada app tiene un **comando que se ejecuta cada X segundos** (cron) que extrae eventos pendientes con `FOR UPDATE SKIP LOCKED`, ejecuta sus suscriptores y borra/marca según el resultado. Reintentos y letras muertas incluidos.
- **Modelo**: DDD + arquitectura hexagonal + separación de dominios de cada aplicación, replicando la lógica y el comportamiento de Codely.
