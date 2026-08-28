"""Notification REST API endpoints — 3 routes (SDD §2.7, §3.3).

Implements the Target Design from docs/API.md "Proposed Redesign — Notification Module"
fixing API anti-patterns #5, #3, #15, #1, #20, #13:

- #5: Property-scope authorization on all 3 endpoints
- #3: POST /test returns 202 Accepted (not 201), async via Celery
- #15: External I/O offloaded to Celery tasks
- #1: Optional Idempotency-Key header on POST /test and PATCH /resend
- #20: Cache-Control: private, no-store on all GET endpoints
- #13: Pagination on GET /history with bounded limit and meta

References:
    - CODE_STYLE.md §3.4: Router layer responsibility
    - docs/API.md "Proposed Redesign — Notification Module"
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notification.repository import NotificationRepository
from app.modules.notification.schemas import (
    NotificationCreateResponse,
    NotificationListResponse,
    NotificationMeta,
    NotificationQueuedResponse,
    NotificationResponse,
    SendNotificationRequest,
)
from app.modules.notification.services.notification_service import NotificationService
from app.shared.database import get_db
from app.shared.deps import (
    CurrentUser,
    get_current_user,
    require_property_scope,
    user_has_property_scope,
)
from app.shared.exceptions import APIError
from app.shared.idempotency import check_idempotency, store_idempotency

router = APIRouter(tags=["notifications"], redirect_slashes=False)

# Module-level dependencies (fixes B008)
get_db_dep = Depends(get_db)
get_current_user_dep = Depends(get_current_user)
page_qp_dep = Query(1, ge=1, description="Page number")
limit_qp_dep = Query(20, ge=1, le=100, description="Items per page (1-100)")
property_id_qp_dep = Query(..., description="Property ID (required for scope)")


async def _check_scope(
    current_user: dict[str, Any],
    db: AsyncSession,
    property_id: uuid.UUID | None,
) -> None:
    """Resolve-then-check authorization helper.

    Raises AUTH-005 (403) unless the caller is a global owner/admin or
    holds a scope row for ``property_id``. A ``None`` ``property_id``
    (entity not found) is treated as "no scope" so the caller cannot
    read/guess non-existent resources across properties.
    """
    _ = current_user.get("user_id")
    if property_id is None:
        raise APIError(
            code="AUTH-005",
            message="Insufficient property scope",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if not await user_has_property_scope(current_user, db, property_id):
        raise APIError(
            code="AUTH-005",
            message="Insufficient property scope",
            status_code=status.HTTP_403_FORBIDDEN,
        )


# ── POST /test ──────────────────────────────────────────────────────────


@router.post(
    "/test",
    response_model=NotificationQueuedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Send a test notification (async)",
    description="Creates notification and enqueues for async delivery. Returns 202 with notification_id.",
)
async def send_test_notification(
    response: Response,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    body: SendNotificationRequest,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    db: AsyncSession = get_db_dep,
    _: Annotated[None, require_property_scope()] = None,  # body-sourced property_id
) -> dict[str, Any]:
    """POST /api/v1/notifications/test.

    Authorization (#5): body-sourced ``property_id`` checked via
    ``require_property_scope()`` dependency.
    Idempotency (#1): optional ``Idempotency-Key`` header (24h dedupe).
    Response (#3, #15): 202 Accepted with ``notification_id`` + ``status: queued``.
    Caching (#20): ``Cache-Control: private, no-store``.
    """
    # Additional scope check using helper (belt-and-suspenders)
    await _check_scope(current_user, db, body.property_id)

    # Idempotency check
    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/notifications/test",
            body.model_dump(mode="json"),
        )
        if cached is not None:
            response.headers["Cache-Control"] = "private, no-store"
            return cached

    service = NotificationService(db)
    await service.send_test(
        user_id=body.user_id,
        property_id=body.property_id,
        channel=body.channel,
        subject=body.subject,
        body=body.body,
        sent_by=uuid.UUID(current_user["user_id"]),
        _idempotency_key=idempotency_key,
    )

    notif_id = uuid.uuid4()
    result = {"notification_id": notif_id, "status": "queued"}

    # Store idempotency key
    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/notifications/test",
            body.model_dump(mode="json"),
            result,
            NotificationRepository,
        )

    response.headers["Cache-Control"] = "private, no-store"
    return result


# ── GET /history ────────────────────────────────────────────────────────


@router.get(
    "/history",
    response_model=NotificationListResponse,
    summary="Get notification history (paginated, scoped)",
)
async def get_notification_history(
    response: Response,
    _: Annotated[None, require_property_scope(query_param="property_id")],
    property_id: uuid.UUID = property_id_qp_dep,
    page: int = page_qp_dep,
    limit: int = limit_qp_dep,
    db: AsyncSession = get_db_dep,
) -> NotificationListResponse:
    """GET /api/v1/notifications/history.

    Authorization (#5): query-sourced ``property_id`` checked via
    ``require_property_scope(query_param="property_id")``.
    Pagination (#13): ``page``/``limit`` query params; response ``meta``
    contains ``page``, ``limit``, ``total``, ``has_next``.
    Caching (#20): ``Cache-Control: private, no-store``.
    """
    # Fixes #20: financial-adjacent history must never be cached/shared.
    response.headers["Cache-Control"] = "private, no-store"

    # Scope check is enforced by require_property_scope dependency

    service = NotificationService(db)
    items, total = await service.get_history(
        property_id=property_id,
        page=page,
        limit=limit,
    )

    return NotificationListResponse(
        data=[NotificationResponse.model_validate(n) for n in items],
        meta=NotificationMeta(
            page=page,
            limit=limit,
            total=total,
            has_next=(page * limit) < total,
        ),
    )


# ── GET /{notif_id} ─────────────────────────────────────────────────────


@router.get(
    "/{notif_id}",
    response_model=NotificationCreateResponse,
    summary="Get a single notification by ID",
)
async def get_notification(
    response: Response,
    notif_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: AsyncSession = get_db_dep,
) -> dict[str, Any]:
    """GET /api/v1/notifications/{notif_id}.

    Authorization (#5): resolve-then-check via notification's ``property_id``.
    Caching (#20): ``Cache-Control: private, no-store``.
    """
    # Fixes #20.
    _ = current_user.get("user_id")
    response.headers["Cache-Control"] = "private, no-store"

    repo = NotificationRepository(db)
    notif = await repo.get_by_id(notif_id)
    if notif is None:
        raise APIError(
            code="NOTIF-001",
            message="Notification not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Resolve-then-check: get property_id from notification, then check scope
    await _check_scope(current_user, db, notif.property_id)

    return {"data": NotificationResponse.model_validate(notif), "meta": None}


# ── PATCH /{notif_id}/resend ────────────────────────────────────────────


@router.patch(
    "/{notif_id}/resend",
    response_model=NotificationCreateResponse,
    summary="Resend a failed/pending notification",
)
async def resend_notification(
    response: Response,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    notif_id: uuid.UUID,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    db: AsyncSession = get_db_dep,
) -> dict[str, Any]:
    """PATCH /api/v1/notifications/{notif_id}/resend.

    Authorization (#5): resolve-then-check via notification's ``property_id``.
    Idempotency (#1): optional ``Idempotency-Key`` header (24h dedupe).
    Caching (#20): ``Cache-Control: private, no-store``.
    """
    # Fixes #20.
    response.headers["Cache-Control"] = "private, no-store"

    repo = NotificationRepository(db)
    notif = await repo.get_by_id(notif_id)
    if notif is None:
        raise APIError(
            code="NOTIF-001",
            message="Notification not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    # Resolve-then-check (mirror maintenance_router.py:190-192)
    await _check_scope(current_user, db, notif.property_id)

    # Idempotency check
    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            f"PATCH:/api/v1/notifications/{notif_id}/resend",
            {},  # empty body for PATCH
        )
        if cached is not None:
            return cached

    service = NotificationService(db)
    await service.resend(
        notif_id=notif_id,
        resent_by=uuid.UUID(current_user["user_id"]),
        _idempotency_key=idempotency_key,
    )

    result = {"data": NotificationResponse.model_validate(notif), "meta": None}

    # Store idempotency key
    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            f"PATCH:/api/v1/notifications/{notif_id}/resend",
            {},
            result,
            NotificationRepository,
        )

    return result

