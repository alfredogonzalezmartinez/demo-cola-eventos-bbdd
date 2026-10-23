# demo-cola-eventos-bbdd

Demo de un sistema de **eventos de dominio en base de datos** consumido por **dos aplicaciones** distintas:

- **app1** — PHP 8.3 + Symfony
- **app2** — Node 26 + Astro (SSR)
- **bbdd** — MySQL 8.0.40 con la cola de eventos (`eventos`) y el dominio (`comercio`)

Ambas apps publican y consumen la misma cola mediante tablas SQL (sin broker externo), replicando la lógica del [curso de Codely sobre event bus en BBDD](https://github.com/CodelyTV/infrastructure_design-eventbus-db-course/tree/main/06-to_prod/2-multiples_apps).

## 📚 Documentación

Toda la documentación del proyecto está en [`docs/`](docs/README.md):

1. [Visión general](docs/01-vision-general.md) — objetivo y decisiones técnicas
2. [Escenario de la demo](docs/02-escenario-demo.md) — e-commerce, eventos y flujos
3. [Arquitectura](docs/03-arquitectura.md) — contenedores, DDD y arquitectura hexagonal
4. [Modelo de eventos](docs/04-modelo-eventos.md) — tablas, payload, naming y suscriptores (el contrato entre apps)
5. [Flujo de publicación](docs/05-flujo-publicacion.md)
6. [Flujo de consumo](docs/06-flujo-consumo.md) — cron, retries y dead letter
7. [Infraestructura](docs/07-infraestructura.md) — Docker, compose, Makefile y puesta en marcha
8. [Referencia Codely](docs/08-referencia-codely.md) — mapeo 1:1 con el repo de referencia y adaptaciones a MySQL

## Requisitos

- Docker + Docker Compose
- Node 26 (para la app2 y su tooling)
- PHP 8.3 (para la app1 y su tooling)
