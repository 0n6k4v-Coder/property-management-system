"""Seed the first admin user — bypasses service layer to avoid event/audit side effects.

Usage:
    docker compose -f docker-compose.dev.yml exec -e PYTHONPATH=/app backend \
        python3 /app/scripts/seed_admin.py
"""

import asyncio
import sys

from sqlalchemy import text

from app.modules.auth.models import User
from app.shared.database import async_session
from app.shared.security import hash_password


EMAIL = "admin@example.com"
PASSWORD = "Admin123!"
FULL_NAME = "System Admin"
PHONE = "0812345678"


async def seed_admin() -> None:
    session = async_session()
    try:
        # Check if already exists
        result = await session.execute(
            text("SELECT id FROM users WHERE email = :e"), {"e": EMAIL}
        )
        if result.fetchone():
            print(f"⚠️  Admin '{EMAIL}' already exists — skipping.")
            return

        user = User(
            email=EMAIL,
            password_hash=hash_password(PASSWORD),
            full_name=FULL_NAME,
            phone=PHONE,
            is_active=True,
        )
        session.add(user)
        await session.commit()

        # Verify
        result = await session.execute(
            text("SELECT id, email FROM users WHERE email = :e"), {"e": EMAIL}
        )
        row = result.fetchone()
        if row:
            print(f"✅ Admin user created and verified:")
            print(f"   Email:    {EMAIL}")
            print(f"   Password: {PASSWORD}")
            print(f"   Name:     {FULL_NAME}")
            print(f"   ID:       {row[0]}")
        else:
            print("❌ User not found after commit — something went wrong.")
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


if __name__ == "__main__":
    try:
        asyncio.run(seed_admin())
    except Exception as e:
        print(f"❌ Seed failed: {e}", file=sys.stderr)
        sys.exit(1)
