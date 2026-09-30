import sys
import os
import json
import gzip
import sqlite3
from pathlib import Path

# Add apps/api to path
api_dir = Path("d:/Project/Our Product/thirdeye/apps/api").resolve()
sys.path.insert(0, str(api_dir))
os.chdir(str(api_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app import models

client = TestClient(app)

def test_full_m1_lifecycle():
    print("--- [E2E] ThirdEye Milestone 1 Verification ---")

    # 1. Verify root route
    root_resp = client.get("/")
    assert root_resp.status_code == 200
    assert root_resp.json() == {"message": "Welcome to ThirdEye API"}
    print("[PASS] GET / -> 200 OK")

    # 2. Test validation error (empty session_id)
    bad_resp = client.post("/api/v1/recordings", json={"session_id": "", "events": []})
    assert bad_resp.status_code == 400
    print("[PASS] Validation: empty session_id correctly returns 400")

    # 3. Test POST /api/v1/recordings (Batch 1)
    session_id = "sess_e2e_integration_test_999"
    storage_api_dir = Path("d:/Project/Our Product/thirdeye/apps/api/storage/recordings")
    storage_root_dir = Path("d:/Project/Our Product/thirdeye/storage/recordings")

    # Clean up prior artifacts if any
    for p in [storage_api_dir / f"{session_id}.json.gz", storage_root_dir / f"{session_id}.json.gz"]:
        if p.exists():
            p.unlink()

    db = SessionLocal()
    db.query(models.SessionRecording).filter(models.SessionRecording.session_id == session_id).delete()
    db.commit()

    batch_1 = [
        {"type": 0, "data": {}, "timestamp": 1727701000000},
        {"type": 1, "data": {"text": "***"}, "timestamp": 1727701002000},
        {"type": 2, "data": {"x": 150, "y": 250}, "timestamp": 1727701005000}
    ]

    resp1 = client.post("/api/v1/recordings", json={
        "session_id": session_id,
        "duration": 5,
        "events": batch_1
    })
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["status"] == "stored"
    assert data1["session_id"] == session_id
    assert data1["file_path"] == f"storage/recordings/{session_id}.json.gz"
    assert data1["event_count"] == 3
    print(f"[PASS] Batch 1 stored: {data1}")

    # Check file exists and is valid gzip
    gz_file_api = storage_api_dir / f"{session_id}.json.gz"
    gz_file_root = storage_root_dir / f"{session_id}.json.gz"
    assert gz_file_api.exists(), f"Mock S3 file missing at {gz_file_api}"
    assert gz_file_root.exists(), f"Mock S3 file missing at {gz_file_root}"

    with gzip.open(gz_file_api, "rt", encoding="utf-8") as f:
        events_from_gz = json.load(f)
    assert events_from_gz == batch_1
    print("[PASS] File exists on disk as valid gzip with exact batch 1 events.")

    # 4. Test Continuous Batch Append (Batch 2)
    batch_2 = [
        {"type": 3, "data": {"scroll": 300}, "timestamp": 1727701010000},
        {"type": 4, "data": {"input": "***"}, "timestamp": 1727701015000}
    ]

    resp2 = client.post("/api/v1/recordings", json={
        "session_id": session_id,
        "duration": 15,
        "events": batch_2
    })
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "stored"
    assert data2["event_count"] == 5
    print(f"[PASS] Batch 2 appended: {data2}")

    with gzip.open(gz_file_api, "rt", encoding="utf-8") as f:
        events_appended = json.load(f)
    assert len(events_appended) == 5
    assert events_appended == batch_1 + batch_2
    print("[PASS] Continuous batch append verified: merged array contains 5 sequential events.")

    # 5. Verify SQLite SessionRecording Table & View
    with sqlite3.connect("thirdeye.db") as sconn:
        sconn.row_factory = sqlite3.Row
        row_table = sconn.execute("SELECT * FROM session_recordings WHERE session_id = ?", (session_id,)).fetchone()
        row_view = sconn.execute("SELECT * FROM SessionRecording WHERE session_id = ?", (session_id,)).fetchone()
        
        assert row_table is not None, "Row missing in session_recordings table"
        assert row_view is not None, "Row missing in SessionRecording view"
        assert row_table["session_id"] == session_id
        assert row_table["duration"] == 15
        assert row_table["file_path"] == f"storage/recordings/{session_id}.json.gz"
        assert row_view["duration"] == 15
        print(f"[PASS] SQLite verified via table & view: id={row_table['id']}, duration={row_table['duration']}, file_path={row_table['file_path']}")

    # 6. Test GET /api/v1/recordings (List)
    list_resp = client.get("/api/v1/recordings")
    assert list_resp.status_code == 200
    records = list_resp.json()
    assert any(r["session_id"] == session_id for r in records)
    print(f"[PASS] GET /api/v1/recordings: successfully listed {len(records)} recordings.")

    # 7. Test GET /api/v1/recordings/{session_id} (Replay Fetch)
    replay_resp = client.get(f"/api/v1/recordings/{session_id}")
    assert replay_resp.status_code == 200
    replay_data = replay_resp.json()
    assert len(replay_data) == 5
    assert replay_data == batch_1 + batch_2
    print(f"[PASS] GET /api/v1/recordings/{session_id}: returned decompressed JSON array of 5 events.")

    # Test replay alias route
    replay_alias_resp = client.get(f"/api/v1/recordings/{session_id}/replay")
    assert replay_alias_resp.status_code == 200
    assert replay_alias_resp.json() == batch_1 + batch_2
    print("[PASS] GET /api/v1/recordings/{session_id}/replay: alias route returned identical JSON events.")

    # Test gzip stream retrieval
    gzip_stream_resp = client.get(f"/api/v1/recordings/{session_id}?stream_gzip=true")
    assert gzip_stream_resp.status_code == 200
    assert gzip_stream_resp.headers.get("Content-Encoding") == "gzip"
    # Note: httpx / TestClient transparently decompresses gzip payloads
    if gzip_stream_resp.content.startswith(b"[{"):
        decompressed_events = json.loads(gzip_stream_resp.text)
    else:
        decompressed_events = json.loads(gzip.decompress(gzip_stream_resp.content).decode("utf-8"))
    assert decompressed_events == batch_1 + batch_2
    print("[PASS] GET /api/v1/recordings/{session_id}?stream_gzip=true: gzip stream verified.")

    # 8. Test 404 for missing session
    not_found_resp = client.get("/api/v1/recordings/does_not_exist_404")
    assert not_found_resp.status_code == 404
    print("[PASS] GET /api/v1/recordings/{missing}: correctly returned 404.")

    db.close()
    print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_full_m1_lifecycle()
