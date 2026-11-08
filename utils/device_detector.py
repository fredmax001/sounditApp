"""
Device Detection Utility
Detects mobile vs desktop devices for payment method selection
"""

import re
from typing import Optional


MOBILE_USER_AGENTS = [
    'Mobile', 'Android', 'iPhone', 'iPad', 'iPod', 'Windows Phone',
    'BlackBerry', 'Opera Mini', 'IEMobile'
]


def is_mobile_device(user_agent: Optional[str]) -> bool:
    """
    Detect if the request is from a mobile device based on User-Agent header.
    
    Args:
        user_agent: The User-Agent string from the request headers
        
    Returns:
        bool: True if mobile device, False otherwise
    """
    if not user_agent:
        return False
    
    user_agent_lower = user_agent.lower()
    
    mobile_patterns = [
        'mobile', 'android', 'iphone', 'ipad', 'ipod',
        'windows phone', 'blackberry', 'opera mini',
        'iemobile', 'webos', 'silk', 'kindle'
    ]
    
    for pattern in mobile_patterns:
        if pattern in user_agent_lower:
            return True
    
    return False


def get_device_type(user_agent: Optional[str]) -> str:
    """
    Get the device type string.
    
    Returns:
        str: 'mobile' or 'desktop'
    """
    return "mobile" if is_mobile_device(user_agent) else "desktop"


def get_payment_method_for_device(user_agent: Optional[str]) -> dict:
    """
    Get the appropriate payment method configuration based on device type.
    
    Returns:
        dict: Contains 'method', 'qr_code_url', 'payment_link', 'instructions'
    """
    is_mobile = is_mobile_device(user_agent)
    
    if is_mobile:
        return {
            "method": "yoopay_link",
            "type": "mobile",
            "payment_link": "https://yoopay.cn/tc/603316601",
            "qr_code_url": None,
            "instructions": "Click the payment link above to complete your payment with Yoopay. After payment, upload your screenshot.",
            "button_text": "Pay with Yoopay"
        }
    else:
        return {
            "method": "yoopay_qr",
            "type": "web",
            "payment_link": "https://yoopay.cn/tc/603316601",
            "qr_code_url": "/static/yoopay_qr_code.jpg",
            "instructions": "Scan the QR code with your phone to pay via Yoopay. After payment, upload your screenshot below.",
            "button_text": "I have completed payment"
        }
