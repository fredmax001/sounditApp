with open('auth.py', 'r') as f:
    content = f.read()

old_block = '''    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()'''

new_block = '''    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Handle staff tokens (sub = "staff:123")
    if isinstance(user_id, str) and user_id.startswith("staff:"):
        from models import StaffMember
        staff_id = int(user_id.split(":")[1])
        staff = db.query(StaffMember).filter(StaffMember.id == staff_id).first()
        if not staff or staff.status != "Active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Staff account not found or inactive",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Return the business user that the staff belongs to
        user = db.query(User).filter(User.id == staff.business_id).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Business user not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Attach staff info to user for downstream use
        user._staff_context = {
            "staff_id": staff.id,
            "staff_name": staff.full_name,
            "staff_role": staff.role,
            "staff_permissions": staff.permissions or {},
            "event_id": payload.get("event_id"),
        }
        return user
    
    user = db.query(User).filter(User.id == int(user_id)).first()'''

if old_block in content:
    content = content.replace(old_block, new_block)
    print("Fixed auth.py staff token handling")
else:
    print("WARNING: Could not find block in auth.py")

with open('auth.py', 'w') as f:
    f.write(content)
