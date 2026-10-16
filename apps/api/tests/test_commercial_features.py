#!/usr/bin/env python3
import os
import sys
import uuid
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

TEST_FILE = Path(__file__).resolve()
TESTS_DIR = TEST_FILE.parent
API_DIR = TESTS_DIR.parent

os.chdir(str(API_DIR))
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def register_tenant(c: TestClient, domain: str = "example.com", name: str = "Client"):
    uid = uuid.uuid4().hex[:8]
    clean_domain = domain.replace("https://", "").replace("http://", "").strip("/")
    email = f"tenant_{uid}@{clean_domain}"
    password = f"SecurePass_{uid}!9"
    org_name = f"Org_{uid}_{clean_domain.split('.')[0].capitalize()}"

    reg_payload = {
        "email": email,
        "password": password,
        "name": f"{name} {uid}",
        "domain": clean_domain,
        "organization_name": org_name,
    }

    reg_resp = c.post("/api/auth/register", json=reg_payload)
    assert reg_resp.status_code == 200, f"Tenant registration failed: {reg_resp.text}"
    data = reg_resp.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    proj_resp = c.get("/api/v1/projects/status", headers=headers)
    assert proj_resp.status_code == 200, f"Status failed: {proj_resp.text}"
    pdata = proj_resp.json()
    return token, pdata["project_id"], pdata["api_key"], clean_domain

def test_01_billing_usage_metrics(client):
    token, proj_id, api_key, domain = register_tenant(client, "billingtest.com", "BillingClient")
    headers = {"Authorization": f"Bearer {token}"}

    # Ingest 3 events
    for i in range(3):
        resp = client.post("/api/v1/collect", json={
            "api_key": api_key,
            "session_id": f"sess_bill_{i}",
            "event_type": "pageview",
            "url": f"https://{domain}/page-{i}",
            "properties": {"step": i}
        })
        assert resp.status_code == 200

    # Query billing usage
    usage_resp = client.get("/api/v1/billing/usage", headers=headers)
    assert usage_resp.status_code == 200
    billing = usage_resp.json()

    assert "plan" in billing
    assert billing["plan"] in ["Growth Pro", "Pro"]
    assert "usage" in billing
    assert billing["usage"]["events_limit"] >= 100000
    assert billing["usage"]["events_used"] >= 3
    assert "events_pct" in billing["usage"]
    assert "recordings_pct" in billing["usage"]
    assert billing["billing_cycle"] == "Monthly"
    assert "next_billing_date" in billing

def test_02_billing_upgrade_flow(client):
    token, proj_id, api_key, domain = register_tenant(client, "upgradetest.com", "UpgradeClient")
    headers = {"Authorization": f"Bearer {token}"}

    # Upgrade to Enterprise
    up_resp = client.post("/api/v1/billing/upgrade", headers=headers, json={"plan": "Enterprise"})
    assert up_resp.status_code == 200
    up_data = up_resp.json()
    assert up_data["status"] == "upgraded"
    assert up_data["plan"] == "Enterprise"
    assert up_data["monthly_event_limit"] == 1000000

    # Verify usage reflects updated plan
    usage_resp = client.get("/api/v1/billing/usage", headers=headers)
    assert usage_resp.status_code == 200
    billing = usage_resp.json()
    assert billing["plan"] == "Enterprise"
    assert billing["usage"]["events_limit"] == 1000000

def test_03_error_status_toggle_and_isolation(client):
    token_a, proj_a, key_a, domain_a = register_tenant(client, "error-a.com", "ErrorA")
    token_b, proj_b, key_b, domain_b = register_tenant(client, "error-b.com", "ErrorB")

    session_id = f"sess_err_{uuid.uuid4().hex[:8]}"

    # Tenant A logs code error
    err_resp = client.post("/api/v1/collect", json={
        "api_key": key_a,
        "session_id": session_id,
        "event_type": "code_error",
        "url": f"https://{domain_a}/pricing",
        "properties": {
            "message": "TypeError: Cannot read properties of undefined (reading 'tier')",
            "filename": "pricing.js",
            "lineno": 42,
            "colno": 15
        }
    })
    assert err_resp.status_code == 200

    # Tenant A fetches errors
    diag_resp = client.get("/api/v1/analytics/errors", headers={"Authorization": f"Bearer {token_a}"})
    assert diag_resp.status_code == 200
    diag_data = diag_resp.json()
    code_errors = diag_data["code_errors"]
    assert len(code_errors) > 0

    target_err = next((e for e in code_errors if "reading 'tier'" in e["message"]), None)
    assert target_err is not None
    err_id = target_err["id"]
    assert target_err["status"] == "open"
    assert target_err["session_id"] == session_id

    # Tenant B attempts to toggle Tenant A's error -> 403 Forbidden / 404 Not Found (strict isolation)
    hack_resp = client.patch(f"/api/v1/errors/{err_id}/status", headers={"Authorization": f"Bearer {token_b}"}, json={"status": "resolved"})
    assert hack_resp.status_code in [403, 404]

    # Tenant A marks error resolved -> 200
    resolve_resp = client.patch(f"/api/v1/errors/{err_id}/status", headers={"Authorization": f"Bearer {token_a}"}, json={"status": "resolved"})
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "resolved"

    # Tenant A re-checks errors
    diag_after = client.get("/api/v1/analytics/errors", headers={"Authorization": f"Bearer {token_a}"})
    updated_err = next(e for e in diag_after.json()["code_errors"] if e["id"] == err_id)
    assert updated_err["status"] == "resolved"

def test_04_offline_html_replay_export_and_isolation(client):
    token_a, proj_a, key_a, domain_a = register_tenant(client, "replay-export.com", "ExportClient")
    token_b, proj_b, key_b, domain_b = register_tenant(client, "attacker-export.com", "AttackerClient")

    sess_id = f"sess_export_{uuid.uuid4().hex[:8]}"

    # Tenant A records a session
    client.post("/api/v1/collect", json={
        "api_key": key_a,
        "session_id": sess_id,
        "event_type": "pageview",
        "url": f"https://{domain_a}/landing",
        "properties": {}
    })

    rec_resp = client.post("/api/v1/recordings", json={
        "api_key": key_a,
        "session_id": sess_id,
        "duration": 18,
        "events": [
            {"type": 2, "timestamp": 1000, "data": {"node": {"tag": "html"}}},
            {"type": 3, "timestamp": 18000, "data": {"source": 1}}
        ]
    })
    assert rec_resp.status_code == 200

    # Tenant A exports offline HTML
    export_resp = client.get(f"/api/v1/recordings/{sess_id}/export/html", headers={"Authorization": f"Bearer {token_a}"})
    assert export_resp.status_code == 200
    assert "text/html" in export_resp.headers.get("content-type", "")
    html_content = export_resp.text
    assert "<!DOCTYPE html>" in html_content
    assert "rrwebPlayer" in html_content
    assert sess_id in html_content
    assert "events = [" in html_content

    # Tenant B tries to export Tenant A's replay -> 403/404 isolation
    cross_resp = client.get(f"/api/v1/recordings/{sess_id}/export/html", headers={"Authorization": f"Bearer {token_b}"})
    assert cross_resp.status_code in [403, 404]
