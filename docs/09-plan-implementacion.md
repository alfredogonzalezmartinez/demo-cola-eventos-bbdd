# 09 · Plan de implementación

Backlog por fases con criterios de cierre. Orden pactado: **app2 primero** (copia 1:1 de Codely→MySQL), luego **app1 en Symfony** replicando el modelo. Commits directos sobre `main` con Conventional Commits (skill `codely-git-conventional-commit`, un commit por fase o sub-fase coherente).

## Decisiones de implementación ya tomadas

| # | Decisión | Elección |
|---|----------|----------|
| I1 | Código del sistema de eventos app2 | **Sparse clone** del repo de Codely + adaptar Postgres→MySQL |
| I2 | Tests | **Desde el día 1** (port del `PostgresEventBus.test.ts` a MySQL) |
| I3 | Scheduler de consumo | **Cron-equivalente externo**: el comando se ejecuta una vez; un cron del host lo dispara cada X segundos |
| I4 | Git | Commits directos sobre `main` |
| I5 | Local specs | `requirements.md` y notas personales en `.local/` (ignorada por git) |

## Fase 0 · Infraestructura base

**Objetivo**: `docker compose up` levanta los 3 contenedores con las BDs creadas.

- [x] `compose.yml` (mysql 8.0.40, app1, app2), `.env.example`, `databases/01-eventos.sql` + `02-comercio.sql`
- [x] `Makefile` con `up`, `down`, `sync`, `consume-a1`, `consume-a2` — `sync/consume-a1/consume-a2` llegan con las Fases 2-3 (dependen del código de las apps)
- [x] `docs/` ya referenciadas (README raíz)

**Cierre**: `make up && docker exec app1 php -v` y `docker exec app2 node -v` responden; las 2 BDs existen.

## Fase 1 · Esqueleto app2 (Astro SSR)

**Objetivo**: Astro con adaptador Node levanta SSR y una ruta de API dummy.

- [x] Proyecto en `app2/` con `@astrojs/node` (standalone), express-style API route `src/pages/api/health.ts` (convención Astro; mapeo Next→Astro en [07](07-infraestructura.md#endpoints-http-expuestos-para-probar-sin-cron))
- [x] Estructura `src/contexts/{shared,commerce}` vacía preparada
- [x] Node 26 (`.nvmrc`/`engines`), tooling **Vite+**: `vp test` (Vitest) + `vp check` (Oxlint) vía `npx` — desviación de "jest + eslint como la referencia", detalle en [08](08-referencia-codely.md)

**Cierre**: `curl localhost:4321/api/health` responde 200.

## Fase 2 · Sistema de eventos app2 (1:1 Codely → MySQL)

**Objetivo**: el `shared` de la referencia funciona sobre MySQL, con su port de tests.

Copia desde Codely (sparse clone) y adaptación:

```bash
mkdir -p .local && cd .local
git clone --filter=blob:none --sparse https://github.com/CodelyTV/infrastructure_design-eventbus-db-course.git codely-ref
cd codely-ref && git sparse-checkout add 06-to_prod/2-multiples_apps/src/contexts/shared 06-to_prod/2-multiples_apps/tests
# copiar a app2/src/contexts/shared y adaptar (vere [08](08-referencia-codely.md)):
```

| Fichero (referencia) | Adaptación necesaria |
|---|---|
| `shared/domain/event/*` (DomainEvent, EventBus, Subscriber) | ninguna (idéntico) |
| `shared/infrastructure/postgres/PostgresConnection` | reescribir como `MysqlConnection` sobre `mysql2/promise` (tag template de `postgres-js` → queries preparadas de mysql2) |
| `shared/infrastructure/domain-event/PostgresEventBus` | → `MysqlEventBus`: JSONB→JSON, `eventos.` en lugar de `public.`, `INSERT IGNORE` en sync-routing |
| `shared/infrastructure/domain-event/*Map*` (NameToClass, etc.) | ninguna |
| DI `diod.config` | ninguna |
| `tests/*` (PostgresEventBus.test, mothers, TestDomainEvent) | adaptar a MysqlEventBus **manteniendo los mismos casos** y pasando los ficheros de jest → Vitest (tooling Vite+, ver [08](08-referencia-codely.md)) |

**Cierre**: `npm run test` en verde; `publish` + `consume` contra `mysql:8.0.40` creadas por la Fase 0.

> **✅ Estado (2026-10-24)**: cerrada — `make test` en verde (9/9: 8 casos del bus + sanity). Clone sparse usado en `.local/codely-ref` (gitignored); contenedor `bbdd-test` (profile `test`, host 3307, DDL de Fase 0 por init) y Make targets `test-db`/`test` añadidos. Los DSN de test viven en `app2/.env.test`, cargados por `tests/setup-env.ts` con prioridad sobre el entorno heredado. `MysqlConnection` usa una conexión por schema con DSN (`MYSQL_EVENTOS_URL`, `MYSQL_COMERCIO_URL`); tablas calificadas `eventos.` vía fragmentos raw. En los tests el routing se sincroniza antes de cada caso (mismo mecanismo `INSERT IGNORE` que `sync-domain-events-routing` de la Fase 3) porque el `truncateAll` limpia también `domain_events_routing`. La DDL de la cola pasó a `TIMESTAMP(6)` para conservar la precisión de `timestamptz` (igualdad de `occurred_at` en tests); docs/04 actualizado.

## Fase 3 · Consumo y routing app2

**Objetivo**: la cola se consume y el routing se inscribe, con cron externo.

- [x] `src/app/scripts/consume-mysql-events.ts` (args `subscribers limit`) y `sync-domain-events-routing.ts` — análogos del repo
- [x] API route `GET /api/event-bus/consume` con Bearer `CRON_SECRET`
- [x] Script de cron del host (o make target) que dispara cada intervalo; por defecto cada 60 s (granularidad mínima de cron)

**Cierre**: tras publicar un evento "de prueba", una pasada del consume lo borra/deja en `retries` según el resultado.

> **✅ Estado (2026-10-24)**: cerrada — scripts portados 1:1 (`consume-events`/`sync-routing` con tsx, devDep de app2) y endpoint Astro equivalente (`src/pages/api/event-bus/consume.ts`, mínimo estilo `health.ts`: 401 sin Bearer, 200 vacío, 500 en error). Make targets `sync`, `consume-a2` y `watch-consume` (bucle por `CONSUME_INTERVAL_SECONDS`, default 60). Demo del cierre manual con suscriptores temporales no commiteados vía el camino real `make sync` → publish(bs) → `make consume-a2`: la fila del suscriptor ok se borró, y la del que lanza acumuló retries 1→2→3 con dead letter al 3.er fallo (una 4.ª ronda no la reintenta). Descubrimientos clave: Node 26 corre TS en strip-only y rechaza parameter properties ⇒ tsx; `verbatimModuleSyntax` de Astro expuso imports de tipos sin `import type` (y tipos exportados de `mysql2/promise`) que Vite no link-estricta pero tsx sí; los decorators de diod (`@Service`) exigen `experimentalDecorators: true` en el tsconfig de app2 para la SSR de Vite (instalación de `tsx` en el contenedor: `docker exec app2 npm install` — node_modules es un volumen shadow). Los runs del bus quedan cubiertos por la suite (9/9, verdes).

## Fase 4 · Dominio `commerce` app2 + UI

**Objetivo**: el flujo de publicador real.

- [x] Contexto `commerce/orders` (aggregate `Order`, `OrderCreatedDomainEvent`, `MysqlOrderRepository`, caso `CheckoutOrder`)
- [x] `commerce/products` con `ProductViewedDomainEvent` (suscriptores de app2: `UpdateOrderStatus`, se crean en la Fase 6 — el cierre de esta fase no exige consumidores)
- [x] Página SSR de tienda + checkout + listado de pedidos con estados

**Cierre**: un checkout inserta en `comercio.orders` y en `eventos.domain_events_to_consume` un evento `commerce.order_created`.

> **✅ Estado (2026-10-25)**: cerrada — `make test` en verde (14/14: bus + sanity + `CheckoutOrder` + `ViewProduct` con MySQL real). Publicación en dos pasos como la referencia (docs/02 corregida en consecuencia); payload de los eventos según docs/04 (`camelCase`, `toPrimitives` incluye `id`). DDL: `orders`/`order_status_history` a `TIMESTAMP(6)` + seed de 3 productos en `databases/02-comercio.sql`. DI: `ComercioMysqlConnection` (DSN `MYSQL_COMERCIO_URL`, docs/07) como token junto a la conexión de `eventos`; repos y casos de uso registrados por factory en `diod.config`. UI (Q8): páginas SSR `index` (tienda), `products/[id]` (publica `product_viewed` por render, no incrementa `views` — el consumidor hace el UPDATE), `checkout` (form nativo POST → `/api/checkout`, redirect 303 → `/orders`) y `orders`; error del checkout genérico 500 (Q7). Suscripciones: ninguna en app2 — la cola no recibió filas en la demo manual (routing con 0 filas: correcto hasta la Fase 6). Config de tests: `fileParallelism: false` en `app2/vite.config.ts` (los `truncateAll` se cruzaban entre ficheros en paralelo; sin imports en la config porque `vitest`/`vite-plus` no son resolubles vía npx). Gotcha del contenedor: tras recrear el volumen hay `docker exec app2 npm install` **y reiniciar app2** (el `astro dev` ya en marcha mantiene caché de módulos podrido con los paquetes del estado previo). Node del host: v26 vía nvm (el node del sistema v16 no soporta el tooling).

## Fase 5 · E2E app2 (sin app1)

**Cierre de fase**: demo E2E manual desde la UI, sin código permanente — checkout real → `make sync` (suscriptor temporal dummy, no commiteado) → ronda suelta `make consume-a2` → verificación por SQL de que la fila `order_created` aparece en `domain_events_to_consume` y desaparece tras el consume exitoso.

> **✅ Estado (2026-10-25)**: cerrada — demo E2E completa con la cola limpia de origen (0 filas): suscriptor temporal `DummyOrderCreatedSubscriber` (nuevos ficheros + línea en `diod.config` revertidos tras la demo, instancia como criterio: misma interfaz `DomainEventSubscriber` que usará `UpdateOrderStatus` en la Fase 6); `make sync` inscribió `order_created → dummy` en routing; checkout real (2× Teclado mecánico, 99.80 EUR, pedido `a9ba8c9d-…`) dejó 1 fila en `domain_events_to_consume` con payload camelCase y `id` del agregado; una ronda `make consume-a2` consumió el evento (log 📥 → 🫥 dummy → fila borrada), dejando 0 pendientes y 0 dead letter. Descubrimiento clave: `publish` encola mirando las filas de `domain_events_routing` (no las clases del DI), por lo que el SSR del checkout no necesita conocer a los suscriptores — solo hace falta `make sync` antes de publish; el dummy entra en los scripts por proceso tsx nuevo sin reiniciar el dev server. Limpieza SQL tras la demo (routing del dummy) y suite en verde (14/14).

## Fase 6 · app1 (Symfony, replica del modelo)

**Objetivo**: la otra pata del contrato: consumidores y publicador.

- [x] Bundle `shared` en PHP: `DomainEvent`, `EventBus` (interfaz), `MysqlDoctrineEventBus` (o sobre PDO), atributo/interfaz `DomainEventSubscriber`
- [x] Sistema de tagging del DI por `subscriber` + comando `events:sync-routing`
- [x] Comando `events:consume` con el mismo algoritmo (SKIP LOCKED, retries=3, dead letter)
- [x] Suscriptores: `OrderConfirmationEmail` (order_created) y `ProductStats` (product_viewed) de app1, y `UpdateOrderStatus` de app2 (`order_confirmed`, `order_shipped`; aplazado aquí desde la Fase 4, ver [04](04-modelo-eventos.md#los-suscriptores))
- [x] Publicador de `ops.order_confirmed` / `ops.order_shipped` (back-office mínimo: comandos `ops:orders:confirm|ship` y botones web equivalentes)
- [x] Tests en PHP con el mismo enfoque (MySQL real de test)

**Cierre**: `php bin/console events:consume` procesa los eventos publicados por app2 (emails mocked) y app1 publica `order_confirmed`.

> **✅ Estado (2026-10-25)**: cerrada — app1 completa en Symfony (PHP 8.3, MicroKernelTrait sin twig) y demo E2E de cierre verde en ambos sentidos: botón "Confirmar" en app1 → cola → `npm run consume-events` de app2 deja el pedido en `confirmed` con fila en `order_status_history` (tracking NULL); botón "Enviar" → `shipped` con tracking `PLK-#####` autogenerado; y a la inversa `product_viewed` (SSR de app2) → `events:consume` de app1 sube `views` (visible en `/products`). Semántica fail-fast verificada: re-confirmar un pedido `shipped` devuelve 500 sin publicar. Suite PHP del bus en verde (8 tests, 20 assertions) con `RetryingConnectionTestDouble` que simula los reintentos sin conectar; `make test` corre las dos suites. Decisiones: estructura hexagonal espejo de app2 (`src/Shared`, `src/Commerce` inbound, `src/Ops`), doctrine/dbal **standalone sin ORM** con envs `EVENTOS_DSN`/`COMERCIO_DSN` cuyo DSN se parsea a mano porque DBAL 4.5 no infiere el driver del scheme y trata `localhost` como unix socket (→ `127.0.0.1`); tag `subscriber` a mano en `services.yaml` con `!tagged_iterator` (entrega `RewindableGenerator`: conviene `iterator_to_array`); endpoint HTTP de consume con Bearer con el mismo contrato que app2. Lecciones: **(1)** las constantes `STDOUT`/`STDERR` solo existen en CLI — el primer publish desde web petó 500; se extrajo un helper `ConsoleOutput` SAPI-safe que en web delega en `error_log` (acaba en `docker logs app1`); **(2)** el `variables_order` por defecto (GPCS) no copia el entorno a `$_SERVER` en el SAPI web ⇒ autenticar con `getenv()`, no `$_SERVER[...]`; **(3)** en app2, `import type` borra el símbolo en runtime: los eventos usados como valor en `subscribedTo()` (`subscribedTo(): [OrderConfirmedDomainEvent, …]`) necesitan import de valor (`OrderConfirmedDomainEvent is not defined`); **(4)** bug real en el `toSql` de `MysqlConnection` de app2: `typeof null === "object"` hacía `"$raw" in null` al parametrizar `null` (trackingNumber opcional) — añadido el guard `value !== null`; **(5)** LIMIT parametrizado rompe builds de cláusulas (interpolado `%d`). DDL: `order_status_history.tracking_number VARCHAR(255) NULL` (aplicado a los volúmenes ya creados; `make down` y `make up` para recrear limpio). Gotchas de contenedor ya conocidos se mantienen (vendor app1 en volumen shadow ⇒ `docker exec app1 composer install` si cambia `composer.json`; `docker exec app1 sh -c 'rm -rf /app/var/cache'` para limpiar el cache que el contenedor escribe como root).

## Fase 7 · Demo end-to-end completa

**Cierre final (Definition of Done)**:

- [ ] `make up && make sync` → escenario completo de [02-escenario-demo.md](02-escenario-demo.md) ejecuta de punta a punta con cron activo
- [ ] Demo del fallo: un suscriptor que lanza excepción 3 veces acaba en dead letter visible por SQL
- [ ] README actualizado con el "cómo lo levantas" real que funciona
- [ ] `docs/09` archiva lecciones aprendidas (récord de decisiones adoptadas)

## Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Tag template `postgres-js` no existe en mysql2 | Fase 2 define primero la interfaz de `MysqlConnection` antes de portar el bus |
| Los timestamps PHP/Node y MySQL difieren en zona horaria | Todas las conexiones con TZ fija `UTC` (`connection.setTimezone('+00:00')` / `PDO::TIMEZONE`) |
| cron del host no existe en Windows | Makefile `watch-consume` como fallback (bucle sleep) |
| Node 26 demasiado nuevo para algunas deps (mysql2, diod) | Verificar en Fase 2; si falla algo instalar con `--force` o fijar versión de la dep |
