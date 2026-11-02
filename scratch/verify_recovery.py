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

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

print("=== 1. Testing GET /api/v1/analytics/recovery/abandoned-sessions ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/analytics/recovery/abandoned-sessions?project_id=2', headers=headers)
with urllib.request.urlopen(req) as resp:
    print("Status:", resp.status)
    data = json.loads(resp.read().decode('utf-8'))
    print("Total Abandoned:", data.get('total_abandoned'))
    print("Potential Value at Risk:", data.get('potential_value_at_risk'))
    sessions = data.get('sessions', [])
    print(f"Sample Abandoned Sessions ({len(sessions)}):")
    for s in sessions[:3]:
        print(" - SID:", s['session_id'], "URL:", s['url'], "Last Field:", s['last_field'], "Replay:", s['has_replay'], "Tags:", s['friction_tags'])

print("\n=== 2. Testing POST /api/v1/analytics/recovery/config ===")
cfg_payload = json.dumps({
    'project_id': 2,
    'webhook_url': 'https://webhook.site/thirdeye-recovery-test',
    'secret_token': 'sk_live_recovery_secret_123',
    'is_active': True,
    'trigger_on': 'all_abandoned',
    'min_hesitation_sec': 20
}).encode('utf-8')
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/analytics/recovery/config', data=cfg_payload, headers=headers, method='POST')
with urllib.request.urlopen(req) as resp:
    print("Config Save Status:", resp.status)
    print("Response:", json.loads(resp.read().decode('utf-8')))

print("\n=== 3. Testing POST /api/v1/analytics/recovery/test ===")
test_payload = json.dumps({
    'project_id': 2,
    'webhook_url': 'https://httpbin.org/post'
}).encode('utf-8')
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/analytics/recovery/test', data=test_payload, headers=headers, method='POST')
with urllib.request.urlopen(req) as resp:
    print("Test Dispatch Status:", resp.status)
    t_res = json.loads(resp.read().decode('utf-8'))
    print("Delivery Status:", t_res.get('status'), "Code:", t_res.get('response_code'), "Message:", t_res.get('message'))
    print("Payload Sample:", t_res.get('test_payload'))

print("\n=== 4. Testing GET /api/v1/analytics/recovery/logs ===")
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/analytics/recovery/logs?project_id=2', headers=headers)
with urllib.request.urlopen(req) as resp:
    print("Logs Status:", resp.status)
    logs_data = json.loads(resp.read().decode('utf-8'))
    print(f"Total Logs: {len(logs_data.get('logs', []))}")
    for l in logs_data.get('logs', [])[:2]:
        print(" - Log:", l)

print("\n=== 5. Testing Frontend Route ===")
fe_req = urllib.request.Request('http://127.0.0.1:3000/analytics/forms')
with urllib.request.urlopen(fe_req) as resp:
    print("Frontend /analytics/forms Status:", resp.status)
