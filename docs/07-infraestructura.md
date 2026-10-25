# 07 · Infraestructura (Docker)

## Contenedores

```yaml
# compose.yml — reflejo del fichero real de la raíz (a cierre de la Fase 6)
services:
  bbdd:
    image: mysql:8.0.40
    command: [--default-time-zone=+00:00]   # los timestamps de eventos son UTC
    ports:
      - "${MYSQL_HOST_PORT:-3306}:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./databases:/docker-entrypoint-initdb.d:ro

  bbdd-test:                      # profile "test": no arranca con `make up`
    image: mysql:8.0.40
    ports: ["3307:3306"]          # el host corre aquí las suites de test

  app2:
    build: ./app2                 # node:26 + Astro + adaptador Node (SSR)
    environment:
      MYSQL_EVENTOS_URL: mysql://demo:demo@bbdd:3306/eventos
      MYSQL_COMERCIO_URL: mysql://demo:demo@bbdd:3306/comercio
      CRON_SECRET: ${CRON_SECRET}    # auth de /api/event-bus/consume
    ports:
      - "${APP2_HOST_PORT:-4321}:4321"
    volumes:
      - ./app2:/app
      - app2_node_modules:/app/node_modules   # shadow del bind

  app1:                           # replica PHP del mismo modelo de eventos
    build: ./app1                 # php:8.3-cli + pdo_mysql + composer
    environment:
      EVENTOS_DSN: mysql://demo:demo@bbdd:3306/eventos
      COMERCIO_DSN: mysql://demo:demo@bbdd:3306/comercio
      CRON_SECRET: ${CRON_SECRET}
    ports:
      - "${APP1_HOST_PORT:-8000}:8000"   # `php -S 0.0.0.0:8000 -t public public/router.php`
    volumes:
      - ./app1:/app
      - app1_vendor:/app/vendor    # shadow del bind
    depends_on:
      bbdd:
        condition: service_healthy
```

## Bases de datos y arranque (databases/)

Montados como `/docker-entrypoint-initdb.d`, se ejecutan en orden al crear el volumen:

| Fichero | Contenido |
|---|---|
| `01-eventos.sql` | DDL de la cola: `domain_events_to_consume` + `domain_events_routing` (ver [04-modelo-eventos.md](04-modelo-eventos.md#esquema-de-la-cola-bd-eventos)) |
| `02-comercio.sql` | DDL del dominio e-commerce (ver [02-escenario-demo.md](02-escenario-demo.md#base-de-datos-de-dominio-comercio)) |

> En MySQL el entrada `/docker-entrypoint-initdb.d` acepta varios `.sql` con `CREATE DATABASE … USE …` dentro para poblar las dos BDs en un solo motor.

> **Charset del initdb**: el cliente MySQL del entrypoint corre con `--default-character-set=auto` (latin1 en la práctica) ⇒ los literales UTF-8 del seed se guardarían con doble encode (`mecÃ¡nico`). Todos los `databases/*.sql` empiezan con `SET NAMES utf8mb4;` — no quitarlo.

### Inspección del estado

- Estado y UIs: `npm run db` (raíz del repo) — monitor en vivo: panel de texto (sin caja) con filas estables `✓`(arriba, verde) / spinner (arrancando) / `✗`(no arranca), con nombre del schema en negrita y su URL de Drizzle Studio siempre con puerto (`https://local.drizzle.studio?port=4983` eventos / `?port=4984` comercio, clicable solo si la terminal soporta OSC 8). Sonda las dos BDs (carga `.env`; el DSN de compose (`bbdd`) no es resoluble desde el host y el `getaddrinfo` puede colgar ~90s, así que cada sonda corre contra reloj y si se pasa cae a `localhost`, que recuerda). Si una UI cae la relanza (3 intentos → fila `✗` y, debajo del panel, línea de error `✗ <bd> — no arranca la UI (N intentos) — revisa .local/logs/studio-<bd>.log`; reintento en segundo plano cada 30s, si recupera la fila vuelve a `✓`). Los logs de las instancias viven en `.local/logs/studio-<bd>.log` (también usados por `studio.sh`). Al salir (Ctrl+C) limpia el panel y muestra `Deteniendo monitor de base de datos…` con spinner y `✓ Detenido monitor de base de datos` (apagando **todas** las UIs, incluidas residuales de `studio.sh`). Con `--once` hace una sola pasada de estado, sin gestionar studios (exit 1 con errores). Estilado con `node:util` `styleText` (color/negritas), `terminal-link`+`supports-hyperlinks` (enlaces), `log-update` (redibujo en sitio) y `spinners` de `ora` (animación) — devDependencies de la raíz.
- UI web: `npx drizzle-kit studio` por esquema con las configs y schemas de `scripts/db/` (usa el `drizzle-kit` de la raíz; `studio.sh eventos|comercio` para lanzarlas a mano): eventos→4983 en https://local.drizzle.studio y comercio→4984 en https://local.drizzle.studio?port=4984. Los snapshot `out/` que genera drizzle-kit van a `.local/drizzle/` (gitignored — no se mantienen migraciones).

## Tareas periódicas (cron)

Ambas apps necesitan dos **tareas** que se invocan cada X segundos (arquitectura de scheduler del host o dentro del contenedor — indiferente para la demo):

| Tarea | app2 (Node) | app1 (PHP) |
|---|---|---|
| Consumir eventos | `npm run consume-events [subscribers] [limit]` ⋙ `src/app/scripts/consume-mysql-events.ts` | `php bin/console events:consume [subscribers] [limit]` |
| Sincronizar routing | `npm run sync-routing` ⋙ `src/app/scripts/sync-domain-events-routing.ts` | `php bin/console events:sync-routing` |

Intervalo para la demo: `CONSUME_INTERVAL_SECONDS=60` en `.env` (granularidad preceptiva de cron 1 min). El driver de la demo en el host es `make watch-consume` / `make watch-consume-a1` (bucle con docker exec — autocontenido, sin crontab compatible con cualquier SO); para rondas sueltas `make consume-a2` / `make consume-a1`, y a mano `make sync` (ambas apps, en ese orden: primero app2, porque sus suscriptores también inscriben los eventos que publica app1). El endpoint HTTP con Bearer es la vía para un cron real. Los scripts de app2 corren con `tsx` (Node 26 ejecuta TS en strip-only y no soporta parameter properties ni los decorators de diod).

## Endpoints HTTP expuestos (para probar sin cron)

| Ruta | App | Equivalente en la referencia |
|---|---|---|
| `GET /api/event-bus/consume?subscribers=a,b&limit=10` (Bearer `CRON_SECRET`) | app2 (API route de Astro) | `src/app/api/event-bus/consume/route.ts` |
| `GET /api/health` → 200 | app2 | — |
| `GET /api/event-bus/consume?subscribers=a,b&limit=10` (Bearer `CRON_SECRET`), mismo contrato | app1 (controller Symfony) | — |

> **Mapeo de rutas Next → Astro** (decisión Fase 1): los ficheros que la referencia coloca en `src/app/**/route.ts` viven aquí como endpoints de Astro en `src/pages/api/**` (un `route.ts` Next = un `*.ts` Astro exportando `GET`/`POST`). Los scripts CLI sí mantienen la carpeta `src/app/scripts/` de la referencia (dentro de un proyecto Astro son código TS ejecutado con tsx, sin relación con el router).

## Web mínima (la UI de la demo)

| Ruta | App | Qué muestra |
|---|---|---|
| `/` (tienda), `/checkout`, `/orders` | app2 (Astro SSR, :4321) | checkout publica `order_created`; `products/[id]` publica `product_viewed` por render |
| `GET /orders` + `POST /orders/{id}/confirm` y `/orders/{id}/ship` | app1 (back-office, :8000) | botones que publican `order_confirmed` / `order_shipped` (equivale a los comandos `ops:orders:confirm|ship`) |
| `GET /products` | app1 | panel read-only de productos con las `views` que sube el consumo |

Errores → 500 genérico en ambas (sin stack). El ejecutor web de app1 es `php -S 0.0.0.0:8000 -t public public/router.php` (el `-t` es obligatorio: por defecto el docroot es el CWD y el estático `/app.css` daría 404). El look replica el de app2 con **Tailwind compilado**: `app1/assets/app.css` (`@import "tailwindcss"` + `@source "./src"`, porque las clases viven en strings PHP) se compila a `app1/public/app.css` (commiteado) con `make css` — node solo en el host, el equivalente al build de Vite que genera el CSS de app2.

## Comandos make (Makefile de la raíz, a cierre de la Fase 6)

```makefile
up:           ## levanta bbdd, app2, app1 (bbdd-test solo bajo el profile "test")
down:         ## para y borra
test-db:      ## MySQL de tests (profile "test", host 3307), con --wait (healthcheck)
test:         ## suite de app2 (Vitest en host, Node 26 vía nvm) + suite de app1 (PHPUnit en contenedor) — ambas contra bbdd-test
sync:         ## inscribe los suscriptores de ambas apps en domain_events_routing
	docker exec app2 npm run sync-routing
	docker exec app1 php bin/console events:sync-routing
consume-a2:   ## una ronda de consume en app2 (SUBSCRIBERS=* LIMIT=10)
watch-consume: ## bucle de consume en app2 cada CONSUME_INTERVAL_SECONDS (Ctrl+C para parar)
consume-a1:   ## una ronda de consume en app1
watch-consume-a1: ## bucle de consume en app1 cada CONSUME_INTERVAL_SECONDS
```

## Puesta en marcha de la demo (chuleta)

```bash
make up                     # levanta bbdd, app1, app2 con las BDs creadas
make sync                   # routing inscribe a todos los suscriptores declarados
# 🛒 compone un pedido en http://localhost:4321  (app2 publica order_created)
make consume-a1             # app1 procesa → email de confirmación (log 📧)
# ✅ back-office de app1 (8000): botón "Confirmar" (publica order_confirmed)
make consume-a2             # app2 marca el pedido como confirmado (+ fila en order_status_history)
# 📦 botón "Enviar" en app1 (o `docker exec app1 php bin/console ops:orders:ship <id>`)
make consume-a2             # app2 refleja "enviado" con nº de tracking (PLK-#####)
# 👀 abre http://localhost:4321/products/<id> (app2 publica product_viewed)
make consume-a1             # app1 procesa → views +1 (visible en http://localhost:8000/products)
```
