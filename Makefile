# Infra de la demo.
.DEFAULT_GOAL := help

-include .env
export

SUBSCRIBERS ?= *
LIMIT ?= 10
CONSUME_INTERVAL_SECONDS ?= 60

.PHONY: help up down restart rebuild logs ps test-db test sync consume-a2 watch-consume

help: ## Muestra los targets disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Levanta los contenedores (la primera vez ejecuta databases/*.sql)
	docker compose up -d --wait

down: ## Para y borra contenedores + datos (volume)
	docker compose down -v

restart: down up ## Reinicio completo (volumen incluido)

logs: ## Sigue los logs de los contenedores
	docker compose logs -f --tail 100

ps: ## Estado de los servicios
	docker compose ps

# ── Tests de integración ──────────────────────────────────────────────────
test-db: ## Levanta el MySQL de tests (profile test, host 3307)
	docker compose --profile test up -d --wait bbdd-test

test: test-db ## Tests de integración de app2 contra bbdd-test (DSN desde app2/.env.test)
	cd app2 && npm run test

# ── Cola de eventos (contrato en docs/04-06) ─────────────────────────────
sync: ## Inscribe en domain_events_routing los suscriptores registrados en app2
	docker exec app2 npm run sync-routing

consume-a2: ## Ronda única de consumo de app2 (SUBSCRIBERS=* LIMIT=10)
	docker exec app2 npm run consume-events -- "$(SUBSCRIBERS)" "$(LIMIT)"

watch-consume: ## Consumo periódico de app2 cada CONSUME_INTERVAL_SECONDS (Ctrl+C para parar)
	while true; do \
		docker exec app2 npm run consume-events -- "$(SUBSCRIBERS)" "$(LIMIT)"; \
		sleep "$(CONSUME_INTERVAL_SECONDS)"; \
	done
