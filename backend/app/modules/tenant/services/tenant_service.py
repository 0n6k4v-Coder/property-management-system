"""Tenant Service — Business Logic Layer (SDD §2.4).

References:
- SDD.md §2.4: Tenant Module Specification (FR-TENANT-01~04)
- SDD.md §4.4: Security & access control (encrypted ID card at rest)
- CODE_STYLE.md §5.3: Audit logging for sensitive operations
- CODE_STYLE.md §6.3: Sensitive data encryption (Fernet)
"""

import uuid
from http import HTTPStatus
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tenant.constants import (
    EVENT_TENANT_CREATED,
    TENANT_001_DUPLICATE_PHONE,
    TENANT_004_TENANT_NOT_FOUND,
    TENANT_008_QUERY_TOO_SHORT,
)
from app.modules.tenant.events import publish_tenant_event
from app.modules.tenant.models import Tenant
from app.modules.tenant.repository import TenantRepository
from app.shared.audit import log_audit
from app.shared.exceptions import APIError
from app.shared.security import encrypt_sensitive


class TenantService:
    """Business logic for tenant management.

    Handles encryption of sensitive personal data (ID card) before
    persistence, validates business rules, and logs audit events.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = TenantRepository(db)

    async def create_tenant(
        self,
        property_id: uuid.UUID,
        full_name: str,
        id_card_number: str,
        phone: str,
        created_by: uuid.UUID,
        email: str | None = None,
        emergency_contact_name: str | None = None,
        emergency_contact_phone: str | None = None,
    ) -> Tenant:
        """Create a new tenant with encrypted ID card data.

        The plain-text ``id_card_number`` is encrypted with Fernet before
        being stored in ``id_card_number_encrypted``.  The plain text is
        **never** returned in any response.

        Parameters
        ----------
        property_id
            UUID of the property this tenant belongs to.
        full_name
            Tenant's full name.
        id_card_number
            Plain-text Thai national ID card (13 digits) — encrypted before storage.
        phone
            Thai phone number (unique per property).
        created_by
            UUID of the user creating the tenant record.
        email
            Optional email address.
        emergency_contact_name
            Optional emergency contact person.
        emergency_contact_phone
            Optional emergency contact phone.

        Returns
        -------
        Tenant
            The newly created tenant (without plain-text ID card).

        Raises
        ------
        APIError
            TENANT-007 if the property does not exist.
            TENANT-001 if the phone is already registered in the property.
        """
        # Check for duplicate phone within property
        existing = await self.repo.get_by_phone_and_property(phone, property_id)
        if existing is not None:
            raise APIError(
                code=TENANT_001_DUPLICATE_PHONE,
                message="Phone number already registered in this property",
                status_code=HTTPStatus.CONFLICT,
                details={"phone": phone, "property_id": str(property_id)},
            )

        # Encrypt the ID card before persistence
        encrypted = encrypt_sensitive(id_card_number)

        tenant = Tenant(
            property_id=property_id,
            full_name=full_name,
            id_card_number_encrypted=encrypted,
            phone=phone,
            email=email,
            emergency_contact_name=emergency_contact_name,
            emergency_contact_phone=emergency_contact_phone,
        )
        tenant = await self.repo.create(tenant)

        # Audit log (fail-silent)
        await log_audit(
            db=self.db,
            user_id=created_by,
            action="tenant.created",
            resource_type="tenant",
            resource_id=tenant.id,
            property_id=property_id,
            metadata={"full_name": full_name, "phone": phone},
        )

        # Publish domain event (fail-silent)
        await publish_tenant_event(
            EVENT_TENANT_CREATED,
            str(tenant.id),
            {"property_id": str(property_id), "full_name": full_name},
        )

        return tenant

    async def list_tenants_paginated(
        self,
        page: int,
        limit: int,
        property_id: uuid.UUID | None,
        user_id: uuid.UUID,
        is_global: bool,
    ) -> tuple[list[Tenant], int]:
        """List tenants with pagination and property scope filtering.

        Parameters
        ----------
        page
            Page number (1-indexed).
        limit
            Items per page.
        property_id
            Optional property UUID to filter by.
        user_id
            UUID of the user making the request.
        is_global
            Whether the user has global (owner/admin) access.

        Returns
        -------
        tuple[list[Tenant], int]
            (tenants list, total count)
        """
        offset = (page - 1) * limit

        if property_id is not None:
            # Scoped to a specific property
            tenants = await self.repo.get_paginated_for_property(property_id, offset, limit)
            total = await self.repo.count_for_property(property_id)
        elif is_global:
            # Global access - all tenants
            tenants = await self.repo.get_paginated(offset, limit)
            total = await self.repo.count_all()
        else:
            # User has specific property scopes - get their accessible properties
            from app.modules.auth.repository import UserRepository
            user_repo = UserRepository(self.db)
            scopes = await user_repo.get_property_scopes(user_id)
            property_ids = [s.property_id for s in scopes]
            if not property_ids:
                return [], 0
            tenants = await self.repo.get_paginated_for_properties(property_ids, offset, limit)
            total = await self.repo.count_for_properties(property_ids)

        return tenants, total

    async def search_tenants(
        self,
        property_id: uuid.UUID,
        query: str,
        search_by: str = "name",
        page: int = 1,
        limit: int = 20,
    ) -> dict[str, Any]:
        """Search tenants within a property.

        Parameters
        ----------
        property_id
            Scoping property UUID.
        query
            Search string (min 3 characters).
        search_by
            Field to search: ``"name"``, ``"phone"``, or ``"email"``.
        page
            Page number (1-indexed).
        limit
            Items per page.

        Returns
        -------
        dict
            ``{"data": list[Tenant], "meta": {"page", "limit", "total", "has_next"}}``

        Raises
        ------
        APIError
            TENANT-008 if query is shorter than 3 characters.
        """
        if len(query.strip()) < 3:
            raise APIError(
                code=TENANT_008_QUERY_TOO_SHORT,
                message="Search query must be at least 3 characters",
                status_code=HTTPStatus.BAD_REQUEST,
            )

        offset = (page - 1) * limit
        tenants = await self.repo.search(
            property_id=property_id,
            query=query,
            search_by=search_by,
            limit=limit,
            offset=offset,
        )
        total = await self.repo.count_search(
            property_id=property_id,
            query=query,
            search_by=search_by,
        )

        has_next = (offset + limit) < total
        return {
            "data": tenants,
            "meta": {
                "page": page,
                "limit": limit,
                "total": total,
                "has_next": has_next,
            },
        }

    async def get_tenant_by_id(
        self,
        tenant_id: uuid.UUID,
    ) -> Tenant:
        """Retrieve a tenant by ID.

        Raises
        ------
        APIError
            TENANT-004 if the tenant does not exist.
        """
        tenant = await self.repo.get_by_id(tenant_id)
        if tenant is None:
            raise APIError(
                code=TENANT_004_TENANT_NOT_FOUND,
                message="Tenant not found",
                status_code=HTTPStatus.NOT_FOUND,
            )
        return tenant
