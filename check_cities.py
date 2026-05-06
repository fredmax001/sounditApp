import os
os.chdir('/var/www/soundit')

from database import SessionLocal
from models import User
from sqlalchemy import func, distinct

db = SessionLocal()
try:
    result = db.query(func.count(distinct(User.preferred_city))).filter(
        User.preferred_city.isnot(None),
        User.role.in_(['business', 'artist', 'vendor', 'organizer'])
    ).scalar()
    print("total_cities: " + str(result))
    
    cities = db.query(User.preferred_city, func.count(User.id)).filter(
        User.preferred_city.isnot(None),
        User.role.in_(['business', 'artist', 'vendor', 'organizer'])
    ).group_by(User.preferred_city).all()
    for city, count in cities:
        print("  " + str(city) + ": " + str(count))
finally:
    db.close()
