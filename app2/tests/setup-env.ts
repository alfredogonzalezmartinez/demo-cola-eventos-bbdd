import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

/**
 * Carga el .env de testing (.env.test) con prioridad sobre el entorno heredado:
 * el Makefile exporta las DSN de la demo (bbdd:3306) y en tests prevalecen las
 * del contenedor bbdd-test (localhost:3307, ver compose.yml).
 *
 * Sin dependencia dotenv: parser mínimo KEY=VALUE con comentarios y comillas.
 */
export function loadTestEnv(fileName = ".env.test"): void {
  const file = isAbsolute(fileName) ? fileName : join(import.meta.dirname ?? ".", "..", fileName);

  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const clean = line.trim();

    if (clean.length === 0 || clean.startsWith("#")) {
      continue;
    }

    const separator = clean.indexOf("=");
    const key = clean.slice(0, separator).trim();

    let value = clean.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
