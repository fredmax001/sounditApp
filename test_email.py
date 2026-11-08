import requests

url = 'http://127.0.0.1:8000/api/v1/notifications/broadcast'
# Test with invalid auth - but we can also just test the email service directly
# Let's use the test email endpoint if available, or just call send_email

# Actually, let's just call the email_service function directly
import sys
sys.path.insert(0, '/var/www/soundit/current')

from email_service import send_test_email
result = send_test_email('djfredmax221@gmail.com')
print('Email sent:', result)
