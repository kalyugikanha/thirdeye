# Original User Request

## 2026-09-30T09:00:18Z

Build the UX Session Recording Module for ThirdEye. Integrate `rrweb` into the tracking snippet, build a Mock S3 backend to compress and store the heavy JSON payloads, and create a Session Replay dashboard using `rrweb-player`.

Working directory: d:/Project/Our Product/thirdeye
Integrity mode: development

## Requirements

### R1. JS Snippet Recording (`te.js`)
Integrate the `rrweb` library into the existing `public/te.js` script. It must capture full DOM mutations, mouse movements, and scrolls. **Strict Privacy:** Configure `rrweb` to mask ALL text and inputs (e.g., turn text into `***`) to ensure compliance. Batch and send the recording data as JSON to the backend every 5 seconds.

### R2. Mock S3 Storage Backend (FastAPI)
Create a new endpoint `POST /api/v1/recordings` to receive the batched `rrweb` JSON payloads. To prevent database bloat, the backend must compress the JSON (e.g., gzip) and save it to a local `storage/recordings/` directory (acting as a Mock S3 bucket). Only save the metadata (`session_id`, `project_id`, duration, and the local file path) in the existing SQLite database.

### R3. Session Replay UI (Next.js)
Create a new page at `apps/web/src/app/analytics/sessions/page.tsx`. It should list all recorded sessions for the user's project. When a session is selected, use the `rrweb-player` library to fetch the compressed JSON from the backend and play it back like a video.

## Acceptance Criteria

### Data Capture & Storage
- [ ] A programmatic Python test script must send a mock `rrweb` JSON payload to the `POST /api/v1/recordings` endpoint and assert that a compressed `.gz` or `.json` file is successfully created in the local `storage/recordings/` directory.
- [ ] The SQLite database must contain a new `SessionRecording` table with a new row linking the `session_id` to the file path.

### Build Verification
- [ ] The Next.js application must compile successfully without errors after adding `rrweb-player`.
- [ ] The `te.js` script must not throw syntax errors when loaded into a standard HTML file.

## 2026-09-30T17:16:46Z

Build a production-ready AI Insights Engine (connecting the dashboard search to Google Gemini to query analytics data) AND migrate the ThirdEye application from SQLite to PostgreSQL, including a Dockerfile for the Python backend.

Working directory: d:/Project/Our Product/thirdeye
Integrity mode: development

## Verification Resources
- A Google Gemini API key is available in the environment or can be provided upon request. 
- The team must handle setting up a temporary PostgreSQL instance (e.g., via Docker) to verify database migrations.

## Requirements

### R1. PostgreSQL Migration
Replace the existing SQLite database connection in `database.py` with a PostgreSQL connection. Ensure all SQLAlchemy models create correctly in Postgres. The system must maintain strict multi-tenant isolation by `organization_id` as previously implemented. No data migration of existing SQLite data is required; start with a clean schema.

### R2. AI Insights Engine (Text-to-SQL)
Implement an endpoint in the FastAPI backend that accepts a natural language query, uses the official Google Gemini API to translate the query into SQL based on the PostgreSQL schema, executes it safely (read-only) against the user's isolated data, and returns a plain-English insight.

### R3. Backend Dockerization
Create a `Dockerfile` specifically for the FastAPI backend in `apps/api/` (optimized for Python/AWS-like environments). Do not create a Dockerfile for the Next.js frontend, as it will be deployed natively to Vercel.

## Acceptance Criteria

### Database Migration
- [ ] A programmatic test script must connect to a PostgreSQL instance, successfully run `Base.metadata.create_all()`, insert a mock `Organization` and `User`, and retrieve them without schema errors.

### AI Integration
- [ ] A programmatic test script (e.g., `test_ai.py`) must successfully send a natural language query (like "How many users registered today?") to the new endpoint and assert that a valid JSON response containing the insight is returned.

### Docker Build
- [ ] Running `docker build -t thirdeye-api apps/api` must complete successfully without compilation errors.
