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

- [ ] `compose.yml` (mysql 8.0.40, app1, app2), `.env.example`, `databases/01-eventos.sql` + `02-comercio.sql`
- [ ] `Makefile` con `up`, `down`, `sync`, `consume-a1`, `consume-a2`
- [ ] `docs/` ya referenciadas (README raíz)

**Cierre**: `make up && docker exec app1 php -v` y `docker exec app2 node -v` responden; las 2 BDs existen.

## Fase 1 · Esqueleto app2 (Astro SSR)

**Objetivo**: Astro con adaptador Node levanta SSR y una ruta de API dummy.

- [ ] Proyecto en `app2/` con `@astrojs/node`, express-style API route `src/app/api/health`
- [ ] Estructura `src/contexts/{shared,commerce}` vacía preparada
- [ ] Node 26 (`.nvmrc`/`engines`), jest + eslint como la referencia

**Cierre**: `curl localhost:4321/api/health` responde 200.

## Fase 2 · Sistema de eventos app2 (1:1 Codely → MySQL)

**Objetivo**: el `shared` de la referencia funciona sobre MySQL, con su port de tests.

Copia desde Codely (sparse clone) y adaptación:

```bash
git clone --filter=blob:none --sparse https://github.com/CodelyTV/infrastructure_design-eventbus-db-course.git codely-ref
cd codely-ref && git sparse-checkout set 06-to_prod/2-multiples_apps/src/contexts/shared tests/contexts/shared
# copiar a app2/src/contexts/shared y adaptar:
```

| Fichero (referencia) | Adaptación necesaria |
|---|---|
| `shared/domain/event/*` (DomainEvent, EventBus, Subscriber) | ninguna (idéntico) |
| `shared/infrastructure/postgres/PostgresConnection` | reescribir como `MysqlConnection` sobre `mysql2/promise` (tag template de `postgres-js` → queries preparadas de mysql2) |
| `shared/infrastructure/domain-event/PostgresEventBus` | → `MysqlEventBus`: JSONB→JSON, `eventos.` en lugar de `public.`, `INSERT IGNORE` en sync-routing |
| `shared/infrastructure/domain-event/*Map*` (NameToClass, etc.) | ninguna |
| DI `diod.config` | ninguna |
| `tests/*` (PostgresEventBus.test, mothers, TestDomainEvent) | adaptar a MysqlEventBus **manteniendo los mismos casos** |

**Cierre**: `npm run test` en verde; `publish` + `consume` contra `mysql:8.0.40` creadas por la Fase 0.

## Fase 3 · Consumo y routing app2

**Objetivo**: la cola se consume y el routing se inscribe, con cron externo.

- [ ] `src/app/scripts/consume-mysql-events.ts` (args `subscribers limit`) y `sync-domain-events-routing.ts` — análogos del repo
- [ ] API route `GET /api/event-bus/consume` con Bearer `CRON_SECRET`
- [ ] Script de cron del host (o make target) que dispara cada intervalo; por defecto cada 60 s (granularidad mínima de cron)

**Cierre**: tras publicar un evento "de prueba", una pasada del consume lo borra/deja en `retries` según el resultado.

## Fase 4 · Dominio `commerce` app2 + UI

**Objetivo**: el flujo de publicador real.

- [ ] Contexto `commerce/orders` (aggregate `Order`, `OrderCreatedDomainEvent`, `MysqlOrderRepository`, caso `CheckoutOrder`)
- [ ] `commerce/products` con `ProductViewedDomainEvent` + suscriptores de app2 (`UpdateOrderStatus`)
- [ ] Página SSR de tienda + checkout + listado de pedidos con estados

**Cierre**: un checkout inserta en `comercio.orders` y en `eventos.domain_events_to_consume` un evento `commerce.order_created`.

## Fase 5 · E2E app2 (sin app1)

**Cierre de fase**: checkout → consume app2 (suscriptor `UpdateOrderStatus` dummy de prueba? no: en esta fase no hay eventos que lleguen a app2; validar publish de app2 e **inserciones en cola** + una ronda consume de prueba manual con un suscriptor temporal).

## Fase 6 · app1 (Symfony, replica del modelo)

**Objetivo**: la otra pata del contrato: consumidores y publicador.

- [ ] Bundle `shared` en PHP: `DomainEvent`, `EventBus` (interfaz), `MysqlDoctrineEventBus` (o sobre PDO), atributo/interfaz `DomainEventSubscriber`
- [ ] Sistema de tagging del DI por `subscriber` + comando `events:sync-routing`
- [ ] Comando `events:consume` con el mismo algoritmo (SKIP LOCKED, retries=3, dead letter)
- [ ] Suscriptores: `OrderConfirmationEmail` (order_created), `ProductStats` (product_viewed)
- [ ] Publicador de `ops.order_confirmed` / `ops.order_shipped` (back-office mínimo: comandos de consola sirven como UI de la demo)
- [ ] Tests en PHP con el mismo enfoque (MySQL real de test)

**Cierre**: `php bin/console events:consume` procesa los eventos publicados por app2 (emails mocked) y app1 publica `order_confirmed`.

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
