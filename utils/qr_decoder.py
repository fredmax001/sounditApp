"""QR code decoding utilities for payment deep-linking.

Decodes WeChat/Alipay QR images once at upload time and stores the encoded
payment URLs (wechat_pay_url / alipay_pay_url) so mobile checkout can
deep-link directly into the payment apps without any payment API.

The decode step is best-effort: any failure is logged and never blocks
the upload flow.
"""
import logging
import os
from typing import Optional

import requests

logger = logging.getLogger(__name__)


def _load_image_bytes(source: str) -> Optional[bytes]:
    """Load image bytes from a URL or a local /static/uploads/... path."""
    if source.startswith("http://") or source.startswith("https://"):
        try:
            resp = requests.get(source, timeout=10)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            logger.warning("QR decode: failed to fetch %s: %s", source, e)
            return None

    # Absolute local path (e.g. /var/www/... or a temp file).
    # NB: "/static/uploads/..." also starts with "/" but is a URL-style app
    # path handled below - only treat genuine filesystem paths here.
    if os.path.isabs(source) and not source.startswith("/static/uploads/"):
        if os.path.exists(source):
            try:
                with open(source, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.warning("QR decode: failed to read %s: %s", source, e)
                return None
        logger.warning("QR decode: file not found for %s", source)
        return None

    # Local /static/uploads/<subfolder>/<file> path
    rel = source.lstrip("/")
    candidates = []

    from config import get_settings
    settings = get_settings()
    if settings.DEBUG:
        # Dev: files live under the project static/uploads directory
        candidates.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", rel)))
    else:
        # Prod: nginx mirrors /static/uploads/ from /var/www/soundit-uploads/
        candidates.append(os.path.join("/var/www/soundit-uploads", rel.replace("static/uploads/", "", 1)))

    # Generic fallback relative to cwd
    candidates.append(rel)

    for path in candidates:
        if os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.warning("QR decode: failed to read %s: %s", path, e)
                return None

    logger.warning("QR decode: file not found for %s", source)
    return None


def decode_qr(source: Optional[str]) -> Optional[str]:
    """Decode the content string encoded in a QR code image.

    Returns the decoded string, or None when decoding is not possible
    (missing file, unreadable image, no QR found).
    """
    if not source:
        return None

    data = _load_image_bytes(source)
    if not data:
        return None

    try:
        import numpy as np
        import cv2

        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            logger.warning("QR decode: cv2 could not decode image %s", source)
            return None

        detector = cv2.QRCodeDetector()

        # Primary: single-QR decode
        content, _, _ = detector.detectAndDecode(img)
        content = (content or "").strip()

        # Fallback: multi detector (handles some rotated/padded layouts)
        if not content:
            try:
                ok, decoded_list, _, _ = detector.detectAndDecodeMulti(img)
                if ok and decoded_list:
                    content = (decoded_list[0] or "").strip()
            except Exception:
                pass

        return content or None
    except Exception as e:
        logger.warning("QR decode failed for %s: %s", source, e)
        return None


def refresh_pay_urls(obj) -> None:
    """Decode an object's wechat_qr_url / alipay_qr_url into
    wechat_pay_url / alipay_pay_url attributes (if the model has them).

    Never raises, decoding is best-effort so uploads never fail because of it.
    """
    try:
        wechat_qr = getattr(obj, "wechat_qr_url", None)
        alipay_qr = getattr(obj, "alipay_qr_url", None)

        if not hasattr(obj, "wechat_pay_url") and not hasattr(obj, "alipay_pay_url"):
            return

        if wechat_qr:
            obj.wechat_pay_url = decode_qr(wechat_qr)
        elif hasattr(obj, "wechat_pay_url"):
            obj.wechat_pay_url = None

        if alipay_qr:
            obj.alipay_pay_url = decode_qr(alipay_qr)
        elif hasattr(obj, "alipay_pay_url"):
            obj.alipay_pay_url = None
    except Exception as e:
        logger.warning("refresh_pay_urls failed: %s", e)
