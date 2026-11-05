import os
import sys

sys.path.insert(0, '/var/www/thirdeye/apps/api')
os.chdir('/var/www/thirdeye/apps/api')

from app.database import SessionLocal
from app import models

db = SessionLocal()

req = db.query(models.NetworkRequest).filter(models.NetworkRequest.endpoint_url.like('%calculate-project-cost%')).first()
if req:
    print("Found calculate-project-cost row:")
    print("ID:", req.id)
    print("Project ID:", req.project_id)
    print("Session ID:", req.session_id)
    print("Page URL:", req.page_url)
    print("Endpoint URL:", req.endpoint_url)
    print("Method:", req.method)
    print("Status code:", req.status_code)
    print("Duration ms:", req.duration_ms)
    print("Created at:", req.created_at)
else:
    print("Not found!")

print("\n--- Let's check who created it or what session it is linked to ---")
if req and req.session_id:
    sess = db.query(models.SessionRecording).filter(models.SessionRecording.session_id == req.session_id).first()
    if sess:
        print("Session recording found:", sess.id, sess.user_email, sess.created_at)
    else:
        print("No recording found with session_id:", req.session_id)

    evs = db.query(models.Event).filter(models.Event.session_id == req.session_id).all()
    print(f"Events found with session_id {req.session_id}: {len(evs)}")
    for e in evs[:5]:
        print("  Event:", e.event_type, e.url, e.created_at)

db.close()
