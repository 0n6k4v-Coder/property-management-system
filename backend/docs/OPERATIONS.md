# Operations Guide — Property Management System v1.0.0

**Last Updated:** 2026-05-31  
**Version:** 1.0  
**Status:** ✅ Production-Ready (Sprint 8)

---

## 📋 Overview

This guide covers day-to-day operations for the Property Management System:
backup schedules, log management, upgrade procedures, incident response,
and known limitations.

---

## 🗓️ Backup Schedule

### Automated Backups (via Cron)

Recommended cron schedule on the host machine:

```cron
# Daily backup at 02:00
0 2 * * * cd /opt/property-management-system && bash scripts/backup.sh >> /var/log/pms-backup.log 2>&1

# Weekly full backup with verbose logging
0 3 * * 0 cd /opt/property-management-system && bash scripts/backup.sh >> /var/log/pms-backup-weekly.log 2>&1
```

### Backup Retention Policy

| Frequency | Retention | Location |
|-----------|-----------|----------|
| Daily | 30 days | MinIO bucket `pms-backups/backup/` |
| Weekly | 12 months | MinIO bucket + offsite copy (manual) |
| Monthly | Archive | External cold storage (manual) |

### Verify Backup Integrity

```bash
# List available backups
mc ls pms-minio/pms-backups/backup/

# Download and verify latest
LATEST=$(mc ls pms-minio/pms-backups/backup/ | sort -k1,2 | tail -1 | awk '{print $NF}')
mc cp pms-minio/pms-backups/backup/$LATEST /tmp/
gunzip -t /tmp/$LATEST
echo "Checksum: $(md5sum /tmp/$LATEST)"
```

---

## 📝 Log Management

### Log Locations (Docker)

| Service | Log Driver | Max Size | Max Files |
|---------|------------|----------|-----------|
| backend | json-file | 10 MB | 5 |
| db | json-file | 50 MB | 3 |
| redis | json-file | 10 MB | 3 |
| minio | json-file | 10 MB | 3 |

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs --tail=100

# Backend only, JSON format
docker compose -f docker-compose.prod.yml logs backend --tail=50 | grep '"level":"error"'

# Follow logs in real-time
docker compose -f docker-compose.prod.yml logs -f backend

# Export logs to file
docker compose -f docker-compose.prod.yml logs --no-color > /var/log/pms-export-$(date +%Y%m%d).log
```

### Log Rotation Configuration

Docker's json-file log driver handles rotation. Configure in `docker-compose.prod.yml`:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

To change for running containers:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

### Production Log Format (JSON)

All production logs use structlog JSON format. No sensitive data (passwords, tokens, ID cards) is ever logged.

```json
{
  "event": "request_completed",
  "request_id": "a1b2c3d4",
  "method": "GET",
  "path": "/api/v1/dashboard/summary",
  "status_code": 200,
  "duration_ms": 45,
  "has_auth": true,
  "timestamp": "2026-05-31T10:30:00.123456Z",
  "level": "info"
}
```

---

## 🔄 Upgrade Path

### Patch Upgrade (e.g. 1.0.0 → 1.0.1)

```bash
# 1. Pull latest image
docker compose -f docker-compose.prod.yml pull backend

# 2. Backup database
bash scripts/backup.sh

# 3. Restart backend (zero-downtime if using load balancer)
docker compose -f docker-compose.prod.yml up -d --no-deps --build backend

# 4. Run any new migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 5. Verify health
curl http://localhost:8000/health
```

### Major Upgrade (e.g. 1.x → 2.x)

```bash
# 1. Read release notes and migration guides
# 2. Backup ALL data (DB + MinIO)
bash scripts/backup.sh
mc mirror pms-minio/pms-backups /tmp/pms-full-backup-$(date +%Y%m%d)

# 3. Pull new version
docker compose -f docker-compose.prod.yml pull backend

# 4. Stop all services
docker compose -f docker-compose.prod.yml down

# 5. Backup compose file
cp docker-compose.prod.yml docker-compose.prod.yml.bak

# 6. Update compose file if needed

# 7. Start new stack
docker compose -f docker-compose.prod.yml up -d

# 8. Run migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 9. Verify data integrity
bash scripts/restore.sh --dry-run
```

---

## 🚨 Incident Response

### Incident Severity Levels

| Level | Definition | Response Time |
|-------|------------|---------------|
| **P0** | Complete outage — API unreachable | < 15 min |
| **P1** | Degraded performance — p95 > 1s | < 1 hour |
| **P2** | Feature impairment — non-critical | < 4 hours |
| **P3** | Bug/annoyance — no data loss | < 24 hours |

### Incident Response Playbook

#### P0: API Unreachable

```bash
# 1. Check health
curl -f http://localhost:8000/health || echo "DOWN"

# 2. Check container status
docker compose -f docker-compose.prod.yml ps

# 3. Check logs for errors
docker compose -f docker-compose.prod.yml logs backend --tail=50

# 4. Check database
docker compose -f docker-compose.prod.yml exec db pg_isready -U user

# 5. Restart if needed
docker compose -f docker-compose.prod.yml restart backend

# 6. If DB issue: check disk space
docker compose -f docker-compose.prod.yml exec db df -h /var/lib/postgresql/data

# 7. Escalation: restore from backup if data corrupted
bash scripts/restore.sh --file=<latest-good-backup>
```

#### P1: Degraded Performance

```bash
# 1. Run validation
bash scripts/validate_prod_env.sh

# 2. Check connection pool usage
docker compose -f docker-compose.prod.yml exec backend \
  python -c "from app.shared.database import engine; print(engine.pool.status())"

# 3. Check active connections in DB
docker compose -f docker-compose.prod.yml exec db \
  psql -U user -d pms_prod -c "SELECT count(*) FROM pg_stat_activity;"

# 4. Check slow queries
docker compose -f docker-compose.prod.yml exec db \
  psql -U user -d pms_prod -c "SELECT query, state FROM pg_stat_activity WHERE state = 'active';"

# 5. Verify indexes are being used
docker compose -f docker-compose.prod.yml exec db \
  psql -U user -d pms_prod -c "SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes ORDER BY idx_scan;"
```

#### P2: Feature Issue (e.g. Meter Reading Fails)

```bash
# 1. Check application logs for relevant error
docker compose -f docker-compose.prod.yml logs backend --tail=50 | grep -i "error\|exception"

# 2. Check audit logs via API (requires auth)
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8000/api/v1/admin/audit-logs?limit=10

# 3. Check Celery worker if async task is failing
docker compose -f docker-compose.prod.yml logs celery-worker --tail=20
```

---

## 📊 Performance Baseline (Sprint 8)

| Metric | Target | Measured |
|--------|--------|----------|
| `/health` latency (p95) | < 50ms | — |
| `/api/v1/auth/login` (p95) | < 200ms | — |
| `/api/v1/dashboard/summary` (p95) | < 500ms | — |
| DB connection pool acquisition | < 10ms | — |
| Concurrent users | 50+ | — |
| Error rate | 0% | — |
| Image size | ≤ 350MB | — |

Run load test to measure actual values:

```bash
make load-test
# OR
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
  locust -f /app/tests/load/locustfile.py --headless -u 50 -r 10 -t 2m --csv /tmp/locust_results
```

---

## 🐳 Resource Limits Configuration

### Current Limits (docker-compose.prod.yml)

| Service | CPU Limit | Memory Limit | Reservation |
|---------|-----------|--------------|-------------|
| backend | 4.0 | 2 GB | 1 CPU + 512 MB |
| db | 4.0 | 4 GB | 1 CPU + 1 GB |
| redis | 1.0 | 1 GB | 0.5 CPU + 256 MB |
| minio | 2.0 | 2 GB | 0.5 CPU + 512 MB |
| celery-worker | 2.0 | 1 GB | 0.5 CPU + 256 MB |

### Recommended Host Specs

| Deployment Size | CPU | RAM | Storage |
|----------------|-----|-----|---------|
| Small (< 50 rooms) | 2 cores | 4 GB | 50 GB SSD |
| Medium (50-200 rooms) | 4 cores | 8 GB | 100 GB SSD |
| Large (200+ rooms) | 8 cores | 16 GB | 250 GB SSD |

---

## ⚠️ Known Limitations (v1.0.0)

| Limitation | Impact | Workaround | Future Fix |
|------------|--------|------------|------------|
| **Single-node DB** | No HA/failover | Regular backups + restore script | Add pg_auto_failover in v1.1 |
| **In-memory rate limiter** | Lost on backend restart | Acceptable for single instance | Migrate to Redis-based in v1.2 |
| **No TLS termination** | HTTP traffic not encrypted | Use reverse proxy (Caddy/Nginx) | Add Caddy sidecar in v1.1 |
| **No multi-tenancy** | All data in single DB | Separate deployments for each tenant | Add tenant_id column + RLS in v2.0 |
| **Celery single worker** | No parallel task execution | Scale with `--concurrency=4` profile | Add KEDA autoscaler in v1.2 |
| **No email/LINE provider** | Notifications not sent | API ready, provider config only | Add LINE Notify in v1.1 |
| **No automated backup cron** | Requires cron on host | Use systemd timer or k8s CronJob | Built-in scheduler in v1.2 |

---

## 📚 Reference Links

| Resource | URL/Path |
|----------|----------|
| Deployment Guide | `backend/docs/DEPLOYMENT.md` |
| API Docs (dev mode) | `http://localhost:8000/docs` |
| OpenAPI Spec (dev mode) | `http://localhost:8000/openapi.json` |
| MinIO Console | `http://localhost:9001` |
| Prometheus metrics | Future — not yet implemented |
| Grafana dashboards | Future — not yet implemented |

---

## 📝 Maintenance Checklist

### Daily

- [ ] Verify health endpoint returns 200
- [ ] Check backup ran successfully (review logs)
- [ ] Review error logs from last 24 hours

### Weekly

- [ ] Run `bash scripts/validate_prod_env.sh` to check environment
- [ ] Verify MinIO backup integrity
- [ ] Review performance — check load test results
- [ ] Check disk usage on host

### Monthly

- [ ] Test full restore from backup in staging environment
- [ ] Audit user accounts and API keys
- [ ] Review and rotate secrets if needed
- [ ] Check for available image updates

### Quarterly

- [ ] Review incident response playbook
- [ ] Update known limitations list
- [ ] Plan upgrade if new version available
- [ ] Full disaster recovery drill