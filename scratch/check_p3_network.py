import os
import sys

sys.path.insert(0, '/var/www/thirdeye/apps/api')
os.chdir('/var/www/thirdeye/apps/api')

from app.database import SessionLocal
from app import models
from sqlalchemy import func

db = SessionLocal()

print("--- PROJECT 3 (SoftecAI) NETWORK REQUESTS ---")
p3_rows = db.query(
    models.NetworkRequest.endpoint_url,
    models.NetworkRequest.status_code,
    models.NetworkRequest.duration_ms,
    models.NetworkRequest.created_at
).filter(models.NetworkRequest.project_id == 3).all()

print(f"Total rows for Project 3: {len(p3_rows)}")
p3_eps = db.query(
    models.NetworkRequest.endpoint_url,
    func.count(models.NetworkRequest.id),
    func.avg(models.NetworkRequest.duration_ms),
    func.sum(models.NetworkRequest.status_code)
).filter(models.NetworkRequest.project_id == 3).group_by(models.NetworkRequest.endpoint_url).all()

for ep, cnt, avg_dur, sum_st in p3_eps:
    print(f"P3: {ep} -> count: {cnt}, avg_duration: {avg_dur}")

print("\n--- SAMPLE 10 ROWS FOR PROJECT 3 ---")
for r in p3_rows[:10]:
    print(r)

print("\n--- WHAT ABOUT PROJECT 2 (SelfUp)? ---")
p2_sample = db.query(
    models.NetworkRequest.endpoint_url,
    func.count(models.NetworkRequest.id)
).filter(models.NetworkRequest.project_id == 2, models.NetworkRequest.endpoint_url.like('%calculate-project-cost%')).group_by(models.NetworkRequest.endpoint_url).all()
print("P2 calculate-project-cost:", p2_sample)

p3_sample = db.query(
    models.NetworkRequest.endpoint_url,
    func.count(models.NetworkRequest.id)
).filter(models.NetworkRequest.project_id == 3, models.NetworkRequest.endpoint_url.like('%calculate-project-cost%')).group_by(models.NetworkRequest.endpoint_url).all()
print("P3 calculate-project-cost:", p3_sample)

db.close()
