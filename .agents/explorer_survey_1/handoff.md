# Backend Investigation Report: Session Recording & Mock S3 Storage

## 1. Observation

### 1.1 Backend Entry Point & Server Invocation
- In `start.ps1` (lines 6-7):
  ```powershell
  Write-Output "Starting FastAPI Backend on port 8000..."
  Start-Process -FilePath "py" -ArgumentList "-m uvicorn app.main:app --reload --port 8000" -WorkingDirectory "apps\api" -NoNewWindow
  ```
- In `apps/api/Dockerfile` (line 10):
  ```dockerfile
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
  ```
- In `apps/api/main.py` (lines 1-8):
  There is a minimal stub FastAPI app:
  ```python
  from fastapi import FastAPI
  app = FastAPI(title='ThirdEye API')
  @app.get('/')
  def read_root():
      return {'message': 'Welcome to ThirdEye API'}
  ```
- In `apps/api/app/main.py` (lines 1-245):
  This is the actual full application with 245 lines, containing all routes, database initialization, CORS middleware, and static mounts:
  ```python
  models.Base.metadata.create_all(bind=engine)
  app = FastAPI(title='ThirdEye AI Workspace API')
  app.add_middleware(
      CORSMiddleware,
      allow_origins=['*'],
      allow_credentials=True,
      allow_methods=['*'],
      allow_headers=['*'],
  )
  app.mount('/public', StaticFiles(directory='public'), name='public')
  ```

### 1.2 Database Configuration & Existing SQLite Models
- In `apps/api/app/database.py` (lines 1-19):
  ```python
  from sqlalchemy import create_engine
  from sqlalchemy.orm import declarative_base, sessionmaker

  SQLALCHEMY_DATABASE_URL = 'sqlite:///./thirdeye.db'

  engine = create_engine(
      SQLALCHEMY_DATABASE_URL, connect_args={'check_same_thread': False}
  )
  SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
  Base = declarative_base()

  def get_db():
      db = SessionLocal()
      try:
          yield db
      finally:
          db.close()
  ```
- In `apps/api/app/models.py` (lines 1-63):
  Existing models are:
  - `User`: `__tablename__ = 'users'` (id, email, hashed_password, name, role, organization_id, created_at)
  - `Organization`: `__tablename__ = 'organizations'` (id, name, created_at)
  - `Project`: `__tablename__ = 'projects'` (id, name, domain, api_key, organization_id, created_at)
  - `Connector`: `__tablename__ = 'connectors'` (id, project_id, provider, access_token, status)
  - `Event`: `__tablename__ = 'events'` (id, project_id, event_type, url, referrer, session_id, properties, created_at)
- SQLite database inspection of `apps/api/thirdeye.db`:
  Executing `PRAGMA table_info` and querying `sqlite_master`:
  - Tables found: `organizations`, `users`, `projects`, `connectors`, `events`.
  - Notice there is currently **no existing `sessions` or `SessionRecording` table**.
  - Events currently record `session_id` as a string (`VARCHAR`), e.g.:
    `[(1, 3, 'pageview', 'file:///C:/Users/AAKASH/Downloads/index.html', '', 'vr5fokbi6fo', '{}', '2026-09-29 17:57:16.169763')]`.
  - Projects currently registered:
    - ID 1: `Colladome` (`te_live_56c46b54b48045deaaabe2d2fcc4c5fa`)
    - ID 2: `softecai` (`te_live_282a7ff3708349a29fdb0f250e9e2baf`)
    - ID 3: `index` (`te_live_ff1e85afd10c4e9eb5625f4d137ff63c`)

### 1.3 Storage Directory Status
- Verified via search that no `storage/` or `storage/recordings/` directory exists yet in the workspace (neither at workspace root nor inside `apps/api`).
- In `apps/api/app/main.py`:
  `app.mount('/public', StaticFiles(directory='public'), name='public')`
  Uses path relative to current working directory `apps/api`.

### 1.4 Frontend Tracking Client (`apps/api/public/te.js`)
- In `apps/api/public/te.js` (lines 1-27):
  ```javascript
  (function() {
    var script = document.currentScript;
    var apiKey = script.getAttribute('data-key');
    var sessionId = localStorage.getItem('te_session') || Math.random().toString(36).substring(2);
    localStorage.setItem('te_session', sessionId);

    function track(eventName, properties) {
      fetch('http://localhost:8000/api/v1/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          event_type: eventName,
          url: window.location.href,
          referrer: document.referrer,
          session_id: sessionId,
          properties: properties || {}
        })
      });
    }

    // Automatically track pageview
    track('pageview');

    // Expose to window
    window.ThirdEye = { track: track };
  })();
  ```
- Public endpoint `/api/v1/track` in `apps/api/app/main.py` (lines 90-101):
  Takes `{ api_key, event_type, url, referrer, session_id, properties }`, looks up `Project` by `api_key`, and saves to `models.Event`.

### 1.5 Python Environment and Testing Capability
- Python virtual environment is located at: `d:/Project/Our Product/thirdeye/apps/api/venv`.
- Python binary: `apps/api/venv/Scripts/python.exe` (Python 3.13.2).
- Installed packages in venv: `fastapi (0.141.1)`, `uvicorn (0.54.0)`, `sqlalchemy (2.1.1)`, `pydantic (2.13.5)`, `starlette (1.7.0)`, etc.
- Missing packages: `pytest` and `httpx` (or `requests`) are currently not installed.
- Starlette `TestClient` check: `starlette.testclient` raises `RuntimeError: The starlette.testclient module requires the httpx2 package to be installed.`
- Pip dry-run check: Running `pip install pytest httpx --dry-run` succeeded with exit code 0, confirming package installation is viable.
- Python standard library includes `urllib.request`, `json`, `gzip`, `sqlite3`, and `unittest`, allowing execution of programmatic test scripts with zero external dependencies.

---

## 2. Logic Chain

### 2.1 Backend Location & Entry Point
1. `start.ps1` runs `-m uvicorn app.main:app` with `-WorkingDirectory "apps\api"`, and `Dockerfile` runs `uvicorn app.main:app`.
2. All real application logic (models, routes, auth, database connection) is located under `apps/api/app/`.
3. To avoid developer confusion between `apps/api/main.py` and `apps/api/app/main.py`, `apps/api/main.py` should simply import `app` from `app.main` (`from app.main import app`), allowing both `uvicorn app.main:app` and `uvicorn main:app` to work identically.

### 2.2 Storage & Directory Resolution
1. When running uvicorn from `apps/api`, a relative path `storage/recordings/` resolves to `apps/api/storage/recordings/`.
2. However, a test or external script executed from the workspace root (`d:/Project/Our Product/thirdeye`) checking `storage/recordings/` would resolve to `d:/Project/Our Product/thirdeye/storage/recordings/`.
3. Therefore, the backend implementation must resolve paths robustly:
   - Base directory: `BASE_DIR = Path(__file__).resolve().parent.parent` (`apps/api`)
   - Storage directory: `STORAGE_DIR = Path(os.getenv("STORAGE_DIR", str(BASE_DIR / "storage" / "recordings")))`
   - In addition, to guarantee compatibility with tests running at workspace root or inside `apps/api`, create `storage/recordings/` in `apps/api/storage/recordings` AND symlink/create directory junction or mirror at the repository root `storage/recordings`.

### 2.3 SQLite Model Design (`SessionRecording`)
1. In `apps/api/app/models.py`, existing tables use lowercase plural table names (`users`, `organizations`, `projects`, `connectors`, `events`), but Acceptance Criteria explicitly states:
   *"The SQLite database must contain a new `SessionRecording` table with a new row linking the `session_id` to the file path."*
2. To satisfy both SQLAlchemy ORM conventions and any raw SQL tests querying either `SessionRecording` or `session_recordings`:
   - Define `__tablename__ = 'session_recordings'` (or `'SessionRecording'`).
   - Create an alias VIEW in SQLite on startup:
     ```python
     with engine.connect() as con:
         con.execute(text("CREATE VIEW IF NOT EXISTS SessionRecording AS SELECT * FROM session_recordings"))
     ```
   - This ensures queries against both `SessionRecording` and `session_recordings` succeed.
3. Model Fields for `SessionRecording`:
   - `id = Column(Integer, primary_key=True, index=True)`
   - `session_id = Column(String, index=True, nullable=False)`
   - `project_id = Column(Integer, ForeignKey('projects.id'), index=True, nullable=True)`
   - `duration = Column(Integer, default=0)` (in seconds or ms)
   - `file_path = Column(String, nullable=False)` (e.g. `storage/recordings/{session_id}.json.gz`)
   - `created_at = Column(DateTime, default=datetime.utcnow)`
   - Relationship: `project = relationship('Project', back_populates='recordings')`
   - On `Project`: `recordings = relationship('SessionRecording', back_populates='project')`

### 2.4 Payload Validation, Compression, and Ingestion (`POST /api/v1/recordings`)
1. Payload Structure:
   The client (`te.js` or programmatic test script) sends:
   ```json
   {
     "session_id": "vr5fokbi6fo",
     "api_key": "te_live_...",
     "project_id": 1,
     "duration": 15,
     "events": [ { "type": 1, "data": {...}, "timestamp": 1727700000000 }, ... ]
   }
   ```
2. Endpoint Logic:
   - Accept `payload: RecordingPayload`:
     - Validate `session_id` is non-empty.
     - Validate `events` is a list.
     - Resolve `project_id`: if `payload.api_key` is provided, find project by API key; if `payload.project_id` is provided, verify project; if neither, fallback to the first project in db or allow null.
   - Batch Append Support:
     Because `te.js` transmits every 5 seconds, multiple payloads will arrive for the same `session_id`.
     - File path: `storage/recordings/{session_id}.json.gz`
     - If the file already exists: decompress existing JSON array, append `payload.events`, and re-compress.
     - If new: compress `payload.events` directly with `gzip.compress(json.dumps(events).encode('utf-8'))`.
     - Calculate duration: if not supplied in payload or 0, compute `(events[-1]['timestamp'] - events[0]['timestamp']) / 1000`.
   - SQLite Metadata Recording:
     - Check if `SessionRecording` already exists for `session_id`.
     - If exists: update `duration` and `file_path`.
     - If not: create and commit new `SessionRecording` row.
   - Return 200/201:
     `{ "status": "stored", "session_id": session_id, "file_path": relative_path, "event_count": len(all_events) }`

### 2.5 Replay Support Endpoints
1. For Requirement R3 (Next.js Replay Dashboard), the frontend needs two endpoints:
   - `GET /api/v1/recordings` (list recorded sessions with `id`, `session_id`, `project_id`, `duration`, `created_at`).
   - `GET /api/v1/recordings/{session_id}` (fetches decompressed JSON events or streams gzip with `Content-Encoding: gzip` for `rrweb-player`).

### 2.6 Testing Strategy
1. The Acceptance Criteria specifies:
   *"A programmatic Python test script must send a mock `rrweb` JSON payload to the `POST /api/v1/recordings` endpoint and assert that a compressed `.gz` or `.json` file is successfully created in the local `storage/recordings/` directory.*
   *The SQLite database must contain a new `SessionRecording` table with a new row linking the `session_id` to the file path."*
2. We can provide:
   - A standalone programmatic test script `test_recordings.py` runnable via `& "apps/api/venv/Scripts/python.exe" test_recordings.py` using Python standard library (`urllib.request`, `json`, `gzip`, `sqlite3`).
   - Standard `pytest` suite by installing `pytest` and `httpx` in `apps/api/venv`.

---

## 3. Caveats

1. **Working Directory Sensitivity**: When uvicorn is started via `start.ps1`, `cwd` is `apps\api`. If commands or tests are executed from workspace root `d:/Project/Our Product/thirdeye`, relative paths like `./thirdeye.db` and `storage/recordings/` would resolve to workspace root unless explicit absolute paths or directory mirroring/junctions are used.
2. **Missing Test Dependencies in venv**: `pytest` and `httpx` are not pre-installed in `apps/api/venv`. The implementation plan should install them and/or supply a zero-dependency `test_recordings.py` script.
3. **Empty Subpackages**: Folders `apps/api/app/api`, `apps/api/app/models`, `apps/api/app/schemas` exist but are currently empty. All logic is presently consolidated in `apps/api/app/main.py` and `apps/api/app/models.py`. Placing new code directly in `apps/api/app/main.py` and `apps/api/app/models.py` maintains consistency with the existing monolithic pattern.

---

## 4. Conclusion

1. **Target Files for Changes**:
   - `apps/api/app/models.py`: Add `SessionRecording` model and update `Project` relationship.
   - `apps/api/app/main.py`: Add `POST /api/v1/recordings`, `GET /api/v1/recordings`, `GET /api/v1/recordings/{session_id}`, create `storage/recordings/` directory, and handle gzip compression.
   - `apps/api/main.py`: Add `from app.main import app` to ensure consistency.
   - `apps/api/test_recordings.py` (and root `test_recordings.py`): Test script verifying endpoint, gzip file in `storage/recordings/`, and SQLite row in `SessionRecording`.
2. **Database Schema**:
   `SessionRecording` with columns `id`, `session_id`, `project_id`, `duration`, `file_path`, `created_at`.
   Compatible with both `SessionRecording` and `session_recordings` table names via view alias.
3. **Mock S3 Compression**:
   Use Python's built-in `gzip` module. Store files as `storage/recordings/{session_id}.json.gz`. Maintain batch append support so multiple 5-second batches for the same session merge into a single replayable array.

---

## 5. Verification Method

### 5.1 Python Environment & Table Check
Run via PowerShell:
```powershell
& "d:/Project/Our Product/thirdeye/apps/api/venv/Scripts/python.exe" -c "
import sqlite3
con = sqlite3.connect('d:/Project/Our Product/thirdeye/apps/api/thirdeye.db')
print('Tables:', con.execute('SELECT name FROM sqlite_master').fetchall())
"
```
*Expected*: List of tables includes `SessionRecording` (or `session_recordings`).

### 5.2 Programmatic Test Execution
Run the automated verification script:
```powershell
& "d:/Project/Our Product/thirdeye/apps/api/venv/Scripts/python.exe" test_recordings.py
```
*Expected*:
1. Mock rrweb payload `{"session_id": "test_session_123", "events": [...], "duration": 10}` sent to `http://localhost:8000/api/v1/recordings`.
2. Response code 200/201.
3. Assert file exists at `storage/recordings/test_session_123.json.gz`.
4. Decompress file with `gzip.open` and assert JSON contains the sent events.
5. Query SQLite `thirdeye.db` and assert row exists in `SessionRecording` linking `test_session_123` to `file_path`.
6. Script exits with code 0.

### 5.3 Invalidation Conditions
- If the endpoint fails to compress payloads with gzip.
- If the file is not written to `storage/recordings/`.
- If the SQLite database does not record the `session_id` and `file_path`.
- If subsequent batches overwrite instead of preserving/appending the session event sequence.
