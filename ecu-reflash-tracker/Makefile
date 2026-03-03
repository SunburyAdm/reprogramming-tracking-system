# Makefile for ECU Reflash Tracker

.PHONY: help build up down logs shell db-shell test seed clean

help:
	@echo "ECU Reflash Tracker - Make Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make init      - Initialize config files"
	@echo "  make build     - Build Docker images"
	@echo ""
	@echo "Development:"
	@echo "  make up        - Start all services"
	@echo "  make down      - Stop all services"
	@echo "  make logs      - View all logs"
	@echo "  make clean     - Stop and remove containers"
	@echo ""
	@echo "Interactive:"
	@echo "  make shell     - Shell into backend container"
	@echo "  make db-shell  - PostgreSQL shell"
	@echo ""
	@echo "Testing:"
	@echo "  make test      - Run backend tests"
	@echo "  make seed      - Seed database"
	@echo ""

init:
	@bash init.sh || cmd /c init.bat

build:
	docker compose build

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

shell:
	docker compose exec backend bash

db-shell:
	docker compose exec postgres psql -U ecu_user -d ecu_db

test:
	docker compose exec backend pytest tests/ -v

seed:
	docker compose exec backend python scripts/seed.py

clean:
	docker compose down -v
	rm -rf backend/__pycache__ backend/.pytest_cache frontend/node_modules

.SILENT:
