"""MinIO/S3-compatible object storage client wrapper (SDD.md §9.2).

Provides a thin async-compatible wrapper around the MinIO Python SDK
for file uploads, downloads, presigned URLs, and object management.
The client is configured via ``app.config.get_settings()``.

Currently a stub — all operations raise ``NotImplementedError`` until
the MinIO integration is wired up in Phase 2+.

References:
    - SDD.md §4.4: Storage guidelines
    - SDD.md §9.1: shared/storage.py specification
    - AGENTS.md §Tech Stack: minio 7.2+
"""

from io import BytesIO
from typing import Any

from app.config import get_settings


class MinIOClient:
    """Async wrapper for MinIO/S3 object storage (stub).

    Manages file lifecycle: upload, download, delete, and presigned
    URL generation.  Intended for tenant ID-card images, invoice
    PDFs, and contract documents.

    Usage (future)::

        client = MinIOClient()
        url = await client.get_presigned_upload_url("invoice.pdf", "application/pdf")
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        # TODO: Initialize minio.Minio client when storage is wired up
        # self._client = minio.Minio(
        #     self._settings.MINIO_ENDPOINT,
        #     access_key=self._settings.MINIO_ACCESS_KEY,
        #     secret_key=self._settings.MINIO_SECRET_KEY,
        #     secure=self._settings.MINIO_SECURE,
        # )
        self._default_bucket = "pms-files"

    async def ensure_bucket(self, bucket_name: str | None = None) -> None:
        """Create the bucket if it does not already exist.

        Parameters
        ----------
        bucket_name
            Name of the bucket.  Defaults to ``pms-files``.
        """
        raise NotImplementedError("MinIOClient.ensure_bucket — Phase 2")

    async def upload_file(
        self,
        file_data: BytesIO,
        object_name: str | None = None,
        bucket_name: str | None = None,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Upload a file stream to MinIO.

        Parameters
        ----------
        file_data
            Binary stream of the file content.
        object_name
            Target object key.  Auto-generated as UUID if not provided.
        bucket_name
            Target bucket.  Defaults to ``pms-files``.
        content_type
            MIME type of the file.

        Returns
        -------
        str
            The object key (used for subsequent download / delete).
        """
        raise NotImplementedError("MinIOClient.upload_file — Phase 2")

    async def download_file(
        self,
        object_name: str,
        bucket_name: str | None = None,
    ) -> bytes:
        """Download a file from MinIO as raw bytes.

        Parameters
        ----------
        object_name
            Object key returned from ``upload_file``.
        bucket_name
            Source bucket.  Defaults to ``pms-files``.

        Returns
        -------
        bytes
            The file content.
        """
        raise NotImplementedError("MinIOClient.download_file — Phase 2")

    async def delete_file(
        self,
        object_name: str,
        bucket_name: str | None = None,
    ) -> None:
        """Permanently delete a file from MinIO.

        Parameters
        ----------
        object_name
            Object key to delete.
        bucket_name
            Bucket containing the object.  Defaults to ``pms-files``.
        """
        raise NotImplementedError("MinIOClient.delete_file — Phase 2")

    async def get_presigned_upload_url(
        self,
        filename: str,
        content_type: str,
        expiry_minutes: int = 15,
    ) -> str:
        """Generate a presigned URL for browser-based file upload.

        The returned URL allows a client to ``PUT`` a file directly
        to MinIO without exposing credentials.

        Parameters
        ----------
        filename
            The original filename (used to derive the object key).
        content_type
            Expected MIME type (MinIO validates this on upload).
        expiry_minutes
            URL validity duration (default: 15 minutes).

        Returns
        -------
        str
            Presigned URL for ``PUT`` upload.
        """
        raise NotImplementedError("MinIOClient.get_presigned_upload_url — Phase 2")

    async def get_presigned_download_url(
        self,
        object_name: str,
        expiry_minutes: int = 60,
        response_disposition: str = "attachment",
    ) -> str:
        """Generate a presigned URL for temporary file download.

        Parameters
        ----------
        object_name
            Object key to share.
        expiry_minutes
            URL validity duration (default: 60 minutes).
        response_disposition
            ``attachment`` (download) or ``inline`` (preview).

        Returns
        -------
        str
            Presigned URL for ``GET`` download.
        """
        raise NotImplementedError("MinIOClient.get_presigned_download_url — Phase 2")

    async def list_files(
        self,
        prefix: str = "",
        bucket_name: str | None = None,
        max_keys: int = 100,
    ) -> list[dict[str, Any]]:
        """List objects in a bucket, optionally filtered by prefix.

        Parameters
        ----------
        prefix
            Object key prefix filter (e.g. ``"tenant-123/"``).
        bucket_name
            Bucket to list.  Defaults to ``pms-files``.
        max_keys
            Maximum number of results to return.

        Returns
        -------
        list[dict[str, Any]]
            List of dicts with keys ``object_name``, ``size``,
            ``etag``, ``last_modified``.
        """
        raise NotImplementedError("MinIOClient.list_files — Phase 2")


# Module-level singleton for dependency injection
_storage_client: MinIOClient | None = None


def get_storage_client() -> MinIOClient:
    """Return a singleton ``MinIOClient`` instance.

    Use this function for FastAPI dependency injection instead of
    instantiating ``MinIOClient()`` directly.
    """
    global _storage_client
    if _storage_client is None:
        _storage_client = MinIOClient()
    return _storage_client


__all__ = [
    "MinIOClient",
    "get_storage_client",
]
