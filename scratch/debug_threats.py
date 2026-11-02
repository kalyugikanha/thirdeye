import sys
import os
import traceback

sys.path.insert(0, '/var/www/thirdeye/apps/api')
os.chdir('/var/www/thirdeye/apps/api')

from app.database import SessionLocal
from app import secureeye, models

db = SessionLocal()
user = db.query(models.User).filter(models.User.email == 'akash@colladome.com').first()
print(f"User found: {user.email if user else None}")

print("\n--- Testing get_threat_events ---")
try:
    res = secureeye.get_threat_events(project_id=2, current_user=user, db=db)
    print("Threats success! KPIs:", res.get("kpis"))
except Exception as e:
    traceback.print_exc()

print("\n--- Testing get_security_badge ---")
try:
    badge_resp = secureeye.get_security_badge(domain="selfupcommunity.com", db=db)
    print("Badge success! Type:", type(badge_resp))
except Exception as e:
    traceback.print_exc()

db.close()
