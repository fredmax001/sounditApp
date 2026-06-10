"""
Menu Import Service — Extract product items from images, PDFs, and text
for vendor bulk product creation.
"""
import re
import io
import logging
from typing import List, Optional, Dict
from pydantic import BaseModel

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import pytesseract
except ImportError:
    pytesseract = None

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

logger = logging.getLogger(__name__)


class MenuItem(BaseModel):
    name: str
    price: float
    description: Optional[str] = None
    category: Optional[str] = None
    confidence: float = 1.0


# Common regex patterns for Chinese/English menu items
PRICE_PATTERNS = [
    # ¥25, ¥ 25, ¥25.50
    r"[¥￥]\s*(\d+(?:\.\d{1,2})?)",
    # 25元, 25 元
    r"(\d+(?:\.\d{1,2})?)\s*[元圆]",
    # RMB 25, RMB25
    r"RMB\s*(\d+(?:\.\d{1,2})?)",
    # CNY 25
    r"CNY\s*(\d+(?:\.\d{1,2})?)",
    # $25 (fallback)
    r"\$\s*(\d+(?:\.\d{1,2})?)",
]

# Separators between name and price
SEPARATOR_PATTERN = r"[-—–−\s·•|]+"

# Category keywords
CATEGORY_KEYWORDS = {
    "food": ["rice", "noodle", "pasta", "burger", "pizza", "chicken", "beef", "pork", "fish", "salad", "soup", "dumpling", "sushi", "taco", "wrap", "三明治", "饭", "面", "饺子", "寿司", "汉堡", "披萨", "沙拉", "汤"],
    "drink": ["tea", "coffee", "beer", "wine", "cocktail", "juice", "soda", "water", "milk", "smoothie", "latte", "espresso", "茶", "咖啡", "啤酒", "葡萄酒", "鸡尾酒", "果汁", "水", "奶昔"],
    "dessert": ["cake", "ice cream", "cookie", "brownie", "pie", "pudding", "mousse", "waffle", "pancake", "蛋糕", "冰淇淋", "饼干", "布丁"],
    "snack": ["fries", "chips", "popcorn", "nuts", "薯条", "薯片", "爆米花"],
}


def _guess_category(name: str) -> Optional[str]:
    """Guess product category from name keywords."""
    name_lower = name.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in name_lower:
                return category
    return None


def _clean_name(name: str) -> str:
    """Clean extracted product name."""
    # Remove price-related suffixes
    name = re.sub(r"[¥￥]\s*\d+.*$", "", name)
    name = re.sub(r"\d+\s*[元圆].*$", "", name)
    name = re.sub(r"RMB\s*\d+.*$", "", name, flags=re.IGNORECASE)
    name = re.sub(r"CNY\s*\d+.*$", "", name, flags=re.IGNORECASE)
    # Remove common bullet markers
    name = re.sub(r"^[·•\-\*\d]+\s*", "", name)
    # Strip whitespace
    name = name.strip()
    return name


def _extract_price(text: str) -> Optional[float]:
    """Extract price from a line of text."""
    for pattern in PRICE_PATTERNS:
        match = re.search(pattern, text)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    return None


def _parse_menu_line(line: str) -> Optional[MenuItem]:
    """Parse a single line of text into a MenuItem."""
    line = line.strip()
    if not line or len(line) < 3:
        return None
    
    # Skip lines that look like headers, addresses, or notes
    skip_keywords = ["tel", "phone", "address", "address:", "hours", "menu", "welcome", "thank", "cash", "card", "tax", "service charge", "电话", "地址", "营业时间", "欢迎", "谢谢"]
    line_lower = line.lower()
    for kw in skip_keywords:
        if kw in line_lower and len(line) < 50:
            return None
    
    # Try to extract price
    price = _extract_price(line)
    if price is None:
        return None
    
    # Remove price from line to get name
    name = line
    for pattern in PRICE_PATTERNS:
        name = re.sub(pattern, "", name)
    name = _clean_name(name)
    
    if not name or len(name) < 2:
        return None
    
    # Detect category
    category = _guess_category(name)
    
    return MenuItem(
        name=name,
        price=price,
        category=category,
        confidence=0.9
    )


def parse_text_menu(text: str) -> List[MenuItem]:
    """Parse pasted text menu into product items."""
    items: List[MenuItem] = []
    lines = text.split("\n")
    
    for line in lines:
        item = _parse_menu_line(line)
        if item:
            items.append(item)
    
    return items


def parse_image_menu(image_bytes: bytes) -> List[MenuItem]:
    """OCR an image and extract menu items."""
    if Image is None:
        logger.error("PIL not installed, cannot process image")
        return []
    
    if pytesseract is None:
        logger.error("pytesseract not installed, cannot OCR image")
        return []
    
    try:
        image = Image.open(io.BytesIO(image_bytes))
        
        # Try Chinese + English OCR first
        try:
            text = pytesseract.image_to_string(image, lang='eng+chi_sim')
        except Exception:
            text = pytesseract.image_to_string(image, lang='eng')
        
        if not text:
            return []
        
        logger.info(f"[OCR] Extracted {len(text)} chars from menu image")
        return parse_text_menu(text)
        
    except Exception as e:
        logger.error(f"[OCR Error] {e}")
        return []


def parse_pdf_menu(pdf_bytes: bytes) -> List[MenuItem]:
    """Extract text from PDF and parse menu items."""
    text = ""
    
    # Try pdfplumber first (best text extraction)
    if pdfplumber is not None:
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            if text.strip():
                logger.info(f"[PDF] Extracted {len(text)} chars via pdfplumber")
                return parse_text_menu(text)
        except Exception as e:
            logger.warning(f"[PDF] pdfplumber failed: {e}")
    
    # Fallback to PyPDF2
    if PyPDF2 is not None:
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            if text.strip():
                logger.info(f"[PDF] Extracted {len(text)} chars via PyPDF2")
                return parse_text_menu(text)
        except Exception as e:
            logger.warning(f"[PDF] PyPDF2 failed: {e}")
    
    # Last resort: OCR each page as image
    if pytesseract is not None and Image is not None:
        try:
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(pdf_bytes, dpi=200)
            for img in images:
                try:
                    page_text = pytesseract.image_to_string(img, lang='eng+chi_sim')
                except Exception:
                    page_text = pytesseract.image_to_string(img, lang='eng')
                if page_text:
                    text += page_text + "\n"
            if text.strip():
                logger.info(f"[PDF] Extracted {len(text)} chars via OCR")
                return parse_text_menu(text)
        except ImportError:
            logger.warning("[PDF] pdf2image not installed, cannot OCR PDF pages")
        except Exception as e:
            logger.warning(f"[PDF] OCR fallback failed: {e}")
    
    logger.error("[PDF] Could not extract text from PDF")
    return []
