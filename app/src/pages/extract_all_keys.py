import re
import json

pages = [
    ("About.tsx", "about"),
    ("ArtistDetail.tsx", "artistDetail"),
    ("Careers.tsx", "careers"),
    ("Cart.tsx", "cart"),
    ("CityGuide.tsx", "cityGuide"),
    ("Community.tsx", "community"),
    ("Contact.tsx", "contact"),
    ("EventDetail.tsx", "eventDetail"),
    ("Help.tsx", "help"),
    ("Press.tsx", "press"),
    ("Privacy.tsx", "privacy"),
    ("Recaps.tsx", "recaps"),
    ("RefundPolicy.tsx", "refundPolicy"),
    ("Scan.tsx", "scan"),
    ("Subscriptions.tsx", "subscriptions"),
    ("Terms.tsx", "terms"),
    ("Validate.tsx", "validate"),
    ("payment/Checkout.tsx", "payment"),
    ("payment/PaymentSuccess.tsx", "payment"),
]

def extract_calls(content):
    # Match t('namespace.key') or t("namespace.key")
    pattern = r"t\(['\"]([^'\"]+)['\"]"
    return re.findall(pattern, content)

consolidated = {}

for filepath, expected_ns in pages:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    calls = extract_calls(content)
    ns_keys = {}
    for full_key in calls:
        parts = full_key.split(".", 1)
        if len(parts) != 2:
            continue
        ns, key = parts
        # Only include keys that match the expected namespace for this file
        if ns != expected_ns:
            continue
        # Find the original English text for the key if possible
        # We can look for the pattern >{t('full_key')}< and extract the text between > and <
        # But if it was replaced earlier, we don't have the original text.
        # Instead, we can build the JSON with empty values or the key as value.
        # For this task, the user wants the translation keys object; values can be the original English strings.
        # Since we don't have original strings for pre-existing keys, we'll put the key as the value.
        ns_keys[key] = key  # placeholder
    if ns_keys:
        consolidated[expected_ns] = ns_keys

print(json.dumps(consolidated, indent=2, ensure_ascii=False))
