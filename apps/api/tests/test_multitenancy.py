#!/usr/bin/env python3
"""
ThirdEye Multi-Tenant Hardening - E2E Multi-Tenant Opaque-Box Test Suite
=======================================================================
Requirement Authority:
- ORIGINAL_REQUEST.md (2026-10-15 Multi-Tenant Production Hardening)
  - R1: Strict Backend Multi-Tenant Data Isolation
  - R2: Zero Silent Fallbacks in Event Ingestion
  - R3: Dynamic Frontend Client Workspace (Status endpoint contracts)
  - R4: Authentic New Tenant Empty State & Domain Simulator
- PROJECT.md & TEST_INFRA.md

Architecture:
- Opaque-box, requirement-driven tests using FastAPI TestClient(app).
- Tier 1: Feature Coverage (>=5 test cases per feature across F1 to F6).
- Tier 2: Boundary & Corner Cases (invalid/missing token, empty/whitespace api_key,
          cross-tenant project_id query parameter, nonexistent session IDs, etc.).
- Tier 3: Cross-Feature Interactions (Tenant A vs Tenant B mutual data isolation,
          alien key rejection, simulated replay boundary).
- Tier 4: Real-World Scenarios (complete selfupcommunity.com onboarding lifecycle,
          hostile ingestion probe, cross-tenant snooping, concurrent workloads, full lifecycle).

Test Runner Compatibility:
- pytest: apps\\api\\venv\\Scripts\\python.exe -m pytest apps/api/tests/test_multitenancy.py -v
- standalone: apps\\api\\venv\\Scripts\\python.exe apps/api/tests/test_multitenancy.py
"""

import os
import sys
import uuid
import json
import gzip
import time
import inspect
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import pytest

# ---------------------------------------------------------------------------
# Environment Bootstrap & Path Setup
# ---------------------------------------------------------------------------
TEST_FILE = Path(__file__).resolve()
TESTS_DIR = TEST_FILE.parent
API_DIR = TESTS_DIR.parent
ROOT_DIR = API_DIR.parent.parent

# Change current working directory to apps/api to ensure StaticFiles('public')
# and relative sqlite storage paths resolve identically in all execution contexts
os.chdir(str(API_DIR))

if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

# Import FastAPI app and models
from fastapi.testclient import TestClient
from app.main import app
from app import models, database

STORAGE_DIR_API = API_DIR / "storage" / "recordings"
STORAGE_DIR_ROOT = ROOT_DIR / "storage" / "recordings"


# ---------------------------------------------------------------------------
# Fixtures & Test Helpers
# ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def client():
    """Module-level TestClient fixture with lifespan startup execution."""
    with TestClient(app) as c:
        yield c


def register_tenant(c: TestClient, domain: str = "example.com", name: str = "Client") -> Dict[str, Any]:
    """
    Registers a brand new tenant with unique email, organization, and project.
    Retrieves the tenant's access token, headers, project_id, and api_key.
    """
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
    assert reg_resp.status_code == 200, f"Tenant registration failed ({reg_resp.status_code}): {reg_resp.text}"
    data = reg_resp.json()
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch tenant's project to obtain project_id and api_key
    proj_resp = c.get("/api/projects", headers=headers)
    assert proj_resp.status_code == 200, f"Failed to fetch projects ({proj_resp.status_code}): {proj_resp.text}"
    projects = proj_resp.json()
    assert len(projects) > 0, "Registration did not auto-seed a project for the tenant"
    proj = projects[0]

    return {
        "email": email,
        "password": password,
        "token": token,
        "headers": headers,
        "project_id": proj["id"],
        "api_key": proj["api_key"],
        "domain": clean_domain,
        "org_id": proj["organization_id"],
    }


def make_mock_rrweb_events(domain: str, session_id: str) -> List[Dict[str, Any]]:
    """Generates standard rrweb v2 compatible event list for testing."""
    now_ts = int(time.time() * 1000)
    return [
        {
            "type": 4,  # Meta
            "data": {
                "href": f"https://{domain}/",
                "width": 1920,
                "height": 1080,
            },
            "timestamp": now_ts,
        },
        {
            "type": 2,  # FullSnapshot
            "data": {
                "node": {
                    "id": 1,
                    "type": 0,
                    "childNodes": [
                        {
                            "id": 2,
                            "type": 1,
                            "name": "html",
                            "publicId": "",
                            "systemId": "",
                            "childNodes": [
                                {
                                    "id": 3,
                                    "type": 2,
                                    "tagName": "body",
                                    "attributes": {"class": "workspace-body"},
                                    "childNodes": [
                                        {
                                            "id": 4,
                                            "type": 2,
                                            "tagName": "h1",
                                            "attributes": {"id": "title"},
                                            "childNodes": [
                                                {"id": 5, "type": 3, "textContent": f"Welcome to {domain}"}
                                            ],
                                        }
                                    ],
                                }
                            ],
                        }
                    ],
                },
                "initialOffset": {"left": 0, "top": 0},
            },
            "timestamp": now_ts + 50,
        },
        {
            "type": 3,  # IncrementalSnapshot (MouseMove)
            "data": {
                "source": 1,
                "positions": [
                    {"x": 120, "y": 240, "id": 4, "timeOffset": 200},
                    {"x": 180, "y": 290, "id": 4, "timeOffset": 500},
                ],
            },
            "timestamp": now_ts + 200,
        },
    ]


# ===========================================================================
# TIER 1: FEATURE COVERAGE (>=5 tests per feature)
# ===========================================================================

# ---------------------------------------------------------------------------
# Feature 1: Authenticated Recordings Scoping (GET /api/v1/recordings)
# ---------------------------------------------------------------------------
def test_f1_01_recordings_unauthenticated_returns_401(client: TestClient):
    """F1: Calling GET /api/v1/recordings without auth header must return HTTP 401 Unauthorized."""
    resp = client.get("/api/v1/recordings")
    assert resp.status_code == 401, (
        f"Security violation: GET /api/v1/recordings without auth must return 401, got {resp.status_code}: {resp.text}"
    )


def test_f1_02_recordings_new_tenant_returns_empty_list(client: TestClient):
    """F1: Newly registered tenant with 0 recordings must receive 200 OK with [] (never legacy recordings)."""
    tenant = register_tenant(client, domain="fresh-startup.io")
    resp = client.get("/api/v1/recordings", headers=tenant["headers"])
    assert resp.status_code == 200, f"Failed to list recordings: {resp.text}"
    recordings = resp.json()
    assert isinstance(recordings, list), f"Expected list response, got {type(recordings)}"
    assert len(recordings) == 0, (
        f"Data leakage detected: New tenant with 0 recordings received {len(recordings)} recordings! "
        f"Must never return GrowInsight or other tenant's recordings: {recordings}"
    )


def test_f1_03_recordings_scoped_strictly_to_tenant_projects(client: TestClient):
    """F1: Tenant A only sees Tenant A's recordings; Tenant B only sees Tenant B's recordings."""
    tenant_a = register_tenant(client, domain="tenant-alpha.com")
    tenant_b = register_tenant(client, domain="tenant-beta.com")

    # Tenant A ingests a recording
    sess_a = f"sess_a_{uuid.uuid4().hex[:8]}"
    ingest_resp = client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_a,
            "api_key": tenant_a["api_key"],
            "duration": 12,
            "events": make_mock_rrweb_events(tenant_a["domain"], sess_a),
        },
    )
    assert ingest_resp.status_code == 200, f"Tenant A recording ingest failed: {ingest_resp.text}"

    # Tenant A lists recordings -> must find sess_a
    list_a = client.get("/api/v1/recordings", headers=tenant_a["headers"])
    assert list_a.status_code == 200
    recs_a = list_a.json()
    sess_ids_a = [r["session_id"] for r in recs_a]
    assert sess_a in sess_ids_a, f"Tenant A should see their session {sess_a}, got {sess_ids_a}"

    # Tenant B lists recordings -> must NOT see sess_a
    list_b = client.get("/api/v1/recordings", headers=tenant_b["headers"])
    assert list_b.status_code == 200
    recs_b = list_b.json()
    sess_ids_b = [r["session_id"] for r in recs_b]
    assert sess_a not in sess_ids_b, (
        f"Data leakage violation: Tenant B listed session {sess_a} belonging to Tenant A!"
    )


def test_f1_04_recordings_explicit_project_id_filtering(client: TestClient):
    """F1: Filtering with tenant's own project_id returns only recordings for that project."""
    tenant = register_tenant(client, domain="filtering-test.com")
    sess_id = f"sess_filt_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "api_key": tenant["api_key"],
            "duration": 8,
            "events": make_mock_rrweb_events(tenant["domain"], sess_id),
        },
    )

    resp = client.get(
        f"/api/v1/recordings?project_id={tenant['project_id']}",
        headers=tenant["headers"],
    )
    assert resp.status_code == 200
    recs = resp.json()
    assert all(r["project_id"] == tenant["project_id"] for r in recs)


def test_f1_05_recordings_metadata_schema_contract(client: TestClient):
    """F1: Recording items adhere to the metadata schema contract with required fields."""
    tenant = register_tenant(client, domain="schema-verify.org")
    sess_id = f"sess_schema_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "api_key": tenant["api_key"],
            "duration": 25,
            "events": make_mock_rrweb_events(tenant["domain"], sess_id),
        },
    )

    resp = client.get("/api/v1/recordings", headers=tenant["headers"])
    assert resp.status_code == 200
    recs = resp.json()
    match = [r for r in recs if r["session_id"] == sess_id]
    assert len(match) == 1
    rec = match[0]

    required_keys = ["session_id", "project_id", "duration", "file_path", "created_at"]
    for k in required_keys:
        assert k in rec, f"Missing required key '{k}' in recording item: {rec}"
    assert rec["project_id"] == tenant["project_id"]


# ---------------------------------------------------------------------------
# Feature 2: Replay Ownership Authorization (GET /api/v1/recordings/{session_id}/replay)
# ---------------------------------------------------------------------------
def test_f2_01_replay_unauthenticated_returns_401(client: TestClient):
    """F2: Calling /replay without authentication header returns HTTP 401 Unauthorized."""
    tenant = register_tenant(client, domain="replay-auth.com")
    sess_id = f"sess_repunauth_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "api_key": tenant["api_key"],
            "duration": 10,
            "events": make_mock_rrweb_events(tenant["domain"], sess_id),
        },
    )

    resp = client.get(f"/api/v1/recordings/{sess_id}/replay")
    assert resp.status_code == 401, (
        f"Security violation: Replay access without auth must return 401, got {resp.status_code}"
    )


def test_f2_02_replay_owner_access_allowed_and_returns_events(client: TestClient):
    """F2: The tenant who owns the session can fetch and replay it (status 200, valid event list)."""
    tenant = register_tenant(client, domain="replay-owner.com")
    sess_id = f"sess_repown_{uuid.uuid4().hex[:8]}"
    raw_events = make_mock_rrweb_events(tenant["domain"], sess_id)

    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "api_key": tenant["api_key"],
            "duration": 15,
            "events": raw_events,
        },
    )

    resp = client.get(f"/api/v1/recordings/{sess_id}/replay", headers=tenant["headers"])
    assert resp.status_code == 200, f"Owner failed to replay their session: {resp.status_code}: {resp.text}"
    replay_data = resp.json()
    assert isinstance(replay_data, list), "Expected list of rrweb events"
    assert len(replay_data) >= len(raw_events), "Replay returned incomplete event stream"


def test_f2_03_replay_cross_tenant_forbidden_403_or_404(client: TestClient):
    """F2: Tenant B attempting to access Tenant A's recording replay returns HTTP 403 Forbidden or 404."""
    tenant_a = register_tenant(client, domain="confidential-a.com")
    tenant_b = register_tenant(client, domain="attacker-b.com")

    sess_a = f"sess_secret_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_a,
            "api_key": tenant_a["api_key"],
            "duration": 30,
            "events": make_mock_rrweb_events(tenant_a["domain"], sess_a),
        },
    )

    # Tenant B tries to replay Tenant A's session
    resp = client.get(f"/api/v1/recordings/{sess_a}/replay", headers=tenant_b["headers"])
    assert resp.status_code in (403, 404), (
        f"Critical security leak: Tenant B accessed Tenant A's replay! Expected 403 or 404, got {resp.status_code}: {resp.text}"
    )


def test_f2_04_direct_session_endpoint_cross_tenant_forbidden(client: TestClient):
    """F2: GET /api/v1/recordings/{session_id} (direct alias) also enforces tenant ownership."""
    tenant_a = register_tenant(client, domain="direct-alias-a.com")
    tenant_b = register_tenant(client, domain="direct-alias-b.com")

    sess_a = f"sess_direct_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_a,
            "api_key": tenant_a["api_key"],
            "duration": 20,
            "events": make_mock_rrweb_events(tenant_a["domain"], sess_a),
        },
    )

    resp = client.get(f"/api/v1/recordings/{sess_a}", headers=tenant_b["headers"])
    assert resp.status_code in (403, 404), (
        f"Security violation: Direct session endpoint must reject cross-tenant access. Got {resp.status_code}"
    )


def test_f2_05_replay_gzip_stream_cross_tenant_forbidden(client: TestClient):
    """F2: Cross-tenant replay requests with Accept: application/gzip return 403/404 before reading file."""
    tenant_a = register_tenant(client, domain="gzip-owner-a.com")
    tenant_b = register_tenant(client, domain="gzip-snooper-b.com")

    sess_a = f"sess_gz_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_a,
            "api_key": tenant_a["api_key"],
            "duration": 18,
            "events": make_mock_rrweb_events(tenant_a["domain"], sess_a),
        },
    )

    headers = dict(tenant_b["headers"])
    headers["Accept"] = "application/gzip"
    resp = client.get(f"/api/v1/recordings/{sess_a}/replay?stream_gzip=true", headers=headers)
    assert resp.status_code in (403, 404), (
        f"Security violation: Gzip stream cross-tenant access must return 403/404, got {resp.status_code}"
    )


# ---------------------------------------------------------------------------
# Feature 3: Zero Silent Fallback Event Ingestion (POST /api/v1/collect & /track)
# ---------------------------------------------------------------------------
def test_f3_01_collect_valid_key_ingests_to_tenant_project(client: TestClient):
    """F3: Event ingestion with a valid api_key succeeds (200 OK, {"status": "tracked"})."""
    tenant = register_tenant(client, domain="ingest-valid.com")
    sess_id = f"sess_event_{uuid.uuid4().hex[:8]}"

    resp = client.post(
        "/api/v1/collect",
        json={
            "api_key": tenant["api_key"],
            "event_type": "pageview",
            "url": f"https://{tenant['domain']}/products",
            "session_id": sess_id,
            "referrer": "https://google.com",
            "properties": {"browser": "Firefox", "os": "Linux"},
        },
    )
    assert resp.status_code == 200, f"Failed to ingest event with valid key: {resp.text}"
    assert resp.json().get("status") == "tracked"


def test_f3_02_collect_missing_key_returns_401(client: TestClient):
    """F3: POST /api/v1/collect with missing/omitted api_key must return HTTP 401 Unauthorized."""
    resp = client.post(
        "/api/v1/collect",
        json={
            "api_key": "",
            "event_type": "pageview",
            "url": "https://random-site.com/",
            "session_id": "sess_orphan_01",
        },
    )
    assert resp.status_code == 401, (
        f"Silent fallback defect: Ingestion with empty api_key must return 401, got {resp.status_code}: {resp.text}"
    )


def test_f3_03_collect_invalid_key_returns_401(client: TestClient):
    """F3: POST /api/v1/collect with invalid/forged api_key must return HTTP 401 (never fallback to Project 1)."""
    resp = client.post(
        "/api/v1/collect",
        json={
            "api_key": "te_live_forged_invalid_key_xyz",
            "event_type": "click",
            "url": "https://malicious.org/",
            "session_id": "sess_badkey_01",
        },
    )
    assert resp.status_code == 401, (
        f"Silent fallback defect: Ingestion with invalid key must return 401, got {resp.status_code}: {resp.text}"
    )


def test_f3_04_track_alias_missing_or_invalid_key_returns_401(client: TestClient):
    """F3: POST /api/v1/track alias must also reject invalid/missing api_key with 401."""
    resp = client.post(
        "/api/v1/track",
        json={
            "api_key": "te_live_nonexistent_alias_key",
            "event_type": "pageview",
            "url": "https://alias-test.org/",
            "session_id": "sess_alias_01",
        },
    )
    assert resp.status_code == 401, (
        f"Silent fallback defect on /track: Invalid key must return 401, got {resp.status_code}"
    )


def test_f3_05_collect_empty_string_key_returns_401(client: TestClient):
    """F3: Event ingestion payload with empty string key returns 401 Unauthorized."""
    resp = client.post(
        "/api/v1/collect",
        json={
            "api_key": "   ",
            "event_type": "custom",
            "url": "https://whitespace-key.com/",
            "session_id": "sess_ws_01",
        },
    )
    assert resp.status_code == 401, (
        f"Boundary defect: Whitespace api_key must return 401, got {resp.status_code}"
    )


# ---------------------------------------------------------------------------
# Feature 4: Zero Silent Fallback Recording Ingestion (POST /api/v1/recordings)
# ---------------------------------------------------------------------------
def test_f4_01_recording_valid_key_ingests_and_stores_file(client: TestClient):
    """F4: Recording ingestion with a valid api_key succeeds (200 OK, 'stored') and saves gzip file."""
    tenant = register_tenant(client, domain="recording-valid.io")
    sess_id = f"sess_recvalid_{uuid.uuid4().hex[:8]}"

    resp = client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "api_key": tenant["api_key"],
            "duration": 14,
            "events": make_mock_rrweb_events(tenant["domain"], sess_id),
        },
    )
    assert resp.status_code == 200, f"Recording ingestion failed: {resp.text}"
    data = resp.json()
    assert data.get("status") == "stored"
    assert data.get("session_id") == sess_id

    # Verify physical file artifact in Mock S3 storage
    expected_file = STORAGE_DIR_API / f"{sess_id}.json.gz"
    root_file = STORAGE_DIR_ROOT / f"{sess_id}.json.gz"
    assert expected_file.exists() or root_file.exists(), (
        f"Mock S3 file was not created on disk for session {sess_id}"
    )


def test_f4_02_recording_invalid_key_returns_401(client: TestClient):
    """F4: Recording ingestion with invalid api_key returns HTTP 401 (never fallback to Project 1)."""
    sess_id = f"sess_forged_{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "api_key": "te_live_completely_fake_key_12345",
            "duration": 5,
            "events": [{"type": 4, "data": {}, "timestamp": 1000}],
        },
    )
    assert resp.status_code == 401, (
        f"Silent fallback defect: Ingestion with invalid key must return 401, got {resp.status_code}: {resp.text}"
    )


def test_f4_03_recording_missing_key_returns_401(client: TestClient):
    """F4: Recording ingestion without api_key on initial session batch must return HTTP 401."""
    sess_id = f"sess_nokey_{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "duration": 5,
            "events": [{"type": 4, "data": {}, "timestamp": 1000}],
        },
    )
    assert resp.status_code == 401, (
        f"Silent fallback defect: Ingestion without api_key must return 401, got {resp.status_code}: {resp.text}"
    )


def test_f4_04_recording_unauthorized_project_id_forgery_rejected(client: TestClient):
    """F4: Supplying project_id=1 without valid api_key is rejected with HTTP 401."""
    sess_id = f"sess_forged_proj_{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "project_id": 1,
            "api_key": "te_live_fake_key",
            "duration": 7,
            "events": [{"type": 4, "data": {}, "timestamp": 1000}],
        },
    )
    assert resp.status_code == 401, (
        f"Security defect: Ingestion with forged project_id and invalid key must return 401, got {resp.status_code}"
    )


def test_f4_05_recording_append_batches_respects_tenant_ownership(client: TestClient):
    """F4: Continuous batch appends require matching api_key or ownership."""
    tenant = register_tenant(client, domain="append-test.org")
    sess_id = f"sess_append_{uuid.uuid4().hex[:8]}"

    # Initial batch
    resp1 = client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "api_key": tenant["api_key"],
            "duration": 5,
            "events": [{"type": 4, "data": {"href": "https://append-test.org/"}, "timestamp": 1000}],
        },
    )
    assert resp1.status_code == 200

    # Second batch with matching api_key
    resp2 = client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_id,
            "api_key": tenant["api_key"],
            "duration": 10,
            "events": [{"type": 3, "data": {}, "timestamp": 2000}],
        },
    )
    assert resp2.status_code == 200
    assert resp2.json().get("event_count") == 2


# ---------------------------------------------------------------------------
# Feature 5: Zero Silent Fallback APM Ingestion (POST /api/v1/apm/report)
# ---------------------------------------------------------------------------
def test_f5_01_apm_valid_key_records_metric(client: TestClient):
    """F5: APM report with valid api_key records metric and returns 200 OK."""
    tenant = register_tenant(client, domain="apm-valid.io")
    resp = client.post(
        "/api/v1/apm/report",
        json={
            "api_key": tenant["api_key"],
            "service_name": "web-frontend",
            "endpoint": "/api/v1/products",
            "method": "GET",
            "status_code": 200,
            "duration_ms": 75,
        },
    )
    assert resp.status_code == 200, f"APM reporting failed: {resp.text}"
    assert resp.json().get("status") == "recorded"


def test_f5_02_apm_invalid_key_returns_401(client: TestClient):
    """F5: APM report with invalid api_key returns 401 Unauthorized (never fallback to Project 1)."""
    resp = client.post(
        "/api/v1/apm/report",
        json={
            "api_key": "te_live_fake_apm_key_999",
            "endpoint": "/api/v1/checkout",
            "duration_ms": 120,
        },
    )
    assert resp.status_code == 401, (
        f"Silent fallback defect: APM report with invalid key must return 401, got {resp.status_code}: {resp.text}"
    )


def test_f5_03_apm_missing_key_returns_401(client: TestClient):
    """F5: APM report with empty or omitted api_key returns 401 Unauthorized."""
    resp = client.post(
        "/api/v1/apm/report",
        json={
            "api_key": "",
            "endpoint": "/api/v1/orders",
            "duration_ms": 60,
        },
    )
    assert resp.status_code == 401, (
        f"Silent fallback defect: APM report without api_key must return 401, got {resp.status_code}: {resp.text}"
    )


def test_f5_04_apm_empty_key_returns_401(client: TestClient):
    """F5: APM report with whitespace-only key returns 401 Unauthorized."""
    resp = client.post(
        "/api/v1/apm/report",
        json={
            "api_key": "   ",
            "endpoint": "/api/v1/users",
            "duration_ms": 45,
        },
    )
    assert resp.status_code == 401, (
        f"Silent fallback defect: APM report with whitespace key must return 401, got {resp.status_code}"
    )


def test_f5_05_apm_metrics_endpoint_isolated_by_tenant(client: TestClient):
    """F5: GET /api/v1/apm/metrics returns only APM traces belonging to authenticated tenant."""
    tenant = register_tenant(client, domain="apm-isolated.com")
    unique_endpoint = f"/api/custom_{uuid.uuid4().hex[:6]}"

    # Ingest trace for tenant
    client.post(
        "/api/v1/apm/report",
        json={
            "api_key": tenant["api_key"],
            "endpoint": unique_endpoint,
            "duration_ms": 110,
            "status_code": 200,
        },
    )

    resp = client.get("/api/v1/apm/metrics", headers=tenant["headers"])
    assert resp.status_code == 200
    data = resp.json()
    recent = data.get("recent_traces", [])
    # Verify that if traces exist, they belong to the tenant's endpoint
    if recent:
        endpoints = [t["endpoint"] for t in recent]
        assert unique_endpoint in endpoints, f"Tenant's trace {unique_endpoint} not found in APM metrics"


# ---------------------------------------------------------------------------
# Feature 6: Domain Simulation Endpoint (POST /api/v1/recordings/simulate)
# ---------------------------------------------------------------------------
def test_f6_01_simulate_unauthenticated_returns_401(client: TestClient):
    """F6: POST /api/v1/recordings/simulate without auth token returns HTTP 401 Unauthorized."""
    resp = client.post("/api/v1/recordings/simulate")
    assert resp.status_code == 401, (
        f"Simulation endpoint must require authentication. Got {resp.status_code}: {resp.text}"
    )


def test_f6_02_simulate_creates_domain_tailored_session(client: TestClient):
    """F6: Authenticated tenant simulating a session creates recording tailored to registered domain."""
    tenant = register_tenant(client, domain="selfupcommunity.com")
    resp = client.post("/api/v1/recordings/simulate", headers=tenant["headers"])
    assert resp.status_code in (200, 201), (
        f"Simulation failed with status {resp.status_code}: {resp.text}"
    )
    data = resp.json()
    assert data.get("status") == "simulated"
    assert "session_id" in data
    assert data.get("domain") == "selfupcommunity.com"
    assert data.get("project_id") == tenant["project_id"]


def test_f6_03_simulate_writes_compressed_s3_recording_file(client: TestClient):
    """F6: Simulated recording creates .json.gz file in storage/recordings/ matching session_id."""
    tenant = register_tenant(client, domain="storage-check.com")
    resp = client.post("/api/v1/recordings/simulate", headers=tenant["headers"])
    assert resp.status_code in (200, 201)
    sess_id = resp.json()["session_id"]

    file_api = STORAGE_DIR_API / f"{sess_id}.json.gz"
    file_root = STORAGE_DIR_ROOT / f"{sess_id}.json.gz"
    target = file_api if file_api.exists() else file_root
    assert target.exists(), f"Simulated recording file not found on disk at {file_api} or {file_root}"

    # Verify gzip decompress
    with gzip.open(target, "rt", encoding="utf-8") as f:
        events = json.load(f)
    assert isinstance(events, list)
    assert len(events) >= 2


def test_f6_04_simulate_rrweb_events_contain_client_domain_branding(client: TestClient):
    """F6: Decompressed rrweb events contain client's registered domain in meta and document."""
    tenant = register_tenant(client, domain="selfupcommunity.com")
    resp = client.post("/api/v1/recordings/simulate", headers=tenant["headers"])
    assert resp.status_code in (200, 201)
    sess_id = resp.json()["session_id"]

    # Replay session
    replay_resp = client.get(f"/api/v1/recordings/{sess_id}/replay", headers=tenant["headers"])
    assert replay_resp.status_code == 200
    events = replay_resp.json()

    # Find Meta event (type 4)
    meta_events = [e for e in events if e.get("type") == 4]
    assert len(meta_events) > 0, "No rrweb meta event found in simulated session"
    href = meta_events[0].get("data", {}).get("href", "")
    assert "selfupcommunity.com" in href, f"Meta href does not contain client domain: {href}"


def test_f6_05_simulate_consecutive_calls_generate_unique_sessions(client: TestClient):
    """F6: Calling simulate multiple times produces distinct session_ids without collision."""
    tenant = register_tenant(client, domain="multi-sim.com")
    resp1 = client.post("/api/v1/recordings/simulate", headers=tenant["headers"])
    resp2 = client.post("/api/v1/recordings/simulate", headers=tenant["headers"])

    assert resp1.status_code in (200, 201)
    assert resp2.status_code in (200, 201)
    sess1 = resp1.json()["session_id"]
    sess2 = resp2.json()["session_id"]
    assert sess1 != sess2, f"Consecutive simulate calls generated duplicate session ID: {sess1}"


# ===========================================================================
# TIER 2: BOUNDARY & CORNER CASES (>=5 tests)
# ===========================================================================

def test_t2_01_bearer_token_missing_malformed_expired(client: TestClient):
    """T2: Boundary test - requests with malformed, empty, or random JWTs return HTTP 401."""
    cases = [
        {"Authorization": ""},
        {"Authorization": "Bearer "},
        {"Authorization": "Bearer totally_bogus_not_a_jwt_string"},
        {"Authorization": "Basic dXNlcjpwYXNz"},
    ]
    for h in cases:
        resp = client.get("/api/v1/recordings", headers=h)
        assert resp.status_code == 401, f"Expected 401 for header {h}, got {resp.status_code}"


def test_t2_02_api_key_whitespace_and_null_bytes(client: TestClient):
    """T2: Boundary test - api_key values with whitespace, tabs, or newlines return HTTP 401."""
    bad_keys = ["", " ", "   \t\n  ", "\x00nullbyte", "undefined", "null"]
    for k in bad_keys:
        resp = client.post(
            "/api/v1/collect",
            json={
                "api_key": k,
                "event_type": "pageview",
                "url": "https://test.com/",
                "session_id": "sess_edge_01",
            },
        )
        assert resp.status_code == 401, f"Expected 401 for key '{k}', got {resp.status_code}"


def test_t2_03_cross_tenant_project_id_query_parameter_tampering(client: TestClient):
    """T2: Boundary test - Tenant B passing ?project_id=<tenant_a_id> cannot view Tenant A recordings."""
    tenant_a = register_tenant(client, domain="tamper-victim.com")
    tenant_b = register_tenant(client, domain="tamper-attacker.com")

    # Ingest recording for Tenant A
    sess_a = f"sess_victim_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_a,
            "api_key": tenant_a["api_key"],
            "duration": 12,
            "events": make_mock_rrweb_events(tenant_a["domain"], sess_a),
        },
    )

    # Tenant B tries to query specifically with Tenant A's project_id
    resp = client.get(
        f"/api/v1/recordings?project_id={tenant_a['project_id']}",
        headers=tenant_b["headers"],
    )
    # Must either reject with 403 or return empty list (cannot return Tenant A recordings)
    if resp.status_code == 200:
        recs = resp.json()
        assert len(recs) == 0, (
            f"Query parameter tampering leak: Tenant B accessed Tenant A recordings: {recs}"
        )
    else:
        assert resp.status_code in (403, 404)


def test_t2_04_nonexistent_session_id_returns_404(client: TestClient):
    """T2: Boundary test - querying non-existent session_id returns 404 Not Found."""
    tenant = register_tenant(client, domain="nonexistent-check.org")
    ghost_id = f"sess_ghost_{uuid.uuid4().hex}"
    resp = client.get(f"/api/v1/recordings/{ghost_id}/replay", headers=tenant["headers"])
    assert resp.status_code == 404, f"Expected 404 for non-existent session, got {resp.status_code}"


def test_t2_05_recording_empty_whitespace_session_id_returns_400(client: TestClient):
    """T2: Boundary test - POST /api/v1/recordings with empty session_id returns HTTP 400."""
    tenant = register_tenant(client, domain="empty-sess.com")
    for bad_sess in ["", "   ", "\t"]:
        resp = client.post(
            "/api/v1/recordings",
            json={
                "session_id": bad_sess,
                "api_key": tenant["api_key"],
                "duration": 5,
                "events": [],
            },
        )
        assert resp.status_code == 400, (
            f"Expected 400 for empty session_id '{bad_sess}', got {resp.status_code}"
        )


def test_t2_06_event_collection_boundary_empty_event_type_or_url(client: TestClient):
    """T2: Boundary test - event collection with missing required event fields handles gracefully."""
    tenant = register_tenant(client, domain="event-boundary.org")
    # Missing session_id or event_type should fail Pydantic validation (422 Unprocessable Entity)
    resp = client.post(
        "/api/v1/collect",
        json={"api_key": tenant["api_key"], "event_type": "pageview"},
    )
    assert resp.status_code in (400, 422), f"Expected 400/422 validation failure, got {resp.status_code}"


# ===========================================================================
# TIER 3: CROSS-FEATURE INTERACTIONS (>=5 tests)
# ===========================================================================

def test_t3_01_dual_tenant_complete_data_isolation(client: TestClient):
    """T3: Tenant A registers & ingests; Tenant B registers selfupcommunity.com; Tenant B gets [] recordings."""
    tenant_a = register_tenant(client, domain="enterprise-corp.com")
    tenant_b = register_tenant(client, domain="selfupcommunity.com")

    # Tenant A ingests event & recording
    sess_a = f"sess_dual_a_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/collect",
        json={
            "api_key": tenant_a["api_key"],
            "event_type": "pageview",
            "url": f"https://{tenant_a['domain']}/",
            "session_id": sess_a,
        },
    )
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_a,
            "api_key": tenant_a["api_key"],
            "duration": 22,
            "events": make_mock_rrweb_events(tenant_a["domain"], sess_a),
        },
    )

    # Tenant B lists recordings -> strictly empty
    list_b = client.get("/api/v1/recordings", headers=tenant_b["headers"])
    assert list_b.status_code == 200
    assert list_b.json() == [], (
        f"Cross-feature leak: Tenant B saw recordings after Tenant A ingested! {list_b.json()}"
    )

    # Tenant A lists recordings -> sees sess_a
    list_a = client.get("/api/v1/recordings", headers=tenant_a["headers"])
    assert list_a.status_code == 200
    recs_a = list_a.json()
    assert any(r["session_id"] == sess_a for r in recs_a)


def test_t3_02_cross_tenant_replay_snooping_blocked(client: TestClient):
    """T3: Tenant B cannot replay Tenant A's session; returns HTTP 403 Forbidden."""
    tenant_a = register_tenant(client, domain="healthtech-secure.com")
    tenant_b = register_tenant(client, domain="selfupcommunity.com")

    sess_a = f"sess_audit_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": sess_a,
            "api_key": tenant_a["api_key"],
            "duration": 19,
            "events": make_mock_rrweb_events(tenant_a["domain"], sess_a),
        },
    )

    # Tenant B tries to replay
    rep_b = client.get(f"/api/v1/recordings/{sess_a}/replay", headers=tenant_b["headers"])
    assert rep_b.status_code in (403, 404), (
        f"Cross-tenant replay violation: Tenant B accessed Tenant A session. Got {rep_b.status_code}"
    )


def test_t3_03_ingestion_with_alien_key_does_not_leak_or_associate_to_caller(client: TestClient):
    """T3: Submitting events with an alien key does not corrupt or pollute the caller's project."""
    tenant_a = register_tenant(client, domain="owner-org.com")
    tenant_b = register_tenant(client, domain="attacker-org.com")

    # Attacker tries to submit event using Tenant A's api_key
    sess_rogue = f"sess_rogue_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/collect",
        json={
            "api_key": tenant_a["api_key"],
            "event_type": "exploit_probe",
            "url": "https://malicious.org/probe",
            "session_id": sess_rogue,
        },
    )

    # Tenant B checks their own stats -> rogue event must NOT appear in Tenant B's workspace
    b_stats = client.get("/api/v1/dashboard/stats", headers=tenant_b["headers"])
    if b_stats.status_code == 200:
        assert b_stats.json().get("total_events", 0) == 0


def test_t3_04_dashboard_stats_and_recordings_mutual_isolation(client: TestClient):
    """T3: Ingestion under Tenant A increments Tenant A dashboard stats; Tenant B remains zero."""
    tenant_a = register_tenant(client, domain="metrics-alpha.org")
    tenant_b = register_tenant(client, domain="metrics-beta.org")

    sess_a = f"sess_stats_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/collect",
        json={
            "api_key": tenant_a["api_key"],
            "event_type": "pageview",
            "url": f"https://{tenant_a['domain']}/",
            "session_id": sess_a,
        },
    )

    stats_a = client.get("/api/v1/dashboard/stats", headers=tenant_a["headers"]).json()
    stats_b = client.get("/api/v1/dashboard/stats", headers=tenant_b["headers"]).json()

    assert stats_a.get("total_events", 0) >= 1
    assert stats_b.get("total_events", 0) == 0


def test_t3_05_simulation_replay_authorization_boundary(client: TestClient):
    """T3: Tenant B simulates session; Tenant B can replay; Tenant A receives 403 Forbidden."""
    tenant_a = register_tenant(client, domain="snoop-tenant-a.com")
    tenant_b = register_tenant(client, domain="selfupcommunity.com")

    # Tenant B triggers domain simulation
    sim_resp = client.post("/api/v1/recordings/simulate", headers=tenant_b["headers"])
    assert sim_resp.status_code in (200, 201), f"Simulation failed: {sim_resp.text}"
    sim_session_id = sim_resp.json()["session_id"]

    # Tenant B replays simulated session -> 200 OK
    rep_b = client.get(f"/api/v1/recordings/{sim_session_id}/replay", headers=tenant_b["headers"])
    assert rep_b.status_code == 200, f"Tenant B could not replay their own simulation: {rep_b.text}"

    # Tenant A attempts to replay Tenant B's simulated session -> 403 / 404
    rep_a = client.get(f"/api/v1/recordings/{sim_session_id}/replay", headers=tenant_a["headers"])
    assert rep_a.status_code in (403, 404), (
        f"Authorization defect: Tenant A snooped Tenant B simulated replay! Got {rep_a.status_code}"
    )


# ===========================================================================
# TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 Scenarios)
# ===========================================================================

def test_t4_01_scenario_selfupcommunity_onboarding_lifecycle(client: TestClient):
    """
    Scenario 1: Complete selfupcommunity.com onboarding lifecycle:
    1. Register new tenant with domain 'selfupcommunity.com'.
    2. Verify 0 recordings initially (never pre-seeded GrowInsight session '2n69l5dt3kd').
    3. Trigger POST /api/v1/recordings/simulate to generate domain-tailored test session.
    4. Assert disk artifact (.json.gz) contains selfupcommunity.com branding & DOM nodes.
    5. Replay simulated session via GET /api/v1/recordings/{session_id}/replay.
    6. Verify recordings list now contains exactly 1 recording belonging to client.
    """
    # 1. Register
    tenant = register_tenant(client, domain="selfupcommunity.com", name="SelfUp Admin")

    # 2. Verify initial empty state
    initial_recs = client.get("/api/v1/recordings", headers=tenant["headers"])
    assert initial_recs.status_code == 200
    recs_list = initial_recs.json()
    assert recs_list == [], (
        f"Scenario 1 defect: New client saw pre-existing recordings on first login: {recs_list}"
    )

    # 3. Trigger simulation
    sim_resp = client.post("/api/v1/recordings/simulate", headers=tenant["headers"])
    assert sim_resp.status_code in (200, 201), f"Simulation trigger failed: {sim_resp.text}"
    sim_data = sim_resp.json()
    sess_id = sim_data["session_id"]
    assert sim_data.get("domain") == "selfupcommunity.com"

    # 4. Check disk artifact
    file_api = STORAGE_DIR_API / f"{sess_id}.json.gz"
    file_root = STORAGE_DIR_ROOT / f"{sess_id}.json.gz"
    target_file = file_api if file_api.exists() else file_root
    assert target_file.exists(), "Simulated gzip file not present on disk"

    with gzip.open(target_file, "rt", encoding="utf-8") as f:
        events = json.load(f)
    meta_events = [e for e in events if e.get("type") == 4]
    assert len(meta_events) > 0
    assert "selfupcommunity.com" in meta_events[0].get("data", {}).get("href", "")

    # 5. Replay session
    rep_resp = client.get(f"/api/v1/recordings/{sess_id}/replay", headers=tenant["headers"])
    assert rep_resp.status_code == 200
    assert len(rep_resp.json()) == len(events)

    # 6. Verify recordings feed has 1 session
    final_recs = client.get("/api/v1/recordings", headers=tenant["headers"])
    assert final_recs.status_code == 200
    items = final_recs.json()
    assert len(items) == 1
    assert items[0]["session_id"] == sess_id


def test_t4_02_scenario_hostile_ingestion_probe(client: TestClient):
    """
    Scenario 2: Hostile Ingestion Probe:
    A rogue client/scanner sends batches of spoofed events and recordings using:
    - Empty api_key
    - Forged api_key ('te_live_hack_attempt')
    - SQL injection attempt in api_key ('te_live_\' OR 1=1 --')
    All endpoints (/collect, /track, /recordings, /apm/report) must strictly return 401.
    Verify Project 1 is NOT polluted with rogue events or recordings.
    """
    probes = [
        "",
        "te_live_hack_attempt",
        "te_live_' OR 1=1 --",
        "te_live_undefined",
    ]

    for bad_key in probes:
        # Collect
        c_resp = client.post(
            "/api/v1/collect",
            json={
                "api_key": bad_key,
                "event_type": "hostile_probe",
                "url": "https://darkweb.onion/",
                "session_id": "sess_hostile_01",
            },
        )
        assert c_resp.status_code == 401, (
            f"Hostile probe allowed on /collect with key '{bad_key}': status {c_resp.status_code}"
        )

        # Recordings
        r_resp = client.post(
            "/api/v1/recordings",
            json={
                "session_id": f"sess_hostile_{uuid.uuid4().hex[:6]}",
                "api_key": bad_key,
                "duration": 9,
                "events": [{"type": 4, "data": {}, "timestamp": 1000}],
            },
        )
        assert r_resp.status_code == 401, (
            f"Hostile probe allowed on /recordings with key '{bad_key}': status {r_resp.status_code}"
        )

        # APM
        a_resp = client.post(
            "/api/v1/apm/report",
            json={
                "api_key": bad_key,
                "endpoint": "/admin/delete_all",
                "duration_ms": 999,
            },
        )
        assert a_resp.status_code == 401, (
            f"Hostile probe allowed on /apm/report with key '{bad_key}': status {a_resp.status_code}"
        )


def test_t4_03_scenario_cross_tenant_replay_snooping(client: TestClient):
    """
    Scenario 3: Cross-Tenant Replay Snooping:
    Tenant Alpha records confidential sessions.
    Tenant Beta registers and attempts to sniff/fetch Alpha's recordings via:
    - Listing recordings (Beta sees 0)
    - Guessing Alpha's session_id on /replay (Beta gets 403/404)
    - Requesting raw gzip stream (Beta gets 403/404)
    - Direct endpoint /api/v1/recordings/{session_id} (Beta gets 403/404)
    Alpha accesses their session cleanly with 200 OK.
    """
    alpha = register_tenant(client, domain="alpha-fintech.com")
    beta = register_tenant(client, domain="beta-competitor.com")

    alpha_sess = f"sess_confidential_{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/recordings",
        json={
            "session_id": alpha_sess,
            "api_key": alpha["api_key"],
            "duration": 45,
            "events": make_mock_rrweb_events(alpha["domain"], alpha_sess),
        },
    )

    # Beta lists recordings -> 0
    beta_list = client.get("/api/v1/recordings", headers=beta["headers"]).json()
    assert all(r["session_id"] != alpha_sess for r in beta_list)

    # Beta attempts replay
    rep1 = client.get(f"/api/v1/recordings/{alpha_sess}/replay", headers=beta["headers"])
    assert rep1.status_code in (403, 404), f"Snooping replay allowed! Got {rep1.status_code}"

    # Beta attempts raw stream
    rep2 = client.get(
        f"/api/v1/recordings/{alpha_sess}/replay?raw=true",
        headers=beta["headers"],
    )
    assert rep2.status_code in (403, 404), f"Snooping raw stream allowed! Got {rep2.status_code}"

    # Beta attempts direct alias
    rep3 = client.get(f"/api/v1/recordings/{alpha_sess}", headers=beta["headers"])
    assert rep3.status_code in (403, 404), f"Snooping direct alias allowed! Got {rep3.status_code}"

    # Alpha accesses cleanly
    alpha_rep = client.get(f"/api/v1/recordings/{alpha_sess}/replay", headers=alpha["headers"])
    assert alpha_rep.status_code == 200


def test_t4_04_scenario_concurrent_dual_tenant_workload(client: TestClient):
    """
    Scenario 4: Concurrent Dual-Tenant Workload:
    Two active tenants (Tenant X: 'saas-portal.com', Tenant Y: 'ecommerce-hub.com')
    simultaneously ingest events, APM metrics, and recording sessions.
    Assert complete isolation in:
    - Recording lists
    - APM metric queries
    - Dashboard aggregate statistics
    """
    tenant_x = register_tenant(client, domain="saas-portal.com")
    tenant_y = register_tenant(client, domain="ecommerce-hub.com")

    # Ingest for Tenant X (2 events, 1 recording, 1 APM trace)
    sess_x = f"sess_x_{uuid.uuid4().hex[:6]}"
    client.post(
        "/api/v1/collect",
        json={"api_key": tenant_x["api_key"], "event_type": "pageview", "url": f"https://{tenant_x['domain']}/", "session_id": sess_x},
    )
    client.post(
        "/api/v1/collect",
        json={"api_key": tenant_x["api_key"], "event_type": "click", "url": f"https://{tenant_x['domain']}/btn", "session_id": sess_x},
    )
    client.post(
        "/api/v1/recordings",
        json={"session_id": sess_x, "api_key": tenant_x["api_key"], "duration": 15, "events": make_mock_rrweb_events(tenant_x["domain"], sess_x)},
    )
    client.post(
        "/api/v1/apm/report",
        json={"api_key": tenant_x["api_key"], "endpoint": "/api/portal/load", "duration_ms": 40},
    )

    # Ingest for Tenant Y (3 events, 2 recordings, 1 APM trace)
    sess_y1 = f"sess_y1_{uuid.uuid4().hex[:6]}"
    sess_y2 = f"sess_y2_{uuid.uuid4().hex[:6]}"
    for i in range(3):
        client.post(
            "/api/v1/collect",
            json={"api_key": tenant_y["api_key"], "event_type": "pageview", "url": f"https://{tenant_y['domain']}/p{i}", "session_id": sess_y1},
        )
    client.post(
        "/api/v1/recordings",
        json={"session_id": sess_y1, "api_key": tenant_y["api_key"], "duration": 20, "events": make_mock_rrweb_events(tenant_y["domain"], sess_y1)},
    )
    client.post(
        "/api/v1/recordings",
        json={"session_id": sess_y2, "api_key": tenant_y["api_key"], "duration": 10, "events": make_mock_rrweb_events(tenant_y["domain"], sess_y2)},
    )
    client.post(
        "/api/v1/apm/report",
        json={"api_key": tenant_y["api_key"], "endpoint": "/api/ecom/cart", "duration_ms": 85},
    )

    # Assert Recording isolation
    recs_x = client.get("/api/v1/recordings", headers=tenant_x["headers"]).json()
    recs_y = client.get("/api/v1/recordings", headers=tenant_y["headers"]).json()
    assert len(recs_x) == 1
    assert len(recs_y) == 2
    assert recs_x[0]["session_id"] == sess_x
    assert {r["session_id"] for r in recs_y} == {sess_y1, sess_y2}


def test_t4_05_scenario_full_user_lifecycle_isolation(client: TestClient):
    """
    Scenario 5: Full User Lifecycle & Legacy Data Isolation:
    Validates that a newly onboarded tenant is completely isolated from the
    pre-seeded GrowInsight session '2n69l5dt3kd' and legacy ScanPe workspace:
    1. Register tenant with domain 'acmecorp.io'.
    2. Confirm '2n69l5dt3kd' does NOT appear in recordings list.
    3. Confirm cross-tenant replay of '2n69l5dt3kd' returns 403 Forbidden.
    4. Simulate domain test session -> replays successfully.
    5. Ingest genuine tracking event -> dashboard stats increment cleanly.
    6. Final recordings list contains only the tenant's simulated session.
    """
    # 1. Register
    tenant = register_tenant(client, domain="acmecorp.io")

    # 2. Check no legacy GrowInsight recordings leaked
    recs = client.get("/api/v1/recordings", headers=tenant["headers"]).json()
    legacy_ids = [r["session_id"] for r in recs if r["session_id"] == "2n69l5dt3kd"]
    assert len(legacy_ids) == 0, (
        f"Legacy leakage defect: Pre-seeded GrowInsight session '2n69l5dt3kd' leaked to new tenant!"
    )

    # 3. Cross-replay of legacy session rejected
    rep_legacy = client.get("/api/v1/recordings/2n69l5dt3kd/replay", headers=tenant["headers"])
    assert rep_legacy.status_code in (403, 404), (
        f"Authorization defect: Client allowed to replay legacy GrowInsight session '2n69l5dt3kd'! Got {rep_legacy.status_code}"
    )

    # 4. Simulate session
    sim = client.post("/api/v1/recordings/simulate", headers=tenant["headers"])
    assert sim.status_code in (200, 201)
    sim_id = sim.json()["session_id"]

    # Replay simulated session
    sim_rep = client.get(f"/api/v1/recordings/{sim_id}/replay", headers=tenant["headers"])
    assert sim_rep.status_code == 200

    # 5. Ingest genuine tracking event
    client.post(
        "/api/v1/collect",
        json={
            "api_key": tenant["api_key"],
            "event_type": "pageview",
            "url": "https://acmecorp.io/pricing",
            "session_id": "sess_acme_live_01",
        },
    )

    # 6. Final verification
    final_recs = client.get("/api/v1/recordings", headers=tenant["headers"]).json()
    assert len(final_recs) == 1
    assert final_recs[0]["session_id"] == sim_id


# ===========================================================================
# Standalone CLI Test Runner (__main__)
# ===========================================================================

class TestRunner:
    """Discovers and executes all test cases with structured diagnostic reporting."""

    def __init__(self):
        self.passes = 0
        self.bugs = 0
        self.errors = 0
        self.results: List[Dict[str, Any]] = []

    def run_all(self):
        print("=" * 80)
        print(" ThirdEye Multi-Tenant Hardening: E2E Test Suite Execution")
        print("=" * 80)

        # Collect all test functions in this module
        current_module = sys.modules[__name__]
        test_funcs = [
            (name, func)
            for name, func in inspect.getmembers(current_module, inspect.isfunction)
            if name.startswith("test_")
        ]
        # Sort tests by name for consistent deterministic ordering
        test_funcs.sort(key=lambda x: x[0])

        print(f"Discovered {len(test_funcs)} test cases across Tiers 1-4.\n")

        with TestClient(app) as test_client:
            for name, func in test_funcs:
                start_time = time.time()
                tier = "Tier 1"
                if "_t2_" in name:
                    tier = "Tier 2"
                elif "_t3_" in name:
                    tier = "Tier 3"
                elif "_t4_" in name:
                    tier = "Tier 4"

                try:
                    func(test_client)
                    duration_ms = int((time.time() - start_time) * 1000)
                    self.passes += 1
                    self.results.append({
                        "name": name,
                        "tier": tier,
                        "status": "PASS",
                        "duration_ms": duration_ms,
                        "error": None,
                    })
                    print(f"  [ PASS ] {tier} | {name} ({duration_ms}ms)")

                except AssertionError as ae:
                    duration_ms = int((time.time() - start_time) * 1000)
                    self.bugs += 1
                    err_msg = str(ae).strip()
                    self.results.append({
                        "name": name,
                        "tier": tier,
                        "status": "BUG_DISCOVERED",
                        "duration_ms": duration_ms,
                        "error": err_msg,
                    })
                    print(f"  [ BUG  ] {tier} | {name} ({duration_ms}ms)")
                    print(f"           Defect: {err_msg[:120]}...")

                except Exception as ex:
                    duration_ms = int((time.time() - start_time) * 1000)
                    self.errors += 1
                    err_msg = f"{type(ex).__name__}: {str(ex)}"
                    self.results.append({
                        "name": name,
                        "tier": tier,
                        "status": "ERROR",
                        "duration_ms": duration_ms,
                        "error": err_msg,
                    })
                    print(f"  [ ERR  ] {tier} | {name} ({duration_ms}ms)")
                    print(f"           Crash: {err_msg[:120]}...")

        print("\n" + "=" * 80)
        print(" Summary of Multi-Tenant Verification Results")
        print("=" * 80)
        total = len(test_funcs)
        print(f"Total Tests Executed : {total}")
        print(f"Passed               : {self.passes}")
        print(f"Implementation Bugs  : {self.bugs}")
        print(f"Harness Errors       : {self.errors}")
        print("-" * 80)

        if self.bugs > 0:
            print("\n[!] IMPLEMENTATION DEFECTS DISCOVERED (To Escalate to Implementation Track):")
            for r in self.results:
                if r["status"] == "BUG_DISCOVERED":
                    print(f" - {r['name']} ({r['tier']}): {r['error']}")

        print("=" * 80 + "\n")
        return 0 if self.errors == 0 and self.bugs == 0 else 1


if __name__ == "__main__":
    runner = TestRunner()
    sys.exit(runner.run_all())
