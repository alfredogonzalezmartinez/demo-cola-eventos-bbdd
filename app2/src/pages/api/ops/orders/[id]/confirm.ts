import type { APIRoute } from "astro";

import { container } from "../../../../../contexts/shared/infrastructure/dependency-injection/diod.config";
import { ConfirmOrder } from "../../../../../contexts/commerce/orders/application/ConfirmOrder";
import { OrderNotFoundError } from "../../../../../contexts/commerce/orders/domain/OrderNotFoundError";
import { OrderStatusChangeNotAllowedError } from "../../../../../contexts/commerce/orders/domain/OrderStatusChangeNotAllowedError";

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Comando síncrono desde el back-office de app1 (docs/05): Bearer OPS_API_TOKEN,
// 200 aceptado · 404 no existe · 409 transición no permitida
export const POST: APIRoute = async ({ params, request }) => {
  if (request.headers.get("authorization") !== `Bearer ${process.env.OPS_API_TOKEN}`) {
    return new Response(null, { status: 401 });
  }

  try {
    const outcome = await container.get(ConfirmOrder).run(params.id!);

    return json(outcome, 200);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return json({ error: "Order not found" }, 404);
    }

    if (error instanceof OrderStatusChangeNotAllowedError) {
      return json(
        {
          error: error.message,
          currentStatus: error.params.currentStatus,
          expectedStatus: error.params.expectedStatus,
        },
        409,
      );
    }

    console.error("confirm failed:", error);

    return json({ error: "Internal error" }, 500);
  }
};
