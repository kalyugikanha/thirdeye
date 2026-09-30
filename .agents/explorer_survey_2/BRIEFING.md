# BRIEFING — 2026-09-30T09:12:00Z

## Mission
Investigate tracking snippet (public/te.js), rrweb integration, DOM mutation/mouse/scroll capture, strict privacy masking, 5-second JSON batching, and verification methods.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigator, synthesis
- Working directory: d:/Project/Our Product/thirdeye/.agents/explorer_survey_2
- Original parent: c64e98df-902d-4971-a278-52a3d604839f
- Milestone: survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Only write files within own working directory (`d:/Project/Our Product/thirdeye/.agents/explorer_survey_2`)
- No modifications to application source code

## Current Parent
- Conversation ID: c64e98df-902d-4971-a278-52a3d604839f
- Updated: 2026-09-30T09:02:36Z

## Investigation State
- **Explored paths**:
  - `d:/Project/Our Product/thirdeye/.agents/ORIGINAL_REQUEST.md`
  - `apps/api/public/te.js`
  - `apps/api/app/main.py`
  - `apps/web/src/app/onboarding/page.tsx`
  - `.agents/orchestrator_1/BRIEFING.md`
  - `.agents/explorer_survey_1/handoff.md`
  - `.agents/explorer_survey_3/handoff.md`
  - Monorepo package structure & build configs
- **Key findings**:
  - `public/te.js` is located at `apps/api/public/te.js` and mounted at `/public` by FastAPI (`apps/api/app/main.py:28`).
  - No build tool currently builds `te.js`; it is served as static vanilla JavaScript.
  - Three integration options identified for rrweb: Dynamic loader with CDN/local fallback (recommended), Pre-bundled standalone script, and Self-hosted static bundle.
  - Privacy masking requires `maskAllInputs: true`, `maskInputFn: () => '***'`, `maskTextSelector: '*'`, `maskTextFn: (t) => t.trim() ? '***' : t`.
  - Batching requires 5-second `setInterval` buffer splice, payload `{ session_id, api_key, duration, events }` sent to `POST /api/v1/recordings`, plus `beforeunload` beacon.
  - Verification can use `node --check apps/api/public/te.js` and standard HTML test harness.
- **Unexplored areas**: None for survey scope.

## Key Decisions Made
- Recommend dynamic loader architecture with local fallback for `te.js` to keep file lightweight while enabling zero external dependencies if needed.
- Define exact backend contract matching Explorer 1's `POST /api/v1/recordings` specifications.
- Provide full proposed code for `apps/api/public/te.js` in handoff.md.

## Artifact Index
- DISPATCH.md — incoming dispatch records
- progress.md — progress tracking and liveness heartbeat
- BRIEFING.md — persistent working memory
- handoff.md — final comprehensive report
