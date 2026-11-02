import os
import sys
import json
import urllib.request
import urllib.error

# Ensure api directory is in python path
sys.path.insert(0, '/var/www/thirdeye/apps/api')
os.chdir('/var/www/thirdeye/apps/api')

from app import auth, models
from app.database import SessionLocal

BASE_URL = "http://127.0.0.1:8000"
PUBLIC_URL = "https://thirdeye.colladome.com"

def run_tests():
    print(f"[*] Testing CyberGuard Enterprise Security Suite against {BASE_URL}...")
    
    # 1. Generate Auth Token
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == 'akash@colladome.com').first()
    if not user:
        user = db.query(models.User).first()
    
    if not user:
        print("[!] No user found in database!")
        db.close()
        return False
        
    token = auth.create_access_token(data={"sub": user.email, "id": user.id})
    db.close()
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    print(f"[+] Token generated for user: {user.email}")

    # 2. Test Security Suite Endpoints
    endpoints = [
        ("/api/v1/secureeye/threats?project_id=2", "Live WAF Threat Events & KPIs"),
        ("/api/v1/secureeye/threats/blocked-ips?project_id=2", "Blocked IP Blacklist"),
        ("/api/v1/secureeye/secrets/scan?project_id=2", "Secret Leak Shield (DLP) Scan"),
        ("/api/v1/secureeye/api-security/endpoints?project_id=2", "API Security & Shadow Endpoints"),
        ("/api/v1/secureeye/compliance/status?project_id=2", "Compliance Readiness Audits"),
        ("/api/v1/secureeye/badge/selfupcommunity.com", "Dynamic SVG Trust Badge")
    ]

    all_passed = True
    for path, desc in endpoints:
        url = f"{BASE_URL}{path}"
        req_headers = headers if "badge" not in path else {}
        req = urllib.request.Request(url, headers=req_headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                ctype = resp.headers.get("Content-Type", "")
                print(f" [PASS] {desc}: HTTP {resp.status} OK (Content-Type: {ctype})")
        except urllib.error.HTTPError as e:
            print(f" [FAIL] {desc}: HTTP {e.code}")
            all_passed = False
        except Exception as e:
            print(f" [FAIL] {desc}: {e}")
            all_passed = False

    # 3. Test IP blocking and unblocking
    try:
        block_url = f"{BASE_URL}/api/v1/secureeye/threats/block-ip"
        block_payload = json.dumps({
            "project_id": 2,
            "ip_address": "198.51.100.99",
            "reason": "Automated verification test probe"
        }).encode("utf-8")
        
        req = urllib.request.Request(block_url, data=block_payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            b_data = json.loads(resp.read().decode("utf-8"))
            blocked_id = b_data.get("id")
            ip_str = b_data.get("ip_address")
            print(f" [PASS] 1-Click IP Block: Successfully blocked {ip_str} (Rule ID: {blocked_id})")

        # Now unblock
        if blocked_id:
            del_url = f"{BASE_URL}/api/v1/secureeye/threats/blocked-ips/{blocked_id}?project_id=2"
            del_req = urllib.request.Request(del_url, headers=headers, method="DELETE")
            with urllib.request.urlopen(del_req, timeout=10) as d_resp:
                print(f" [PASS] IP Unblock: Successfully deleted rule ID {blocked_id} (HTTP {d_resp.status})")
    except Exception as e:
        print(f" [FAIL] Block/Unblock exception: {e}")
        all_passed = False

    # 4. Verify Frontend HTTP Routes via PUBLIC_URL
    fe_routes = [
        "/security",
        "/security/threats",
        "/security/secrets",
        "/security/api-security",
        "/security/compliance"
    ]
    for route in fe_routes:
        fe_url = f"{PUBLIC_URL}{route}"
        req = urllib.request.Request(fe_url)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                print(f" [PASS] Web Route {route}: HTTP {resp.status} OK")
        except urllib.error.HTTPError as e:
            print(f" [FAIL] Web Route {route}: HTTP {e.code}")
            all_passed = False
        except Exception as e:
            print(f" [FAIL] Web Route {route}: {e}")
            all_passed = False

    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
