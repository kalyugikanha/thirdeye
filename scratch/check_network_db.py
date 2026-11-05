import os
import sys

sys.path.insert(0, '/var/www/thirdeye/apps/api')
os.chdir('/var/www/thirdeye/apps/api')

from app.database import SessionLocal
from app import models
from sqlalchemy import func

db = SessionLocal()

print("--- PROJECTS ---")
for p in db.query(models.Project).all():
    print(f"Project ID: {p.id}, Org ID: {p.organization_id}, Domain: {p.domain}, Name: {p.name}")

print("\n--- USERS ---")
for u in db.query(models.User).all():
    print(f"User ID: {u.id}, Org ID: {u.organization_id}, Email: {u.email}, Role: {u.role}")

print("\n--- NETWORK REQUESTS COUNT BY PROJECT ---")
res = db.query(models.NetworkRequest.project_id, func.count(models.NetworkRequest.id)).group_by(models.NetworkRequest.project_id).all()
for pid, cnt in res:
    print(f"Project ID: {pid} -> Total requests: {cnt}")

print("\n--- NETWORK REQUESTS BREAKDOWN BY ENDPOINT ---")
ep_res = db.query(
    models.NetworkRequest.project_id,
    models.NetworkRequest.endpoint_url,
    func.count(models.NetworkRequest.id),
    func.avg(models.NetworkRequest.duration_ms)
).group_by(models.NetworkRequest.project_id, models.NetworkRequest.endpoint_url).all()
for pid, ep, cnt, avg_dur in ep_res:
    print(f"Project {pid} | {ep} | Count: {cnt} | Avg Latency: {avg_dur}")

db.close()
