with open('/var/www/soundit/releases/20260806030032/auth.py', 'r') as f:
    content = f.read()

# Add aliases at the end if not present
aliases = '''\n\n# Public aliases for cleaner imports\nget_password_hash = get_REDACTED_PLACEHOLDER_hash\nverify_password = verify_REDACTED_PLACEHOLDER\ncreate_access_token = REDACTED_PLACEHOLDER\ndecode_token = decode_REDACTED_PLACEHOLDER\n'''

if 'get_password_hash = get_REDACTED_PLACEHOLDER_hash' not in content:
    content = content.rstrip() + aliases
    print("Added aliases to auth.py")
else:
    print("Aliases already exist")

with open('/var/www/soundit/releases/20260806030032/auth.py', 'w') as f:
    f.write(content)
