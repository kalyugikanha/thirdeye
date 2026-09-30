import sys
import os
import json
import gzip
import sqlite3
from pathlib import Path

# Add apps/api to path
api_dir = Path("d:/Project/Our Product/thirdeye/apps/api").resolve()
sys.path.insert(0, str(api_dir))

# Change directory to apps/api to simulate standard startup
os.chdir(str(api_dir))

from app.database import engine, SessionLocal
from app import models, main

print("1. Checking models and table/view creation...")
with engine.connect() as conn:
    cursor = conn.exec_driver_sql("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view')")
    items = cursor.fetchall()
    names = [row[0] for row in items]
    print(f"Database items found: {names}")
    assert "session_recordings" in names, "Table 'session_recordings' not found!"
    assert "SessionRecording" in names, "View 'SessionRecording' not found!"

# Verify querying via both names
with sqlite3.connect("thirdeye.db") as sconn:
    c1 = sconn.execute("SELECT COUNT(*) FROM session_recordings").fetchone()
    c2 = sconn.execute("SELECT COUNT(*) FROM SessionRecording").fetchone()
    print(f"Row count via session_recordings: {c1[0]}, via SessionRecording: {c2[0]}")
    assert c1[0] == c2[0], "Row count mismatch between table and view!"

print("2. Checking storage directories...")
storage_api = Path("d:/Project/Our Product/thirdeye/apps/api/storage/recordings")
storage_root = Path("d:/Project/Our Product/thirdeye/storage/recordings")
assert storage_api.exists(), f"Directory {storage_api} does not exist!"
assert storage_root.exists(), f"Directory {storage_root} does not exist!"
print("Storage directories verified.")

print("3. Testing POST /api/v1/recordings endpoint...")
db = SessionLocal()
test_session_id = "test_verify_session_42"

# Clean up any previous test artifacts
for p in [storage_api / f"{test_session_id}.json.gz", storage_root / f"{test_session_id}.json.gz"]:
    if p.exists():
        p.unlink()
db.query(models.SessionRecording).filter(models.SessionRecording.session_id == test_session_id).delete()
db.commit()

# Payload 1: initial batch
batch1_events = [
    {"type": 1, "data": {"text": "***"}, "timestamp": 1727700000000},
    {"type": 2, "data": {"x": 100, "y": 200}, "timestamp": 1727700005000}
]

payload1 = main.RecordingPayload(
    session_id=test_session_id,
    duration=5,
    events=batch1_events
)

resp1 = main.create_or_append_recording(payload1, db=db)
print("Batch 1 response:", resp1)
assert resp1["status"] == "stored"
assert resp1["session_id"] == test_session_id
assert resp1["event_count"] == 2

# Verify file created on disk in both directories
file1_api = storage_api / f"{test_session_id}.json.gz"
file1_root = storage_root / f"{test_session_id}.json.gz"
assert file1_api.exists(), f"File {file1_api} was not created!"
assert file1_root.exists(), f"File {file1_root} was not created!"

# Verify gzip decompression
with gzip.open(file1_api, "rt", encoding="utf-8") as f:
    decompressed1 = json.load(f)
assert decompressed1 == batch1_events, "Decompressed events do not match batch 1!"
print("Batch 1 gzip decompression successfully verified.")

# Payload 2: continuous batch append
batch2_events = [
    {"type": 3, "data": {"scroll": 50}, "timestamp": 1727700010000}
]

payload2 = main.RecordingPayload(
    session_id=test_session_id,
    duration=10,
    events=batch2_events
)

resp2 = main.create_or_append_recording(payload2, db=db)
print("Batch 2 response:", resp2)
assert resp2["status"] == "stored"
assert resp2["event_count"] == 3

# Verify merged file
with gzip.open(file1_api, "rt", encoding="utf-8") as f:
    decompressed2 = json.load(f)
assert len(decompressed2) == 3, f"Expected 3 merged events, got {len(decompressed2)}"
assert decompressed2 == batch1_events + batch2_events, "Merged events do not match combined batches!"
print("Continuous batch append verified.")

print("4. Testing SQLite SessionRecording table entry...")
rec = db.query(models.SessionRecording).filter(models.SessionRecording.session_id == test_session_id).first()
assert rec is not None, "SessionRecording row not found in DB!"
assert rec.session_id == test_session_id
assert rec.duration == 10
assert rec.file_path == f"storage/recordings/{test_session_id}.json.gz"
print(f"SessionRecording row verified: id={rec.id}, session_id={rec.session_id}, duration={rec.duration}, file_path={rec.file_path}")

print("5. Testing GET /api/v1/recordings listing...")
recordings_list = main.list_recordings(db=db)
matching = [r for r in recordings_list if r["session_id"] == test_session_id]
assert len(matching) == 1, "Recording not listed in GET /api/v1/recordings!"
assert matching[0]["duration"] == 10
assert matching[0]["file_path"] == f"storage/recordings/{test_session_id}.json.gz"
print("Listing endpoint verified.")

print("6. Testing GET /api/v1/recordings/{session_id} playback retrieval...")
from starlette.requests import Request
from starlette.datastructures import Headers

mock_request = Request({"type": "http", "method": "GET", "headers": [(b"accept", b"application/json")]})
replay_events = main.get_recording(session_id=test_session_id, request=mock_request)
assert replay_events == batch1_events + batch2_events, "Replay events do not match combined batch!"
print("Replay retrieval endpoint verified.")

# Test gzip response
mock_request_gzip = Request({"type": "http", "method": "GET", "headers": [(b"accept", b"application/gzip")]})
replay_gzip = main.get_recording(session_id=test_session_id, request=mock_request_gzip)
assert replay_gzip.headers["Content-Encoding"] == "gzip"
assert gzip.decompress(replay_gzip.body) == json.dumps(batch1_events + batch2_events).encode("utf-8")
print("Gzip replay streaming verified.")

print("7. Testing main.py re-export...")
import main as root_main
assert hasattr(root_main, "app"), "root main.py does not export 'app'!"
assert root_main.app == main.app, "root main.py 'app' does not match app.main:app!"
print("Re-export verified.")

db.close()
print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
