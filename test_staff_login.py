import requests
import json

url = 'http://127.0.0.1:8000/api/v1/business/staff/login'
data = {
    'event_url': 'https://sounditent.com/events/1',
    'email_or_phone': 'test@test.com',
    'password': 'test123'
}

res = requests.post(url, json=data)
print('Status:', res.status_code)
print('Response:', res.text)
