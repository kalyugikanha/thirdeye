## 2026-09-30T09:25:52Z

You are Worker M2 for the ThirdEye project.
Your working directory is: d:/Project/Our Product/thirdeye/.agents/worker_m2
The authoritative user request is located at: d:/Project/Our Product/thirdeye/.agents/ORIGINAL_REQUEST.md
The master project architecture is at: d:/Project/Our Product/thirdeye/.agents/orchestrator_1/PROJECT.md
The snippet survey handoff report is at: d:/Project/Our Product/thirdeye/.agents/explorer_survey_2/handoff.md
The workspace root is: d:/Project/Our Product/thirdeye
Your parent conversation ID is: c64e98df-902d-4971-a278-52a3d604839f

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Write Ownership:
You have exclusive write ownership of:
- `apps/api/public/te.js`
- `apps/api/public/rrweb-record.min.js` (and any companion static helper files in `apps/api/public/`)
Do NOT modify files outside your ownership boundary.

Tasks for Milestone 2 (M2):
1. Read ORIGINAL_REQUEST.md, PROJECT.md, and explorer_survey_2/handoff.md.
2. Implement `apps/api/public/te.js` according to Requirement R1:
   - Integrate `rrweb` recording:
     - Capture full DOM mutations (MutationObserver).
     - Capture mouse movements and mouse interactions (`sampling: { mousemove: true, mouseInteraction: true }`).
     - Capture scrolls (`sampling: { scroll: 150 }`).
   - Strict Privacy:
     - Mask ALL text and inputs (e.g. turn text into `***`).
     - `maskAllInputs: true`, `maskInputOptions: { password: true, email: true, tel: true, text: true, color: true, date: true }`, `maskInputFn: function(v, el) { return '***'; }`.
     - `maskTextSelector: '*'`, `maskTextFn: function(text, el) { if (!text || !text.trim()) return text; return '***'; }`.
   - Batching & Transmission:
     - In-memory event buffer.
     - Batch and send JSON to `POST /api/v1/recordings` every 5 seconds (`setInterval(flushRecordings, 5000)`).
     - Unload beacon: flush remaining buffer on `beforeunload` and `pagehide` using `navigator.sendBeacon` or `fetch` with `keepalive: true`.
     - Include payload: `{ session_id: sessionId, api_key: apiKey, duration: duration, events: batch }`.
   - Dynamic Script Loader:
     - If `rrweb` or `rrwebRecord` is not already loaded on window, dynamically inject script tag from CDN (`https://cdn.jsdelivr.net/npm/rrweb@latest/dist/record/rrweb-record.min.js`) with fallback to local `apiHost + '/public/rrweb-record.min.js'`.
     - Provide a standalone copy of `rrweb-record.min.js` in `apps/api/public/rrweb-record.min.js` so offline / local environments work seamlessly without internet access.
   - Maintain existing `pageview` tracking and `window.ThirdEye` global exposure.
3. Verification:
   - Run `node --check apps/api/public/te.js` to ensure zero syntax errors.
   - Run an automated test script (using node or python) to assert:
     a) `node --check` passes cleanly with exit code 0.
     b) Snippet contains required privacy masking parameters (`maskAllInputs: true`, `'***'`, `maskTextFn`).
     c) Snippet contains 5-second interval timer (5000) and `POST /api/v1/recordings`.
4. Update progress.md in your working directory.
5. Write your handoff report to `d:/Project/Our Product/thirdeye/.agents/worker_m2/handoff.md`.
6. Send a message to parent when done.
