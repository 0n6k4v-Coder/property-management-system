"""Seed admin user for manual E2E testing."""

import asyncio
import sys

from sqlalchemy import text

from app.modules.auth.models import User
from app.shared.database import async_session_maker
from app.shared.security import hash_password


async def seed_admin() -> None:
    """Create admin user for E2E testing."""
    email = "admin@example.com"
    password = "Admin123!"
    full_name = "Admin User"
    phone = "0812345678"

    async with async_session_maker() as session:
        # Check if admin already exists
        result = await session.execute(
            text("SELECT id FROM users WHERE email = :e"), {"e": email}
        )
        if result.fetchone():
            print(f"⚠️  Admin user '{email}' already exists — skipping.")
            return

        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            phone=phone,
            is_active=True,
        )
        session.add(user)
        await session.commit()

        # Verify
        result = await session.execute(
            text("SELECT id, email FROM users WHERE email = :e"), {"e": email}
        )
        row = result.fetchone()
        if row:
            print("✅ Admin user created successfully!")
            print(f"   Email:    {email}")
            print(f"   Password: {password}")
        else:
            print("❌ Admin user creation failed!", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(seed_admin())
    except Exception as e:
        print(f"❌ Seed failed: {e}", file=sys.stderr)
        sys.exit(1)
