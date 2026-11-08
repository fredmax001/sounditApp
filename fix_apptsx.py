with open('app/src/App.tsx', 'r') as f:
    content = f.read()

# Add imports
old_import = "import NotFound from './pages/NotFound';"
new_import = "import NotFound from './pages/NotFound';\nimport OnSiteTools from './pages/OnSiteTools';\nimport CheckedInGuests from './pages/CheckedInGuests';"

if old_import in content:
    content = content.replace(old_import, new_import)
    print("Added imports")
else:
    print("WARNING: Could not find import")

# Add routes after Scan route
old_route = "            {/* Scan Page - Works on all devices */}\n            <Route path=\"/scan\" element={<Scan />} />"
new_route = """            {/* Scan Page - Works on all devices */}
            <Route path="/scan" element={<Scan />} />

            {/* On Site Tools - Staff event login and dashboard */}
            <Route path="/on-site-tools" element={<OnSiteTools />} />
            <Route path="/on-site-tools/guests" element={<CheckedInGuests />} />"""

if old_route in content:
    content = content.replace(old_route, new_route)
    print("Added routes")
else:
    print("WARNING: Could not find route placement")

with open('app/src/App.tsx', 'w') as f:
    f.write(content)
