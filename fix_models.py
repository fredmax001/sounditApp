with open('models.py', 'r') as f:
    content = f.read()

# Fix corrupted StaffMember model
old_block = '''    password_hash = Column(String(255), nullable=True)
    
    permissions = Column(JSON, nullable=True, default=dict)"Scanner")
    status = Column(String(20), nullable=False, default="Pending")
    
    permissions = Column(JSON, nullable=True, default=dict)'''

new_block = '''    password_hash = Column(String(255), nullable=True)
    
    permissions = Column(JSON, nullable=True, default=dict)'''

if old_block in content:
    content = content.replace(old_block, new_block)
    print("Fixed models.py")
else:
    print("WARNING: Could not find corrupted block in models.py")
    # Try alternative
    old_block2 = '''    password_hash = Column(String(255), nullable=True)
    
    permissions = Column(JSON, nullable=True, default=dict)"Scanner")'''
    if old_block2 in content:
        content = content.replace(old_block2, '''    password_hash = Column(String(255), nullable=True)
    
    permissions = Column(JSON, nullable=True, default=dict)''')
        # Also remove the duplicate lines after
        content = content.replace('''    status = Column(String(20), nullable=False, default="Pending")
    
    permissions = Column(JSON, nullable=True, default=dict)''', '''    status = Column(String(20), nullable=False, default="Pending")''')
        print("Fixed models.py (alternative)")
    else:
        print("ERROR: Could not fix models.py")

with open('models.py', 'w') as f:
    f.write(content)
