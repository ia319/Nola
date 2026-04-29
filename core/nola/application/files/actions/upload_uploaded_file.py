"""Upload-file use-case."""

import asyncio
import uuid
from collections.abc import Callable, Set
from pathlib import Path

from nola.application.files.contracts import (
    SupportsFileMutations,
    SupportsFileUploadStream,
)
from nola.application.files.errors import FileUseCaseError
from nola.application.files.types import FileUploadPayload


async def upload_uploaded_file(
    *,
    file_store: SupportsFileMutations,
    stream: SupportsFileUploadStream,
    filename: str | None,
    content_type: str | None,
    upload_dir: Path,
    max_file_size: int,
    allowed_extensions: Set[str],
    allowed_content_types: Set[str],
    infer_content_type: Callable[[str], str],
    file_id_factory: Callable[[], str] | None = None,
) -> FileUploadPayload:
    """Validate, store, and record one uploaded audio file."""
    if not filename:
        raise FileUseCaseError(
            status_code=400,
            detail="No filename provided",
            error_code="invalid_filename",
        )

    file_ext = Path(filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise FileUseCaseError(
            status_code=400,
            detail=(
                f"Unsupported file format: {file_ext}. "
                f"Allowed: {', '.join(sorted(allowed_extensions))}"
            ),
            error_code="unsupported_file_format",
        )

    if content_type and content_type not in allowed_content_types:
        raise FileUseCaseError(
            status_code=400,
            detail=f"Unsupported content type: {content_type}",
            error_code="unsupported_content_type",
        )

    file_id = file_id_factory() if file_id_factory else str(uuid.uuid4())
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / f"{file_id}{file_ext}"
    file_size = 0

    try:
        with open(file_path, "wb") as target:
            while True:
                chunk = await stream.read(1024 * 1024)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > max_file_size:
                    raise FileUseCaseError(
                        status_code=413,
                        detail=(
                            "File too large. Maximum size: "
                            f"{max_file_size // (1024 * 1024)} MB"
                        ),
                        error_code="file_too_large",
                    )
                await asyncio.to_thread(target.write, chunk)
    except FileUseCaseError:
        file_path.unlink(missing_ok=True)
        raise
    finally:
        await stream.close()

    resolved_content_type = content_type or infer_content_type(filename)
    try:
        file_store.create_file(
            file_id=file_id,
            filename=filename,
            path=str(file_path),
            size=file_size,
            content_type=resolved_content_type,
        )
    except Exception:
        file_path.unlink(missing_ok=True)
        raise

    return {
        "file_id": file_id,
        "filename": filename,
        "size": file_size,
        "content_type": resolved_content_type,
    }
