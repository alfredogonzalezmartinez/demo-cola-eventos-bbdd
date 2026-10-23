# Fase 0: solo infraestructura de BBDD. Los targets de consume/sync llegan en Fases 3+ (app2) y 6 (app1).
.DEFAULT_GOAL := help

-include .env
export

.PHONY: help up down restart rebuild logs ps

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
