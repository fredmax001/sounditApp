try:
    import pytesseract  # type: ignore
except ImportError:
    pytesseract = None

from PIL import Image
import io
import re
from typing import Optional
import logging

logger = logging.getLogger(__name__)

def extract_payment_reference(image_bytes: bytes) -> Optional[str]:
    """
    Extracts a transaction reference number from a payment screenshot using OCR.
    Supports WeChat Pay and Alipay formats in both English and Chinese.
    """
    if pytesseract is None:
        logger.warning("pytesseract not installed, skipping OCR")
        return None
    
    try:
        # Load image from bytes
        image = Image.open(io.BytesIO(image_bytes))
        
        # Run OCR 
        # Note: Production server must have tesseract and chi_sim data installed
        try:
            # Try with Chinese and English support
            text = pytesseract.image_to_string(image, lang='eng+chi_sim')
        except Exception:
            # Fallback to English only if Chinese data is missing
            text = pytesseract.image_to_string(image, lang='eng')
        
        if not text:
            return None
            
        # Standardize text for easier regex matching
        # Remove spaces within the lines but keep whitespace between potential fields
        lines = text.split('\n')
        clean_text = ' '.join(line.replace(' ', '') for line in lines if line.strip())
        
        logger.info(f"[OCR] Extracted text length: {len(clean_text)}")

        # Patterns to find:
        # WeChat: Transaction Order No. / 交易单号
        # Alipay: Order No. / 商家订单号 / 订单号
        
        # Look for sequences of 16 to 32 digits
        # WeChat IDs are usually 28 digits, Alipay are 28-32 digits
        patterns = [
            r"(?:TransactionOrderNo|交易单号)[:：]?\s*([0-9]{16,32})",
            r"(?:OrderNo|商家订单号|订单号)[:：]?\s*([0-9]{16,32})",
            r"(?:MerchantOrderNo|商户单号)[:：]?\s*([0-9]{16,32})"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, clean_text, re.IGNORECASE)
            if match:
                ref = match.group(1)
                logger.info(f"[OCR] Found reference via keyword: {ref}")
                return ref
        
        # Fallback: Look for any standalone numeric string of 20-32 characters
        # Many Alipay/WeChat IDs fall in this range
        fallback_matches = re.findall(r"\b[0-9]{20,32}\b", clean_text)
        if fallback_matches:
            # Pick the longest one as it's most likely the transaction ID
            ref = max(fallback_matches, key=len)
            logger.info(f"[OCR] Found potential reference via fallback: {ref}")
            return ref
            
    except Exception as e:
        logger.error(f"[OCR Error] {str(e)}")
        
    return None
