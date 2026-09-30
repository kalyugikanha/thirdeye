# BRIEFING — 2026-09-30T09:31:30Z

## Mission
Implement rrweb session recording, strict privacy masking, buffer batching/beacon transmission, and dynamic fallback loader in `apps/api/public/te.js` and provide local standalone `apps/api/public/rrweb-record.min.js`.

## 🔒 My Identity
- Archetype: implementer / qa / specialist
- Roles: implementer, qa, specialist
- Working directory: d:/Project/Our Product/thirdeye/.agents/worker_m2
- Original parent: c64e98df-902d-4971-a278-52a3d604839f
- Milestone: Milestone 2 (M2)

## 🔒 Key Constraints
- File Write Ownership: ONLY `apps/api/public/te.js`, `apps/api/public/rrweb-record.min.js` (and companion static helper files in `apps/api/public/`), plus `.agents/worker_m2/`.
- DO NOT CHEAT: Genuine implementation, real state and real behavior. No dummy/facade implementations.
- Strict Privacy: Mask all text (`maskTextFn` returning `'***'`), mask all inputs (`maskAllInputs: true`, `'***'`).
- Batching & Transmission: 5s flush interval, unload beacon (`beforeunload`, `pagehide`).
- Dynamic Script Loader: CDN with fallback to local `apiHost + '/public/rrweb-record.min.js'`.
- Maintain existing pageview tracking and window.ThirdEye global exposure.

## Current Parent
- Conversation ID: c64e98df-902d-4971-a278-52a3d604839f
- Updated: not yet

## Task Summary
- **What to build**: Full rrweb recording client in `apps/api/public/te.js` and standalone `apps/api/public/rrweb-record.min.js`.
- **Success criteria**: Syntax check clean (`node --check`), privacy masking options strictly configured, batching buffer with beacon on unload, offline fallback loader functional.
- **Interface contracts**: `d:/Project/Our Product/thirdeye/.agents/orchestrator_1/PROJECT.md`
- **Code layout**: `apps/api/public/`

## Key Decisions Made
- Embedded `rrweb-record.min.js` (51.7 KB) directly in `apps/api/public/` so environments without internet access can load recording scripts reliably.
- `te.js` checks for `typeof rrwebRecord === 'function'` or `window.rrweb.record` before attempting script injection.
- Dynamic script injection attempts jsdelivr CDN first; on error, dynamically appends local script element targeting `apiHost + '/public/rrweb-record.min.js'`.
- Configured `maskAllInputs: true`, `maskInputFn: (v, el) => '***'`, and `maskTextSelector: '*'`, `maskTextFn: (text, el) => (!text || !text.trim() ? text : '***')`.
- Batch buffer flushes every 5000ms via `POST /api/v1/recordings` with `session_id`, `api_key`, `duration`, `events`. Failed uploads are re-queued (bounded to 5000 events max).
- Added `beforeunload` and `pagehide` beacon handling using `navigator.sendBeacon` (with fallback to `fetch` with `keepalive: true`).
- Preserved existing `track('pageview')` call and `window.ThirdEye` global API.

## Artifact Index
- `.agents/worker_m2/DISPATCH.md` — Task dispatch instructions
- `.agents/worker_m2/BRIEFING.md` — Situational awareness and working memory
- `.agents/worker_m2/progress.md` — Heartbeat and task progress tracker
- `.agents/worker_m2/test_m2.py` — Python test script validating syntax and AST requirements
- `.agents/worker_m2/test_m2.js` — Node test script validating syntax and string requirements
- `.agents/worker_m2/test_behavior.js` — Node VM behavioral test validating runtime execution
- `apps/api/public/te.js` — Client tracking & recording snippet
- `apps/api/public/rrweb-record.min.js` — Local fallback rrweb recording library
- `.agents/worker_m2/handoff.md` — Final handoff report

## Change Tracker
- **Files modified**:
  - `apps/api/public/te.js`: Enhanced with full rrweb recorder, strict privacy masking, 5s batching buffer, unload beacon, CDN/local fallback loader.
  - `apps/api/public/rrweb-record.min.js`: Standalone production minified rrweb recorder library for offline fallback.
- **Build status**: PASS (`node --check` clean, all assertions passed)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (Node syntax check, Python verification script, Node verification script, VM runtime simulation passed)
- **Lint status**: 0 violations
- **Tests added/modified**: `.agents/worker_m2/test_m2.py`, `.agents/worker_m2/test_m2.js`, `.agents/worker_m2/test_behavior.js`
