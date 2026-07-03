# Sprint 8 Implementation Plan — Backend (Production Ready & CI/CD)

**Frozen Contract v1.0** — Effective Date: 2026-05-31
**Status:** ✅ COMPLETE — CI/CD pipeline, multi-stage Docker, backup/restore, Locust load tests, deployment docs verified 2026-05-27

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | สร้าง Production Deployment Pipeline (CI/CD, Multi-stage Docker, Security Hardening) + Load Testing + Backup/Restore Validation + Final Handoff Docs ที่พร้อมใช้งานจริงใน 3 Deployment Modes — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `docs/SDD.md` v1.4: §10 (Deployment), §4.5 (Security), §9.5 (CI/CD), §7.4 (Audit), §3.1 (API Conventions) |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ, `--profile prod` สำหรับ validation |
| **Output** | Production-ready Docker images, CI/CD pipeline, load test reports, backup/restore scripts validated, deployment documentation complete |

> 📌 **สำคัญ:** `Makefile` อยู่ที่ **root ของโปรเจกต์** (`/property-management-system/Makefile`)  
> ✅ **คำสั่ง `make` ทุกคำสั่งต้องรันจากที่นี่** — ไม่ใช่จากใน `backend/`  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จ — ห้ามทิ้งคอนเทนเนอร์รันค้าง

---

## 🐳 Docker Environment Setup (ก่อนเริ่มงาน)

### 1. ตรวจสอบระบบโฮสต์
```bash
docker --version          # ≥ 24.0
docker compose version    # ≥ 2.20
make --version
```

### 2. เตรียมฐานข้อมูล & Migration
```bash
docker compose -f docker-compose.dev.yml --profile dev run --rm backend \
  alembic upgrade head
docker compose -f docker-compose.dev.yml --profile dev exec db \
  psql -U user -d pms_test -c "\dt"
```

### 3. เริ่มสภาพแวดล้อมพัฒนา
```bash
make dev
docker compose -f docker-compose.dev.yml --profile dev ps
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

---

## 📋 Sprint 8 TODO List (Docker-First)

### 🔹 Phase 0: Bootstrap & CI/CD Foundation (Day 1 AM) — ~1 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 0.1 | สร้าง `.github/workflows/ci.yml` | Lint → Test → Build → Security Scan (pass on PR) |
| 0.2 | สร้าง `docker-compose.prod.yml` | Multi-service, restart policies, resource limits, healthchecks |
| 0.3 | อัปเดต `Makefile` | เพิ่ม target: `prod-up`, `prod-down`, `load-test`, `backup`, `release` |

### 🔹 Phase 1: Production Docker Hardening (Day 1 PM - Day 2) — ~8 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 1.1 | `Dockerfile` (Multi-stage) | `builder` → `runner`, non-root user, minimal base image, healthcheck, graceful shutdown |
| 1.2 | `.dockerignore` + `backend/.env.production.example` | Exclude dev/test files, production vars template |
| 1.3 | `backend/app/main.py` hardening | Graceful shutdown hooks (SIGTERM/SIGINT), production logging config (JSON), disable debug routes |

### 🔹 Phase 2: Load & Performance Testing (Day 3 - Day 4) — ~10 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 2.1 | `tests/load/locustfile.py` | Simulate 100+ users, target `/health`, `/dashboard/summary`, `/auth/login`, verify p95 < 500ms |
| 2.2 | `tests/load/test_performance.py` | Pytest benchmark: DB connection pool, query latency, rate limit threshold |
| 2.3 | Connection pool & query tuning | `pool_pre_ping=True`, index validation, N+1 elimination verified |

### 🔹 Phase 3: Backup/Restore & Release Validation (Day 5) — ~6 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 3.1 | `scripts/backup.sh` + `scripts/restore.sh` | pg_dump → MinIO, verified restore on clean DB, idempotent |
| 3.2 | `scripts/validate_prod_env.sh` | Pre-flight checks: env vars, ports, permissions, migration status |
| 3.3 | `scripts/release.sh` | Git tag, docker buildx multi-arch, push to registry, changelog generation |

### 🔹 Phase 4: Documentation & Final Handoff (Day 6) — ~4 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 4.1 | `backend/docs/DEPLOYMENT.md` | Self-hosted / On-premise / Cloud setup, env vars, monitoring, troubleshooting |
| 4.2 | `backend/docs/OPERATIONS.md` | Backup schedule, log rotation, incident response, upgrade path |
| 4.3 | Sprint 8 Retrospective | บันทึก lessons learned, handoff checklist, known limitations |

### 🔹 Phase 5: CI/CD & Integration Verification (Day 7) — ~2 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 5.1 | GitHub Actions dry-run | Workflow executes, artifacts published, security scan clean |
| 5.2 | Final `make lint` + `make test` | 139+ tests pass, coverage ≥85%, 0 warnings |
| 5.3 | Archive & tag release | `git tag -a v1.0.0`, `make release` runs successfully |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. ตรวจสอบ CI/CD Workflow (local run via act หรือ push to GitHub)
act -W .github/workflows/ci.yml --container-architecture linux/amd64

# 🔹 2. ตรวจสอบ Production Compose
docker compose -f docker-compose.prod.yml config --quiet
# → ต้องไม่มี error

# 🔹 3. ตรวจสอบ Multi-stage Dockerfile
docker build -t pms-prod-backend:latest --target production .
docker run --rm pms-prod-backend:latest python -c "from app.main import app; print('✅ Prod image OK')"

# 🔹 4. Load Test (simulated)
make load-test
# → ต้องได้ p95 < 500ms, 0% error rate

# 🔹 5. Backup/Restore Validation
make backup && make restore-dry-run
# → ต้องสำเร็จโดยไม่เสียข้อมูล
```

---

## 🚀 Quick Start Commands (Docker-Only — รันจาก root)
```bash
make dev                          # เริ่มเฉพาะเมื่อจำเป็น
make lint                         # ตรวจสอบคุณภาพโค้ด
make test                         # รันเทสต์ทั้งหมด
make load-test                    # ทดสอบประสิทธิภาพ
make prod-up                      # เริ่ม production stack
make backup                       # สำรองฐานข้อมูล + MinIO
make dev-down                     # 🔴 ปิดทันทีเมื่อเสร็จ
```

---

## 🎯 Sprint 8 Exit Criteria (ต้องผ่านก่อนประกาศ v1.0.0)

```markdown
## ✅ Sprint 8 Done Definition — Production-Verified

### CI/CD & Deployment
- [ ] `.github/workflows/ci.yml` ผ่าน lint, test, build, security scan
- [ ] `docker-compose.prod.yml` ใช้งานได้จริง (healthchecks, restart policies, resource limits)
- [ ] Multi-stage `Dockerfile` ลดขนาด image ≤ 350MB, รันเป็น non-root user
- [ ] `scripts/backup.sh` และ `restore.sh` ทำงานได้, verify data integrity

### Performance & Security
- [ ] Load test p95 latency < 500ms สำหรับ endpoints หลัก
- [ ] Rate limiter, CORS hardening, security headers ทำงานใน production mode
- [ ] Graceful shutdown: รับ SIGTERM → ปิด connection pool → บันทึก log → exit 0
- [ ] Production logging: JSON format, structured, no sensitive data leaked

### Quality & Handoff
- [ ] `make lint` ผ่าน, `make test` ≥139 passed, coverage ≥85%
- [ ] `backend/docs/DEPLOYMENT.md` และ `OPERATIONS.md` ครบถ้วน
- [ ] `git tag -a v1.0.0` สร้างสำเร็จ, changelog อัปเดต
- [ ] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 8)

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| **Docker image ใหญ่เกิน** | `docker image ls \| grep pms-prod` | ตรวจสอบ multi-stage, ลบ apt cache, ใช้ `slim` base, ลบ `.pyc`/`__pycache__` |
| **Graceful shutdown ไม่ทำงาน** | `docker stop <container> && docker logs <container>` | ตรวจสอบ signal handler ใน `main.py`, ใช้ `uvicorn` `--graceful-timeout` |
| **Load test p95 สูง** | `locust -f tests/load/locustfile.py --web` | ตรวจสอบ DB connection pool, N+1 queries, index usage, rate limit config |
| **CI/CD fail test** | GitHub Actions logs → `pytest` output | ตรวจสอบ environment variables ใน workflow, volume mounts, async fixture pattern |
| **Backup script ล้ม** | `bash scripts/backup.sh 2>&1 \| tail -20` | ตรวจสอบ pg_dump permissions, MinIO credentials, network connectivity |

---

## 🔄 Change Control Reminder (Docker Context)
```text
1️⃣ หยุดเขียนโค้ด → 2️⃣ เสนอการเปลี่ยนแปลง (SPRINT_8.md §X.Y) → 3️⃣ รอ Human approve
4️⃣ อัปเดตเอกสาร → 5️⃣ รัน make test → 6️⃣ Commit พร้อมระบุ Docker test command
❌ ห้าม: แก้โค้ดไม่แก้เอกสาร, ข้าม propose/approve, รันนอกคอนเทนเนอร์, ทิ้ง container ค้าง
```

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract**  
> 🔄 **เปลี่ยนอะไรในโค้ด → อัปเดต SPRINT_8.md + Traceability + Tests**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root เสมอ**  
> ♻️ **ทรัพยากร:** หลังทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันที  
> 🤖 **สำหรับ AI Agent:** อ่านไฟล์นี้ + `docs/SDD.md` §10 + §4.5 + `docs/CODE_STYLE.md` ก่อนสร้างโค้ด  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria อนุมัติ v1.0.0 + Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** FROZEN — Ready for Autonomous Implementation (Sprint 8, Production-Ready)  
🐳 **Quick Start:** `make dev` → `make lint` → `make test` → `make load-test` → `make dev-down`  
📅 **Sprint 8 Start Date:** 2026-06-01 (ตัวอย่าง)  
🎯 **Next:** v1.0.0 Release & Production Deployment