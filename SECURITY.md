# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | ✅ Yes             |
| < 1.0   | ❌ No              |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities via public GitHub issues.**

Instead, report them via:

1. **Email**: security@your-domain.com (PGP key available on request)
2. **GitHub Security Advisory**: Use the "Report a vulnerability" tab in the Security section

We will acknowledge receipt within **48 hours** and provide a status update within **7 days**.

## Security Architecture

### Authentication & Authorization

| Component | Implementation | Standard |
|-----------|----------------|----------|
| **Password Hashing** | Argon2id (time_cost=3, memory_cost=64MB, parallelism=1) | OWASP 2026, RFC 9106 |
| **Access Tokens** | JWT (RS256), 15-minute expiry | RFC 7519 |
| **Refresh Tokens** | Opaque tokens, 7-day expiry, rotation on use, stored in httpOnly+Secure+SameSite=Strict cookies | RFC 6749 |
| **Invite Tokens** | JWT signed by SECRET_KEY, 7-day expiry, single-use | Internal |
| **Rate Limiting** | 100 req/min/IP (auth endpoints), sliding window | Internal |

### Data Protection

| Data Type | Protection | Details |
|-----------|------------|---------|
| **ID Card Numbers** | Fernet (AES-256-GCM) encryption at rest | Key from `ID_CARD_ENCRYPTION_KEY` env var |
| **Passwords** | Never logged, Argon2id hashed | passlib[argon2] |
| **Database Connections** | TLS/SSL required in production | PostgreSQL SSL mode |
| **API Communication** | HTTPS enforced via Caddy reverse proxy | TLS 1.3 |
| **Object Storage** | MinIO with TLS, bucket policies | S3 API over HTTPS |

### Audit Logging

All sensitive operations are logged with:
- User ID (or "anonymous")
- IP Address
- User Agent
- Timestamp (ISO 8601 UTC)
- Operation type and resource
- Success/Failure status
- Error code (if failed)

Log format: Structured JSON via `structlog` — never plain text.

### Secrets Management

| Secret | Source | Rotation |
|--------|--------|----------|
| `SECRET_KEY` | Environment variable (`.env`) | Manual, 90-day recommended |
| `ID_CARD_ENCRYPTION_KEY` | Environment variable (`.env`) | Manual, 180-day recommended |
| `DATABASE_URL` | Environment variable | Managed by infra |
| `MINIO_ACCESS/SECRET_KEY` | Environment variable | Manual, 90-day recommended |
| JWT signing key | Derived from `SECRET_KEY` | Rotates with SECRET_KEY |

**Never commit secrets to version control.** Use `.env` files (gitignored) or secret managers in production.

### Network Security

```
Internet → Caddy (TLS termination) → Frontend (static) / Backend (API)
                                              ↓
                                    Internal Network (Docker)
                                              ↓
                              PostgreSQL | Redis | MinIO | Celery
```

- All inter-service communication on isolated Docker network
- Database, Redis, MinIO **not exposed** to host/public
- Only Caddy ports 80/443 exposed externally
- Backend health endpoint `/health` for load balancer checks

### Threat Model (STRIDE)

| Threat | Mitigation |
|--------|------------|
| **Spoofing** | JWT validation, token rotation, secure cookies |
| **Tampering** | HTTPS everywhere, request/response integrity via structlog |
| **Repudiation** | Audit logging for all sensitive operations |
| **Information Disclosure** | PII encryption, structured logging (no secrets), CORS policy |
| **Denial of Service** | Rate limiting (100 req/min/IP), connection pooling, timeouts |
| **Elevation of Privilege** | RBAC middleware, property scope enforcement, least privilege DB users |

### OWASP Top 10 Coverage

| # | Risk | Mitigation |
|---|------|------------|
| A01 | Broken Access Control | RBAC middleware, property scopes, endpoint auth |
| A02 | Cryptographic Failures | Argon2id, Fernet, TLS 1.3, secure cookies |
| A03 | Injection | Pydantic validation, SQLAlchemy ORM (parameterized), input sanitization |
| A04 | Insecure Design | Modular monolith, layered architecture, threat modeling |
| A05 | Security Misconfiguration | Secure defaults, DEBUG=false in prod, disabled docs in prod |
| A06 | Vulnerable Components | Pinned dependencies, `safety` scans in CI, automated dependabot |
| A07 | Auth Failures | Rate limiting, token rotation, Argon2id, secure cookies |
| A08 | Software Integrity | CI/CD pipeline, signed containers, SBOM generation |
| A09 | Logging Failures | Structured JSON logging, audit trail, no sensitive data in logs |
| A10 | SSRF | No user-controlled outbound requests, MinIO presigned URLs |

### Security Headers (via Caddy)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Dependency Scanning

Automated in CI:
- **Backend**: `bandit` (static analysis), `safety` (known vulnerabilities)
- **Frontend**: `npm audit`, `snyk` (optional)

Run locally:
```bash
make security  # Backend scans
cd frontend && npm audit  # Frontend scan
```

### Incident Response

1. **Detect** — Alerting via Prometheus/Grafana + audit log monitoring
2. **Contain** — Revoke tokens, rotate keys, isolate affected services
3. **Eradicate** — Patch vulnerability, deploy fix
4. **Recover** — Restore from verified backup if needed
5. **Lessons Learned** — Post-incident review, update threat model

### Compliance Considerations

- **PDPA (Thailand)**: PII encryption, audit logging, data minimization
- **GDPR (if applicable)**: Right to erasure (soft delete), data portability (export), DPO contact
- **SOC 2 Type II**: Audit trails, access controls, encryption, monitoring (target for v1.1)

## Security Checklist for Deployments

- [ ] `DEBUG=false` in production `.env`
- [ ] `SECRET_KEY` and `ID_CARD_ENCRYPTION_KEY` rotated from defaults
- [ ] TLS certificates valid (Caddy auto-manages via Let's Encrypt)
- [ ] Database SSL mode `require`
- [ ] MinIO bucket policies restrict public access
- [ ] Backup encryption enabled
- [ ] Monitoring alerts configured (failed auth, high error rate, disk space)
- [ ] `make prod-validate` passes

## Contact

Security Team: security@your-domain.com
PGP Key: Available on request

---

**Last Updated**: 2026-07-02  
**Version**: 1.0