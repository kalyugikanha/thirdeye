#!/usr/bin/env python3
"""End-to-end hardening tests for ThirdEye platform.

Verifies:
1. New tenant registration & zero cross-tenant recording leakage
2. Active project_id scoping for recordings
3. Accurate duration calculation (no 2-hour ghost duration)
4. UTC timezone ISO format with 'Z' suffix (no 5h ago offset)
5. Replay payload integrity and decompression
6. Isolation between distinct tenants
"""
import os
import sys
import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

TEST_FILE = Path(__file__).resolve()
API_DIR = TEST_FILE.parent.parent

os.chdir(str(API_DIR))
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def register_tenant(c: TestClient, domain: str = "example.com"):
    uid = uuid.uuid4().hex[:8]
    clean = domain.replace("https://", "").replace("http://", "").strip("/")
    resp = c.post("/api/auth/register", json={
        "email": f"client_{uid}@{clean}",
        "password": f"Pass_{uid}!99",
        "name": f"Tester {uid}",
        "domain": clean,
        "organization_name": f"Org_{uid}",
    })
    assert resp.status_code == 200, resp.text
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    p = c.get("/api/v1/projects/status", headers=headers).json()
    return headers, p["project_id"], p["api_key"], clean


def test_01_new_tenant_has_zero_recordings_and_no_static_seed(client):
    headers, pid, api_key, domain = register_tenant(client, "fresh-onboarding.com")

    # Brand new tenant must see exactly 0 recordings (NO static 2n69l5dt3kd seed!)
    rec_res = client.get("/api/v1/recordings", headers=headers)
    assert rec_res.status_code == 200
    recs = rec_res.json()
    assert recs == [], f"Expected empty recordings for new tenant, got: {recs}"


def test_02_simulation_creates_accurate_duration_and_utc_timestamp(client):
    headers, pid, api_key, domain = register_tenant(client, "my-business-app.com")

    # Simulate realistic session for this tenant
    sim_res = client.post("/api/v1/recordings/simulate", headers=headers)
    assert sim_res.status_code == 200

    # Fetch recordings
    recs = client.get(f"/api/v1/recordings?project_id={pid}", headers=headers).json()
    assert len(recs) == 1
    rec = recs[0]

    # Duration must be 18 seconds (NOT 2 hours / 7200s!)
    assert rec["duration"] == 18, f"Expected 18s duration, got {rec['duration']}"

    # created_at must have 'Z' UTC suffix so Indian browsers (UTC+5:30) don't say 5h ago!
    assert rec["created_at"] is not None
    assert rec["created_at"].endswith("Z"), f"Expected UTC 'Z' suffix, got {rec['created_at']}"
    assert rec["project_id"] == pid

    # Verify replay payload can be fetched and decompressed
    sess_id = rec["session_id"]
    replay_res = client.get(f"/api/v1/recordings/{sess_id}/replay", headers=headers)
    assert replay_res.status_code == 200
    events = replay_res.json()
    assert isinstance(events, list) and len(events) > 0


def test_03_te_js_recording_ingestion_and_duration_bounding(client):
    headers, pid, api_key, domain = register_tenant(client, "storefront-client.com")

    sess_id = f"test_sess_{uuid.uuid4().hex[:6]}"
    now_ms = 1700000000000

    # Ingest a 25-second session batch
    payload = {
        "session_id": sess_id,
        "api_key": api_key,
        "duration": 25,
        "url": f"https://{domain}/checkout",
        "referrer": "https://google.com",
        "meta": {"browser": "Chrome", "os": "Windows"},
        "events": [
            {"type": 4, "data": {"href": f"https://{domain}/checkout"}, "timestamp": now_ms},
            {"type": 3, "data": {"source": 1}, "timestamp": now_ms + 25000}
        ]
    }
    ingest_res = client.post("/api/v1/recordings", json=payload)
    assert ingest_res.status_code == 200

    # Query recordings for this project
    recs = client.get(f"/api/v1/recordings?project_id={pid}", headers=headers).json()
    found = next((r for r in recs if r["session_id"] == sess_id), None)
    assert found is not None
    assert found["duration"] == 25
    assert found["created_at"].endswith("Z")


def test_04_cross_tenant_isolation_under_direct_and_unfiltered_queries(client):
    ha, pa, ka, da = register_tenant(client, "alpha-company.com")
    hb, pb, kb, db_ = register_tenant(client, "beta-company.com")

    # Alpha simulates a recording
    client.post("/api/v1/recordings/simulate", headers=ha)
    recs_a = client.get(f"/api/v1/recordings?project_id={pa}", headers=ha).json()
    assert len(recs_a) == 1

    # Beta queries recordings: must be empty
    recs_b_scoped = client.get(f"/api/v1/recordings?project_id={pb}", headers=hb).json()
    assert len(recs_b_scoped) == 0

    # Beta attempts to query Alpha's project_id: must return 403 Forbidden
    forbidden_res = client.get(f"/api/v1/recordings?project_id={pa}", headers=hb)
    assert forbidden_res.status_code == 403

    # Beta attempts to replay Alpha's session: must return 403 Forbidden
    alpha_sess = recs_a[0]["session_id"]
    forbidden_replay = client.get(f"/api/v1/recordings/{alpha_sess}/replay", headers=hb)
    assert forbidden_replay.status_code == 403
