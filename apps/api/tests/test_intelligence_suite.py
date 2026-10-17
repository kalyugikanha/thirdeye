#!/usr/bin/env python3
"""AI Copilot & Engineering Intelligence Suite tests.

Covers:
1. AI RAG Workspace Copilot (/api/v1/copilot/context, /api/v1/copilot/ask)
2. Release & Deployment Impact Tracker (/api/v1/releases, /api/v1/releases/webhook, regression delta)
3. Browser Network XHR / Fetch Failure Inspector (/api/v1/network/collect, /api/v1/network/requests)
4. User Retention Cohort Matrix (/api/v1/analytics/cohorts, /api/v1/analytics/cohorts/simulate)
5. Strict Multi-Tenant Data Isolation
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
        "email": f"tenant_{uid}@{clean}",
        "password": f"SecurePass_{uid}!9",
        "name": f"Client {uid}",
        "domain": clean,
        "organization_name": f"Org_{uid}",
    })
    assert resp.status_code == 200, resp.text
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    p = c.get("/api/v1/projects/status", headers=headers).json()
    return headers, p["project_id"], p["api_key"], clean


# =====================================================================
# 1. AI RAG WORKSPACE COPILOT
# =====================================================================
def test_01_copilot_context_and_ask_personas(client):
    headers, pid, api_key, domain = register_tenant(client, "copilot-tenant.com")

    # Fetch context snapshot
    ctx_res = client.get("/api/v1/copilot/context", headers=headers)
    assert ctx_res.status_code == 200
    ctx = ctx_res.json()
    assert ctx["domain"] == domain
    assert "total_sessions_7d" in ctx
    assert "code_errors_7d" in ctx
    assert "avg_csat_score" in ctx

    # Test Engineering persona asking about bugs
    eng_res = client.post("/api/v1/copilot/ask", headers=headers, json={
        "query": "What is our current bug and error status?",
        "persona": "engineering"
    })
    assert eng_res.status_code == 200
    eng_data = eng_res.json()
    assert eng_data["persona"] == "engineering"
    assert "Error" in eng_data["title"]
    assert len(eng_data["recommended_actions"]) > 0

    # Test Growth persona asking about conversions
    growth_res = client.post("/api/v1/copilot/ask", headers=headers, json={
        "query": "How are our conversion goals performing?",
        "persona": "growth"
    })
    assert growth_res.status_code == 200
    growth_data = growth_res.json()
    assert "Conversion & Growth Intelligence" in growth_data["title"]


# =====================================================================
# 2. RELEASE & DEPLOYMENT IMPACT TRACKER
# =====================================================================
def test_02_release_tracking_and_webhook(client):
    headers, pid, api_key, domain = register_tenant(client, "releases-tenant.com")

    # 1. Webhook ingestion with api_key
    hook_res = client.post("/api/v1/releases/webhook", json={
        "api_key": api_key,
        "version": "v1.2.0",
        "commit_sha": "abc1234",
        "environment": "production",
        "notes": "Automated deployment from GitHub Actions",
        "deployed_by": "GitHub Actions"
    })
    assert hook_res.status_code == 200
    rel_id = hook_res.json()["id"]

    # 2. List releases for tenant
    rels = client.get("/api/v1/releases", headers=headers).json()
    assert len(rels) >= 1
    found = next(r for r in rels if r["id"] == rel_id)
    assert found["version"] == "v1.2.0"
    assert found["status_verdict"] == "healthy"

    # 3. Manual release creation via dashboard
    man_res = client.post("/api/v1/releases", headers=headers, json={
        "version": "v1.3.0",
        "commit_sha": "def5678",
        "environment": "staging",
        "notes": "Feature test deploy"
    })
    assert man_res.status_code == 200

    # 4. Release simulation (creates sample releases and regression errors)
    sim_res = client.post("/api/v1/releases/simulate", headers=headers)
    assert sim_res.status_code == 200
    sim_rels = client.get("/api/v1/releases", headers=headers).json()
    # At least one should be flagged as regression due to simulated post-release errors
    regressions = [r for r in sim_rels if r["status_verdict"] == "regression"]
    assert len(regressions) >= 1


# =====================================================================
# 3. BROWSER NETWORK XHR / FETCH FAILURE INSPECTOR
# =====================================================================
def test_03_network_failure_collection_and_kpis(client):
    headers, pid, api_key, domain = register_tenant(client, "network-tenant.com")

    # Ingest 500 error
    net1 = client.post("/api/v1/network/collect", json={
        "api_key": api_key,
        "session_id": "sess_net_1",
        "page_url": f"https://{domain}/checkout",
        "endpoint_url": f"https://{domain}/api/pay",
        "method": "POST",
        "status_code": 500,
        "duration_ms": 1250
    })
    assert net1.status_code == 200

    # Ingest 404 client error
    net2 = client.post("/api/v1/network/collect", json={
        "api_key": api_key,
        "session_id": "sess_net_2",
        "page_url": f"https://{domain}/users",
        "endpoint_url": f"https://{domain}/api/missing",
        "method": "GET",
        "status_code": 404,
        "duration_ms": 120
    })
    assert net2.status_code == 200

    # Query network summary
    res = client.get("/api/v1/network/requests", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["kpis"]["total"] >= 2
    assert data["kpis"]["errors_5xx"] >= 1
    assert data["kpis"]["errors_4xx"] >= 1
    assert data["kpis"]["slow_requests"] >= 1
    assert len(data["endpoints"]) >= 2
    assert len(data["recent_requests"]) >= 2

    # Simulation endpoint
    sim = client.post("/api/v1/network/simulate", headers=headers)
    assert sim.status_code == 200
    assert sim.json()["created"] > 0


# =====================================================================
# 4. RETENTION COHORT MATRIX
# =====================================================================
def test_04_retention_cohorts_and_simulation(client):
    headers, pid, api_key, domain = register_tenant(client, "cohorts-tenant.com")

    # Simulate 4-week cohort events
    sim_res = client.post("/api/v1/analytics/cohorts/simulate", headers=headers)
    assert sim_res.status_code == 200
    assert sim_res.json()["created_events"] > 0

    # Retrieve calculated cohort matrix
    matrix_res = client.get("/api/v1/analytics/cohorts?weeks=5", headers=headers)
    assert matrix_res.status_code == 200
    matrix = matrix_res.json()
    assert "cohorts" in matrix
    assert len(matrix["cohorts"]) >= 1
    first_cohort = matrix["cohorts"][0]
    assert "cohort" in first_cohort
    assert first_cohort["size"] > 0
    assert len(first_cohort["retention"]) == 5
    # Week 0 retention should be 100%
    assert first_cohort["retention"][0] == 100.0


# =====================================================================
# 5. STRICT MULTI-TENANT ISOLATION
# =====================================================================
def test_05_strict_multitenant_isolation(client):
    # Register Tenant Alpha
    ha, pa, ka, da = register_tenant(client, "alpha-tenant.com")
    # Register Tenant Beta
    hb, pb, kb, db = register_tenant(client, "beta-tenant.com")

    # Ingest release and network request for Alpha
    client.post("/api/v1/releases/webhook", json={
        "api_key": ka,
        "version": "v1.0.0-alpha",
        "commit_sha": "alpha999"
    })
    client.post("/api/v1/network/collect", json={
        "api_key": ka,
        "session_id": "sess_alpha_99",
        "page_url": f"https://{da}/app",
        "endpoint_url": f"https://{da}/api/alpha-secret",
        "method": "GET",
        "status_code": 500,
        "duration_ms": 300
    })

    # Assert Tenant Beta sees 0 releases and 0 network requests
    beta_rels = client.get("/api/v1/releases", headers=hb).json()
    assert len(beta_rels) == 0

    beta_net = client.get("/api/v1/network/requests", headers=hb).json()
    assert beta_net["kpis"]["total"] == 0
    assert len(beta_net["recent_requests"]) == 0
    assert len(beta_net["endpoints"]) == 0
