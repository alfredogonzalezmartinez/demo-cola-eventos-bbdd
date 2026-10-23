# 05 · Flujo de publicación

Cubrimos cómo una app **publica** eventos: componentes implicados, orden de operaciones y comportamiento esperado (exactamente el de `PostgresEventBus.publish` de la referencia, aquí sobre MySQL).

## Componentes

| Componente | Nombre (referencia) | app2 (Node) | app1 (PHP) |
|---|---|---|---|
| Interfaz del dominio | `EventBus` | idéntico | idéntico |
| Implementación (cola en tablas) | `PostgresEventBus` | `MysqlEventBus` | `MysqlDoctrineEventBus` |
| Conexión BD de infraestructura | `PostgresConnection` | `MysqlConnection` (mysql2) | `MysqlConnection` (PDO/DBAL) |
| Origen de los eventos | `AggregateRoot.record(events…)` + caso de uso | idéntico | `Aggregate::record()` |

La interfaz es mínima — así la referencia y así aquí:

```ts
export abstract class EventBus {
  abstract publish(events: DomainEvent[]): Promise<void>;
}
```

## Cuándo se publica

Inside **la transacción/operación de negocio que origina el evento**, como hace la referencia:

1. El caso de uso (p.ej. `CheckoutOrder`) crea/agrega el agregado `Order`.
2. `Order` (AGGREGATE ROOT) registra sus eventos: `record(new OrderCreatedDomainEvent(...))`.
3. Al persistir, el caso de uso llama `eventBus.publish(order.pullDomainEvents())`.
4. La publicación **no está dentro** de la transacción del negocio a nivel SQL: es un paso posterior del caso de uso (así es en `PostgresEventBus.publish` — abre su propia transacción).

> Nota de outbox: en la referencia, si falla la publicación, el evento se pierde salvo por el `retry(...)` interno del bus (3 intentos, backoff 30ms). Para la demo replicamos ese comportamiento tal cual; quede anotado como mejora futura una transacción única dominio+cola.

## Qué hace el bus al publicar (comportamiento que se replica 1:1)

```
publish(events)
  ├─ si events.length == 0 → return     (no-op)
  ├─ retry(publishEvents, 3 intentos, 30ms)     ← igual que la referencia
  └─ publishEvents(events):
       BEGIN TRANSACTION (en BD `eventos`)
       para cada evento:
           1. SELECT subscriber_name FROM domain_events_routing
              WHERE event_name = ${event.eventName}       ← determina los destinatarios
           2. log "📤 Publishing event X to: → sub1 → sub2"
           3. por cada subscriber: INSERT INTO domain_events_to_consume
              (event_id, subscriber_name, name, attributes(JSON), occurred_at)
       COMMIT (todo o nada por lote)
```

Puntos clave:

- **Una fila por suscriptor** (no una por evento) — así cada consumidor avanza por su cuenta; borrados de otros no afectan.
- La PK compuesta `(event_id, subscriber_name)` hace el INSERT idempotente: si el mismo `eventId` se vuelve a publicar para un suscriptor, falla por PK (la referencia no maneja este caso de forma especial — la demo tampoco lo hace).
- El **routing** es la verdad absoluta de quién recibe qué: si un suscriptor no está en la fila, no llega.
- El `attributes` se guarda tal como devuelve `event.toPrimitives()` (incluye `id`, ver [04-modelo-eventos.md](04-modelo-eventos.md#reglas-de-payload)).

## Ejemplo end-to-end en app2 (Node)

```ts
// contexts/commerce/orders/application/CheckoutOrder.ts
async checkout(cart): Promise<Order> {
  const order = await this.repository.save(Order.create(cart));     // bd `comercio`
  await this.eventBus.publish(order.pullDomainEvents());            // 📤 → bd `eventos`
  return order;
}
```

```sql
-- Lo que acaba en MySQL:
-- en `comercio`:      INSERT INTO orders (…) VALUES (…);
-- en `eventos`:       SELECT subscriber_name FROM domain_events_routing
--                     WHERE event_name = 'commerce.order_created_domain_event';
--                     INSERT INTO domain_events_to_consume
--                     VALUES ('b1a5…', 'OrderConfirmationEmail', 'commerce.order_created_domain_event', '{"id":"b1a5…", …}', '2026-10-23 12:00:00');
```

## Ejemplo en app1 (PHP)

Idéntico el flujo; acción distinta: publico `order_confirmed` y `order_shipped` (ver payload en [04-modelo-eventos.md](04-modelo-eventos.md#payload-de-los-4-eventos-del-escenario)).

```php
public function __invoke(ConfirmOrder $command): void
{
    $order = $this->repository->find($command->orderId());
    $order->confirm();
    $this->repository->save($order);
    $this->eventBus->publish($order->pullDomainEvents());   // op.order_confirmed_domain_event
}
```

## Registro del routing (sincronización)

Nada se inscribe a mano: cuando una app arranca (o en el provisioning), se ejecuta el comando **`sync-domain-events-routing`** (idéntico de la referencia):

1. Obtiene, del contenedor de DI, **todos los servicios taggeados como `subscriber`**.
2. Deriva el mapa `{susscriberName → [eventNames]}` (clase `DomainEventSubscriberNameToEventNames`).
3. Hace `INSERT ... ON CONFLICT DO NOTHING` (MySQL: `INSERT IGNORE`) de `(event_name, subscriber_name)` en `domain_events_routing`, uno por pareja.
4. Log: `🔄 Syncing routing for X subscribers… ✅ event → subscriber`.

Ver [08-referencia-codely.md](08-referencia-codely.md#scripts) para el script tal cual de referencia.
