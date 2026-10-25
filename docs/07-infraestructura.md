# 07 · Infraestructura (Docker)

## Contenedores

```yaml
# compose.yml (esbozo de partida; versiones/props exactas al implementar)
# Fase 0: solo el servicio bbdd está activo; app1 y app2 se descomentan en sus fases (plan docs/09)
services:
  bbdd:
    image: mysql:8.0.40
    environment:
      MYSQL_USER: demo
      MYSQL_PASSWORD: demo
      MYSQL_ROOT_PASSWORD: root
      TZ: UTC                     # los timestamps de eventos son UTC
    ports:
      - "3306:3306"
    volumes:
      - ./databases:/docker-entrypoint-initdb.d   # DDL de arranque (ver abajo)

  app2:                           # ← se implementa PRIMERO (referencia 1:1)
    build: ./app2                 # node:26 + Astro + adaptador Node (SSR)
    environment:
      MYSQL_URL: mysql://demo:demo@bbdd:3306/     # legado Fase 0-1; DSN por schema llegaron en Fase 2
      MYSQL_EVENTOS_URL: mysql://demo:demo@bbdd:3306/eventos
      MYSQL_COMERCIO_URL: mysql://demo:demo@bbdd:3306/comercio
      CRON_SECRET: <token>        # auth de /api/event-bus/consume
      CONSUME_INTERVAL_SECONDS: 30
    ports:
      - "4321:4321"
    depends_on:
      - bbdd

  app1:                          # replica PHP del mismo modelo de eventos
    build: ./app1                # php:8.3 + Symfony
    environment:
      DATABASE_URL: mysql://demo:demo@bbdd:3306/eventos   # bus; `comercio` según repositorios
      CONSUME_INTERVAL_SECONDS: 30
    ports:
      - "8000:8000"
    depends_on:
      - bbdd
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

Intervalo para la demo: `CONSUME_INTERVAL_SECONDS=60` en `.env` (granularidad preceptiva de cron 1 min). El driver de la demo en el host es `make watch-consume` (bucle con docker exec — autocontenido, sin crontab compatible con cualquier SO); para rondas sueltas `make consume-a2`, y a mano `make sync`. El endpoint HTTP con Bearer es la vía para un cron real. Los scripts corren con `tsx` (Node 26 ejecuta TS en strip-only y no soporta parameter properties ni los decorators de diod).

## Endpoints HTTP expuestos (para probar sin cron)

| Ruta | App | Equivalente en la referencia |
|---|---|---|
| `GET /api/event-bus/consume?subscribers=a,b&limit=10` (Bearer `CRON_SECRET`) | app2 (API route de Astro) | `src/app/api/event-bus/consume/route.ts` |
| `GET /api/health` → 200 | app2 | — |

> **Mapeo de rutas Next → Astro** (decisión Fase 1): los ficheros que la referencia coloca en `src/app/**/route.ts` viven aquí como endpoints de Astro en `src/pages/api/**` (un `route.ts` Next = un `*.ts` Astro exportando `GET`/`POST`). Los scripts CLI sí mantienen la carpeta `src/app/scripts/` de la referencia (dentro de un proyecto Astro son código TS ejecutado con tsx, sin relación con el router).
| `GET /orders` (listado con estado), `POST /orders` (checkout) | app2 | rutas `mooc/courses` del ejemplo |
| Rutas del back-office (confirmar/enviar pedido, alta de productos) | app1 | — |
| `$ php bin/console events:consume` | app1 | equivalente CLI |
| (opcional) endpoint protegido en Symfony, mismo contrato url/params que app2 | app1 | de referencia */

## Comandos make (Makefile de partida)

```makefile
up:           ## levanta los 3 contenedores
	docker compose up -d --build
down:         ## para y borra
	docker compose down -v
test-db:      ## (Fase 2+) MySQL de tests, profile "test", host 3307
	docker compose --profile test up -d --wait bbdd-test
test:         ## (Fase 2+) tests de integración de app2 contra bbdd-test
	cd app2 && npm run test
sync:         ## inscribe los suscriptores declarados en domain_events_routing (app2 hoy; incluirá app1)
	docker exec app2 npm run sync-routing
consume-a2:   ## una ronda de consume en app2 (SUBSCRIBERS=* LIMIT=10)
	docker exec app2 npm run consume-events -- "$(SUBSCRIBERS)" "$(LIMIT)"
watch-consume: ## bucle de consume en app2 cada CONSUME_INTERVAL_SECONDS (Ctrl+C para parar)
	while true; do \
		docker exec app2 npm run consume-events -- "$(SUBSCRIBERS)" "$(LIMIT)"; \
		sleep "$(CONSUME_INTERVAL_SECONDS)"; \
	done
consume-a1:   ## (con app1) una ronda de consume en app1
	docker exec app1 php bin/console events:consume '*' 10
```

## Puesta en marcha de la demo (chuleta)

```bash
make up                     # terceros levantan app1, app2, bbdd con las BDs creadas
make sync                   # routing inscribe a todos los suscriptores declarados
# 🛒 compone un pedido en http://localhost:4321  (app2 publica order_created)
make consume-a1             # app1 procesa → email de confirmación + publica order_confirmed
make consume-a2             # app2 muestra el pedido como confirmado
# 📦 desde el back-office de app1 (8000): confirmar/enviar pedido
make consume-a2             # app2 refleja "enviado" con nº de tracking
```
