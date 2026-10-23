#!/usr/bin/env python3
"""Enterprise Suite tests: incident webhooks, journeys, goals, feedback, tenant isolation."""
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
from app import enterprise


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def register_tenant(c: TestClient, domain: str = "example.com"):
    uid = uuid.uuid4().hex[:8]
    clean = domain.replace("https://", "").replace("http://", "").strip("/")
    resp = c.post("/api/auth/register", json={
        "email": f"tenant_{uid}@{clean}", "password": f"SecurePass_{uid}!9", "name": f"Client {uid}",
        "domain": clean, "organization_name": f"Org_{uid}",
    })
    assert resp.status_code == 200, resp.text
    headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    p = c.get("/api/v1/projects/status", headers=headers).json()
    return headers, p["project_id"], p["api_key"], clean


def pageview(c, key, sid, domain, path):
    r = c.post("/api/v1/collect", json={"api_key": key, "session_id": sid, "event_type": "pageview",
                                         "url": f"https://{domain}{path}"})
    assert r.status_code == 200, r.text


@pytest.fixture
def sent(monkeypatch):
    calls = []

    def fake_post(url, payload):
        calls.append((url, payload))
        return 200
    monkeypatch.setattr(enterprise, "_post_json", fake_post)
    return calls


# ------------------------------------------------------------ 1. incidents
def test_01_payload_formats():
    slack = enterprise.build_slack_payload("DB down", "boom", "uptime_downtime", {"URL": "https://x.io"})
    blocks = slack["attachments"][0]["blocks"]
    assert slack["attachments"][0]["color"] == "#F43F5E"
    assert blocks[0]["type"] == "header" and blocks[1]["type"] == "section"
    discord = enterprise.build_discord_payload("DB down", "boom", "uptime_downtime", {"URL": "https://x.io"})
    emb = discord["embeds"][0]
    assert emb["color"] == 0xF43F5E and emb["fields"][0] == {"name": "URL", "value": "https://x.io", "inline": True}


def test_02_monitor_down_dispatches_logs_and_cooldown(client, sent):
    headers, pid, key, domain = register_tenant(client, "incident-a.com")
    client.post("/api/v1/alert-channels", headers=headers,
                json={"name": "S", "type": "slack", "config": {"url": "https://hooks.slack.test/a"}})
    client.post("/api/v1/alert-channels", headers=headers,
                json={"name": "D", "type": "discord", "config": {"url": "https://discord.test/a"}})
    mon = client.post("/api/v1/monitors", headers=headers,
                      json={"name": "Dead", "url": "http://127.0.0.1:1/", "project_id": pid}).json()

    assert client.post(f"/api/v1/monitors/{mon['id']}/check", headers=headers).json()["status"] == "down"
    urls = sorted(u for u, _ in sent)
    assert urls == ["https://discord.test/a", "https://hooks.slack.test/a"]
    by_url = dict(sent)
    assert "attachments" in by_url["https://hooks.slack.test/a"]
    assert "embeds" in by_url["https://discord.test/a"]

    hist = client.get("/api/v1/incidents/history", headers=headers).json()
    assert len(hist) == 2 and all(h["status"] == "delivered" and h["incident_type"] == "uptime_downtime" for h in hist)

    # second check within cooldown -> no new webhooks, no new log rows
    client.post(f"/api/v1/monitors/{mon['id']}/check", headers=headers)
    assert len(sent) == 2
    assert len(client.get("/api/v1/incidents/history", headers=headers).json()) == 2


def test_03_failed_delivery_is_logged(client, monkeypatch):
    headers, pid, key, domain = register_tenant(client, "incident-fail.com")
    client.post("/api/v1/alert-channels", headers=headers,
                json={"name": "W", "type": "webhook", "config": {"url": "https://bad.test/h"}})

    def boom(url, payload):
        raise RuntimeError("connection refused")
    monkeypatch.setattr(enterprise, "_post_json", boom)
    mon = client.post("/api/v1/monitors", headers=headers,
                      json={"name": "Dead", "url": "http://127.0.0.1:1/", "project_id": pid}).json()
    client.post(f"/api/v1/monitors/{mon['id']}/check", headers=headers)
    hist = client.get("/api/v1/incidents/history", headers=headers).json()
    assert len(hist) == 1 and hist[0]["status"] == "failed"


def test_04_error_spike_triggers_incident(client, sent):
    headers, pid, key, domain = register_tenant(client, "spike.com")
    client.post("/api/v1/alert-channels", headers=headers,
                json={"name": "S", "type": "slack", "config": {"url": "https://hooks.slack.test/spike"}})
    for i in range(enterprise.ERROR_SPIKE_THRESHOLD):
        client.post("/api/v1/collect", json={"api_key": key, "session_id": f"e{i}", "event_type": "code_error",
                                              "url": f"https://{domain}/", "properties": {"message": "x"}})
    assert len(sent) == 1  # one dispatch despite continued errors (cooldown)
    client.post("/api/v1/collect", json={"api_key": key, "session_id": "e99", "event_type": "code_error",
                                          "url": f"https://{domain}/"})
    assert len(sent) == 1
    hist = client.get("/api/v1/incidents/history", headers=headers).json()
    assert hist[0]["incident_type"] == "error_spike"


# -------------------------------------------------------------- 2. journeys
def test_05_journey_aggregation_and_isolation(client):
    ha, pa, ka, da = register_tenant(client, "journey-a.com")
    hb, pb, kb, db_ = register_tenant(client, "journey-b.com")
    for sid, path in [("a1", ["/", "/pricing", "/register"]), ("a2", ["/", "/pricing", "/register"]),
                      ("a3", ["/", "/blog"]), ("a4", ["/", "/", "/pricing"])]:
        for p in path:
            pageview(client, ka, sid, da, p)
    pageview(client, kb, "b1", db_, "/secret-b")

    j = client.get("/api/v1/analytics/journeys", headers=ha).json()
    assert j["total_sessions"] == 4
    root = j["tree"][0]
    assert root["name"] == "/" and root["count"] == 4
    pricing = next(c for c in root["children"] if c["name"] == "/pricing")
    assert pricing["count"] == 3 and pricing["drop_off"] == 1   # a4 stopped at /pricing
    assert j["top_paths"][0]["steps"] == ["/", "/pricing", "/register"] and j["top_paths"][0]["sessions"] == 2
    assert set(j["top_paths"][0]["sample_session_ids"]) == {"a1", "a2"}
    assert "/secret-b" not in str(j)

    jb = client.get("/api/v1/analytics/journeys", headers=hb).json()
    assert jb["total_sessions"] == 1 and "/pricing" not in str(jb)
    # cannot peek into another tenant's project
    assert client.get(f"/api/v1/analytics/journeys?project_id={pa}", headers=hb).json()["total_sessions"] == 0


# ----------------------------------------------------------------- 3. goals
def test_06_goals_attribution_and_isolation(client):
    ha, pa, ka, da = register_tenant(client, "goals-a.com")
    hb, pb, kb, db_ = register_tenant(client, "goals-b.com")

    g_url = client.post("/api/v1/goals", headers=ha, json={"name": "Signup", "type": "url",
                                                           "target": "/thank-you", "revenue_usd": 50})
    assert g_url.status_code == 200
    g_click = client.post("/api/v1/goals", headers=ha, json={"name": "CTA", "type": "click",
                                                             "target": "#buy-btn", "revenue_usd": 10}).json()
    assert client.post("/api/v1/goals", headers=ha, json={"name": "x", "type": "bogus", "target": "y"}).status_code == 422

    for sid in ("s1", "s2", "s3", "s4"):
        pageview(client, ka, sid, da, "/")
    pageview(client, ka, "s1", da, "/thank-you")
    pageview(client, ka, "s2", da, "/thank-you/")     # trailing slash still matches
    pageview(client, ka, "s2", da, "/thank-you")      # duplicate completion counted once per session
    client.post("/api/v1/collect", json={"api_key": ka, "session_id": "s3", "event_type": "click",
                                          "url": f"https://{da}/", "properties": {"selectors": ["#buy-btn", "button"]}})
    pageview(client, kb, "other", db_, "/thank-you")  # another tenant's visit must not count

    data = client.get("/api/v1/goals", headers=ha).json()
    goals = {g["name"]: g for g in data["goals"]}
    assert goals["Signup"]["completions"] == 2 and goals["Signup"]["revenue"] == 100
    assert goals["Signup"]["conversion_rate"] == 50.0
    assert goals["CTA"]["completions"] == 1 and goals["CTA"]["revenue"] == 10
    assert data["kpis"]["total_revenue"] == 110 and data["kpis"]["total_sessions"] == 4
    assert data["kpis"]["total_completions"] == 3
    assert data["kpis"]["conversion_rate"] == 75.0   # s1, s2, s3 converted of 4

    # isolation
    assert client.get("/api/v1/goals", headers=hb).json()["goals"] == []
    assert client.delete(f"/api/v1/goals/{g_click['id']}", headers=hb).status_code == 404
    assert client.delete(f"/api/v1/goals/{g_click['id']}", headers=ha).status_code == 200
    assert len(client.get("/api/v1/goals", headers=ha).json()["goals"]) == 1


def test_07_goals_require_auth(client):
    assert client.get("/api/v1/goals").status_code in (401, 403)
    assert client.post("/api/v1/goals", json={"name": "a", "target": "/b"}).status_code in (401, 403)
    assert client.get("/api/v1/analytics/journeys").status_code in (401, 403)
    assert client.get("/api/v1/analytics/feedback").status_code in (401, 403)
    assert client.get("/api/v1/incidents/history").status_code in (401, 403)


# -------------------------------------------------------------- 4. feedback
def test_08_feedback_ingestion_session_linkage_and_isolation(client):
    ha, pa, ka, da = register_tenant(client, "fb-a.com")
    hb, pb, kb, db_ = register_tenant(client, "fb-b.com")

    # invalid / missing key -> 401, never written anywhere
    assert client.post("/api/v1/feedback", json={"api_key": "nope", "rating": 5}).status_code == 401
    assert client.post("/api/v1/feedback", json={"rating": 5}).status_code == 401
    assert client.post("/api/v1/feedback", json={"api_key": ka, "rating": 9}).status_code == 422

    # a real recording so the feedback can link to a replay
    client.post("/api/v1/recordings", json={"api_key": ka, "session_id": "fbsess1", "duration": 5,
                                             "events": [{"type": 4, "data": {"href": f"https://{da}/"}, "timestamp": 1}]})
    for rating, comment, trig in [(5, "great", "widget"), (4, "good", "widget"), (1, "button broken", "rage_click")]:
        r = client.post("/api/v1/feedback", json={"api_key": ka, "rating": rating, "comment": comment,
                                                   "url": f"https://{da}/", "session_id": "fbsess1", "trigger": trig})
        assert r.status_code == 200

    out = client.get("/api/v1/analytics/feedback", headers=ha).json()
    s = out["summary"]
    assert s["total"] == 3 and s["average_rating"] == 3.33
    assert (s["positive"], s["neutral"], s["negative"]) == (2, 0, 1)
    assert all(i["session_id"] == "fbsess1" for i in out["items"])
    assert any(i["trigger"] == "rage_click" and i["sentiment"] == "negative" for i in out["items"])

    # B sees nothing of A
    ob = client.get("/api/v1/analytics/feedback", headers=hb).json()
    assert ob["summary"]["total"] == 0 and ob["items"] == []


def test_09_feedback_widget_toggle_and_simulate(client):
    ha, pa, ka, da = register_tenant(client, "toggle.com")
    cfg = client.get(f"/api/v1/feedback/config?api_key={ka}").json()
    assert cfg["enabled"] is False                       # off by default
    assert client.get("/api/v1/feedback/config?api_key=bad").status_code == 401

    upd = client.put("/api/v1/feedback/settings", headers=ha, json={"enabled": True, "prompt": "Rate us"})
    assert upd.status_code == 200
    cfg = client.get(f"/api/v1/feedback/config?api_key={ka}").json()
    assert cfg == {"enabled": True, "prompt": "Rate us"}

    assert client.post("/api/v1/feedback/simulate", headers=ha).json()["created"] == 4
    items = client.get("/api/v1/analytics/feedback", headers=ha).json()["items"]
    assert len(items) == 4 and all(da in i["url"] for i in items)


# -------------------------------------------------------------- 5. phase 1.5
def test_10_phase1_5_masking_and_hostinger_validation(client):
    headers, pid, key, domain = register_tenant(client, "phase15.com")
    # Create an email channel with a secret smtp_pass
    ch = client.post("/api/v1/alert-channels", headers=headers, json={
        "name": "Hostinger Ops",
        "type": "email",
        "config": {
            "to": "ops@phase15.com",
            "smtp_host": "smtp.hostinger.com",
            "smtp_port": "465",
            "smtp_user": "alerts@phase15.com",
            "smtp_pass": "SuperSecretHostingerPass999"
        },
        "events": ["uptime_down", "ssl_expiry"]
    }).json()

    # GET must mask smtp_pass with ••••s999
    channels = client.get("/api/v1/alert-channels", headers=headers).json()
    assert len(channels) == 1
    masked_pass = channels[0]["config"]["smtp_pass"]
    assert masked_pass.startswith("••••") and masked_pass.endswith("s999")
    assert "SuperSecret" not in masked_pass

    # PUT with the masked password should preserve the original secret in DB
    upd = client.put(f"/api/v1/alert-channels/{ch['id']}", headers=headers, json={
        "name": "Hostinger Ops Updated",
        "config": channels[0]["config"],
        "events": ["uptime_down", "ssl_expiry", "quota_limit"]
    })
    assert upd.status_code == 200
    assert upd.json()["events"] == ["uptime_down", "ssl_expiry", "quota_limit"]

    # Create an email channel WITHOUT smtp_pass and verify test endpoint returns failed (never fake delivered)
    ch_bad = client.post("/api/v1/alert-channels", headers=headers, json={
        "name": "Incomplete SMTP",
        "type": "email",
        "config": {"to": "ops@phase15.com", "smtp_user": "alerts@phase15.com", "smtp_pass": ""}
    }).json()
    test_res = client.post(f"/api/v1/alert-channels/{ch_bad['id']}/test", headers=headers).json()
    assert test_res["status"] == "failed" and test_res["success"] is False
    assert "Hostinger SMTP credentials required" in (test_res["error"] or "")


