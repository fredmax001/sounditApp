"""
Structured logging configuration for the Sound It Platform.

Configures the root logger with a rotating file handler and a console handler,
emits JSON-formatted logs, and ensures the log directory exists.
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from typing import Any, Dict


class JsonFormatter(logging.Formatter):
    """Simple JSON log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Add extra fields from the record
        for key in ("request_id", "user_id", "ip_address", "endpoint", "method"):
            value = getattr(record, key, None)
            if value is not None:
                log_entry[key] = value

        # Add any custom attributes not part of the standard LogRecord
        standard_attrs = set(logging.LogRecord(None, None, "", 0, "", (), None).__dict__.keys())
        for key, value in record.__dict__.items():
            if key not in standard_attrs and key not in log_entry:
                log_entry[key] = value

        return json.dumps(log_entry, default=str)


def setup_logging(log_level: str = "INFO", log_file: str = "logs/app.log") -> None:
    """
    Configure the root logger with JSON output to a rotating file and stdout.

    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        log_file: Path to the log file. Relative paths are resolved against
                  the current working directory.
    """
    level = getattr(logging, log_level.upper(), logging.INFO)

    # Ensure log directory exists
    log_dir = os.path.dirname(log_file)
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Avoid duplicate handlers if setup_logging is called multiple times
    if root_logger.handlers:
        root_logger.handlers.clear()

    formatter = JsonFormatter()

    # Rotating file handler: 10 MB per file, keep 5 backups
    file_handler = RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5)
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
