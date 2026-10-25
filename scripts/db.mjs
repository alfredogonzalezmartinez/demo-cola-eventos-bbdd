#!/usr/bin/env node
// Monitor de las BDs de la demo (npm run db): panel vivo con una UI de
// Drizzle Studio por schema (configs y schemas en scripts/db), redibujado
// en sitio, relanza las UIs si caen y al salir (Ctrl+C) las apaga todas.
// node --env-file-if-exists=.env scripts/db.mjs [--once]
import mysql from "mysql2/promise";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "node:util";

import terminalLink from "terminal-link";
import supportsHyperlinks from "supports-hyperlinks";
import logUpdate from "log-update";
import { spinners } from "ora";

const ONCE = process.argv.includes("--once");
const TICK_MS = 500;
// studio tarda ~8 s en publicar su puerto: evita relanzamientos en cascada
const LAUNCH_GRACE_MS = 20_000;
// dos pasadas fracasadas seguidas antes de dar la UI por caída (la sonda
// del puerto puede estornudar contra un server recién levantado)
const DOWN_CONFIRM_MS = 1_500;
const RETRY_FAIL_MS = 30_000;
const MAX_ATTEMPTS = 3;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// configs de drizzle-kit y schemas viven junto a este script (tracked)
const DB_DIR = path.join(ROOT, "scripts", "db");

// Los logs de las UIs de studio van a .local/logs (gitignored)
const LOGS = path.join(ROOT, ".local", "logs");
mkdirSync(LOGS, { recursive: true });

const SCHEMAS = [
	{ name: "eventos", env: "MYSQL_EVENTOS_URL", fallback: "mysql://demo:demo@localhost:3306/eventos", studioPort: 4983 },
	{ name: "comercio", env: "MYSQL_COMERCIO_URL", fallback: "mysql://demo:demo@localhost:3306/comercio", studioPort: 4984 },
	{ name: "ops", env: "OPS_DSN", fallback: "mysql://demo:demo@localhost:3306/ops", studioPort: 4985 },
];

// Todos los glifos (spinner dots, ✓, ✗) son de ancho 1 y las filas tienen
// las mismas columnas: el panel no cambia de tamaño en ningún estado.
const NAME_PAD = 9;

// URL clicable solo cuando la terminal soporta OSC 8; con el fallback de
// terminal-link la URL sale duplicada ("texto URL") y estorba.
const url = (schema) => {
	const link = `https://local.drizzle.studio?port=${schema.studioPort}`;
	const text = styleText("cyan", link);
	return supportsHyperlinks.stdout ? terminalLink(text, link) : text;
};

const row = (schema, glyph, glyphColor) =>
	`${styleText(glyphColor, glyph)}  ${styleText("bold", schema.name.padEnd(NAME_PAD))}${url(schema)}`;

const errorLine = (schema, diagnosis) =>
	`${styleText("red", "✗")} ${styleText("bold", schema.name)} — ${diagnosis}`;

const states = new Map(); // name → { attempts, child, lastLaunch, downSince }
const frames = spinners.dots.frames;
let frameIndex = 0;

function stateOf(name) {
	if (!states.has(name)) states.set(name, { attempts: 0, child: undefined, lastLaunch: 0, downSince: 0 });
	return states.get(name);
}

function pidAlive(pid) {
	if (!pid) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// El proxy de cada instancia es un listener en 127.0.0.1 — sondamos el
// puerto. Cinturón de 500ms: una sonda no puede colgar el tick (los
// connect colgados no terminan de emitir ni close ni error).
function portOpen(port) {
	return new Promise((resolve) => {
		let settled = false;
		const done = (value) => {
			if (settled) return;
			settled = true;
			resolve(value);
		};
		const socket = net.connect({ host: "127.0.0.1", port });
		socket.setTimeout(300);
		socket.once("timeout", () => {
			socket.destroy();
			done(false);
		});
		socket.once("connect", () => {
			socket.destroy();
			done(true);
		});
		socket.once("close", () => done(settled ? undefined : false));
		socket.once("error", () => done(false));
		setTimeout(() => done(false), 500).unref();
	});
}

// .env apunta al DNS interno de compose (bbdd): en el host el getaddrinfo
// puede colgar ~90s (el timeout de mysql2 no cubre la fase de resolución).
// Sondeo con carrera de reloj y, si falla, caída a localhost (mismo
// puerto, exportado por compose) — la que funciona se recuerda.
const PROBE_TIMEOUT_MS = 2_000;
const dsnChosen = new Map(); // name → dsn que funcionó

const probeOne = async (dsn) => {
	const conn = await mysql.createConnection(dsn);
	await conn.query("SELECT 1");
	await conn.end();
	return undefined;
};

const raced = (dsn) =>
	Promise.race([
		probeOne(dsn),
		new Promise((_, reject) => {
			setTimeout(() => reject(new Error("la sonda tardó demasiado")), PROBE_TIMEOUT_MS).unref();
		}),
	]);

async function dbError(schema) {
	const original = process.env[schema.env] ?? schema.fallback;
	const cached = dsnChosen.get(schema.name);

	let lastError;
	const targets = cached ? [cached] : [original];
	if (!cached) {
		const local = new URL(original);
		if (local.hostname !== "localhost" && local.hostname !== "127.0.0.1") {
			local.hostname = "localhost";
			targets.push(local.toString());
		}
	}

	for (const target of targets) {
		try {
			const result = await raced(target);
			dsnChosen.set(schema.name, target);
			return result;
		} catch (error) {
			lastError = error;
		}
	}
	return lastError?.code ?? lastError?.message ?? "error desconocido";
}

function launchStudio(schema) {
	const log = openSync(path.join(LOGS, `studio-${schema.name}.log`), "a");
	// bin.cjs de la devDependency de la raíz, con node directamente (sin la
	// capa npx: su shim sh -c traga tokens con valor separado)
	const child = spawn(
		process.execPath,
		[path.join(ROOT, "node_modules", "drizzle-kit", "bin.cjs"),
			"studio", `--config=drizzle.${schema.name}.config.ts`, "--port", String(schema.studioPort)],
		{ cwd: DB_DIR, detached: true, stdio: ["ignore", log, log] },
	);
	child.unref();
	const st = stateOf(schema.name);
	st.child = child;
	st.lastLaunch = Date.now();
	st.attempts += 1;
}

// patrón con corchetes: pkill excluye su propio proceso, pero no a los
// ancestros cuyo cmdline también contiene el literal.
// Dos formatos de cmdline: bin.cjs directo (el que lanza este monitor) y la
// cadena npx/npm exec (instancias de studio.sh o residuos).
function shutdownStudios() {
	for (const st of states.values()) {
		if (st.child?.pid) {
			try {
				process.kill(-st.child.pid, "SIGTERM");
			} catch {}
		}
	}
	spawnSync("pkill", ["-f", "bin\\.cjs stud[i]o|drizzle-kit stud[i]o"]);
}

let stopping = false;
let mainTimer;
let renderBusy = false;

async function tick() {
	if (renderBusy || stopping) return;
	renderBusy = true;
	try {
		const rows = [];
		const errors = [];

		for (const schema of SCHEMAS) {
			const dbErr = await dbError(schema);
			const up = await portOpen(schema.studioPort);
			const st = stateOf(schema.name);

			if (up) {
				st.attempts = 0;
				st.child = undefined;
				st.lastLaunch = 0;
				st.downSince = 0;
				rows.push(row(schema, "✓", "green"));
				continue;
			}

			if (!st.downSince) st.downSince = Date.now();
			const downFor = Date.now() - st.downSince;
			const dueLaunch = !ONCE && downFor >= DOWN_CONFIRM_MS && Date.now() - (st.lastLaunch || 0) >= LAUNCH_GRACE_MS;
			if (dueLaunch) launchStudio(schema);

			const launchedAgo = Date.now() - (st.lastLaunch || 0);
			// caída aún no confirmada: spinner neutro (evita el destello de
			// ✗ en el primer tick, cuando apenas acabamos de sondear)
			const starting = dueLaunch
				|| (!ONCE && downFor < DOWN_CONFIRM_MS)
				|| (!ONCE && launchedAgo < LAUNCH_GRACE_MS && st.child?.pid && pidAlive(st.child.pid));

			rows.push(row(schema, starting ? frames[frameIndex % frames.length] : "✗", starting ? "gray" : "red"));

			if (!starting && st.attempts >= MAX_ATTEMPTS) {
				errors.push(errorLine(schema, `no arranca la UI (${st.attempts} intentos) — revisa .local/logs/studio-${schema.name}.log`));
			}
			if (dbErr) {
				errors.push(errorLine(schema, `MySQL no responde (${dbErr})`));
			}
		}

		const lines = [
			styleText("bold", "Monitor de base de datos"),
			"",
			...rows,
			"",
			styleText("gray", "Pulsar Ctrl+C para detener"),
		];
		// panel de texto plano, sin sangría ni caja
		let block = lines.join("\n");
		if (errors.length > 0) block += "\n" + errors.join("\n");

		if (ONCE) {
			console.log(block);
			process.exitCode = errors.length > 0 ? 1 : 0;
		} else {
			logUpdate(block);
		}
	} finally {
		renderBusy = false;
	}
}

function goodbye() {
	if (stopping) return;
	stopping = true;
	// congela el ciclo del panel: un tick pendiente no puede repintar
	// (esa repintada era el salto raro al cortar)
	clearInterval(mainTimer);
	logUpdate.clear();
	logUpdate(
		styleText("gray", frames[0]) + "  " + styleText("bold", "Deteniendo monitor de base de datos") + "…",
	);
	shutdownStudios();
	const spin = setInterval(() => {
		frameIndex += 1;
		logUpdate(
			styleText("gray", frames[frameIndex % frames.length]) + "  " + styleText("bold", "Deteniendo monitor de base de datos") + "…",
		);
	}, 80);

	setTimeout(async () => {
		clearInterval(spin);
		const escuchando = [];
		for (const schema of SCHEMAS) {
			if (await portOpen(schema.studioPort)) escuchando.push(schema.name);
		}
		logUpdate.done();
		if (escuchando.length === 0) {
			console.log(styleText("green", "✓") + "  " + styleText("bold", "Detenido monitor de base de datos"));
		} else {
			console.log(styleText("yellow", "⚠") + "  " + styleText("bold", "Detenido monitor de base de datos") + " — seguía a la escucha: " + escuchando.join(", "));
		}
		process.exit(escuchando.length ? 1 : 0);
	}, 800);
}

if (ONCE) {
	await tick();
} else {
	for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, goodbye);
	await tick();
	frameIndex += 1;
	// sin unref: es el único handle que mantiene el loop con vida
	mainTimer = setInterval(() => {
		frameIndex += 1;
		tick();
	}, TICK_MS);
}
