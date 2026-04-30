"""Unit tests for file application use-cases."""

import asyncio
from pathlib import Path

import pytest

from nola.application.files import (
    batch_delete_uploaded_files,
    delete_uploaded_file,
    list_uploaded_files,
    upload_uploaded_file,
)
from nola.application.files.errors import FileUseCaseError
from nola.models.files import DEFAULT_FILE_SORT_BY, DEFAULT_FILE_SORT_ORDER


class FakeFileStore:
    """In-memory file store for use-case tests."""

    def __init__(
        self,
        files: dict[str, dict[str, object]],
        linked_task_counts: dict[str, int] | None = None,
    ) -> None:
        self.files = files
        self.linked_task_counts = linked_task_counts or {}

    def get_file(self, file_id: str) -> dict[str, object] | None:
        file = self.files.get(file_id)
        return dict(file) if file else None

    def count_linked_tasks(self, file_id: str) -> int:
        return self.linked_task_counts.get(file_id, 0)

    def delete_file(self, file_id: str) -> bool:
        if file_id not in self.files:
            return False
        self.files.pop(file_id)
        return True

    def create_file(
        self,
        file_id: str,
        filename: str,
        path: str,
        size: int,
        content_type: str = "audio/mpeg",
    ) -> None:
        self.files[file_id] = {
            "id": file_id,
            "filename": filename,
            "path": path,
            "size": size,
            "content_type": content_type,
            "created_at": "2026-01-01T00:00:00",
        }

    def list_files(
        self,
        limit: int = 50,
        offset: int = 0,
        q: str | None = None,
        content_type: str | None = None,
        sort_by: str = DEFAULT_FILE_SORT_BY,
        order: str = DEFAULT_FILE_SORT_ORDER,
    ) -> list[dict[str, object]]:
        rows = list(self.files.values())
        if q:
            rows = [row for row in rows if q.casefold() in str(row).casefold()]
        if content_type:
            rows = [
                row
                for row in rows
                if str(row["content_type"]).casefold() == content_type.casefold()
            ]
        reverse = order == "desc"
        return sorted(rows, key=lambda row: str(row[sort_by]), reverse=reverse)[
            offset : offset + limit
        ]

    def count_files(
        self,
        q: str | None = None,
        content_type: str | None = None,
    ) -> int:
        rows = list(self.files.values())
        if q:
            rows = [row for row in rows if q.casefold() in str(row).casefold()]
        if content_type:
            rows = [
                row
                for row in rows
                if str(row["content_type"]).casefold() == content_type.casefold()
            ]
        return len(rows)


class FakeUploadStream:
    """Async upload stream for file use-case tests."""

    def __init__(self, chunks: list[bytes]) -> None:
        self.chunks = chunks
        self.closed = False

    async def read(self, size: int = -1) -> bytes:
        if not self.chunks:
            return b""
        return self.chunks.pop(0)

    async def close(self) -> None:
        self.closed = True


class FailingUploadStream(FakeUploadStream):
    """Upload stream that fails after its queued chunks are consumed."""

    async def read(self, size: int = -1) -> bytes:
        if self.chunks:
            return self.chunks.pop(0)
        raise RuntimeError("stream failed")


class CloseFailingUploadStream(FakeUploadStream):
    """Upload stream that raises during cleanup."""

    async def close(self) -> None:
        raise RuntimeError("close failed")


class ReadAndCloseFailingUploadStream(FailingUploadStream):
    """Upload stream that raises during read and cleanup."""

    async def close(self) -> None:
        raise RuntimeError("close failed")


def _file_row(file_id: str, filename: str, path: Path) -> dict[str, object]:
    return {
        "id": file_id,
        "filename": filename,
        "path": str(path),
        "size": 128,
        "content_type": "audio/mpeg",
        "created_at": "2026-01-01T00:00:00",
    }


def test_delete_uploaded_file_removes_row_and_backing_file(tmp_path: Path) -> None:
    file_path = tmp_path / "audio.mp3"
    file_path.write_bytes(b"audio")
    file_store = FakeFileStore(
        files={"file-1": _file_row("file-1", "audio.mp3", file_path)}
    )

    payload = delete_uploaded_file(file_store=file_store, file_id="file-1")

    assert payload == {
        "file_id": "file-1",
        "message": "File file-1 deleted",
        "filename": "audio.mp3",
    }
    assert file_store.get_file("file-1") is None
    assert not file_path.exists()


def test_delete_uploaded_file_rejects_linked_tasks(tmp_path: Path) -> None:
    file_path = tmp_path / "linked.mp3"
    file_path.write_bytes(b"audio")
    file_store = FakeFileStore(
        files={"file-2": _file_row("file-2", "linked.mp3", file_path)},
        linked_task_counts={"file-2": 2},
    )

    with pytest.raises(FileUseCaseError) as error:
        delete_uploaded_file(file_store=file_store, file_id="file-2")

    assert error.value.status_code == 409
    assert error.value.error_code == "linked_tasks"
    assert file_store.get_file("file-2") is not None
    assert file_path.exists()


def test_batch_delete_uploaded_files_returns_mixed_outcomes(tmp_path: Path) -> None:
    deleted_path = tmp_path / "deleted.mp3"
    linked_path = tmp_path / "linked.mp3"
    deleted_path.write_bytes(b"audio")
    linked_path.write_bytes(b"audio")
    file_store = FakeFileStore(
        files={
            "delete-me": _file_row("delete-me", "deleted.mp3", deleted_path),
            "linked": _file_row("linked", "linked.mp3", linked_path),
        },
        linked_task_counts={"linked": 1},
    )

    payload = batch_delete_uploaded_files(
        file_store=file_store,
        file_ids=["delete-me", "linked", "missing", "delete-me"],
    )

    assert payload["action"] == "delete"
    assert payload["summary"] == {"requested": 4, "succeeded": 1, "failed": 3}
    results = payload["results"]
    assert results[0]["file_id"] == "delete-me"
    assert results[0]["ok"] is True
    assert results[0]["filename"] == "deleted.mp3"
    assert results[1]["error_code"] == "linked_tasks"
    assert results[2]["error_code"] == "not_found"
    assert results[3]["error_code"] == "duplicate_file_id"
    assert file_store.get_file("delete-me") is None
    assert file_store.get_file("linked") is not None


def test_list_uploaded_files_returns_paged_payload(tmp_path: Path) -> None:
    file_store = FakeFileStore(
        files={
            "file-a": _file_row("file-a", "alpha.mp3", tmp_path / "alpha.mp3"),
            "file-b": _file_row("file-b", "beta.wav", tmp_path / "beta.wav"),
        }
    )

    payload = list_uploaded_files(
        file_store=file_store,
        limit=1,
        offset=0,
        q=None,
        content_type=None,
        sort_by="filename",
        order="asc",
    )

    assert payload["total"] == 2
    assert payload["files"] == [
        {
            "file_id": "file-a",
            "filename": "alpha.mp3",
            "size": 128,
            "content_type": "audio/mpeg",
            "created_at": "2026-01-01T00:00:00",
        }
    ]


def test_upload_uploaded_file_stores_file_and_metadata(tmp_path: Path) -> None:
    file_store = FakeFileStore(files={})
    stream = FakeUploadStream([b"audio"])

    payload = asyncio.run(
        upload_uploaded_file(
            file_store=file_store,
            stream=stream,
            filename="meeting.mp3",
            content_type=None,
            upload_dir=tmp_path,
            max_file_size=1024,
            allowed_extensions={".mp3"},
            allowed_content_types={"audio/mpeg"},
            infer_content_type=lambda filename: "audio/mpeg",
            file_id_factory=lambda: "upload-1",
        )
    )

    assert payload == {
        "file_id": "upload-1",
        "filename": "meeting.mp3",
        "size": 5,
        "content_type": "audio/mpeg",
    }
    assert stream.closed is True
    assert (tmp_path / "upload-1.mp3").read_bytes() == b"audio"
    assert file_store.get_file("upload-1") is not None


def test_upload_uploaded_file_ignores_close_failure_after_success(
    tmp_path: Path,
) -> None:
    file_store = FakeFileStore(files={})
    stream = CloseFailingUploadStream([b"audio"])

    payload = asyncio.run(
        upload_uploaded_file(
            file_store=file_store,
            stream=stream,
            filename="meeting.mp3",
            content_type=None,
            upload_dir=tmp_path,
            max_file_size=1024,
            allowed_extensions={".mp3"},
            allowed_content_types={"audio/mpeg"},
            infer_content_type=lambda filename: "audio/mpeg",
            file_id_factory=lambda: "upload-close-failure",
        )
    )

    assert payload["file_id"] == "upload-close-failure"
    assert (tmp_path / "upload-close-failure.mp3").read_bytes() == b"audio"
    assert file_store.get_file("upload-close-failure") is not None


def test_upload_uploaded_file_rejects_unsupported_inferred_content_type(
    tmp_path: Path,
) -> None:
    file_store = FakeFileStore(files={})
    stream = FakeUploadStream([b"audio"])

    with pytest.raises(FileUseCaseError) as error:
        asyncio.run(
            upload_uploaded_file(
                file_store=file_store,
                stream=stream,
                filename="meeting.mp3",
                content_type=None,
                upload_dir=tmp_path,
                max_file_size=1024,
                allowed_extensions={".mp3"},
                allowed_content_types={"audio/mpeg"},
                infer_content_type=lambda filename: "application/octet-stream",
                file_id_factory=lambda: "upload-unsupported",
            )
        )

    assert error.value.status_code == 400
    assert error.value.error_code == "unsupported_content_type"
    assert file_store.get_file("upload-unsupported") is None
    assert not (tmp_path / "upload-unsupported.mp3").exists()


def test_upload_uploaded_file_cleans_partial_file_on_stream_failure(
    tmp_path: Path,
) -> None:
    file_store = FakeFileStore(files={})
    stream = FailingUploadStream([b"partial"])

    with pytest.raises(RuntimeError, match="stream failed"):
        asyncio.run(
            upload_uploaded_file(
                file_store=file_store,
                stream=stream,
                filename="meeting.mp3",
                content_type=None,
                upload_dir=tmp_path,
                max_file_size=1024,
                allowed_extensions={".mp3"},
                allowed_content_types={"audio/mpeg"},
                infer_content_type=lambda filename: "audio/mpeg",
                file_id_factory=lambda: "upload-partial",
            )
        )

    assert stream.closed is True
    assert file_store.get_file("upload-partial") is None
    assert not (tmp_path / "upload-partial.mp3").exists()


def test_upload_uploaded_file_preserves_stream_failure_when_close_fails(
    tmp_path: Path,
) -> None:
    file_store = FakeFileStore(files={})
    stream = ReadAndCloseFailingUploadStream([b"partial"])

    with pytest.raises(RuntimeError, match="stream failed"):
        asyncio.run(
            upload_uploaded_file(
                file_store=file_store,
                stream=stream,
                filename="meeting.mp3",
                content_type=None,
                upload_dir=tmp_path,
                max_file_size=1024,
                allowed_extensions={".mp3"},
                allowed_content_types={"audio/mpeg"},
                infer_content_type=lambda filename: "audio/mpeg",
                file_id_factory=lambda: "upload-close-mask",
            )
        )

    assert file_store.get_file("upload-close-mask") is None
    assert not (tmp_path / "upload-close-mask.mp3").exists()
