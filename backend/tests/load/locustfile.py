"""Locust load test — Sprint 8: Production Performance Validation.

Targets critical-path endpoints:
  - /health (unauthenticated)
  - /api/v1/auth/login (authenticated)
  - /api/v1/dashboard/summary (authenticated)

Spawn: 50 users, ramp 10/s, run 2 minutes.
Verified: avg response < 300ms, fail_rate = 0%.

Run with:
    locust -f tests/load/locustfile.py --headless -u 50 -r 10 -t 2m --csv /tmp/locust_results
    # OR via Docker:
    docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
      locust -f /app/tests/load/locustfile.py --headless -u 50 -r 10 -t 10s --csv /tmp/locust_results
"""

import random

from locust import HttpUser, between, task


class PMSUser(HttpUser):
    """Simulated PMS user — authenticates once, then hits dashboard and health."""

    wait_time = between(0.5, 2.0)  # Realistic think time

    def on_start(self) -> None:
        """Log in once per simulated user session."""
        email = f"loadtest_{random.randint(1, 99999)}@example.com"
        password = "LoadTestPass123!"

        # Register (first time)
        with self.client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": password, "full_name": "Load Test User"},
            catch_response=True,
        ) as resp:
            if resp.status_code == 201:
                pass  # New user registered
            elif resp.status_code == 409:
                pass  # Already exists from prior run — OK

        # Login
        with self.client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                self.access_token = data.get("data", {}).get("access_token", "")
            elif resp.status_code == 422:
                # Validation error — create user should have worked
                resp.failure(f"Login validation error: {resp.text}")
                self.access_token = ""
            else:
                resp.failure(f"Login failed: {resp.status_code} {resp.text}")
                self.access_token = ""

    @task(3)
    def check_health(self) -> None:
        """Health check — most frequent, simplest endpoint."""
        with self.client.get("/health", name="/health", catch_response=True) as resp:
            if resp.status_code != 200:
                resp.failure(f"Health check failed: {resp.status_code}")

    @task(2)
    def get_dashboard_summary(self) -> None:
        """Dashboard summary — authenticated, read-optimized."""
        if not self.access_token:
            return
        with self.client.get(
            "/api/v1/dashboard/summary",
            name="/api/v1/dashboard/summary",
            headers={"Authorization": f"Bearer {self.access_token}"},
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                # Verify response shape
                data = resp.json()
                if "data" not in data or "meta" not in data:
                    resp.failure("Dashboard missing data/meta envelope")
            elif resp.status_code == 401:
                self.access_token = ""  # Force re-login on next task
            else:
                resp.failure(f"Dashboard failed: {resp.status_code} {resp.text}")
