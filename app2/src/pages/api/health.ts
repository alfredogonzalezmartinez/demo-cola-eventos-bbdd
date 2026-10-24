import type { APIRoute } from "astro";

// API route estilo express-style de la referencia (ver docs/07: mapeo Next -> Astro)
export const GET: APIRoute = () => {
  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
