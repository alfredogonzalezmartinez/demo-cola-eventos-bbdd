// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  vite: {
    plugins: [tailwindcss()],
    // Los comandos síncronos del back-office llegan con Host `app2`
    // (DNS interno de compose, docs/07): el guard de Vite los bloquearía
    server: { allowedHosts: ["app2"] },
  },
});
