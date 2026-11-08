with open('/etc/nginx/conf.d/soundit.conf.bak.apk') as f:
    content = f.read()

block = """    # App download routes (APK served by backend)
    location /download {
        proxy_pass http://soundit_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

"""

marker = '    # Public SEO & Ticket routes'
assert marker in content, 'marker not found'
content = content.replace(marker, block + marker, 1)

with open('/etc/nginx/conf.d/soundit.conf', 'w') as f:
    f.write(content)
print('inserted ok')
