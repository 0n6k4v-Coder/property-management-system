# Contributing to Property Management System

Thank you for considering contributing! This document provides guidelines for contributors.

---

## 🌿 Branch Strategy

| Branch | Purpose | Merge To |
|--------|---------|----------|
| `master` | Production-ready code | — |
| `feature/*` | New features | master |
| `fix/*` | Bug fixes | master |
| `docs/*` | Documentation changes | master |
| `refactor/*` | Code refactoring | master |

### Branch Naming
```bash
feature/add-user-profile
fix/login-redirect-issue
docs/update-readme
refactor/extract-auth-service
```

---

## 🔀 Pull Request Process

### 1. Create Feature Branch
```bash
git checkout master
git pull origin master
git checkout -b feature/my-feature
```

### 2. Make Changes
- Follow code style guidelines
- Write tests for new features
- Update documentation if needed

### 3. Run Quality Gates (REQUIRED)
```bash
./scripts/run-quality-gates.sh
```

### 4. Commit with Conventional Commits
```bash
git commit -m "feat(auth): add user profile page"
```

### 5. Push and Create PR
```bash
git push origin feature/my-feature
```

---

## 📝 Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

### Types
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `style` — Code style (no logic change)
- `refactor` — Code refactoring
- `test` — Adding/updating tests
- `chore` — Build process, dependencies

### Scopes
- `auth`, `billing`, `property`, `tenant`, `contract`
- `maintenance`, `dashboard`, `frontend`, `backend`
- `scripts`, `docs`

---

## 🎨 Code Style

### Backend (Python)
See [backend/docs/CODE_STYLE.md](backend/docs/CODE_STYLE.md)

```bash
make lint        # ruff + mypy
make typecheck   # mypy strict
```

### Frontend (TypeScript)
```bash
make lint-frontend    # ESLint
make typecheck-frontend  # tsc
```

---

## 🧪 Testing

```bash
# Backend
make test-unit

# Frontend
make test-frontend

# E2E (fast feedback)
./scripts/run-e2e-subset.sh auth
```

---

## 🚦 Quality Gates

Before submitting a PR, run all quality gates:

```bash
./scripts/run-quality-gates.sh
```

**All 16 gates must pass before merge.**

---

## 📚 Documentation

When adding new features:
1. Update README.md if needed
2. Update SCRIPTS.md if adding scripts
3. Update docs/ for architectural changes
4. Add ADR in docs/DECISIONS/ for significant decisions
