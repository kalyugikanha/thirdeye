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
