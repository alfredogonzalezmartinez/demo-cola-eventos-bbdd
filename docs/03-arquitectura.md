# 03 · Arquitectura

## Contenedores Docker

| Contenedor | Imagen base | Roles expuestos |
|------------|-------------|-----------------|
| `app1` | `php:8.3` + Symfony CLI | Web/API de operaciones. Puerto `8000`. Ejecuta comandos de consume y sync-routing |
| `app2` | `node:26` + adaptador Node de Astro | Web de tienda SSR + API routes. Puerto `4321`. Ejecuta scripts de consume y sync-routing |
| `bbdd` | `mysql:8.0.40` | Servidor MySQL con las bases `eventos`, `comercio` y `ops`. Puerto `3306` |

Detalles de compose, variables y arranque: [07-infraestructura.md](07-infraestructura.md).

## Bases de datos (un solo servidor MySQL)

| BD | Dueño | Contenido |
|----|-------|-----------|
| `eventos` | **ninguna app es dueña: es infraestructura compartida** | `domain_events_to_consume` (la cola) y `domain_events_routing` (rutas evento→suscriptor) |
| `comercio` | app2 | Estado de la tienda: `orders`, `order_items`, `order_status_history` y la proyección `products` (DDL en [02-escenario-demo.md](02-escenario-demo.md#bases-de-datos-de-dominio)) |
| `ops` | app1 | Back-office: `products` (fuente del catálogo + `views`), `orders` (proyección de pedidos) y `order_commands` (auditoría de comandos) |

Equivalencia con la referencia de Codely: `eventos` ≙ `public`; `comercio` ≙ `mooc` + `shop` fusionado en una BD porque MySQL no tiene esquemas independientes dentro de una BD (usamos una BD única y la propiedad se define por tabla); `ops` no tiene equivalente en la referencia (BD propia del back-office, añadida por el escenario).

## Organización del código (DDD + hexagonal)

Ambas apps replican la misma estructura, en su idioma tecnológico. Equivalencia de la referencia de Codely (`src/contexts/*`):

```
app2 (Astro)                              ← igual a src/contexts de la referencia
src/
  contexts/
    commerce/                             ← contexto de la tienda (dueño: app2)
      orders/
        application/  (casos de uso: checkout)
        domain/       (Order, OrderCreatedDomainEvent, OrderRepository…)
        infrastructure/ (MysqlOrderRepository, astro routes…)
    shared/
      domain/       (AggregateRoot, DomainEvent, EventBus, DomainEventSubscriber…)
      infrastructure/ (MysqlConnection, MysqlEventBus, DI…)
```

| Capa | Regla |
|------|-------|
| `domain` | Objetos de valor, agregados, **eventos de dominio**, interfaces (`*Repository`, `EventBus`). Cero dependencias de infraestructura |
| `application` | Casos de uso que orquestan agregados y **publican eventos** a través del `EventBus` del dominio |
| `infrastructure` | Implementaciones concretas: repositorios MySQL, el `EventBus` sobre tablas SQL, conexiones, DI |

**Regla de desacoplamiento crítica**: el caso de uso publica `OrderCreatedDomainEvent` a través de la interfaz `EventBus`; no sabe que detrás hay tablas MySQL, ni quién lo consumirá próximamente (¡ni siquiera si será app1 o app2!).

## Contextos por aplicación

- Cada contexto acotado vive en la app que lo **posee** (`commerce` en app2, `ops` en app1) — igual que `shop`/`mooc` en la referencia cuando cada esquema pertenece a un despliegue distinto.
- El código **compartido** del sistema de eventos vive en `shared/` de cada app. Es **duplicado a propósito** entre app1 y app2: la cola se contrata por tablas SQL (el contrato está en [04-modelo-eventos.md](04-modelo-eventos.md)), no por código compartido. Duplicar código evita acoplar dos despliegues a un mismo repositorio/lenguaje.
- El **payload del evento es el contrato**: `attributes` JSON + campos estándar. El suscriptor de la otra app instancia su propia clase de evento equivalente a partir del JSON (`fromPrimitives`).

## Herramientas usadas en la referencia (y su equivalente aquí)

| Pieza | Referencia (Next.js/Node) | Aquí (app2) | Aquí (app1) |
|-------|---------------------------|-------------|-------------|
| DI con tags para suscriptores | [`diod`](https://www.npmjs.com/package/diod) (`container.findTaggedServiceIdentifiers("subscriber")`) | Se mantiene igual (diod) en app2 | Symfony DIC: interfaces `DomainEventSubscriber` + tag `subscriber` declarado **a mano en services.yaml**, inyectado con `!tagged_iterator` |
| Conexión BD | `postgres` (npm) | `mysql2` (npm) | Doctrine DBAL / PDO en crudo para el bus (sin ORM) |
| Payload del evento | JSONB | JSON | JSON |
| Tareas por cron | script Node + `/api/event-bus/consume` con Bearer `CRON_SECRET` | idéntico | `bin/console events:consume` servido por cron; endpoint API opcional con `#[IsGranted]` |

Ver el mapeo exacto componente a componente en [08-referencia-codely.md](08-referencia-codely.md).
