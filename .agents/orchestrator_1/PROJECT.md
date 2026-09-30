# Project: ThirdEye UX Session Recording Module

## Architecture
ThirdEye UX Session Recording captures client-side DOM mutations, mouse movements, and scrolls using `rrweb` inside `public/te.js`, transmits batched JSON payloads every 5 seconds to a FastAPI backend at `POST /api/v1/recordings`, compresses and stores the payloads as `.json.gz` files in a Mock S3 storage directory (`storage/recordings/`), records metadata (`session_id`, `project_id`, `duration`, `file_path`) in SQLite (`SessionRecording`), and provides a Next.js App Router replay dashboard at `/analytics/sessions` using `rrweb-player`.

### Component Boundaries
- **Snippet (`apps/api/public/te.js`)**: Dynamic rrweb loader, strict privacy masking (redacting all text and inputs to `***`), event buffering, 5-second interval flushing, unload beacon.
- **Backend (`apps/api/app/main.py`, `models.py`)**: Ingestion endpoint `POST /api/v1/recordings`, listing `GET /api/v1/recordings`, replay fetch `GET /api/v1/recordings/{session_id}`, gzip compression, SQLite `SessionRecording` table and view.
- **Storage (`storage/recordings/`)**: Local filesystem directory acting as Mock S3 bucket storing `{session_id}.json.gz`.
- **Frontend (`apps/web/src/app/analytics/sessions/`)**: Sessions listing table, `ReplayPlayer` component with SSR avoidance (`next/dynamic` with `ssr: false`), `rrweb-player` styling, transparent gzip decompression.
- **Testing & QA (`test_recordings.py`)**: Programmatic verification scripts for storage, database, compilation, and syntax.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Mock S3 Storage Directory | Directory `storage/recordings/` created and maintained for compressed session files | M1 | ORIGINAL_REQUEST R2 |
| 2 | SQLite SessionRecording Model | `SessionRecording` table & view with columns (id, session_id, project_id, duration, file_path, created_at) | M1 | ORIGINAL_REQUEST R2 & AC |
| 3 | Ingestion Endpoint `POST /api/v1/recordings` | Ingests JSON batches, compresses with gzip, handles multi-batch appends, saves metadata | M1 | ORIGINAL_REQUEST R2 |
| 4 | Replay Retrieval Endpoints | `GET /api/v1/recordings` (list) and `GET /api/v1/recordings/{session_id}` (playback data) | M1 | ORIGINAL_REQUEST R2, R3 |
| 5 | rrweb Dynamic Integration in `te.js` | Embedded/dynamic loader for rrweb in `public/te.js` with fallback | M2 | ORIGINAL_REQUEST R1 |
| 6 | Interaction & Mutation Capture | Captures full DOM mutations, mouse movements, and scrolls | M2 | ORIGINAL_REQUEST R1 |
| 7 | Strict Privacy Masking | Mask ALL text and inputs into `***` via `maskAllInputs`, `maskInputFn`, `maskTextSelector`, `maskTextFn` | M2 | ORIGINAL_REQUEST R1 |
| 8 | 5-Second Cadence Batching | In-memory buffer flushed every 5s and on page unload | M2 | ORIGINAL_REQUEST R1 |
| 9 | rrweb-player NPM & Types | Add `rrweb` and `rrweb-player` to `apps/web/package.json` with ambient TypeScript definitions | M3 | ORIGINAL_REQUEST R3 & AC |
| 10 | SSR-Safe Replay Component | `ReplayPlayer.tsx` isolated with `next/dynamic(..., { ssr: false })` preventing window/document crashes | M3 | ORIGINAL_REQUEST R3 |
| 11 | Sessions Listing & Player UI | Page at `apps/web/src/app/analytics/sessions/page.tsx` listing sessions and playing back with `rrweb-player` | M3 | ORIGINAL_REQUEST R3 |
| 12 | Navigation Integration | Add link/tabs between `/analytics` and `/analytics/sessions` | M3 | ORIGINAL_REQUEST R3 |
| 13 | Programmatic Python Verification Script | Test script asserting `storage/recordings/` `.json.gz` creation and SQLite `SessionRecording` entry | M4 | ORIGINAL_REQUEST AC |
| 14 | Build & Syntax Verification | Next.js compilation verification and `node --check te.js` syntax verification | M4 | ORIGINAL_REQUEST AC |
| 15 | Forensic Integrity Verification | Systematic audit ensuring genuine logic, no test hardcoding, no mock bypasses | M4 | Integrity Forensics |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Mock S3 Storage & SQLite | `POST /api/v1/recordings`, `GET /api/v1/recordings`, gzip storage in `storage/recordings/`, `SessionRecording` table | none | PLANNED |
| M2 | Snippet rrweb Recording & Strict Masking | `apps/api/public/te.js` capturing DOM mutations, mouse movements, scrolls, strict `***` masking, 5s batching | M1 | PLANNED |
| M3 | Frontend Replay UI Dashboard | `apps/web/src/app/analytics/sessions/page.tsx`, `ReplayPlayer.tsx`, ambient types, Next.js build | M1 | PLANNED |
| M4 | E2E Testing, Acceptance & Forensic Audit | `test_recordings.py`, Next.js build test, `te.js` syntax test, Challenger & Forensic Auditor gates | M1, M2, M3 | PLANNED |

---

## Interface Contracts

### 1. Snippet / Client ↔ Backend Ingestion
- **URL**: `POST /api/v1/recordings`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "session_id": "string (non-empty)",
    "api_key": "string (optional)",
    "project_id": "integer (optional)",
    "duration": "integer (seconds)",
    "events": [
      {
        "type": 0,
        "data": {},
        "timestamp": 1727700000000
      }
    ]
  }
  ```
- **Response**: `200 OK` or `201 Created`
  ```json
  {
    "status": "stored",
    "session_id": "string",
    "file_path": "storage/recordings/{session_id}.json.gz",
    "event_count": 42
  }
  ```
- **Error Handling**: Missing `session_id` or invalid `events` returns `400 Bad Request`.

### 2. Frontend Replay UI ↔ Backend Replay Endpoints
- **List Sessions**:
  - `GET /api/v1/recordings?project_id={id}`
  - **Headers**: `Authorization: Bearer <token>` (optional/supported)
  - **Response**:
    ```json
    [
      {
        "id": 1,
        "session_id": "vr5fokbi6fo",
        "project_id": 1,
        "duration": 45,
        "file_path": "storage/recordings/vr5fokbi6fo.json.gz",
        "created_at": "2026-09-30T10:00:00Z"
      }
    ]
    ```
- **Fetch Session Events**:
  - `GET /api/v1/recordings/{session_id}` (or `GET /api/v1/recordings/{session_id}/replay`)
  - **Response**: Return JSON events array directly OR gzip compressed stream with `Content-Encoding: gzip` / `Content-Type: application/json`.

---

## Code Layout
- Backend Models: `apps/api/app/models.py`
- Backend Application & Endpoints: `apps/api/app/main.py`, `apps/api/main.py`
- Mock S3 Storage Directory: `apps/api/storage/recordings/` and workspace root `storage/recordings/`
- Tracking Snippet: `apps/api/public/te.js`
- Local rrweb Fallback Script: `apps/api/public/rrweb-record.min.js`
- Frontend Replay Page: `apps/web/src/app/analytics/sessions/page.tsx`
- Frontend Replay Player: `apps/web/src/app/analytics/sessions/ReplayPlayer.tsx`
- Frontend Ambient Types: `apps/web/src/types/rrweb-player.d.ts`
- Frontend Navigation Tab: `apps/web/src/app/analytics/page.tsx`
- Programmatic Verification Script: `test_recordings.py` and `apps/api/test_recordings.py`
