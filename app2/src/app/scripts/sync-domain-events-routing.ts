/* eslint-disable no-console,no-await-in-loop */
import "reflect-metadata";

import { DomainEvent } from "../../contexts/shared/domain/event/DomainEvent";
import type { DomainEventSubscriber } from "../../contexts/shared/domain/event/DomainEventSubscriber";
import { DomainEventSubscriberNameToEventNames } from "../../contexts/shared/infrastructure/domain-event/DomainEventSubscriberNameToEventNames";
import { container } from "../../contexts/shared/infrastructure/dependency-injection/diod.config";
import { MysqlConnection, raw } from "../../contexts/shared/infrastructure/mysql/MysqlConnection";

// La cola vive en la BD `eventos` (docs/04). INSERT IGNORE es el
// ON CONFLICT ... DO NOTHING de MySQL: reejecutar el sync es idempotente.
async function main(): Promise<void> {
  const connection = container.get(MysqlConnection);

  const subscribers = container
    .findTaggedServiceIdentifiers<DomainEventSubscriber<DomainEvent>>("subscriber")
    .map((id) => container.get(id));

  const subscriberToEvents = new DomainEventSubscriberNameToEventNames(subscribers);

  console.log(`\n🔄 Syncing routing for ${subscribers.length} subscribers...\n`);

  for (const [subscriberName, eventNames] of subscriberToEvents.all()) {
    for (const eventName of eventNames) {
      await connection.sql`
				INSERT IGNORE INTO ${raw("eventos")}.domain_events_routing (event_name, subscriber_name)
				VALUES (${eventName}, ${subscriberName})
			`;

      console.log(`  ✅ ${eventName} → ${subscriberName}`);
    }
  }

  console.log(`\n✨ Routing sync completed!\n`);
}

main()
  .catch((error) => {
    console.error("❌ Error during routing sync:", error);
    process.exit(1);
  })
  .finally(async () => {
    await container.get(MysqlConnection).end();
    console.log("🔌 Connection closed");
    process.exit(0);
  });
