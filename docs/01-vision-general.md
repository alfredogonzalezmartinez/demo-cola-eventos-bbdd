# 01 · Visión general

## Objetivo

Demostrar que dos aplicaciones tecnológicamente distintas (**PHP 8.3 / Symfony** y **Node 26 / Astro**) pueden **publicar y consumir eventos de dominio** a través de una cola implementada exclusivamente con tablas de una base de datos **MySQL**, sin ninguna infraestructura de mensajería adicional (no hay RabbitMQ, Kafka ni Redis).

## Decisiones tomadas

| # | Decisión | Justificación |
|---|----------|---------------|
| 1 | Cola de eventos **en BBDD** (tablas SQL), sin broker externo | Es la tesis del curso de referencia de Codely; simplicidad operativa para una demo |
| 2 | **MySQL 8.0.40** como motor (no Postgres como en la referencia) | Requisito del enunciado; la cola funciona igual por polling, no se usan capacidades exclusivas de Postgres |
| 3 | **Dos bases de datos** en el mismo servidor: `eventos` y `comercio` | Referencia de Codely (`public` para eventos, `mooc`/`shop` para dominios); separa la infraestructura de la cola del dato de dominio |
| 4 | app2 (**Astro SSR**) se implementa **primero**, copiando 1:1 los componentes del sistema de eventos de Codely | Referencia del enunciado; así se valida el modelo con la tecnología más cercana (Node) antes de portarlo a PHP |
| 5 | app1 (**Symfony**) replica el mismo modelo en PHP | Requisito: ambas apps son publicadoras **y** consumidoras |
| 6 | Consumo mediante **comando ejecutado cada X segundos** (cron/scheduler) | Igual que la referencia; en MySQL no hay `LISTEN/NOTIFY`, pero la referencia tampoco lo usa (es polling puro), por lo que la lógica se mantiene 1:1 |
| 7 | DDD + **arquitectura hexagonal** + un contexto acotado por dominio/aplicación | Requisito explícito; organización del código igual que en el repo de Codely (`contexts/*`) |
| 8 | Escenario de demo: **e-commerce** | Decisión del equipo; permite eventos bidireccionales entre las dos apps |

## Componentes

```
┌──────────────┐   ┌──────────────┐   ┌──────────┐
│    app1      │   │    app2      │   │  bbdd    │
│ PHP 8.3      │   │ Node 26      │   │ MySQL 8.0.40 │
│ Symfony      │   │ Astro SSR    │   │          │
│ (publica +   │   │ (publica +   │   │ `eventos`│
│  consume)    │   │  consume)    │   │ `comercio`│
└──────┬───────┘   └──────┬───────┘   └────▲─────┘
       │                  │                │
       └──────────────────┴────────────────┘
          publican y consumen de la cola de eventos
```

tres contenedores Docker: `app1`, `app2` y `bbdd` (ver [07-infraestructura.md](07-infraestructura.md)).

## Resumen del mecanismo de eventos

1. **Publicar**: al terminar una operación de negocio, la app consulta la tabla de **routing** (qué suscriptores están subscritos a este evento) e inserta **una fila por suscriptor** en `eventos.domain_events_to_consume`, con los atributos del evento serializados a JSON.
2. **Consumir**: cada X segundos, un **comando** en cada app:
   - selecciona eventos pendientes para sus suscriptores con `FOR UPDATE SKIP LOCKED` dentro de una transacción,
   - ejecuta el suscriptor correspondiente,
   - si tiene éxito → **borra** la fila; si falla → `retries++`; tras 3 intentos → **dead letter** (`is_in_dead_letter = true`).
3. **Registro de rutas**: un comando de sincronización inserta en `eventos.domain_events_routing` las parejas *(nombre de evento, nombre de suscriptor)* que cada app declara en su contenedor de dependencias.

Los detalles completos del contrato están en [04-modelo-eventos.md](04-modelo-eventos.md), [05-flujo-publicacion.md](05-flujo-publicacion.md) y [06-flujo-consumo.md](06-flujo-consumo.md).

## Guía de lectura

- Para entender **qué demuestra** el proyecto: este doc + [02-escenario-demo.md](02-escenario-demo.md).
- Para implementar cualquier pieza: [04-modelo-eventos.md](04-modelo-eventos.md) → [03-arquitectura.md](03-arquitectura.md) → [08-referencia-codely.md](08-referencia-codely.md).
- Para levantar el entorno: [07-infraestructura.md](07-infraestructura.md).
