# Property Management System — Backend

**FastAPI-based backend** for Thai dormitory/rental property management.  
Docker-First — all development and testing runs inside containers.

## Quick Start

```bash
# 1. Prerequisites
docker --version          # ≥ 24.0
docker compose version    # ≥ 2.20
make --version            # Optional but recommended

# 2. Clone and configure
git clone <repo> && cd property-management-system
cp backend/.env.example backend/.env
# Edit backend/.env — set SECRET_KEY and ID_CARD_ENCRYPTION_KEY

# 3. Start development environment
make dev
# → hot-reload enabled, backend at http://localhost:8000

# 4. Verify
curl http://localhost:8000/health   # → {"status":"ok"}
curl http://localhost:8000/docs     # → Swagger UI
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | ✅ | — | JWT signing secret (generate via `openssl rand -hex 32`) |
| `ID_CARD_ENCRYPTION_KEY` | ✅ | — | Fernet key for sensitive data (use `Fernet.generate_key()`) |
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://user:pass@db:5432/pms_test` | Async PostgreSQL connection string |
| `REDIS_URL` | ⬜ | `redis://redis:6379/0` | Redis connection (Celery broker, future) |
| `DEBUG` | ⬜ | `true` | Enable hot-reload, CORS, debug logging |
| `BCRYPT_ROUNDS` | ⬜ | `12` | Password hashing cost factor |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ⬜ | `15` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | ⬜ | `7` | JWT refresh token lifetime |
| `INVITE_TOKEN_EXPIRE_DAYS` | ⬜ | `7` | Invite link lifetime |
| `APP_DOMAIN` | ⬜ | `http://localhost:3000` | Frontend domain for invite links |

## Development Commands

Run all commands from the **project root** (`/property-management-system/`):

```bash
make dev              # Start dev environment (hot-reload)
make dev-down         # Stop dev environment
make dev-logs         # Tail backend logs
make dev-shell        # Open shell in backend container
make info             # Show environment info
```

## Testing

```bash
make test             # Run ALL tests in isolated container
make test-unit        # Unit tests only (fast, no DB needed)
make test-integration # Integration tests only (requires DB)
make test-coverage    # Tests + HTML coverage report → backend/htmlcov/
make test-contract    # Schemathesis contract testing
make test-clean       # Clean test artifacts and volumes
```

### Manual test commands (Docker):

```bash
# Run specific test file
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
  pytest tests/modules/auth/test_auth_service.py -v

# Run with coverage
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
  pytest tests/ -v --cov=app --cov-report=term-missing
```

## Database

```bash
make db-migrate       # Run pending Alembic migrations
make db-reset         # ⚠️ DROP + RECREATE + migrate (destroys data)
make db-shell         # Open psql shell in DB container
```

If Alembic is not yet set up, create tables directly:

```bash
docker compose -f docker-compose.dev.yml --profile dev exec -e PYTHONPATH=/app backend \
  python3 /app/scripts/create_tables.py
```

## Quality

```bash
make lint             # ruff + mypy + bandit
make lint-fix         # Auto-fix where possible
make typecheck        # mypy type checking
make security         # bandit + safety scans
```

## Project Structure

```
backend/
├── app/
│   ├── modules/          # Feature modules (auth, property, billing, …)
│   │   └── auth/         # Authentication (5 endpoints)
│   │       ├── models.py, schemas.py, repository.py
│   │       ├── services/  # Business logic
│   │       ├── routers/   # HTTP routes
│   │       ├── events.py, constants.py
│   │       └── __init__.py
│   ├── shared/           # Cross-cutting concerns
│   │   ├── security.py   # JWT, Argon2id, Fernet
│   │   ├── audit.py      # Audit logging
│   │   ├── database.py   # Async session factory
│   │   ├── deps.py       # FastAPI dependencies
│   │   └── exceptions.py # APIError class
│   ├── main.py           # FastAPI app factory
│   └── config.py         # Pydantic Settings
├── tests/                # Mirror app/ structure
│   ├── conftest.py       # Shared fixtures
│   ├── factories/        # Factory-boy definitions
│   ├── modules/          # Module-specific tests
│   ├── shared/           # Shared-kernel tests
│   └── integration/      # Cross-module E2E tests
├── alembic/              # DB migrations
└── docs/                 # Backend documentation
    ├── SPRINT_1.md       # Sprint 1 plan & status
    ├── SDD.md            # Software design document
    └── CODE_STYLE.md     # Coding standards
```

## Troubleshooting

| Problem | Check | Fix |
|---------|-------|-----|
| Backend won't start | `make dev-logs` | Check `.env` vars, port 8000 not in use |
| DB connection failed | `make dev-logs` | Verify `DATABASE_URL` matches service name (`db`) |
| Hot-reload not working | Check volume mounts | Use `cached` option on macOS |
| Tests fail in container | Run `make dev-shell` | Check line endings (CRLF/LF), file permissions |
| Coverage permission error | `make test-coverage` | Uses `/tmp/coverage` writable volume |
| `users` table not found | `make db-shell` → `\dt` | Run `scripts/create_tables.py` or `make db-migrate` |

## References

- [Sprint 1 Plan](backend/docs/SPRINT_1.md)
- [Software Design Document](backend/docs/SDD.md)
- [Code Style Guide](backend/docs/CODE_STYLE.md)
- [Architecture Decision Records](../docs/ARCHITECTURE.md)