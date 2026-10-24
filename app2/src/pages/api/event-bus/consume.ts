import type { APIRoute } from "astro";

import { MysqlEventBus } from "../../../contexts/shared/infrastructure/domain-event/MysqlEventBus";
import { container } from "../../../contexts/shared/infrastructure/dependency-injection/diod.config";

// Mismo contrato que los scripts: `subscribers` (CSV o *, default "*") y
// `limit` (default 10) por query param
export const GET: APIRoute = async ({ request, url }) => {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response(null, { status: 401 });
  }

  const subscribersParam = url.searchParams.get("subscribers");
  const subscribers: string[] | "*" =
    subscribersParam === null || subscribersParam === "*" ? "*" : subscribersParam.split(",");

  const limit = parseInt(url.searchParams.get("limit") ?? "10", 10);

  try {
    await container.get(MysqlEventBus).consume(subscribers, limit);

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error consuming events:", error);

    return new Response(null, { status: 500 });
  }
};
