import sys
import requests

BASE_URL = "https://thirdeye.colladome.com"
LOGIN_URL = f"{BASE_URL}/api/v1/auth/login"

def run_tests():
    print(f"[*] Testing CyberGuard Enterprise Security Suite against {BASE_URL}...")
    
    # 1. Login
    login_payload = {
        "email": "akash@colladome.com",
        "password": "Password123!"
    }
    
    try:
        res = requests.post(LOGIN_URL, json=login_payload, timeout=10)
        if res.status_code != 200:
            print(f"[!] Login failed: {res.status_code} {res.text}")
            return False
        token = res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        print("[+] Logged in successfully. Token acquired.")
    except Exception as e:
        print(f"[!] Exception during login: {e}")
        return False

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
        try:
            req_headers = headers if "badge" not in path else {}
            r = requests.get(url, headers=req_headers, timeout=10)
            if r.status_code == 200:
                print(f" [PASS] {desc}: HTTP 200 OK (Content-Type: {r.headers.get('Content-Type')})")
            else:
                print(f" [FAIL] {desc}: HTTP {r.status_code} - {r.text[:120]}")
                all_passed = False
        except Exception as e:
            print(f" [FAIL] {desc}: Exception {e}")
            all_passed = False

    # Test IP blocking and unblocking
    try:
        block_url = f"{BASE_URL}/api/v1/secureeye/threats/block-ip"
        block_payload = {
            "project_id": 2,
            "ip_address": "198.51.100.99",
            "reason": "Automated verification test probe"
        }
        b_res = requests.post(block_url, json=block_payload, headers=headers, timeout=10)
        if b_res.status_code == 200:
            blocked_obj = b_res.json().get("blocked", {})
            blocked_id = blocked_obj.get("id")
            print(f" [PASS] 1-Click IP Block: Successfully blocked {blocked_obj.get('ip_address')} (ID: {blocked_id})")
            
            # Now unblock
            if blocked_id:
                del_url = f"{BASE_URL}/api/v1/secureeye/threats/blocked-ips/{blocked_id}?project_id=2"
                d_res = requests.delete(del_url, headers=headers, timeout=10)
                if d_res.status_code == 200:
                    print(f" [PASS] IP Unblock: Successfully removed rule ID {blocked_id}")
                else:
                    print(f" [WARN] IP Unblock failed: HTTP {d_res.status_code}")
        else:
            print(f" [FAIL] 1-Click IP Block failed: HTTP {b_res.status_code} - {b_res.text[:120]}")
            all_passed = False
    except Exception as e:
        print(f" [FAIL] Block/Unblock exception: {e}")
        all_passed = False

    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
