#!/usr/bin/env python3
"""
Adversarial Multi-Tenant Data Isolation Test Suite
===================================================
Challenger: Challenger 1 (Milestone 1)
Authority: ORIGINAL_REQUEST.md (2026-10-15 Multi-Tenant Production Hardening)

Target Endpoints Under Adversarial Stress:
1. GET /api/v1/recordings & GET /api/v1/recordings/{session_id}/replay:
   - Token forging, signature tampering, algorithm none attacks, missing claims, expired tokens.
2. POST /api/v1/collect, /track, /recordings, /apm/report:
   - Malformed, empty, whitespace, null-byte, SQL-injected, and cross-tenant API keys.
   - Verification that HTTP 401 is strictly returned and Project 1 is never corrupted.
3. Cross-Tenant Replay Access Across Different User Roles:
   - USER, ADMIN (org-level), MEMBER, unauthenticated, and SUPERADMIN roles.
"""

import os
import sys
import uuid
import json
import gzip
import time
from pathlib import Path
from typing import Dict, Any, List

import pytest
from jose import jwt

# Bootstrap test paths
CURRENT_FILE = Path(__file__).resolve()
TESTS_DIR = CURRENT_FILE.parent
API_DIR = TESTS_DIR.parent
ROOT_DIR = API_DIR.parent.parent

os.chdir(str(API_DIR))
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app import models, database, auth

FAKE_SECRET = "wrong_adversarial_secret_key_123456789"
REAL_SECRET = auth.SECRET_KEY
ALGORITHM = auth.ALGORITHM


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def register_user(c: TestClient, domain: str, role: str = "USER") -> Dict[str, Any]:
    uid = uuid.uuid4().hex[:8]
    clean_domain = domain.replace("https://", "").replace("http://", "").strip("/")
    email = f"{role.lower()}_{uid}@{clean_domain}"
    password = f"P@ssword_{uid}!23"

    resp = c.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "name": f"User {uid}",
        "domain": clean_domain,
        "organization_name": f"Org_{uid}_{clean_domain.split('.')[0].capitalize()}"
    })
    assert resp.status_code == 200, f"Registration failed: {resp.text}"
    data = resp.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    proj_resp = c.get("/api/projects", headers=headers)
    assert proj_resp.status_code == 200
    projects = proj_resp.json()
    assert len(projects) > 0
    proj = projects[0]

    # If role needs update in DB (e.g. ADMIN or MEMBER)
    if role != "USER":
        db = next(database.get_db())
        try:
            u = db.query(models.User).filter(models.User.email == email).first()
            if u:
                u.role = role
                db.commit()
        finally:
            db.close()

    return {
        "email": email,
        "password": password,
        "token": token,
        "headers": headers,
        "project_id": proj["id"],
        "api_key": proj["api_key"],
        "domain": clean_domain,
        "org_id": proj["organization_id"],
        "role": role
    }


def make_mock_events(domain: str, session_id: str) -> List[Dict[str, Any]]:
    ts = int(time.time() * 1000)
    return [
        {"type": 4, "data": {"href": f"https://{domain}/page1", "width": 1920, "height": 1080}, "timestamp": ts},
        {"type": 2, "data": {"node": {"id": 1, "type": 0, "childNodes": []}}, "timestamp": ts + 50},
        {"type": 3, "data": {"source": 1, "positions": [{"x": 100, "y": 150, "timeOffset": 100}]}, "timestamp": ts + 150}
    ]


# ===========================================================================
# GROUP 1: Token Forging and Token Manipulation
# ===========================================================================

def test_token_missing_header_returns_401(client: TestClient):
    """Calling recordings or replay without Authorization header must strictly return 401."""
    r1 = client.get("/api/v1/recordings")
    assert r1.status_code == 401, f"Expected 401, got {r1.status_code}: {r1.text}"

    r2 = client.get("/api/v1/recordings/nonexistent_session_id/replay")
    assert r2.status_code == 401, f"Expected 401, got {r2.status_code}: {r2.text}"


def test_token_empty_and_whitespace_bearer_returns_401(client: TestClient):
    """Calling with empty Bearer or malformed auth scheme returns 401."""
    headers_list = [
        {"Authorization": ""},
        {"Authorization": "Bearer "},
        {"Authorization": "Bearer    "},
        {"Authorization": "Token 12345"},
        {"Authorization": "Basic dXNlcjpwYXNz"},
    ]
    for h in headers_list:
        resp = client.get("/api/v1/recordings", headers=h)
        assert resp.status_code == 401, f"Expected 401 for header {h}, got {resp.status_code}"


def test_token_forged_secret_key_returns_401(client: TestClient):
    """JWT signed with an alien secret key must be rejected with 401."""
    forged_token = jwt.encode({"sub": "admin@thirdeye.io", "exp": int(time.time()) + 3600}, FAKE_SECRET, algorithm="HS256")
    resp = client.get("/api/v1/recordings", headers={"Authorization": f"Bearer {forged_token}"})
    assert resp.status_code == 401, f"Forged secret was accepted! Got {resp.status_code}: {resp.text}"


def test_token_alg_none_attack_returns_401(client: TestClient):
    """JWT utilizing 'alg': 'none' attack must be strictly rejected with 401."""
    # Construct an unverified alg: none token
    header = '{"alg":"none","typ":"JWT"}'
    import base64
    b64_header = base64.urlsafe_b64encode(header.encode()).decode().rstrip("=")
    payload = json.dumps({"sub": "admin@thirdeye.io", "exp": int(time.time()) + 3600})
    b64_payload = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    alg_none_token = f"{b64_header}.{b64_payload}."

    resp = client.get("/api/v1/recordings", headers={"Authorization": f"Bearer {alg_none_token}"})
    assert resp.status_code == 401, f"Algorithm 'none' attack succeeded! Got {resp.status_code}"


def test_token_expired_signature_returns_401(client: TestClient):
    """Token with expiration timestamp in the past must be rejected with 401."""
    expired_token = jwt.encode({"sub": "admin@thirdeye.io", "exp": int(time.time()) - 3600}, REAL_SECRET, algorithm=ALGORITHM)
    resp = client.get("/api/v1/recordings", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401, f"Expired token was accepted! Got {resp.status_code}"


def test_token_missing_sub_claim_returns_401(client: TestClient):
    """Token without 'sub' claim must fail authentication with 401."""
    bad_token = jwt.encode({"role": "SUPERADMIN", "exp": int(time.time()) + 3600}, REAL_SECRET, algorithm=ALGORITHM)
    resp = client.get("/api/v1/recordings", headers={"Authorization": f"Bearer {bad_token}"})
    assert resp.status_code == 401, f"Missing sub claim token was accepted! Got {resp.status_code}"


def test_token_nonexistent_user_returns_401(client: TestClient):
    """Token with valid signature but pointing to nonexistent user in DB returns 401."""
    ghost_token = jwt.encode({"sub": "ghost_nonexistent_user_999@thirdeye.io", "exp": int(time.time()) + 3600}, REAL_SECRET, algorithm=ALGORITHM)
    resp = client.get("/api/v1/recordings", headers={"Authorization": f"Bearer {ghost_token}"})
    assert resp.status_code == 401, f"Ghost user token was accepted! Got {resp.status_code}"


# ===========================================================================
# GROUP 2: Ingestion Resilience & Project 1 Corruption Prevention
# ===========================================================================

def test_ingest_collect_malformed_keys_return_401(client: TestClient):
    """POST /api/v1/collect with malformed, empty, SQLi keys strictly returns 401."""
    hostile_keys = [
        "",
        "   ",
        "\t\n",
        "te_live_forged_key_12345",
        "te_live_' OR 1=1 --",
        "te_live_admin'; DROP TABLE events; --",
        "\x00nullbyte_key",
    ]
    for key in hostile_keys:
        resp = client.post("/api/v1/collect", json={
            "api_key": key,
            "event_type": "exploit_probe",
            "url": "https://malicious.org/probe",
            "session_id": "sess_hostile_001"
        })
        assert resp.status_code == 401, f"Key '{key}' was not rejected with 401: got {resp.status_code}"


def test_ingest_track_alias_malformed_keys_return_401(client: TestClient):
    """POST /api/v1/track alias with missing or invalid api_key strictly returns 401."""
    resp1 = client.post("/api/v1/track", json={
        "api_key": "te_live_fake_track_key",
        "event_type": "pageview",
        "url": "https://attacker.org/",
        "session_id": "sess_track_01"
    })
    assert resp1.status_code == 401

    resp2 = client.post("/api/v1/track", json={
        "event_type": "pageview",
        "url": "https://attacker.org/",
        "session_id": "sess_track_02"
    })
    assert resp2.status_code == 401


def test_ingest_recordings_malformed_and_empty_keys_return_401(client: TestClient):
    """POST /api/v1/recordings with empty, missing, or fake api_key strictly returns 401."""
    probes = [
        {"session_id": "sess_p1", "api_key": "", "events": []},
        {"session_id": "sess_p2", "events": []},
        {"session_id": "sess_p3", "api_key": "   ", "events": []},
        {"session_id": "sess_p4", "api_key": "te_live_forged_rec_key", "events": []},
    ]
    for p in probes:
        resp = client.post("/api/v1/recordings", json=p)
        assert resp.status_code == 401, f"Recording probe was not rejected with 401: got {resp.status_code}"


def test_ingest_recordings_spoofed_project_id_with_invalid_key_returns_401(client: TestClient):
    """Attacker passing project_id=1 with forged key cannot write to Project 1."""
    resp = client.post("/api/v1/recordings", json={
        "session_id": f"sess_hijack_p1_{uuid.uuid4().hex[:6]}",
        "project_id": 1,
        "api_key": "te_live_unauthorized_key",
        "duration": 10,
        "events": [{"type": 4, "data": {}, "timestamp": 1000}]
    })
    assert resp.status_code == 401, f"Spoofed project_id with invalid key must return 401, got {resp.status_code}"


def test_ingest_apm_malformed_keys_return_401(client: TestClient):
    """POST /api/v1/apm/report with missing, whitespace, or invalid key returns 401."""
    apm_probes = [
        {"api_key": "", "endpoint": "/api/test", "duration_ms": 50},
        {"api_key": "   ", "endpoint": "/api/test", "duration_ms": 50},
        {"api_key": "te_live_fake_apm_key", "endpoint": "/api/test", "duration_ms": 50},
    ]
    for probe in apm_probes:
        resp = client.post("/api/v1/apm/report", json=probe)
        assert resp.status_code == 401, f"APM probe was not rejected with 401: got {resp.status_code}"


def test_project1_integrity_under_hostile_probes(client: TestClient):
    """Assert Project 1 events and recordings count remain completely uncorrupted after attacks."""
    db = next(database.get_db())
    try:
        p1 = db.query(models.Project).filter(models.Project.id == 1).first()
        if p1:
            initial_events = db.query(models.Event).filter(models.Event.project_id == 1).count()
            initial_recs = db.query(models.SessionRecording).filter(models.SessionRecording.project_id == 1).count()
            initial_apm = db.query(models.APMTrace).filter(models.APMTrace.project_id == 1).count()

            # Fire hostile probes
            client.post("/api/v1/collect", json={"api_key": "fake_key", "event_type": "pv", "url": "http://x", "session_id": "s1"})
            client.post("/api/v1/recordings", json={"api_key": "fake_key", "session_id": "s2", "events": []})
            client.post("/api/v1/apm/report", json={"api_key": "fake_key", "endpoint": "/test"})

            final_events = db.query(models.Event).filter(models.Event.project_id == 1).count()
            final_recs = db.query(models.SessionRecording).filter(models.SessionRecording.project_id == 1).count()
            final_apm = db.query(models.APMTrace).filter(models.APMTrace.project_id == 1).count()

            assert initial_events == final_events, "Project 1 events table corrupted by hostile probe!"
            assert initial_recs == final_recs, "Project 1 recordings table corrupted by hostile probe!"
            assert initial_apm == final_apm, "Project 1 APM traces table corrupted by hostile probe!"
    finally:
        db.close()


def test_cross_tenant_session_hijacking_rejected_with_403(client: TestClient):
    """Tenant B cannot overwrite or append to Tenant A's recording session using Tenant B's api_key."""
    tenant_a = register_user(client, domain="victim-alpha.org", role="USER")
    tenant_b = register_user(client, domain="attacker-beta.org", role="USER")

    sess_id = f"sess_victim_{uuid.uuid4().hex[:8]}"

    # Tenant A creates session recording
    r1 = client.post("/api/v1/recordings", json={
        "session_id": sess_id,
        "api_key": tenant_a["api_key"],
        "duration": 10,
        "events": make_mock_events(tenant_a["domain"], sess_id)
    })
    assert r1.status_code == 200

    # Tenant B tries to append events to Tenant A's session using Tenant B's valid api_key
    r2 = client.post("/api/v1/recordings", json={
        "session_id": sess_id,
        "api_key": tenant_b["api_key"],
        "duration": 20,
        "events": make_mock_events(tenant_b["domain"], sess_id)
    })
    assert r2.status_code == 403, (
        f"Cross-tenant session hijacking violation: Tenant B appended to Tenant A session! Got {r2.status_code}: {r2.text}"
    )


# ===========================================================================
# GROUP 3: Cross-Tenant Replay Access Across Different User Roles
# ===========================================================================

def test_cross_tenant_replay_role_user_returns_403(client: TestClient):
    """Standard USER role in Tenant B attempting to replay Tenant A session receives 403."""
    tenant_a = register_user(client, domain="finance-corp.com", role="USER")
    tenant_b = register_user(client, domain="snoop-user.com", role="USER")

    sess_a = f"sess_fin_{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/recordings", json={
        "session_id": sess_a,
        "api_key": tenant_a["api_key"],
        "duration": 15,
        "events": make_mock_events(tenant_a["domain"], sess_a)
    })

    resp = client.get(f"/api/v1/recordings/{sess_a}/replay", headers=tenant_b["headers"])
    assert resp.status_code in (403, 404), f"USER role accessed cross-tenant replay! Status: {resp.status_code}"


def test_cross_tenant_replay_role_admin_org_returns_403(client: TestClient):
    """Organization-level ADMIN role in Tenant B attempting to replay Tenant A session receives 403."""
    tenant_a = register_user(client, domain="health-data.org", role="USER")
    tenant_b_admin = register_user(client, domain="rival-admin.org", role="ADMIN")

    sess_a = f"sess_health_{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/recordings", json={
        "session_id": sess_a,
        "api_key": tenant_a["api_key"],
        "duration": 25,
        "events": make_mock_events(tenant_a["domain"], sess_a)
    })

    resp = client.get(f"/api/v1/recordings/{sess_a}/replay", headers=tenant_b_admin["headers"])
    assert resp.status_code in (403, 404), (
        f"Org-level ADMIN role bypassed tenant isolation! Status: {resp.status_code}: {resp.text}"
    )


def test_cross_tenant_replay_role_member_returns_403(client: TestClient):
    """MEMBER role in Tenant B attempting to replay Tenant A session receives 403."""
    tenant_a = register_user(client, domain="legal-briefs.com", role="USER")
    tenant_b_member = register_user(client, domain="outsider-firm.com", role="MEMBER")

    sess_a = f"sess_legal_{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/recordings", json={
        "session_id": sess_a,
        "api_key": tenant_a["api_key"],
        "duration": 18,
        "events": make_mock_events(tenant_a["domain"], sess_a)
    })

    resp = client.get(f"/api/v1/recordings/{sess_a}/replay", headers=tenant_b_member["headers"])
    assert resp.status_code in (403, 404), f"MEMBER role accessed cross-tenant replay! Status: {resp.status_code}"


def test_cross_tenant_replay_superadmin_allowed(client: TestClient):
    """Platform SUPERADMIN role can access replay for support / oversight."""
    tenant_a = register_user(client, domain="client-support.com", role="USER")
    superadmin = register_user(client, domain="thirdeye.io", role="SUPERADMIN")

    sess_a = f"sess_support_{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/recordings", json={
        "session_id": sess_a,
        "api_key": tenant_a["api_key"],
        "duration": 12,
        "events": make_mock_events(tenant_a["domain"], sess_a)
    })

    resp = client.get(f"/api/v1/recordings/{sess_a}/replay", headers=superadmin["headers"])
    assert resp.status_code == 200, f"SuperAdmin was incorrectly blocked from replay: {resp.status_code}: {resp.text}"
    events = resp.json()
    assert isinstance(events, list)
    assert len(events) >= 3


def test_query_param_project_id_tampering_by_user_returns_403(client: TestClient):
    """Passing another tenant's project_id in ?project_id= query param returns 403 Forbidden."""
    tenant_a = register_user(client, domain="victim-alpha-proj.org", role="USER")
    tenant_b = register_user(client, domain="attacker-beta-proj.org", role="USER")

    resp = client.get(f"/api/v1/recordings?project_id={tenant_a['project_id']}", headers=tenant_b["headers"])
    assert resp.status_code in (403, 404) or (resp.status_code == 200 and resp.json() == []), (
        f"Tenant B was able to view recordings by tampering project_id param: {resp.text}"
    )


def test_cross_tenant_replay_stream_gzip_returns_403(client: TestClient):
    """Replay request with gzip stream parameter returns 403 before file reading."""
    tenant_a = register_user(client, domain="stream-victim.io", role="USER")
    tenant_b = register_user(client, domain="stream-attacker.io", role="USER")

    sess_a = f"sess_stream_{uuid.uuid4().hex[:8]}"
    client.post("/api/v1/recordings", json={
        "session_id": sess_a,
        "api_key": tenant_a["api_key"],
        "duration": 30,
        "events": make_mock_events(tenant_a["domain"], sess_a)
    })

    headers = dict(tenant_b["headers"])
    headers["Accept"] = "application/gzip"
    resp = client.get(f"/api/v1/recordings/{sess_a}/replay?stream_gzip=true", headers=headers)
    assert resp.status_code in (403, 404), f"Gzip stream access permitted cross-tenant! Status: {resp.status_code}"


# ===========================================================================
# Standalone execution
# ===========================================================================
if __name__ == "__main__":
    import inspect
    print("=" * 80)
    print(" Adversarial Multi-Tenant Data Isolation Test Runner")
    print("=" * 80)
    current_module = sys.modules[__name__]
    test_funcs = [
        (name, func)
        for name, func in inspect.getmembers(current_module, inspect.isfunction)
        if name.startswith("test_")
    ]
    test_funcs.sort(key=lambda x: x[0])
    print(f"Discovered {len(test_funcs)} adversarial test cases.\n")

    passed = 0
    failed = 0
    with TestClient(app) as test_client:
        for name, func in test_funcs:
            t0 = time.time()
            try:
                func(test_client)
                dur = int((time.time() - t0) * 1000)
                passed += 1
                print(f"  [ PASS ] {name} ({dur}ms)")
            except AssertionError as ae:
                dur = int((time.time() - t0) * 1000)
                failed += 1
                print(f"  [ FAIL ] {name} ({dur}ms) -> {ae}")
            except Exception as ex:
                dur = int((time.time() - t0) * 1000)
                failed += 1
                print(f"  [ ERR  ] {name} ({dur}ms) -> {type(ex).__name__}: {ex}")

    print("\n" + "=" * 80)
    print(f"Adversarial Results: Total={len(test_funcs)} | Passed={passed} | Failed={failed}")
    print("=" * 80)
    sys.exit(0 if failed == 0 else 1)
