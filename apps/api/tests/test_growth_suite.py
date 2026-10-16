#!/usr/bin/env python3
"""Growth & Optimization Suite tests: multi-domain projects, Core Web Vitals RUM, Form Analytics, A/B Experiments."""
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


# ------------------------------------------- 1. Multi-Domain Project Switcher
def test_01_multi_project_creation_and_tenant_isolation(client):
    ha, pa, ka, da = register_tenant(client, "primary-a.com")
    hb, pb, kb, db_ = register_tenant(client, "primary-b.com")

    # Initial project list has 1 domain
    projs_a = client.get("/api/v1/projects", headers=ha).json()
    assert len(projs_a) == 1 and projs_a[0]["domain"] == da

    # Add second domain for Tenant A
    new_proj = client.post("/api/v1/projects", headers=ha, json={"domain": "shop.primary-a.com"})
    assert new_proj.status_code == 200
    np_data = new_proj.json()
    assert np_data["domain"] == "shop.primary-a.com"
    assert np_data["api_key"].startswith("te_live_")

    projs_a2 = client.get("/api/v1/projects", headers=ha).json()
    assert len(projs_a2) == 2

    # Switch status endpoint to second project
    st2 = client.get(f"/api/v1/projects/status?project_id={np_data['id']}", headers=ha).json()
    assert st2["project_id"] == np_data["id"] and st2["domain"] == "shop.primary-a.com"

    # Tenant B must never see Tenant A's projects
    projs_b = client.get("/api/v1/projects", headers=hb).json()
    assert len(projs_b) == 1 and projs_b[0]["domain"] == db_
    st_cross = client.get(f"/api/v1/projects/status?project_id={np_data['id']}", headers=hb).json()
    assert st_cross["project_id"] == pb and st_cross["domain"] == db_


# ------------------------------------------- 2. Core Web Vitals & RUM
def test_02_core_web_vitals_ingestion_and_p75_scoring(client):
    ha, pa, ka, da = register_tenant(client, "cwv-a.com")
    hb, pb, kb, db_ = register_tenant(client, "cwv-b.com")

    # Invalid API key rejected with 401
    assert client.post("/api/v1/rum/vitals", json={
        "api_key": "invalid_key", "session_id": "s1", "url": "https://cwv-a.com/"
    }).status_code == 401

    # Ingest 4 vitals samples for Tenant A
    samples = [
        ("s1", "/", "Desktop", 1200, 60, 0.02, 180),
        ("s2", "/", "Desktop", 1500, 90, 0.04, 210),
        ("s3", "/pricing", "Mobile", 2100, 140, 0.06, 310),
        ("s4", "/pricing", "Desktop", 1800, 110, 0.03, 240),
    ]
    for sid, path, dev, lcp, inp, cls_s, ttfb in samples:
        r = client.post("/api/v1/rum/vitals", json={
            "api_key": ka,
            "session_id": sid,
            "url": f"https://{da}{path}",
            "device": dev,
            "lcp_ms": lcp,
            "inp_ms": inp,
            "cls_score": cls_s,
            "ttfb_ms": ttfb,
        })
        assert r.status_code == 200

    summary = client.get("/api/v1/rum/vitals", headers=ha).json()
    assert summary["total_samples"] == 4
    assert summary["res_score"] == 100
    assert summary["metrics"]["lcp"]["rating"] == "good"
    assert summary["metrics"]["inp"]["rating"] == "good"
    assert summary["metrics"]["cls"]["rating"] == "good"
    assert len(summary["routes"]) == 2
    assert len(summary["devices"]) == 2

    # Tenant B sees 0 samples
    summary_b = client.get("/api/v1/rum/vitals", headers=hb).json()
    assert summary_b["total_samples"] == 0


# ------------------------------------------- 3. Form Abandonment Analytics
def test_03_form_abandonment_funnel_and_field_metrics(client):
    ha, pa, ka, da = register_tenant(client, "forms-a.com")
    hb, pb, kb, db_ = register_tenant(client, "forms-b.com")

    # Simulate checkout funnel on Tenant A
    sim = client.post("/api/v1/analytics/forms/simulate", headers=ha)
    assert sim.status_code == 200

    forms_data = client.get("/api/v1/analytics/forms", headers=ha).json()
    kpis = forms_data["kpis"]
    assert kpis["total_starts"] == 5
    assert kpis["total_submissions"] == 2
    assert kpis["completion_rate"] == 40.0
    assert kpis["abandonment_rate"] == 60.0

    form = forms_data["forms"][0]
    assert form["form_id"] == "checkout-form"
    assert len(form["abandoned_session_ids"]) == 3
    fields_by_name = {f["field"]: f for f in form["fields"]}
    assert fields_by_name["card_number"]["drop_off_count"] == 2
    assert fields_by_name["phone"]["drop_off_count"] == 1

    # Tenant B sees 0 forms
    forms_b = client.get("/api/v1/analytics/forms", headers=hb).json()
    assert forms_b["kpis"]["total_starts"] == 0 and forms_b["forms"] == []


# ------------------------------------------- 4. A/B Testing & Feature Flags
def test_04_ab_experiments_bucketing_and_lift(client):
    ha, pa, ka, da = register_tenant(client, "abtest-a.com")
    hb, pb, kb, db_ = register_tenant(client, "abtest-b.com")

    exp_resp = client.post("/api/v1/experiments", headers=ha, json={
        "key": "hero_cta_test",
        "name": "Hero Button Test",
        "target_url": "/pricing",
        "selector": "#cta-btn",
        "control_text": "Sign Up",
        "variant_text": "Start Free Trial",
        "goal_target": "/thank-you",
        "traffic_split": 50,
    })
    assert exp_resp.status_code == 200
    exp_id = exp_resp.json()["id"]

    # Public active experiments endpoint for te.js
    active = client.get(f"/api/v1/experiments/active?api_key={ka}").json()
    assert len(active) == 1 and active[0]["key"] == "hero_cta_test"
    assert client.get("/api/v1/experiments/active?api_key=invalid").status_code == 401

    # Simulate split traffic (20 A with 4 conversions = 20%, 20 B with 7 conversions = 35% -> +75% lift)
    sim = client.post(f"/api/v1/experiments/{exp_id}/simulate", headers=ha)
    assert sim.status_code == 200

    exps = client.get("/api/v1/experiments", headers=ha).json()
    assert len(exps) == 1
    e = exps[0]
    assert e["control"]["exposures"] == 20 and e["control"]["conversions"] == 4
    assert e["variant"]["exposures"] == 20 and e["variant"]["conversions"] == 7
    assert e["control"]["conversion_rate"] == 20.0
    assert e["variant"]["conversion_rate"] == 35.0
    assert e["lift_pct"] == 75.0
    assert e["winner"] == "B"

    # Cross-tenant isolation: Tenant B cannot view, pause, or delete Tenant A's experiment
    assert client.get("/api/v1/experiments", headers=hb).json() == []
    assert client.patch(f"/api/v1/experiments/{exp_id}", headers=hb, json={"status": "paused"}).status_code == 404
    assert client.delete(f"/api/v1/experiments/{exp_id}", headers=hb).status_code == 404

    # Tenant A can pause and delete
    assert client.patch(f"/api/v1/experiments/{exp_id}", headers=ha, json={"status": "paused"}).status_code == 200
    assert client.get(f"/api/v1/experiments/active?api_key={ka}").json() == []
    assert client.delete(f"/api/v1/experiments/{exp_id}", headers=ha).status_code == 200
    assert client.get("/api/v1/experiments", headers=ha).json() == []
