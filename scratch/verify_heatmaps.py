import os
import sys
os.chdir('/var/www/thirdeye/apps/api')
sys.path.append('/var/www/thirdeye/apps/api')

import urllib.request
import json
from app import auth, models
from app.database import SessionLocal

db = SessionLocal()
user = db.query(models.User).filter(models.User.email == 'akash@colladome.com').first()
token = auth.create_access_token(data={"sub": user.email, "id": user.id})
db.close()

headers = {'Authorization': f'Bearer {token}'}

# 1. Heatmaps API Test
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/analytics/heatmaps', headers=headers)
with urllib.request.urlopen(req) as resp:
    print("Heatmaps API Status:", resp.status)
    data = json.loads(resp.read().decode('utf-8'))
    print("Total Points:", len(data.get('points', [])))
    print("Total Clicks Count:", data.get('total_clicks'))
    print("Device Breakdown:", data.get('device_breakdown'))
    print("Frustration Summary:", data.get('frustration_summary'))
    print("Overall Scroll Depth Stats:", data.get('scroll_depth_stats'))
    urls = data.get('urls', [])
    print(f"Discovered URLs ({len(urls)}):", urls[:3])
    
    by_url = data.get('scroll_depth_by_url', {})
    for u in list(by_url.keys())[:2]:
        print(f"Scroll depth for {u}:", by_url[u])

    pts = data.get('points', [])
    rage_pts = [p for p in pts if p.get('is_rage')]
    dead_pts = [p for p in pts if p.get('is_dead')]
    print(f"Points with is_rage: {len(rage_pts)}, is_dead: {len(dead_pts)}")
    if rage_pts:
        print("Sample rage point:", rage_pts[0])

# 2. CSV Export Test
csv_req = urllib.request.Request('http://127.0.0.1:8000/api/v1/analytics/heatmaps/export/csv', headers=headers)
with urllib.request.urlopen(csv_req) as resp:
    print("CSV Export Status:", resp.status)
    csv_text = resp.read().decode('utf-8')
    print("CSV Length:", len(csv_text))
    print("CSV First 3 lines:\n", "\n".join(csv_text.splitlines()[:3]))
