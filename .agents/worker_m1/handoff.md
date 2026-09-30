# Milestone 1 (M1) Handoff Report: Backend Session Recording Storage & Replay API

## 1. Observation

### 1.1 Model & Database Schema
- File: `apps/api/app/models.py`
  - Added bidirectional relationship `recordings` on `Project`:
    ```python
    recordings = relationship('SessionRecording', back_populates='project')
    ```
  - Added `SessionRecording` model:
    ```python
    class SessionRecording(Base):
        __tablename__ = 'session_recordings'
        id = Column(Integer, primary_key=True, index=True)
        session_id = Column(String, index=True, nullable=False)
        project_id = Column(Integer, ForeignKey('projects.id'), index=True, nullable=True)
        duration = Column(Integer, default=0)
        file_path = Column(String, nullable=False)
        created_at = Column(DateTime, default=datetime.utcnow)

        project = relationship('Project', back_populates='recordings')
    ```
  - In `apps/api/app/main.py`:
    On startup, `models.Base.metadata.create_all(bind=engine)` executes, followed by SQLite view creation and triggers ensuring both `session_recordings` table and `SessionRecording` view are available:
    ```sql
    CREATE VIEW IF NOT EXISTS SessionRecording AS SELECT * FROM session_recordings;
    CREATE TRIGGER IF NOT EXISTS insert_session_recording INSTEAD OF INSERT ON SessionRecording BEGIN
        INSERT INTO session_recordings (id, session_id, project_id, duration, file_path, created_at)
        VALUES (new.id, new.session_id, new.project_id, new.duration, new.file_path, new.created_at);
    END;
    ```
  - Direct database inspection confirmed both table and view:
    ```
    Database items found: ['organizations', 'users', 'projects', 'connectors', 'events', 'session_recordings', 'SessionRecording']
    ```

### 1.2 Storage Directories (Mock S3)
- Storage directories created and verified at:
  - `apps/api/storage/recordings/`
  - `storage/recordings/` (workspace root)
- Payloads compressed with Python's standard `gzip` module into `{session_id}.json.gz` and written synchronously to both locations, ensuring relative path resolution works whether executed from `apps/api/` or workspace root.

### 1.3 Endpoints Implemented in `apps/api/app/main.py`
- `POST /api/v1/recordings`:
  - Accepts `RecordingPayload`: `session_id` (str), `api_key` (optional str), `project_id` (optional int), `duration` (optional int), `events` (optional list).
  - Resolves `project_id` via `api_key` or `project_id`. If unresolved, matches existing session or event records.
  - Decompresses existing `.json.gz` if present, appends incoming events, re-compresses with `gzip`.
  - Calculates/updates duration from payload and event timestamps.
  - Updates or creates record in SQLite `SessionRecording` table.
  - Returns `{"status": "stored", "session_id": session_id, "file_path": "storage/recordings/{session_id}.json.gz", "event_count": len(all_events)}`.
- `GET /api/v1/recordings`:
  - Accepts optional `project_id: Optional[int] = None`.
  - Returns list of recordings: `[{"id": r.id, "session_id": r.session_id, "project_id": r.project_id, "duration": r.duration, "file_path": r.file_path, "created_at": r.created_at.isoformat() if r.created_at else None}]`.
- `GET /api/v1/recordings/{session_id}` and `GET /api/v1/recordings/{session_id}/replay`:
  - Locates `{session_id}.json.gz` in storage directories.
  - Returns decompressed JSON array by default, or gzip stream with `Content-Encoding: gzip` when `stream_gzip=True`, `raw=True`, or client header requests `application/gzip`.
  - Returns 404 if recording not found.
- Root route `GET /`:
  - Returns `{"message": "Welcome to ThirdEye API"}`.

### 1.4 Module Re-export in `apps/api/main.py`
- Re-exported FastAPI instance:
  ```python
  from app.main import app

  __all__ = ['app']
  ```

### 1.5 Verification Results
- Executed `verify_m1.py` with `apps/api/venv/Scripts/python.exe`:
  ```
  1. Checking models and table/view creation...
  Database items found: ['organizations', 'users', 'projects', 'connectors', 'events', 'session_recordings', 'SessionRecording']
  Row count via session_recordings: 0, via SessionRecording: 0
  2. Checking storage directories...
  Storage directories verified.
  3. Testing POST /api/v1/recordings endpoint...
  Batch 1 response: {'status': 'stored', 'session_id': 'test_verify_session_42', 'file_path': 'storage/recordings/test_verify_session_42.json.gz', 'event_count': 2}
  Batch 1 gzip decompression successfully verified.
  Batch 2 response: {'status': 'stored', 'session_id': 'test_verify_session_42', 'file_path': 'storage/recordings/test_verify_session_42.json.gz', 'event_count': 3}
  Continuous batch append verified.
  4. Testing SQLite SessionRecording table entry...
  SessionRecording row verified: id=1, session_id=test_verify_session_42, duration=10, file_path=storage/recordings/test_verify_session_42.json.gz
  5. Testing GET /api/v1/recordings listing...
  Listing endpoint verified.
  6. Testing GET /api/v1/recordings/{session_id} playback retrieval...
  Replay retrieval endpoint verified.
  Gzip replay streaming verified.
  7. Testing main.py re-export...
  Re-export verified.
  ALL VERIFICATIONS PASSED SUCCESSFULLY!
  ```
- Executed `pytest` on `test_e2e_m1.py`:
  ```
  ============================= test session starts =============================
  platform win32 -- Python 3.13.15, pytest-9.1.1, pluggy-1.6.0
  rootdir: d:\Project\Our Product\thirdeye
  plugins: anyio-4.15.1
  collected 1 item

  ..\..\.agents\worker_m1\test_e2e_m1.py .                                 [100%]
  ======================== 1 passed, 4 warnings in 4.74s ========================
  ```

---

## 2. Logic Chain

1. From **Observation 1.1**: The user request and acceptance criteria require a `SessionRecording` table in SQLite with `session_id`, `project_id`, `duration`, `file_path`, and `created_at`. Creating `session_recordings` as the underlying table and `SessionRecording` as an SQLite view (with `INSTEAD OF` triggers) satisfies both SQLAlchemy table naming patterns and direct queries against `SessionRecording`.
2. From **Observation 1.2**: In development and testing, processes may run either with working directory set to `apps/api` (as `start.ps1` does) or from the repository root. Writing `.json.gz` files to both `apps/api/storage/recordings/` and `storage/recordings/` guarantees path consistency regardless of current working directory.
3. From **Observation 1.3**: The client snippet flushes every 5 seconds. Storing only the most recent batch would overwrite earlier recording segments. Decompressing existing `.json.gz` events and appending incoming events before re-compressing ensures full session replay integrity.
4. From **Observation 1.4**: Pointing `apps/api/main.py` directly to `app.main:app` prevents discrepancies between `uvicorn main:app` and `uvicorn app.main:app`.
5. From **Observation 1.5**: Direct end-to-end testing with FastAPI `TestClient` and `pytest` validated:
   - Status 400 on empty `session_id`.
   - Creation of `.json.gz` files in storage directory.
   - Successful decompression and verification of event JSON array matching sent events.
   - Multiple sequential batches merging correctly.
   - SQLite table and view records accurately tracking `session_id`, `duration`, and `file_path`.
   - Retrieval via list and replay endpoints.

---

## 3. Caveats

- `email-validator`, `httpx`, and `pytest` were installed in `apps/api/venv`. If a fresh environment is used without `email-validator`, `apps/api/app/main.py` contains a safe fallback (`EmailStr = str`) to prevent runtime failures.
- No files outside the assigned write boundaries (`apps/api/app/models.py`, `apps/api/app/main.py`, `apps/api/main.py`, storage directories, and agent folder) were created or modified.

---

## 4. Conclusion

Milestone 1 is complete:
- `SessionRecording` SQLAlchemy model is registered and operational.
- SQLite view `SessionRecording` and table `session_recordings` are created and synchronized.
- Mock S3 storage directory `storage/recordings/` compresses and persists batched rrweb JSON payloads with continuous append capability.
- Ingestion (`POST /api/v1/recordings`), listing (`GET /api/v1/recordings`), and playback retrieval (`GET /api/v1/recordings/{session_id}`) endpoints are tested and passing all checks.
- A seed demo session (`sample_demo_session_colladome`) is loaded in project 1 for downstream workers.

---

## 5. Verification Method

### 5.1 Run Automated Pytest Suite
Run from workspace root:
```powershell
& "d:/Project/Our Product/thirdeye/apps/api/venv/Scripts/pytest.exe" "d:/Project/Our Product/thirdeye/.agents/worker_m1/test_e2e_m1.py" -v
```
Expected: 1 test passed (100%), exit code 0.

### 5.2 Standalone Lifecycle Verification Script
```powershell
& "d:/Project/Our Product/thirdeye/apps/api/venv/Scripts/python.exe" "d:/Project/Our Product/thirdeye/.agents/worker_m1/verify_m1.py"
```
Expected: All 7 verification stages pass with exit code 0.

### 5.3 Database Inspection
```powershell
& "d:/Project/Our Product/thirdeye/apps/api/venv/Scripts/python.exe" -c "
import sqlite3
con = sqlite3.connect('d:/Project/Our Product/thirdeye/apps/api/thirdeye.db')
print('Table count:', con.execute('SELECT count(*) FROM session_recordings').fetchone()[0])
print('View count:', con.execute('SELECT count(*) FROM SessionRecording').fetchone()[0])
"
```
Expected: Both return matching counts >= 1.

### 5.4 Invalidation Conditions
- If `POST /api/v1/recordings` does not write a `.json.gz` file to `storage/recordings/`.
- If consecutive POST requests overwrite rather than append events.
- If `SessionRecording` table/view does not contain row with `session_id` and `file_path`.
- If `GET /api/v1/recordings` does not list recordings.
- If `GET /api/v1/recordings/{session_id}` does not return the events array.
