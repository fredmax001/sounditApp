"""Shared upload storage utilities for consistent local file handling."""
import os
import uuid
from typing import Iterable, Optional, Set

from config import get_settings

settings = get_settings()

# Payment proofs / user uploads are images (occasionally PDFs). Anything else
# (e.g. .html, .svg, .php, .js) must never be written to a web-served directory.
SAFE_IMAGE_EXTENSIONS: Set[str] = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif",
    ".heic", ".heif", ".jfif", ".bmp", ".avif",
}
SAFE_PROOF_EXTENSIONS: Set[str] = SAFE_IMAGE_EXTENSIONS | {".pdf"}
DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


class UploadValidationError(ValueError):
    """Raised when an uploaded file fails security validation."""


def _safe_extension(filename: Optional[str]) -> str:
    if not filename or "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def get_upload_dir(subfolder: str = "") -> str:
    """Return the absolute upload directory path.

    In DEBUG mode, files are saved under the project's static/uploads/ directory
    so FastAPI's /static mount can serve them directly during local development.

    In production, files are saved to /var/www/soundit-uploads/ which is mirrored
    by nginx under the /static/uploads/ location.
    """
    if settings.DEBUG:
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static", "uploads"))
    else:
        base = "/var/www/soundit-uploads"

    path = os.path.join(base, subfolder) if subfolder else base
    os.makedirs(path, exist_ok=True)
    return path


def save_upload_securely(
    upload_file,
    subfolder: str = "",
    *,
    allowed_extensions: Optional[Iterable[str]] = None,
    max_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
    prefix: str = "upload",
) -> str:
    """Validate and persist an uploaded file, returning its public URL path.

    Security guarantees:
      * extension is checked against a whitelist (default: safe image/PDF types)
      * size is capped *before* anything is written to disk
      * the on-disk filename is generated server-side (no path traversal / no
        attacker-controlled extension)
      * optional magic-byte/malware scan via FileSecurityScanner when available

    Raises UploadValidationError for rejected input.
    """
    allowed = {str(e).lower() for e in (allowed_extensions or SAFE_PROOF_EXTENSIONS)}
    ext = _safe_extension(getattr(upload_file, "filename", None))
    if ext not in allowed:
        raise UploadValidationError(
            "Unsupported file type. Allowed: " + ", ".join(sorted(allowed))
        )

    stream = upload_file.file
    try:
        stream.seek(0)
    except Exception:
        pass
    data = stream.read(max_bytes + 1)
    try:
        stream.seek(0)
    except Exception:
        pass

    if len(data) > max_bytes:
        raise UploadValidationError(
            f"File too large (max {max_bytes // (1024 * 1024)} MB)"
        )
    if not data:
        raise UploadValidationError("Empty file")

    # Content inspection (defence in depth). Failure to load the scanner must not
    # break uploads — extension + size checks above still apply.
    try:
        from security.file_security import FileSecurityScanner

        scanner = FileSecurityScanner()
        report = scanner.scan_file(data, upload_file.filename or f"{prefix}{ext}")
        result_value = getattr(getattr(report, "result", None), "value", "")
        if result_value in ("infected", "blocked_type", "suspicious"):
            raise UploadValidationError(
                f"File rejected: {getattr(report, 'scan_message', 'security scan failed')}"
            )
    except UploadValidationError:
        raise
    except Exception:
        pass

    upload_dir = get_upload_dir(subfolder)
    filename = f"{prefix}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as handle:
        handle.write(data)

    parts = ["static", "uploads"]
    if subfolder:
        parts.extend(p for p in subfolder.strip("/").split("/") if p)
    parts.append(filename)
    return "/" + "/".join(parts)
