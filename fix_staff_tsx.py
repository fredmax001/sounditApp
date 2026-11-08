with open('app/src/pages/business/Staff.tsx', 'r') as f:
    content = f.read()

old_block = '''          user_id: selectedUser?.id || null,
          permissions: {
            qrScanner: permissions.qrScanner,
            checkedInInfo: permissions.checkedInInfo,
          },'''

new_block = '''          user_id: selectedUser?.id || null,
          password: formData.password || null,
          permissions: {
            qrScanner: permissions.qrScanner,
            checkedInInfo: permissions.checkedInInfo,
          },'''

if old_block in content:
    content = content.replace(old_block, new_block)
    print("Fixed Staff.tsx")
else:
    print("WARNING: Could not find block in Staff.tsx")

with open('app/src/pages/business/Staff.tsx', 'w') as f:
    f.write(content)
