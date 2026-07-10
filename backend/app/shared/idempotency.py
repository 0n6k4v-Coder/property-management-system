"""Idempotency-Key support for mutating auth endpoints (anti-pattern #1).

A client may send an ``Idempotency-Key`` header on ``POST /register`` and
``POST /invite``.  If the same key is replayed within the 24h window, the
original stored response is returned verbatim instead of re-executing the
handler.  The cache is persisted in the ``idempotency_keys`` table (see
``app/modules/auth/models.IdempotencyKey`` and migration ``019``) so it
survives across processes and respects the project's DB-only state policy.

References:
    - docs/API.md "Proposed Redesign" — anti-pattern #1 fix
    - app/modules/auth/repository.py::UserRepository.get_idempotency /
      save_idempotency
"""

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

# How long a cached idempotency result remains valid.
IDEMPOTENCY_TTL = timedelta(hours=24)


def _hash_request(path: str, body: dict[str, Any]) -> str:
    """Stable hash of the normalised request (path + sorted JSON body).

    Rejects a repeated key that carries a *different* body so callers
    cannot silently reuse one key for two distinct operations.
    """
    payload = f"{path}|{sorted(body.items())}"
    return sha256(payload.encode("utf-8")).hexdigest()


async def check_idempotency(
    db: AsyncSession,
    key: str,
    path: str,
    body: dict[str, Any],
) -> dict | None:
    """Return the cached response body for a replayed key, else ``None``.

    Parameters
    ----------
    db
        The request's async DB session.
    key
        The client-supplied ``Idempotency-Key`` header value.
    path
        The normalised request path (e.g. ``POST:/api/v1/auth/invite``).
    body
        The validated request payload.

    Returns
    -------
    dict | None
        The previously stored ``{"data": ...}`` response if the key is
        fresh and the body hash matches, else ``None`` (proceed normally).

    Side effects
    ------------
    Raises ``APIError`` (``VAL-409``) if the key is reused with a
    *different* body — protects against accidental key collisions.
    """
    from app.modules.auth.repository import UserRepository
    from app.shared.exceptions import APIError

    repo = UserRepository(db)
    record = await repo.get_idempotency(key)
    if record is None:
        return None

    request_hash = _hash_request(path, body)
    if record.request_hash != request_hash:
        raise APIError(
            code="VAL-409",
            message="Idempotency-Key reuse with a different request body",
            status_code=409,
            details={"key": key},
        )

    import json

    return json.loads(record.response_body)


async def store_idempotency(
    db: AsyncSession,
    key: str,
    path: str,
    body: dict[str, Any],
    response_body: dict,
    repo_class: Any,
) -> None:
    """Persist a successful response for the given idempotency key.

    Parameters
    ----------
    db
        The request's async DB session (committed by the caller).
    key
        The client-supplied ``Idempotency-Key`` header value.
    path
        The normalised request path.
    body
        The validated request payload (for the body-hash guard).
    response_body
        The ``{"data": ...}`` dict to replay on a future replay.
    repo_class
        The repository class exposing ``save_idempotency`` (kept generic
        to avoid an import cycle at module load time).
    """
    import json

    request_hash = _hash_request(path, body)
    expires_at = datetime.now(timezone.utc) + IDEMPOTENCY_TTL
    await repo_class(db).save_idempotency(
        key=key,
        request_hash=request_hash,
        response_body=json.dumps(response_body),
        expires_at=expires_at,
    )
