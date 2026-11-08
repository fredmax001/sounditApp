with open('/var/www/soundit/releases/20260806030032/api/auth.py', 'r') as f:
    content = f.read()

# Add import if missing
if 'from config import get_settings' not in content:
    # Add after the import secrets line
    content = content.replace(
        'import secrets\n\nlogger',
        'import secrets\nfrom config import get_settings\n\nlogger'
    )
    print("Added get_settings import")
else:
    print("Import already exists")

with open('/var/www/soundit/releases/20260806030032/api/auth.py', 'w') as f:
    f.write(content)
