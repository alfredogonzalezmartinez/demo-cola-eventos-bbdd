# 08 · Referencia de Codely y mapeo con esta demo

Repo base: [CodelyTV/infrastructure_design-eventbus-db-course · 06-to_prod/2-multiples_apps](https://github.com/CodelyTV/infrastructure_design-eventbus-db-course/tree/main/06-to_prod/2-multiples_apps) — étapa final del curso: **una misma cola de eventos en la DB usada por varias apps**.

## Qué copiamos 1:1 en app2 (Node)

Todo el sistema de eventos de `src/contexts/shared/` — sin cambios salvo el driver:

| Componente (referencia) | Ruta en la referencia | Copia en app2 |
|---|---|---|
| `DomainEvent` (clase abstracta + `toPrimitives` + `fromPrimitives`) | `src/contexts/shared/domain/event/DomainEvent.ts` | idéntica |
| `EventBus` (interfaz: `publish(events)`) | `.../domain/event/EventBus.ts` | idéntica |
| `DomainEventSubscriber` (interface `on` / `subscribedTo` / `name`) | `.../domain/event/DomainEventSubscriber.ts` | idéntica |
| `PostgresEventBus` → **`MysqlEventBus`** | `.../infrastructure/domain-event/PostgresEventBus.ts` | única clase reelaborada: `postgres` → `mysql2`, `public.` → `eventos.` |
| `DomainEventNameToClass`, `DomainEventSubscriberNameToClass`, `DomainEventNameToSubscribers`, `DomainEventSubscriberNameToEventNames` | `.../infrastructure/domain-event/*` | idénticas |
| `InMemoryEventBus` | `.../infrastructure/domain-event/InMemoryEventBus.ts` | idéntica (tests unitarios) |
| `AggregateRoot` (+ `pullDomainEvents`) | `.../domain/AggregateRoot.ts` | idéntico |
| Contenedor DI con **diod** + tag `subscriber` | `.../dependency-injection/diod.config.ts` | ídem |
| API route de consumo con Bearer + script CLI de consume + script sync-routing | `src/app/api/event-bus/consume/route.ts`, `src/app/scripts/*` | mismas rutas, mapeadas a Astro: `src/pages/api/event-bus/consume.ts`, scripts en `src/app/scripts/*`, apuntando a MysqlEventBus |

## Ejecutables de la referencia ( Scripts)

| Fichero de la referencia | Qué hace | Traducción aquí |
|---|---|---|
| `src/app/scripts/consume-postgres-events.ts` | Ejecuta una ronda de consume (args: `subscribers limit`) | `consume-mysql-events.ts` (app2) / `events:consume` (app1) |
| `src/app/scripts/sync-domain-events-routing.ts` | Recorre los suscriptores taggeados en DI e inscribe `(event_name, subscriber_name)` en el routing | mismo, apuntando a la BD `eventos` |
| `src/app/scripts/create-courses.ts` | Seed de datos (dominio) | análogo: seed de productos/pedidos de la demo |
| `etc/scripts/1-start.sh` | Orquesta arranque (levantar servicios, verificar) | adaptar en los entrypoints |

## Qué cambia respecto a la referencia

| Ámbito | Referencia | Demo | Motivo / detalle |
|---|---|---|---|
| Motor BD | **Postgres** | **MySQL 8.0.40** | requisitos; ver [04](04-modelo-eventos.md#diferencias-con-la-referencia-y-su-motivo) |
| BDs | `public` (eventos), `mooc` + `shop` (dominio) | `eventos`, `comercio` | Codely separa por BD; aquí una BD de dominio unica para varias tablas compartidas |
| Framework web app2 | Next.js | **Astro SSR** (adaptador Node + API routes) | requisitos; el consumo se mantiene vía API route + script CLI |
| app1 | (en el curso: otras tecnologías en etapas previas; esta etapa solo Next) | **Symfony PHP 8.3** | requisitos |
| Escenario | `users` registrados → emails + sugerencias LLM; `courses` | **e-commerce** | decisión del equipo ([02-escenario-demo.md](02-escenario-demo.md)) |
| Eventos | `user_registered_domain_event`, `welcome_email_sent_domain_event`… | `order_created`, `product_viewed`, `order_confirmed`, `order_shipped` (prefijo contexto) | idéntico mecanismo |
| LLM como proveedor de contenido | Sí (CoursesSuggestionLlm) | No | fuera del alcance de la demo |
| Tooling test/lint | jest + eslint | **Vite+ (`vp`)**: `vp test` (Vitest) + `vp check` (Oxlint/Oxfmt) | decisión Fase 1; la Fase 2 adaptará los tests jest→Vitest conservando los mismos casos |

## Escritura ejecutables del modelo con otros datos (referencia exacta)

Las piezas de comportamiento mantenidas idénticas de la referencia y su doc correspondiente:

| Comportamiento constant | Fuente de referencia | Doc de la demo |
|---|---|---|
| `publish` aloja una fila por suscriptor, transacción por lote, retry(3, 30ms) | `PostgresEventBus.publish` | [05](05-flujo-publicacion.md) |
| Consume con `FOR UPDATE SKIP LOCKED`, log "📥 … retry N/3", delete-on-success, retries++/dead-letter | `PostgresEventBus.consume` | [06](06-flujo-consumo.md) |
| `MAX_RETRIES = 3` | constante en `PostgresEventBus` | [06](06-flujo-consumo.md) |
| DDL de cola con `retries`/`is_in_dead_letter` y PK compuesta | `databases/1-public.sql` | [04](04-modelo-eventos.md#esquema-de-la-cola-bd-eventos) |
| Routing desacoplado por `subscribedTo()` + `name()`, nada a mano | `sync-domain-events-routing.ts` | [05](05-flujo-publicacion.md#registro-del-routing-sincronización) |

> **Regla de oro para la implementación**: cuando la decisión es cómo funciona "el sistema de eventos", mirar primero el repo de referencia y replicar su lógica; MySQL solo cambia el detalle técnico (driver y dialecto), no el diseño.
