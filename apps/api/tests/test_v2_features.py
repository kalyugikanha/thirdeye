#!/usr/bin/env python3
import os
import sys
import uuid
import json
import csv
import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

TEST_FILE = Path(__file__).resolve()
TESTS_DIR = TEST_FILE.parent
API_DIR = TESTS_DIR.parent
ROOT_DIR = API_DIR.parent.parent

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

def test_01_replay_timeline_and_friction_markers(client):
    token, proj_id, api_key, domain = register_tenant(client, "timelinetest.com", "TimelineClient")
    session_id = f"sess_time_{uuid.uuid4().hex[:8]}"

    # Ingest pageview
    resp = client.post("/api/v1/collect", json={
        "api_key": api_key,
        "session_id": session_id,
        "event_type": "pageview",
        "url": f"https://{domain}/checkout",
        "properties": {"browser": "Chrome", "os": "macOS"}
    })
    assert resp.status_code == 200

    # Ingest rage click
    resp = client.post("/api/v1/collect", json={
        "api_key": api_key,
        "session_id": session_id,
        "event_type": "rage_click",
        "url": f"https://{domain}/checkout",
        "properties": {"clicks": 4, "tag": "button", "text": "Pay Now"}
    })
    assert resp.status_code == 200

    # Ingest code error
    resp = client.post("/api/v1/collect", json={
        "api_key": api_key,
        "session_id": session_id,
        "event_type": "code_error",
        "url": f"https://{domain}/checkout",
        "properties": {"message": "Network timeout on payment gateway"}
    })
    assert resp.status_code == 200

    # Save session recording
    rec_resp = client.post("/api/v1/recordings", json={
        "api_key": api_key,
        "session_id": session_id,
        "duration": 22,
        "events": [{"type": 2, "timestamp": 1000}, {"type": 3, "timestamp": 23000}]
    })
    assert rec_resp.status_code == 200

    # Fetch timeline
    tl_resp = client.get(f"/api/v1/recordings/{session_id}/timeline", headers={"Authorization": f"Bearer {token}"})
    assert tl_resp.status_code == 200
    tl_data = tl_resp.json()
    assert tl_data["session_id"] == session_id
    timeline = tl_data["timeline"]
    assert len(timeline) >= 3

    event_types = [item["event_type"] for item in timeline]
    assert "pageview" in event_types
    assert "rage_click" in event_types
    assert "code_error" in event_types

    rage_item = next(item for item in timeline if item["event_type"] == "rage_click")
    assert rage_item["severity"] == "warning"
    assert "Rage Click" in rage_item["label"]

def test_02_ai_diagnose_session_friction_calculation(client):
    token, proj_id, api_key, domain = register_tenant(client, "aidiagtest.io", "AiClient")
    session_id = f"sess_ai_{uuid.uuid4().hex[:8]}"

    client.post("/api/v1/collect", json={
        "api_key": api_key,
        "session_id": session_id,
        "event_type": "pageview",
        "url": f"https://{domain}/signup",
        "properties": {"browser": "Firefox", "os": "Windows"}
    })
    client.post("/api/v1/collect", json={
        "api_key": api_key,
        "session_id": session_id,
        "event_type": "rage_click",
        "url": f"https://{domain}/signup",
        "properties": {"clicks": 3, "tag": "button", "text": "Submit"}
    })
    client.post("/api/v1/collect", json={
        "api_key": api_key,
        "session_id": session_id,
        "event_type": "code_error",
        "url": f"https://{domain}/signup",
        "properties": {"message": "Uncaught SyntaxError"}
    })

    client.post("/api/v1/recordings", json={
        "api_key": api_key,
        "session_id": session_id,
        "duration": 15,
        "events": [{"type": 2, "timestamp": 1000}, {"type": 3, "timestamp": 16000}]
    })

    ai_resp = client.post(f"/api/v1/recordings/{session_id}/ai-diagnose", headers={"Authorization": f"Bearer {token}"})
    assert ai_resp.status_code == 200
    ai_data = ai_resp.json()

    assert ai_data["friction_score"] >= 60
    assert ai_data["friction_level"] == "Critical Friction"
    assert len(ai_data["friction_points"]) >= 2
    assert len(ai_data["developer_recommendation"]) > 10

def test_03_ai_diagnose_cross_tenant_isolation_forbidden(client):
    token_a, _, api_key_a, _ = register_tenant(client, "tenant-a.com", "TenantA")
    token_b, _, _, _ = register_tenant(client, "tenant-b.com", "TenantB")

    session_id = f"sess_iso_{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/recordings", json={
        "api_key": api_key_a,
        "session_id": session_id,
        "duration": 10,
        "events": [{"type": 2, "timestamp": 1000}]
    })

    probe_resp = client.post(f"/api/v1/recordings/{session_id}/ai-diagnose", headers={"Authorization": f"Bearer {token_b}"})
    assert probe_resp.status_code == 403, f"Expected 403 Forbidden, got {probe_resp.status_code}"

def test_04_live_heartbeat_and_visitor_pruning(client):
    token, proj_id, api_key, domain = register_tenant(client, "livetest.org", "LiveClient")
    session_id = f"sess_live_{uuid.uuid4().hex[:8]}"

    hb_resp = client.post("/api/v1/live/heartbeat", json={
        "api_key": api_key,
        "session_id": session_id,
        "current_url": f"https://{domain}/dashboard",
        "referrer": "https://google.com/",
        "properties": {"browser": "Edge", "os": "Windows", "device": "Desktop"}
    })
    assert hb_resp.status_code == 200
    assert hb_resp.json()["status"] == "alive"

    visitors_resp = client.get("/api/v1/live/visitors", headers={"Authorization": f"Bearer {token}"})
    assert visitors_resp.status_code == 200
    v_data = visitors_resp.json()
    assert v_data["active_count"] >= 1
    active_session_ids = [v["session_id"] for v in v_data["visitors"]]
    assert session_id in active_session_ids

def test_05_csv_export_format_and_headers(client):
    token, _, _, _ = register_tenant(client, "csvtest.io", "CsvClient")

    resp = client.get("/api/v1/analytics/export/csv?data_type=sessions", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "attachment; filename=" in resp.headers["content-disposition"]
    csv_text = resp.text
    reader = csv.reader(io.StringIO(csv_text))
    headers = next(reader)
    assert "Session ID" in headers
    assert "Duration (sec)" in headers

    resp_ev = client.get("/api/v1/analytics/export/csv?data_type=events", headers={"Authorization": f"Bearer {token}"})
    assert resp_ev.status_code == 200
    reader_ev = csv.reader(io.StringIO(resp_ev.text))
    headers_ev = next(reader_ev)
    assert "Event Type" in headers_ev
    assert "Session ID" in headers_ev
