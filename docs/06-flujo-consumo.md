# 06 · Flujo de consumo

Cómo consume cada app la cola: **cada app tiene un comando que se llama cada X segundos** (igual que la referencia), y ese comando ejecuta el comportamiento de `PostgresEventBus.consume` — aquí `MysqlEventBus.consume` y `MysqlDoctrineEventBus` (o `MysqlEventBus` también en PHP).

## El contrato de consume

```ts
consume(subscribers: string[] | "*", limit: number): Promise<void>;
```

- `subscribers`: lista de nombres de suscriptor que esta app debe procesar, o `"*"` para todos.
- `limit`: nº máximo de filas procesadas por ronda (default `10` en la referencia).

## ¿Quién dispara el consumo cuándo?

Como en la referencia, cada app tiene **su propio gancho**:

| App | Comando/endpoint | Como se llama cada X segundos |
|-----|------------------|-------------------------------|
| app2 (Node) | `npm run consume-events [subscribers] [limit]` y `GET /api/event-bus/consume` (Bearer `CRON_SECRET`) | cron del host ejecuta cada N seg el script; también puede verse en `etc/scripts/1-start.sh` |
| app1 (PHP) | `php bin/console events:consume [subscribers] [limit]` | mismo cron, llamando al comando Symfony |

> En la demo **ambas apps consumen sus eventos** con el mismo mecanismo. `subscribers = *` dentro de una app igual consumiría los de la otra (por diseño — un solo modelo); en la demo se filtra por suscriptores de cada app: los de app1 en app1, los de app2 en app2 (ver tabla de suscriptores en [04-modelo-eventos.md](04-modelo-eventos.md#los-suscriptores)).

## Comportamiento de una ronda (idéntico a la referencia)

```
consume(subscribers, limit)
  BEGIN TRANSACTION (bd `eventos`)
  1. SELECT event_id, subscriber_name, name, attributes, occurred_at, retries
     FROM domain_events_to_consume
     WHERE is_in_dead_letter = false
       [ AND subscriber_name IN (subscribersFilter) ]      -- "*" ⇒ sin filtro
     ORDER BY inserted_at ASC
     LIMIT ${limit}
     FOR UPDATE SKIP LOCKED                                -- ⚠️ hilos/crones simultáneos no se pisan
  2. por cada fila:
       2.1 (event, subscriber) ← selecciones desde el DI:
            eventNameToClass().searchEvent(...)         → si no existe la clase: log ❌ Unknown event type (no marca error, SIGUE)
            subscriberNameToClass().search(...)         → si no existe: log ❌ Unknown subscriber
       2.2 log "📥 Consuming event X for subscriber Y (retry N/3)"
       2.3 TRY    subscriber.on(event)
                  → DELETE la fila consumida                        ✅ procesado
         CATCH  si retries >= 3-1:
                  → UPDATE set is_in_dead_letter = true, retries+1  💀 dead letter
                si no:
                  → UPDATE set retries = retries + 1                ↻ reintento
  COMMIT (de manera atómica todos los resultados de la ronda)
```

## Puntos que conviene entender

- **`FOR UPDATE SKIP LOCKED`**: bloquea y salta las filas que otra sesión ya está consumiendo ⇒ varias apps/crones pueden consumir a la vez sin duplicados. (Soportado en la versión fijada, `mysql:8.0.40`, como en cualquier MySQL ≥ 8.0.1)
- **Transacción por ronda**: en una ronda, si un evento falla y otro tiene éxito, cada fila se marca/borra por separado *dentro de esa misma transacción*.
- **El DELETE solo ocurre tras éxito**: un evento nunca se "pierde" si el suscriptor ha lanzado una excepción — queda para reintento.
- **Procesado = borrado; fallos acumulan `retries`**:
  - El **nº de intentos** máximo es **3** (`MAX_RETRIES = 3` — constante de la referencia, replicada).
  - Tras 3 intentos fallidos: `is_in_dead_letter = true` y el evento queda ahí **para auditoría/post-mortem**, ya no se reintentará nunca.
  - **No hay** implementado en la referencia (ni por tanto en la demo) un visualizador/reprocesador de la dead letter — queda documentado como posible mejora.
- **Orden**: `ORDER BY inserted_at ASC` — FIFO por momento de publicación. *No* hay orden global por agregado ni por aplicación: es lo que la referencia no ofrece y la demo tampoco.
- **`limit`**: controla cuánto trabajo consume el comando en cada tick, no el tamaño de la cola.

## Casos borde (según lo que hace la referencia)

| Situación | Comportamiento de la referencia (y por tanto aquí) |
|---|---|
| Tipo de evento sin clase en la app que consume | Log `❌ Unknown event type` y **sigue** (no marca error ni dead letter) |
| Suscriptor no registrado en la app que consume | Idem: log `❌ Unknown subscriber` y sigue |
| Suscriptor falla repetidas veces | ⌛ 3 intentos → 💀 dead letter |
| Mismo `eventId` publicado dos veces para el mismo suscriptor | La PK `(event_id, subscriber_name)` lo impide (ver nota en [05-flujo-publicacion.md](05-flujo-publicacion.md#qué-hace-el-bus-al-publicar-comportamiento-que-se-replica-11)) |
| Varios consumidores simultáneos | `FOR UPDATE SKIP LOCKED`: se reparten filas, nadie procesa dos veces la misma |

## Visibilidad para la demo

Para ver las rondas en vivo (en ambas apps):

```bash
# app2 (Node) — vez a vez vía host o dentro del contenedor:
docker exec -it app2 npm run consume-events -- '*' 10

# app1 (PHP):
docker exec -it app1 php bin/console events:consume '*' 10

#Estado de la cola:
docker exec -it bbdd mysql -uroot -p eventos \
  -e "SELECT name, subscriber_name, retries, is_in_dead_letter, inserted_at
      FROM domain_events_to_consume ORDER BY inserted_at;"

# Eventos por dejar de procesarse:
docker exec -it bbdd mysql -uroot -p eventos \
  -e "SELECT * FROM domain_events_to_consume WHERE is_in_dead_letter = 1;"

# Quién está subscrito a qué:
docker exec -it bbdd mysql -uroot -p eventos \
  -e "SELECT * FROM domain_events_routing ORDER BY event_name;"
```
