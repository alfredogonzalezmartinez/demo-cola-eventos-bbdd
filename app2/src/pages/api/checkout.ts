import type { APIRoute } from "astro";

import { container } from "../../contexts/shared/infrastructure/dependency-injection/diod.config";
import { CheckoutOrder } from "../../contexts/commerce/orders/application/CheckoutOrder";

// Error genérico en la UI (Q7/Fase 4): los detalles del fallo van al log del servidor.
// Inline styles: esta respuesta huérfana no carga el stylesheet global de Tailwind.
const GENERIC_ERROR = `<html lang="es"><body style="font-family:system-ui;background:#020617;color:#e2e8f0;padding:2rem"><h1 style="font-size:1.5rem;color:#fff">Algo salió mal</h1><p style="color:#94a3b8">No se pudo procesar la compra. <a href="/checkout" style="color:#38bdf8">Reintentar</a></p></body></html>`;

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();

    const email = String(form.get("email") ?? "").trim();
    if (!email || !email.includes("@")) {
      throw new Error("invalid checkout input");
    }

    const items = [...form.entries()]
      .filter(([name, value]) => name.startsWith("product_") && Number(value) > 0)
      .map(([name, value]) => ({
        productId: name.slice("product_".length),
        quantity: Number(value),
      }));

    await container.get(CheckoutOrder).run(email, items);

    return new Response(null, {
      status: 303,
      headers: { Location: "/orders" },
    });
  } catch (error) {
    console.error("checkout failed:", error);

    return new Response(GENERIC_ERROR, {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
};
