// Sin imports: 'vitest'/'vite-plus' no son resolubles como paquete (vp test
// llega vía npx, docs/08). El `test` block es la config de Vitest.
export default {
  test: {
    // Los ficheros de integración comparten el mismo MySQL de pruebas
    // (truncateAll + routing en cada beforeEach, docs/09 Fase 2): en paralelo
    // se borraban los datos de los demás, así que corren en serie.
    fileParallelism: false,
  },
};
