#!/usr/bin/env zsh
# Lanza Drizzle Studio para una BD de la demo.
# Cada BD vive en su propio puerto, así que las instancias pueden
# convivir: eventos→4983, comercio→4984 y ops→4985
# (https://local.drizzle.studio).
# Uso: ./studio.sh eventos|comercio|ops (desde scripts/db o con ruta)
set -e

BD="${1:-eventos}"
case "$BD" in
	eventos)  PUERTO=4983 ;;
	comercio) PUERTO=4984 ;;
	ops)      PUERTO=4985 ;;
	*) echo "BD desconocida: $BD (usa eventos|comercio|ops)"; exit 1 ;;
esac

cd "$(dirname "$0")"

# Logs fuera del repo tracked: .local/logs es la ruta única de logs
LOGS="$(pwd)/../../.local/logs"
mkdir -p "$LOGS"

CONF="drizzle.${BD}.config.ts"
[ -f "$CONF" ] || { echo "Falta $CONF"; exit 1; }

# Sustituye solo la instancia de este puerto; la otra BD sigue viva.
# (El kill va aquí y no inline en el shell: el patrón por puerto no choca
# con nuestro propio cmdline).
PID=$(ss -ltnp 2>/dev/null | grep ":$PUERTO " | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2)
if [ -n "$PID" ]; then
	kill "$PID" 2>/dev/null || true
	sleep 1
fi

echo "⏳ Arrancando Drizzle Studio sobre '$BD' (puerto $PUERTO)…"
npx drizzle-kit studio --config="$CONF" --port="$PUERTO" > "$LOGS/studio-${BD}.log" 2>&1 &
sleep 8

if grep -q 'up and running' "$LOGS/studio-${BD}.log"; then
	URL="https://local.drizzle.studio"
	[ "$PUERTO" != "4983" ] && URL="${URL}?port=${PUERTO}"
	echo "✅ $URL  (BD: $BD)"
else
	echo '❌ falló:'
	tail -5 "$LOGS/studio-${BD}.log"
	exit 1
fi
