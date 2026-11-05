import os
import sys

sys.path.insert(0, '/var/www/thirdeye/apps/api')
os.chdir('/var/www/thirdeye/apps/api')

from app.database import SessionLocal
from app import models, intelligence

db = SessionLocal()

user_admin = db.query(models.User).filter(models.User.email == 'admin@thirdeye.io').first()
user_selfup = db.query(models.User).filter(models.User.email == 'akash@colladome.com').first()
user_softec = db.query(models.User).filter(models.User.email == 'softecai.com@gmail.com').first()

print("--- Testing list_network_requests ---")

res_selfup = intelligence.list_network_requests(limit=100, project_id=None, db=db, current_user=user_selfup)
print("\n[USER: akash@colladome.com (SelfUp)]")
print("KPIs:", res_selfup.get("kpis"))
print("Top Endpoints count:", len(res_selfup.get("endpoints", [])))
for ep in res_selfup.get("endpoints", []):
    print("  ", ep)

res_selfup_p2 = intelligence.list_network_requests(limit=100, project_id=2, db=db, current_user=user_selfup)
print("\n[USER: akash@colladome.com with project_id=2]")
print("KPIs:", res_selfup_p2.get("kpis"))
print("Top Endpoints count:", len(res_selfup_p2.get("endpoints", [])))
for ep in res_selfup_p2.get("endpoints", []):
    print("  ", ep)

res_softec = intelligence.list_network_requests(limit=100, project_id=None, db=db, current_user=user_softec)
print("\n[USER: softecai.com@gmail.com (Softec)]")
print("KPIs:", res_softec.get("kpis"))
print("Top Endpoints count:", len(res_softec.get("endpoints", [])))
for ep in res_softec.get("endpoints", []):
    print("  ", ep)

res_admin = intelligence.list_network_requests(limit=100, project_id=None, db=db, current_user=user_admin)
print("\n[USER: admin@thirdeye.io (Admin)]")
print("KPIs:", res_admin.get("kpis"))
print("Top Endpoints count:", len(res_admin.get("endpoints", [])))
for ep in res_admin.get("endpoints", []):
    print("  ", ep)

db.close()
