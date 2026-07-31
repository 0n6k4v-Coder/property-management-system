"""Unit tests for shared/storage.py (stub implementation)."""

import pytest

from app.shared.storage import MinIOClient, get_storage_client


@pytest.mark.asyncio
class TestMinIOClientStub:
    async def test_singleton(self) -> None:
        c1 = get_storage_client()
        c2 = get_storage_client()
        assert c1 is c2

    async def test_stub_methods_raise_not_implemented(self) -> None:
        client = MinIOClient()
        with pytest.raises(NotImplementedError):
            await client.ensure_bucket()
        with pytest.raises(NotImplementedError):
            await client.upload_file(None)  # type: ignore[arg-type]
        with pytest.raises(NotImplementedError):
            await client.get_presigned_download_url("test.pdf")
        with pytest.raises(NotImplementedError):
            await client.list_files()
