# 04 · Modelado de eventos de dominio

Este doc es **el contrato** entre las dos apps. Cualquier cosa que se firma aquí es lo único que necesita estar sincronizado entre app1 (PHP) y app2 (Node).

## Esquema de la cola (BD `eventos`)

Traducción a MySQL exacta de `databases/1-public.sql` de la referencia:

```sql
-- La cola: un registro POR (evento, suscriptor)
CREATE TABLE domain_events_to_consume (
    event_id        CHAR(36)     NOT NULL,
    subscriber_name VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,          -- nombre canónico del evento
    attributes      JSON         NOT NULL,          -- payload del evento
    occurred_at     TIMESTAMP    NOT NULL,          -- cuándo ocurrió en el dominio
    inserted_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- cuándo se publicó
    retries         INT          NOT NULL DEFAULT 0,
    is_in_dead_letter BOOLEAN    NOT NULL DEFAULT FALSE,
    PRIMARY KEY (event_id, subscriber_name),
    INDEX idx__domain_events_to_consume__inserted_at (inserted_at),
    INDEX idx__domain_events_to_consume__subscriber_name (subscriber_name)
);

-- Rutas: quién está subscrito a qué tipo de evento
CREATE TABLE domain_events_routing (
    event_name      VARCHAR(255) NOT NULL,
    subscriber_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (event_name, subscriber_name),
    INDEX idx__domain_events_routing__event_name (event_name)
);
```

### Diferencias con la referencia (y su motivo)

| Referencia (Postgres) | Aquí (MySQL) | Motivo |
|---|---|---|
| `jsonb` | `JSON` | MySQL no tiene jsonb |
| `uuid`, `timestamptz` | `CHAR(36)`, `TIMESTAMP` (en UTC) | Portabilidad entre drivers PHP y Node |
| `SELECT ... FOR UPDATE SKIP LOCKED` | idéntico | ✅ Soportado por InnoDB desde MySQL 8.0.1 — versión fijada: `mysql:8.0.40` |
| extensiones previas (`0-enable-extensions.sql`) | no necesarias | Ninguna de las usadas existe en MySQL y ninguna es imprescindible |

## Anatomía de un evento de dominio

Contrato de los campos (idéntico al de la referencia):

| Campo | Qué es | Quién lo genera |
|-------|--------|-----------------|
| `eventId` | UUID v4 identificador del evento | La clase del evento (fallback del constructor) |
| `eventName` | Nombre canónico, p.ej. `commerce.order_created_domain_event` | Constante en la clase del evento |
| `aggregateId` | ID del agregado al que pertenece | Clase del evento |
| `occurredAt` | Fecha/hora del suceso de negocio | Clase del evento (o `fromPrimitives` al reconstruir) |
| `attributes` | Resto del payload serializado, p.ej. email, total… | `toPrimitives()` de la clase |

## Convención de naming

`<contexto>.<entidad>_<verbo_participio>_domain_event`

- Contexto: `commerce.` o `ops.` — desambiguación para eventos de mismo nombre con distinto origen (así Codely separa por BD `shop.`/`mooc.`).
- Los nombres de suscriptor no llevan contexto ni sufijos: sólo el nombre significativo (p.ej. `OrderConfirmationEmail`) y deben ser **únicos a nivel global** de la cola.
- Reglas prácticas:
  - El mismo `eventId` puede aparecer N veces en la cola (una por suscriptor).
  - No se reutilizan nombres de suscriptor entre apps.
  - Los nombres de evento son inmutables una vez publicados por primera vez: las suscripciones "congelan" el contrato.

## Clases del dominio: qué debe tener un evento

### app2 — Node/TypeScript (idéntico a la referencia `DomainEvent.ts`)

```ts
export abstract class DomainEvent {
  protected constructor(
    public readonly eventName: string,
    public readonly aggregateId: string,
    public readonly eventId: string,     // uuid v4
    public readonly occurredAt: Date,
  ) {}

  abstract toPrimitives(): { [attribute: string]: unknown };  // → attributes JSON

  static fromPrimitives(
    aggregateId: string, eventId: string, occurredAt: Date,
    attributes: { [key: string]: unknown },
  ): DomainEvent;   // reconstrucción de cualquier app externa a partir de la fila
}
```

### app1 — PHP 8.3 (replica del mismo contrato)

```php
abstract readonly class DomainEvent
{
    public function __construct(
        public string $eventName,
        public string $aggregateId,
        public string $eventId,          // uuid v4
        public \DateTimeImmutable $occurredAt,
    ) {}

    /** @return array<string, mixed> */
    abstract public function toPrimitives(): array;
}
```

Cada tipo de evento (p.ej. `OrderCreatedDomainEvent`) declara su propio `eventName` como constante/atributo y un constructor desde/desde `attributes`.

## Payload de los 4 eventos del escenario

### `commerce.order_created_domain_event` — publicada por app2

<!-- id: id del pedido (aggregateId) -->
```json
{
  "id": "b1a5e0f2-…",                       // aggregateId: id del pedido
  "email": "cliente@example.com",
  "totalAmount": 59.90,
  "totalCurrency": "EUR",
  "items": [
    { "productId": "f3c0…", "quantity": 2 },
    { "productId": "a1bb…", "quantity": 1 }
  ]
}
```

### `commerce.product_viewed_domain_event` — publicada por app2

```json
{
  "id": "70c1d2e4-…",                       // aggregateId: id del producto visto
  "amount": 1                               // nº de vistas incrementadas por la pub.
}
```

### `ops.order_confirmed_domain_event` — publicada por app1

```json
{
  "id": "b1a5e0f2-…",                       // aggregateId: id del pedido
  "email": "cliente@example.com",           // enriquecido del pedido leído en `comercio`
  "confirmedAt": "2026-10-23T12:00:00Z"     // timestamps ISO-8601 UTC
}
```

### `ops.order_shipped_domain_event` — publicada por app1

```json
{
  "id": "b1a5e0f2-…",
  "email": "cliente@example.com",
  "trackingNumber": "PLK-88213"
}
```

### Reglas de payload

1. **`attributes` no incluye campos estándar** (`event_id`, `occurred_at`, ...) — sólo el payload de negocio. `toPrimitives()` **sí** incluye `id` (aggregateId).
2. Timestamps siempre **ISO-8601 UTC**; importes siempre con su moneda ISO-4217.
3. IDs SIEMPRE string UUID v4 (nunca enteros secuencial).
4. Eficacidad sobre completud: no se envía el agregado entero, sólo lo que el suscriptor necesita. Si el suscriptor necesita más, puede leerlo de la BD de `comercio` (es así como el evento hace de *gist* y la BD de fuente de verdad).

## Los suscriptores

Contrato (igual a `DomainEventSubscriber` de la referencia):

```ts
interface DomainEventSubscriber<T extends DomainEvent> {
  on(domainEvent: T): Promise<void>;      // lógica de negocio
  subscribedTo(): DomainEventClass[];     // qué eventos escucha
  name(): string;                         // nombre único global (¡llave en routing!)
}
```

| Suscriptor | App | Escucha | Acción |
|---|---|---|---|
| `OrderConfirmationEmail` | app1 | `order_created` | Manda el email |
| `ProductStats` | app1 | `product_viewed` | `UPDATE products SET views = views + amount` |
| `UpdateOrderStatus` | app2 | `order_confirmed`, `order_shipped` | `UPDATE orders SET status = …` (con history) |

La **tabla de routing** se llena a partir de `subscribedTo()` + `name()` con el comando de sincronización — nadie escribe a mano `domain_events_routing`.
