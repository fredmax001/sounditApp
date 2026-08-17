with open('app/src/pages/Scan.tsx', 'r') as f:
    content = f.read()

# Add import for staff auth store
old_import = "import { useAuthStore } from '@/store/authStore';"
new_import = "import { useAuthStore } from '@/store/authStore';\nimport { useStaffAuthStore } from '@/store/staffAuthStore';"

if old_import in content:
    content = content.replace(old_import, new_import)
    print("Added staff auth import")
else:
    print("WARNING: Could not find auth import")

# Update token retrieval to also check staff auth
old_token = "      const token = session?.access_token || localStorage.getItem('auth-token') || '';"
new_token = """      const staffToken = useStaffAuthStore.getState().token;
      const token = session?.access_token || staffToken || localStorage.getItem('auth-token') || '';"""

if old_token in content:
    content = content.replace(old_token, new_token)
    print("Updated token retrieval")
else:
    print("WARNING: Could not find token retrieval")

with open('app/src/pages/Scan.tsx', 'w') as f:
    f.write(content)
