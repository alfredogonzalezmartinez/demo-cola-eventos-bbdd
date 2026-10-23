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
      MYSQL_URL: mysql://demo:demo@bbdd:3306/     # 2 BD: eventos y comercio
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

## Tareas periódicas (cron)

Ambas apps necesitan dos **tareas** que se invocan cada X segundos (arquitectura de scheduler del host o dentro del contenedor — indiferente para la demo):

| Tarea | app2 (Node) | app1 (PHP) |
|---|---|---|
| Consumir eventos | `npm run consume-events [subscribers] [limit]` ⋙ `src/app/scripts/consume-mysql-events.ts` | `php bin/console events:consume [subscribers] [limit]` |
| Sincronizar routing | `npm run sync-events-routing` ⋙ `src/app/scripts/sync-domain-events-routing.ts` | `php bin/console events:sync-routing` |

Intervalo recomendado para la demo: `CONSUME_INTERVAL_SECONDS=30` (ambas apps iguales — se escogen por simplicidad, no es un requisito de la referencia).

## Endpoints HTTP expuestos (para probar sin cron)

| Ruta | App | Equivalente en la referencia |
|---|---|---|
| `GET /api/event-bus/consume?subscribers=a,b&limit=10` (Bearer `CRON_SECRET`) | app2 (API route de Astro) | `src/app/api/event-bus/consume/route.ts` |
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
consume-a2:   ## una ronda de consume en app2
	docker exec -it app2 npm run consume-events -- '*' 10
consume-a1:   ## una ronda de consume en app1
	docker exec -it app1 php bin/console events:consume '*' 10
sync:         ## registra (ambas apps) sus suscriptores en domain_events_routing
	docker exec -it app2 npm run sync-events-routing
	docker exec -it app1 php bin/console events:sync-routing
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
