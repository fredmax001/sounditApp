with open('api/business.py', 'r') as f:
    content = f.read()

# Fix 1: Remove duplicate empty StaffMemberResponse class
content = content.replace(
    'class StaffMemberResponse(BaseModel):\n\n\nclass StaffMemberResponse(BaseModel):',
    'class StaffMemberResponse(BaseModel):'
)

# Fix 2: Remove corrupted line with "Pending" and duplicate permissions
content = content.replace(
    '        password_hash=get_password_hash(data.password) if data.password else None,\n        permissions=data.permissions or {},"Pending",\n        permissions=data.permissions or {},',
    '        password_hash=get_password_hash(data.password) if data.password else None,\n        permissions=data.permissions or {},'
)

with open('api/business.py', 'w') as f:
    f.write(content)

print("Fixed api/business.py")
