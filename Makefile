# =============================================================================
# Makefile — Property Management System Backend
# 2026 Best Practices: .ONESHELL, auto-help, color output, pre-flight checks
# Usage: make <target> [VAR=value]
# =============================================================================

# =============================================================================
# Global Settings (2026 Patterns)
# =============================================================================
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:
.SECONDEXPANSION:
.DELETE_ON_ERROR:

# Color output for better UX (2026: terminal-aware)
ifeq ($(TERM),dumb)
    COLOR_RESET :=
    COLOR_GREEN :=
    COLOR_YELLOW :=
    COLOR_RED :=
    COLOR_BLUE :=
else
    COLOR_RESET := \033[0m
    COLOR_GREEN := \033[32m
    COLOR_YELLOW := \033[33m
    COLOR_RED := \033[31m
    COLOR_BLUE := \033[34m
endif

# Docker Compose compatibility (V2 primary, V1 fallback)
DOCKER_COMPOSE := $(shell command -v docker-compose 2>/dev/null || echo "docker compose")

# Project configuration (override via env or command line)
COMPOSE_FILE ?= docker-compose.dev.yml
TEST_COMPOSE = docker-compose.test.yml
PROJECT_NAME ?= pms-dev
TEST_PROJECT_NAME ?= pms-test
BUILD_TARGET ?= development
TEST_RETENTION_DAYS ?= 7

# Environment file loading
ifneq ($(wildcard backend/.env),)
    include backend/.env
    export $(shell sed 's/=.*//' backend/.env)
endif

# =============================================================================
# Pre-flight Checks (2026: Fail fast, helpful errors)
# =============================================================================
.PHONY: check-docker check-compose check-env help

check-docker:
	@if ! command -v docker &>/dev/null; then \
		echo "$(COLOR_RED)Error: Docker is not installed$(COLOR_RESET)"; \
		echo "Install: https://docs.docker.com/get-docker/"; \
		exit 1; \
	fi
	@if ! docker info &>/dev/null; then \
		echo "$(COLOR_RED)Error: Docker daemon is not running$(COLOR_RESET)"; \
		echo "Start Docker Desktop or run: sudo systemctl start docker"; \
		exit 1; \
	fi

check-compose:
	@if ! $(DOCKER_COMPOSE) version &>/dev/null; then \
		echo "$(COLOR_RED)Error: Docker Compose is not installed$(COLOR_RESET)"; \
		echo "Install: https://docs.docker.com/compose/install/"; \
		exit 1; \
	fi

check-env:
	@if [[ ! -f backend/.env ]]; then \
		echo "$(COLOR_YELLOW)Warning: backend/.env not found$(COLOR_RESET)"; \
		echo "Copying backend/.env.example → backend/.env"; \
		cp backend/.env.example backend/.env; \
		echo "$(COLOR_GREEN)Please edit backend/.env and set SECRET_KEY, ID_CARD_ENCRYPTION_KEY$(COLOR_RESET)"; \
	fi
	@if grep -q "change-this" backend/.env 2>/dev/null; then \
		echo "$(COLOR_RED)Error: Please update SECRET_KEY and ID_CARD_ENCRYPTION_KEY in backend/.env$(COLOR_RESET)"; \
		echo "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""; \
		exit 1; \
	fi

# =============================================================================
# Help System (2026: Auto-generated from comments)
# =============================================================================
help: ## Display this help message with available targets
	@echo "$(COLOR_BLUE)Property Management System — Backend Makefile$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_GREEN)Development$(COLOR_RESET)"
	@echo "  make dev              Start development environment (hot-reload)"
	@echo "  make dev-frontend      Start frontend development server only"
	@echo "  make dev-down         Stop development environment"
	@echo "  make dev-logs         View backend logs in real-time"
	@echo "  make dev-shell        Open shell in backend container"
	@echo ""
	@echo "$(COLOR_GREEN)Testing$(COLOR_RESET)"
	@echo "  make test             Run all backend tests (isolated test stack)"
	@echo "  make test-unit        Run unit tests only"
	@echo "  make test-frontend    Run frontend tests (Vitest)"
	@echo "  make test-e2e         Run E2E tests with Playwright (self-contained)"
	@echo "  make test-integration Run integration tests only"
	@echo "  make test-coverage    Run tests + generate HTML coverage report"
	@echo "  make test-contract    Run contract testing with Schemathesis"
	@echo "  make test-clean       Clean test artifacts and volumes"
	@echo ""
	@echo "$(COLOR_GREEN)Quality$(COLOR_RESET)"
	@echo "  make lint             Run linters (ruff, mypy, bandit)"
	@echo "  make lint-frontend    Run frontend linters (ESLint + TSC)"
	@echo "  make lint-fix         Run linters with auto-fix where possible"
	@echo "  make typecheck        Run mypy type checking"
	@echo "  make security         Run security scans (bandit, safety)"
	@echo ""
	@echo "$(COLOR_GREEN)Database$(COLOR_RESET)"
	@echo "  make db-migrate       Run Alembic migrations"
	@echo "  make db-reset         Reset database (DROP + CREATE + migrate) ⚠️"
	@echo "  make db-shell         Open psql shell in database container"
	@echo ""
	@echo "$(COLOR_GREEN)Build & Deploy$(COLOR_RESET)"
	@echo "  make build            Build production Docker image"
	@echo "  make build-dev        Build development Docker image"
	@echo "  make build-test       Build testing Docker image"
	@echo "  make push             Push image to registry (set REGISTRY=...)"
	@echo ""
	@echo "$(COLOR_GREEN)Production (Sprint 8)$(COLOR_RESET)"
	@echo "  make prod-up          Start production stack"
	@echo "  make prod-down        Stop production stack"
	@echo "  make prod-validate    Validate production environment"
	@echo "  make load-test        Run load testing with Locust"
	@echo "  make backup           Backup database to MinIO"
	@echo "  make restore          Restore database from latest backup"
	@echo "  make release          Full release pipeline (tag + build + push)"
	@echo "  make release-dry-run  Dry-run release (validate without publishing)"
	@echo ""
	@echo "$(COLOR_GREEN)Utilities$(COLOR_RESET)"
	@echo "  make clean            Clean all build artifacts and volumes"
	@echo "  make info             Show environment and configuration info"
	@echo ""
	@echo "$(COLOR_YELLOW)Variables$(COLOR_RESET)"
	@echo "  COMPOSE_FILE=path     Use alternate compose file (default: docker-compose.dev.yml)"
	@echo "  BUILD_TARGET=stage    Build specific Docker stage (dev/test/prod)"
	@echo "  TEST_RETENTION_DAYS=N MinIO test data retention (default: 7)"
	@echo ""
	@echo "$(COLOR_BLUE)Examples$(COLOR_RESET)"
	@echo "  make dev                          # Start dev environment"
	@echo "  make test TEST_RETENTION_DAYS=1   # Run tests, keep MinIO data 1 day"
	@echo "  make build BUILD_TARGET=prod      # Build production image"
	@echo ""

# =============================================================================
# Development Targets
# =============================================================================
.PHONY: dev dev-down dev-logs dev-shell

dev: check-docker check-compose check-env ## Start development environment with hot-reload
	@echo "$(COLOR_GREEN)→ Starting development environment...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev up --build

dev-frontend: check-docker check-compose ## Start frontend development server only
	@echo "$(COLOR_GREEN)→ Starting frontend development server...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev up --build frontend

dev-down: check-docker check-compose ## Stop development environment
	@echo "$(COLOR_YELLOW)→ Stopping development environment...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev down

dev-logs: check-docker check-compose ## View backend logs in real-time
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev logs -f backend

dev-shell: check-docker check-compose ## Open interactive shell in backend container
	@echo "$(COLOR_GREEN)→ Opening shell in backend container...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev exec backend bash

# =============================================================================
# Testing Targets (2026: Isolated test stack via docker-compose.test.yml)
# =============================================================================
.PHONY: test test-unit test-frontend test-e2e test-integration test-coverage test-contract test-clean test-up test-down

test-up: check-docker check-compose ## Start isolated test stack (db, redis, minio, backend)
	@echo "$(COLOR_GREEN)→ Starting test stack...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) up -d backend
	@echo "$(COLOR_GREEN)✓ Test stack ready$(COLOR_RESET)"

test-down: check-docker check-compose ## Stop isolated test stack and remove volumes
	@echo "$(COLOR_YELLOW)→ Stopping test stack...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) down -v
	@echo "$(COLOR_GREEN)✓ Test stack stopped$(COLOR_RESET)"

test: check-docker check-compose ## Run all backend tests in isolated test stack
	@echo "$(COLOR_GREEN)→ Running tests in isolated test stack...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		-e TEST_RETENTION_DAYS=$(TEST_RETENTION_DAYS) \
		backend-test

test-unit: check-docker check-compose ## Run unit tests only
	@echo "$(COLOR_GREEN)→ Running unit tests...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test pytest tests/ -m "not integration" -v --color=yes

test-frontend: check-docker check-compose ## Run frontend unit tests (Vitest)
	@echo "$(COLOR_GREEN)→ Running frontend tests...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		frontend-test npx vitest run --coverage

test-e2e: check-docker check-compose ## Run E2E tests with Playwright (self-contained: starts stack, seeds DB, runs tests, tears down)
	@echo "$(COLOR_GREEN)→ Running Playwright E2E tests (self-contained)...$(COLOR_RESET)"
	@mkdir -p frontend/playwright-report frontend/e2e-results
	@# 1. Start test stack (backend + db + redis + minio)
	@echo "$(COLOR_BLUE)  [1/4] Starting test stack...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) up -d backend
	@# 2. Apply migrations
	@echo "$(COLOR_BLUE)  [2/4] Applying migrations...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) exec -T backend alembic upgrade head
	@# 3. Seed E2E fixture data
	@echo "$(COLOR_BLUE)  [3/4] Seeding E2E fixture data...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) exec -T backend python -m scripts.seed_e2e --reset
	@# 4. Run Playwright
	@echo "$(COLOR_BLUE)  [4/4] Running Playwright...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		frontend-test npx playwright test --reporter=html
	@# Cleanup: stop test stack
	@echo "$(COLOR_YELLOW)→ Cleaning up test stack...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) down -v
	@echo "$(COLOR_GREEN)✓ E2E tests complete$(COLOR_RESET)"

test-integration: check-docker check-compose ## Run integration tests only (requires test stack)
	@echo "$(COLOR_GREEN)→ Running integration tests...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) up -d backend
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test pytest tests/ -m "integration" -v --color=yes

test-coverage: check-docker check-compose ## Run tests + generate HTML coverage report
	@echo "$(COLOR_GREEN)→ Running tests with coverage...$(COLOR_RESET)"
	@mkdir -p /tmp/coverage backend/htmlcov
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		-v /tmp/coverage:/tmp/coverage \
		-v $(CURDIR)/backend/htmlcov:/app/htmlcov \
		-e COVERAGE_FILE=/tmp/coverage/.coverage \
		backend-test pytest --cov=app --cov-report=html --cov-report=term-missing -v --color=yes
	@echo ""
	@echo "$(COLOR_GREEN)✓ Coverage report: backend/htmlcov/index.html$(COLOR_RESET)"
	@echo "$(COLOR_BLUE)  Open in browser to view details$(COLOR_RESET)"

test-contract: check-docker check-compose ## Run contract testing with Schemathesis
	@echo "$(COLOR_GREEN)→ Running contract tests against test backend...$(COLOR_RESET)"
	@# Start test stack if backend not running
	@if ! $(DOCKER_COMPOSE) -f $(TEST_COMPOSE) ps backend | grep -q "running"; then \
		echo "$(COLOR_YELLOW)  Backend not running. Starting test stack...$(COLOR_RESET)"; \
		$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) up -d backend; \
		sleep 10; \
	fi
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test schemathesis run http://backend:8000/openapi.json \
		--checks all --endpoint /api/v1/auth --endpoint /api/v1/properties --endpoint /api/v1/rooms \
		--endpoint /api/v1/meter-readings --endpoint /api/v1/invoices --endpoint /api/v1/tenants \
		--endpoint /api/v1/contracts --endpoint /api/v1/dashboard --endpoint /api/v1/reports \
		--endpoint /api/v1/payments --endpoint /api/v1/maintenance \
		--report=html --report-file=/app/test-reports/contract-report.html
	@echo ""
	@echo "$(COLOR_GREEN)✓ Contract report: backend/test-reports/contract-report.html$(COLOR_RESET)"

test-clean: check-docker check-compose ## Clean test artifacts and volumes
	@echo "$(COLOR_YELLOW)→ Cleaning test artifacts...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) down -v
	rm -rf backend/htmlcov backend/test-reports backend/.pytest_cache backend/.mypy_cache

lint-frontend: check-docker check-compose ## Run frontend linters (ESLint + TSC)
	@echo "$(COLOR_GREEN)→ Running frontend linters...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		frontend-test npx eslint . --max-warnings 0
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		frontend-test npx tsc --noEmit

# =============================================================================
# Quality Targets (2026: Fast feedback, auto-fix where possible)
# =============================================================================
.PHONY: lint lint-frontend lint-fix typecheck security

lint: check-docker check-compose ## Run linters (ruff, mypy, bandit)
	@echo "$(COLOR_GREEN)→ Running linters...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test ruff check app --output-format=full --no-cache
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test mypy app --pretty
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test bandit -r app -f json -o /app/test-reports/bandit-report.json || true

lint-fix: check-docker check-compose ## Run linters with auto-fix where possible
	@echo "$(COLOR_GREEN)→ Running linters with auto-fix...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test ruff check backend/app --fix --output-format=full
	@echo "$(COLOR_GREEN)✓ Auto-fix complete. Review changes before committing.$(COLOR_RESET)"

typecheck: check-docker check-compose ## Run mypy type checking
	@echo "$(COLOR_GREEN)→ Running type checking...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test mypy backend/app --pretty --show-error-codes

security: check-docker check-compose ## Run security scans (bandit, safety)
	@echo "$(COLOR_GREEN)→ Running security scans...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test bandit -r app -ll -ii
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test safety check --output bare || true
	@echo "$(COLOR_GREEN)✓ Security scan complete. Check backend/test-reports/ for reports.$(COLOR_RESET)"

# =============================================================================
# Database Targets
# =============================================================================
.PHONY: db-migrate db-reset db-shell

db-migrate: check-docker check-compose ## Run Alembic migrations
	@echo "$(COLOR_GREEN)→ Running database migrations...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev run --rm \
		backend alembic upgrade head

db-reset: check-docker check-compose ## Reset database (DROP + CREATE + migrate) ⚠️
	@echo "$(COLOR_RED)⚠️  WARNING: This will DROP all data in the test database!$(COLOR_RESET)"
	@read -p "Type 'RESET' to confirm: " confirm && [[ "$$confirm" == "RESET" ]] || (echo "Aborted" && exit 1)
	@echo "$(COLOR_YELLOW)→ Resetting database...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev down -v
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev up -d db
	@sleep 5  # Wait for DB to be ready
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev run --rm \
		backend alembic upgrade head
	@echo "$(COLOR_GREEN)✓ Database reset complete$(COLOR_RESET)"

db-shell: check-docker check-compose ## Open psql shell in database container
	@echo "$(COLOR_GREEN)→ Opening psql shell...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev exec db \
		psql -U $${DB_USER:-user} -d $${DB_NAME:-pms_test}

# =============================================================================
# Build & Deploy Targets (2026: Multi-stage, multi-platform ready)
# =============================================================================
.PHONY: build build-dev build-test build-prod push

build: build-prod ## Build production Docker image (default target)

build-dev: check-docker check-compose ## Build development Docker image
	@echo "$(COLOR_GREEN)→ Building development image...$(COLOR_RESET)"
	docker build -t $(PROJECT_NAME)-backend:dev \
		--target development \
		--build-arg PIP_CACHE_DIR=/tmp/pip-cache \
		-f backend/Dockerfile backend

build-test: check-docker check-compose ## Build testing Docker image
	@echo "$(COLOR_GREEN)→ Building testing image...$(COLOR_RESET)"
	docker build -t $(PROJECT_NAME)-backend:test \
		--target testing \
		--build-arg PIP_CACHE_DIR=/tmp/pip-cache \
		-f backend/Dockerfile backend

build-prod: check-docker check-compose ## Build production Docker image
	@echo "$(COLOR_GREEN)→ Building production image...$(COLOR_RESET)"
	docker build -t $(PROJECT_NAME)-backend:prod \
		--target production \
		--build-arg PIP_CACHE_DIR=/tmp/pip-cache \
		-f backend/Dockerfile backend

push: check-docker ## Push image to registry (set REGISTRY=...)
	@if [[ -z "${REGISTRY}" ]]; then \
		echo "$(COLOR_RED)Error: REGISTRY environment variable not set$(COLOR_RESET)"; \
		echo "Usage: make push REGISTRY=ghcr.io/yourorg"; \
		exit 1; \
	fi
	@echo "$(COLOR_GREEN)→ Pushing $(PROJECT_NAME)-backend:prod to ${REGISTRY}...$(COLOR_RESET)"
	docker tag $(PROJECT_NAME)-backend:prod ${REGISTRY}/$(PROJECT_NAME)-backend:latest
	docker push ${REGISTRY}/$(PROJECT_NAME)-backend:latest

# =============================================================================
# Production Targets (Sprint 8)
# =============================================================================
.PHONY: prod-up prod-down prod-validate load-test backup restore release release-dry-run

PROD_COMPOSE = docker-compose.prod.yml

prod-up: check-docker check-compose ## Start production stack
	@echo "$(COLOR_GREEN)→ Starting production stack...$(COLOR_RESET)"
	@$(DOCKER_COMPOSE) -f $(PROD_COMPOSE) up -d
	@echo "$(COLOR_GREEN)✓ Production stack started$(COLOR_RESET)"
	@echo "  Backend: http://localhost:8000"
	@echo "  Health:  http://localhost:8000/health"
	@echo "  MinIO:   http://localhost:9001"

prod-down: check-docker check-compose ## Stop production stack
	@echo "$(COLOR_YELLOW)→ Stopping production stack...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(PROD_COMPOSE) down
	@echo "$(COLOR_GREEN)✓ Production stack stopped$(COLOR_RESET)"

prod-validate: check-docker check-compose ## Validate production environment
	@echo "$(COLOR_GREEN)→ Validating production environment...$(COLOR_RESET)"
	@bash scripts/validate_prod_env.sh

load-test: check-docker check-compose ## Run load testing with Locust
	@echo "$(COLOR_GREEN)→ Running load tests with Locust...$(COLOR_RESET)"
	@# Start test stack (db + redis only)
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) up -d db redis
	@sleep 3
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) run --rm \
		backend-test locust -f /app/tests/load/locustfile.py --headless -u 50 -r 10 -t 10s --csv /tmp/locust_results
	@echo "$(COLOR_GREEN)✓ Load test results: /tmp/locust_results*.csv$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) down -v

backup: check-docker check-compose ## Backup database to MinIO
	@echo "$(COLOR_GREEN)→ Running database backup...$(COLOR_RESET)"
	@bash scripts/backup.sh

restore: check-docker check-compose ## Restore database from latest backup
	@echo "$(COLOR_YELLOW)⚠  WARNING: This will overwrite the current database!$(COLOR_RESET)"
	@read -p "Type 'RESTORE' to confirm: " confirm && [[ "$$confirm" == "RESTORE" ]] || (echo "Aborted" && exit 1)
	@bash scripts/restore.sh

release: check-docker check-compose ## Full release pipeline (tag + build + push)
	@echo "$(COLOR_GREEN)→ Running full release pipeline...$(COLOR_RESET)"
	@bash scripts/release.sh

release-dry-run: check-docker check-compose ## Dry-run release (validate without publishing)
	@echo "$(COLOR_GREEN)→ Running dry-run release validation...$(COLOR_RESET)"
	@bash scripts/release.sh --dry-run

# =============================================================================
# Utility Targets
# =============================================================================
.PHONY: clean info

clean: test-clean ## Clean all build artifacts and volumes
	@echo "$(COLOR_YELLOW)→ Cleaning all artifacts...$(COLOR_RESET)"
	$(DOCKER_COMPOSE) -f $(COMPOSE_FILE) --project-name $(PROJECT_NAME) --profile dev down -v --rmi all
	$(DOCKER_COMPOSE) -f $(TEST_COMPOSE) down -v --rmi all 2>/dev/null || true
	rm -rf backend/__pycache__ backend/app/__pycache__ backend/app/*/__pycache__
	rm -rf backend/app/*/*/__pycache__ backend/.pytest_cache backend/.mypy_cache
	rm -rf backend/htmlcov backend/test-reports
	@echo "$(COLOR_GREEN)✓ Clean complete$(COLOR_RESET)"

info: ## Show environment and configuration info
	@echo "$(COLOR_BLUE)Property Management System — Environment Info$(COLOR_RESET)"
	@echo ""
	@echo "Docker: $$(docker --version)"
	@echo "Compose: $$(command -v docker-compose &>/dev/null && echo "docker-compose $$(docker-compose --version)" || echo "$(DOCKER_COMPOSE) $$(docker compose version)")"
	@echo ""
	@echo "Project: $(PROJECT_NAME)"
	@echo "Compose File: $(COMPOSE_FILE)"
	@echo "Build Target: $(BUILD_TARGET)"
	@echo "Test Retention: $(TEST_RETENTION_DAYS) days"
	@echo ""
	@echo "Environment Variables (from backend/.env):"
	@if [[ -f backend/.env ]]; then \
		grep -v '^#' backend/.env | grep -v '^$$' | sed 's/^/  /' | head -10; \
		if [[ $$(wc -l < backend/.env) -gt 10 ]]; then \
			echo "  ... ($$(wc -l < backend/.env) total lines)"; \
		fi; \
	else \
		echo "  (backend/.env not found)"; \
	fi
	@echo ""
	@echo "$(COLOR_GREEN)Use 'make help' for available targets$(COLOR_RESET)"

# =============================================================================
# Default Target
# =============================================================================
.DEFAULT_GOAL := help