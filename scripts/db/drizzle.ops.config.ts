import type { Config } from "drizzle-kit";

// Esquema generado con drizzle-kit pull; la UI de studio sirve este fichero.
// out/ debe vivir gitignored (no mantenemos migraciones): .local/drizzle
export default {
	dialect: "mysql",
	out: "../../.local/drizzle/ops",
	schema: "./ops/schema.ts",
	dbCredentials: {
		url: "mysql://demo:demo@localhost:3306/ops",
	},
} satisfies Config;
