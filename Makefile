# Infra de la demo. Los targets de consume/sync aparecen cuando llegue el código de las apps (docs/09).
.DEFAULT_GOAL := help

-include .env
export

.PHONY: help up down restart rebuild logs ps test-db test

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
