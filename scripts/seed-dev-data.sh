#!/usr/bin/env bash
# Seed development data: admin user + deterministic E2E fixtures
# Idempotent — safe to run multiple times.
# Usage: ./scripts/seed-dev-data.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

echo "🌱 Seeding dev data (admin + E2E fixtures)..."

echo "▶ Running seed_admin..."
docker exec pms-dev-backend-1 python -m scripts.seed_admin

echo "▶ Running seed_e2e --reset..."
docker exec pms-dev-backend-1 python -m scripts.seed_e2e --reset

echo ""
echo "🔍 Validating seed data..."

docker exec pms-dev-backend-1 python -c "
import asyncio
from sqlalchemy import select
from app.shared.database import async_session_maker

# Import all models to register relationships
from app.modules.auth.models import User  # noqa: F401
from app.modules.billing.models import Invoice, InvoiceLineItem, MeterReading, Payment, UtilityRate  # noqa: F401
from app.modules.contract.models import Contract, ContractTermination, LeaseExtension  # noqa: F401
from app.modules.maintenance.models import MaintenanceRequest  # noqa: F401
from app.modules.property.models import Building, Floor, Property, Room  # noqa: F401
from app.modules.property.constants import RoomStatus
from app.modules.tenant.models import Tenant  # noqa: F401
from app.shared.audit import AuditLog  # noqa: F401

async def validate():
    async with async_session_maker() as session:
        # Check Sunset Tower rooms (PROPERTY_SUNSET_ID = 'c92df6ed-2bf7-5ac2-8fa3-a50c060ea530')
        result = await session.execute(
            select(Room).where(Room.property_id == 'c92df6ed-2bf7-5ac2-8fa3-a50c060ea530')
        )
        rooms = result.scalars().all()
        
        total = len(rooms)
        occupied = sum(1 for r in rooms if r.status == RoomStatus.OCCUPIED)
        occupancy_rate = (occupied / total * 100) if total > 0 else 0
        
        print(f'   Total rooms: {total}')
        print(f'   Occupied rooms: {occupied}')
        print(f'   Occupancy rate: {occupancy_rate:.1f}%')
        
        # Expected: 4 rooms, 1 occupied, 25% occupancy
        errors = []
        if total != 4:
            errors.append(f'Expected 4 rooms, got {total}')
        if occupied != 1:
            errors.append(f'Expected 1 occupied room, got {occupied}')
        if abs(occupancy_rate - 25.0) > 0.1:
            errors.append(f'Expected 25% occupancy, got {occupancy_rate:.1f}%')
        
        if errors:
            print('❌ Validation FAILED:')
            for error in errors:
                print(f'   - {error}')
            exit(1)
        else:
            print('✅ Seed data validated')

asyncio.run(validate())
" || {
    echo "❌ Seed data validation failed"
    exit 1
}

echo ""
echo "✅ Development data seeded and validated successfully."