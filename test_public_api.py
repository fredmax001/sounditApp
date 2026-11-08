import requests

r = requests.post(
    'https://sounditent.com/api/v1/business/staff/login',
    json={
        'event_url': 'https://sounditent.com/events/1',
        'email_or_phone': 'test@test.com',
        'password': 'test123'
    }
)
print('Status:', r.status_code)
print('Response:', r.text[:200])
