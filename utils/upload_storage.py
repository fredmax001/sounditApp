"""Shared upload storage utilities for consistent local file handling."""
import os
from config import get_settings

settings = get_settings()


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
