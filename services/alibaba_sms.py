"""
Alibaba Cloud SMS Service
Supports API Gateway / Marketplace SMS APIs using AppKey + AppSecret + AppCode authentication.
"""
import hmac
import hashlib
import base64
import urllib.parse
import uuid
import datetime
import requests
from typing import Optional
from config import get_settings

settings = get_settings()

# Default Alibaba Cloud SMS endpoint (API Gateway / Marketplace)
# For Alibaba Cloud Direct SMS: dysmsapi.aliyuncs.com
# For API Marketplace: varies by product
ALIBABA_SMS_ENDPOINT = "https://sms.aliyuncs.com"
ALIBABA_MARKETPLACE_ENDPOINT = getattr(settings, "ALIBABA_MARKETPLACE_ENDPOINT", "https://kzsms.market.alicloudapi.com/api/sms/send")


def _percent_encode(string: str) -> str:
    """URL encode special characters for signature calculation."""
    res = urllib.parse.quote(string, safe='')
    res = res.replace('+', '%20')
    res = res.replace('*', '%2A')
    res = res.replace('%7E', '~')
    return res


def _build_signature(params: dict, app_secret: str, http_method: str = "GET") -> str:
    """
    Build Alibaba Cloud API signature using AppSecret.
    Follows Alibaba Cloud POP API signature v1 (HMAC-SHA1).
    """
    # Sort parameters by key
    sorted_params = sorted(params.items())
    
    # Build canonical query string
    canonical_query_string = "&".join(
        f"{_percent_encode(k)}={_percent_encode(str(v))}"
        for k, v in sorted_params
    )
    
    # Build string to sign
    string_to_sign = f"{http_method}&%2F&{_percent_encode(canonical_query_string)}"
    
    # Calculate HMAC-SHA1 signature
    key = app_secret + "&"
    signature = base64.b64encode(
        hmac.new(key.encode('utf-8'), string_to_sign.encode('utf-8'), hashlib.sha1).digest()
    ).decode('utf-8')
    
    return signature


def send_sms_alibaba(
    phone_number: str,
    template_code: str,
    template_param: dict,
    sign_name: Optional[str] = None
) -> dict:
    """
    Send SMS using Alibaba Cloud Direct SMS API (Dysmsapi).
    Uses standard AccessKey/Secret or AppKey/AppSecret authentication.
    
    Args:
        phone_number: Phone number in E.164 format (+8613912345678) or domestic (13912345678)
        template_code: Alibaba Cloud SMS template code
        template_param: Template parameters dict, e.g. {"code": "123456"}
        sign_name: SMS signature name (defaults to settings.ALIBABA_SMS_SIGN_NAME)
    
    Returns:
        dict with 'success', 'message', 'response'
    """
    app_key = settings.ALIBABA_APP_KEY
    app_secret = settings.ALIBABA_APP_SECRET
    app_code = settings.ALIBABA_APP_CODE
    
    if not all([app_key, app_secret]):
        raise Exception("Alibaba Cloud AppKey or AppSecret not configured")
    
    # Normalize phone number - remove '+' for Alibaba Cloud
    phone = phone_number.lstrip('+')
    
    sign = sign_name or settings.ALIBABA_SMS_SIGN_NAME or "SoundIt"
    
    # API parameters for Alibaba Cloud Direct SMS
    params = {
        "Format": "JSON",
        "Version": "2017-05-25",
        "AccessKeyId": app_key,
        "SignatureMethod": "HMAC-SHA1",
        "Timestamp": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "SignatureVersion": "1.0",
        "SignatureNonce": str(uuid.uuid4()),
        "Action": "SendSms",
        "PhoneNumbers": phone,
        "SignName": sign,
        "TemplateCode": template_code,
        "TemplateParam": str(template_param).replace("'", '"'),
    }
    
    # Calculate signature
    params["Signature"] = _build_signature(params, app_secret)
    
    # Make request
    response = requests.get(ALIBABA_SMS_ENDPOINT, params=params, timeout=30)
    
    result = response.json()
    
    if result.get("Code") == "OK":
        return {
            "success": True,
            "message": "SMS sent successfully",
            "response": result
        }
    else:
        return {
            "success": False,
            "message": result.get("Message", "Unknown error"),
            "response": result
        }


def send_sms_via_marketplace(
    phone_number: str,
    template_code: str,
    template_param: dict,
    sign_name: Optional[str] = None,
    raw_message: str = None
) -> dict:
    """
    Send SMS via Alibaba Cloud API Gateway / Marketplace using AppCode authentication.
    This is used when SMS is purchased through the Alibaba Cloud Marketplace.
    
    Args:
        phone_number: Phone number
        template_code: Marketplace template code
        template_param: Template parameters
        sign_name: SMS signature
        raw_message: Optional raw message text (for APIs that support it)
    
    Returns:
        dict with 'success', 'message', 'response'
    """
    import logging
    logger = logging.getLogger(__name__)
    
    app_key = settings.ALIBABA_APP_KEY
    app_secret = settings.ALIBABA_APP_SECRET
    app_code = settings.ALIBABA_APP_CODE
    
    if not app_code:
        raise Exception("Alibaba Cloud AppCode not configured")
    
    phone = phone_number.lstrip('+')
    sign = sign_name or settings.ALIBABA_SMS_SIGN_NAME or "SoundIt"
    
    # Use the configured marketplace endpoint (user-provided)
    url = ALIBABA_MARKETPLACE_ENDPOINT
    
    headers = {
        "Authorization": f"APPCODE {app_code}",
    }
    
    # The kzsms marketplace product uses form-data with specific param names:
    # mobile, templateId, param
    # It does NOT support raw message without template.
    if not template_code:
        return {
            "success": False,
            "message": "This marketplace SMS product requires a templateId. Raw messages are not supported.",
            "response": {}
        }
    
    # Build form payload
    param_str = str(template_param).replace("'", '"') if isinstance(template_param, dict) else str(template_param)
    
    payload = {
        "mobile": phone,
        "templateId": template_code,
        "param": param_str,
    }
    
    try:
        response = requests.post(url, data=payload, headers=headers, timeout=15)
        
        resp_text = response.text
        logger.info(f"Marketplace SMS response: {response.status_code} {resp_text[:500]}")
        
        try:
            result = response.json()
        except Exception:
            result = {"raw": resp_text}
        
        # Alibaba API Gateway often returns errors in headers with empty body
        ca_error = response.headers.get("X-Ca-Error-Message", "")
        ca_code = response.headers.get("X-Ca-Error-Code", "")
        if ca_error:
            result["_gateway_error"] = ca_error
            result["_gateway_code"] = ca_code
        
        if response.status_code == 200:
            if result.get("success") or result.get("code") == 200:
                return {
                    "success": True,
                    "message": "SMS sent successfully",
                    "response": result
                }
            else:
                return {
                    "success": False,
                    "message": result.get("msg") or result.get("message") or ca_error or str(result),
                    "response": result
                }
        else:
            return {
                "success": False,
                "message": ca_error or f"HTTP {response.status_code}: {resp_text[:300]}",
                "response": result
            }
            
    except Exception as e:
        error_msg = f"Request error: {type(e).__name__}: {str(e)[:200]}"
        logger.warning(f"Marketplace SMS request failed: {error_msg}")
        return {
            "success": False,
            "message": error_msg,
            "response": {}
        }


def send_otp_sms(phone_number: str, otp_code: str) -> dict:
    """
    Send OTP SMS using Alibaba Cloud.
    Automatically selects the appropriate method based on configuration.
    
    Args:
        phone_number: Phone number
        otp_code: 6-digit OTP code
    
    Returns:
        dict with 'success', 'message'
    """
    template_code = settings.ALIBABA_SMS_TEMPLATE_CODE
    
    if not template_code:
        raise Exception("Alibaba Cloud SMS template code not configured. Please set ALIBABA_SMS_TEMPLATE_CODE in your environment.")
    
    template_param = {"code": otp_code}
    
    # Try direct Alibaba Cloud SMS first, fallback to marketplace
    try:
        return send_sms_alibaba(phone_number, template_code, template_param)
    except Exception as e:
        # If direct SMS fails and we have AppCode, try marketplace
        if settings.ALIBABA_APP_CODE:
            return send_sms_via_marketplace(phone_number, template_code, template_param)
        raise e


def is_configured() -> bool:
    """Check if Alibaba Cloud SMS credentials are configured."""
    return bool(
        settings.ALIBABA_APP_KEY and
        settings.ALIBABA_APP_SECRET and
        settings.ALIBABA_SMS_TEMPLATE_CODE
    )
