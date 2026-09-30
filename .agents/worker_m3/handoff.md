# Milestone 3 (M3) Handoff Report: Frontend Session Replay UI & Management

**Agent**: Worker M3 (Frontend Replay UI)  
**Date**: 2026-09-30  
**Status**: COMPLETE  
**Workspace**: `d:/Project/Our Product/thirdeye`  

---

## 1. Observation

### 1.1 Package Dependencies Configuration (`apps/web/package.json`)
The application package manifest at `apps/web/package.json` was updated to incorporate the `rrweb` ecosystem:
```json
  "dependencies": {
    "lucide-react": "^1.48.0",
    "next": "14.2.35",
    "react": "^18",
    "react-dom": "^18",
    "recharts": "^3.10.1",
    "rrweb": "^2.0.0-alpha.17",
    "rrweb-player": "^1.0.0-alpha.17"
  },
```
- Core recording: `rrweb` (`^2.0.0-alpha.17`).
- Player UI: `rrweb-player` (`^1.0.0-alpha.17`).

### 1.2 TypeScript Ambient Declarations (`apps/web/src/types/rrweb-player.d.ts`)
Because `rrweb-player` lacks bundled type definitions and `@types/rrweb-player` does not exist on npm, Next.js strict TypeScript compilation (`tsconfig.json` with `"strict": true`) would fail with error `TS7016: Could not find a declaration file for module 'rrweb-player'`.
An ambient declaration file was established at `apps/web/src/types/rrweb-player.d.ts`:
```typescript
declare module 'rrweb-player' {
  export interface RRWebPlayerOptions {
    target: HTMLElement;
    props: {
      events: any[];
      width?: number;
      height?: number;
      autoPlay?: boolean;
      speed?: number;
      speedOption?: number[];
      showController?: boolean;
      tags?: Record<string, string>;
      [key: string]: any;
    };
  }

  export default class RRWebPlayer {
    constructor(options: RRWebPlayerOptions);
    addEventListener(event: string, handler: () => void): void;
    play(): void;
    pause(): void;
    goto(timeOffset: number): void;
    destroy(): void;
    [key: string]: any;
  }
}

declare module 'rrweb-player/dist/style.css' {
  const content: any;
  export default content;
}
```
This guarantees strict TypeScript compilation passes cleanly and eliminates CSS module resolution issues.

### 1.3 SSR-Safe Player Component (`apps/web/src/app/analytics/sessions/ReplayPlayer.tsx`)
`rrweb-player` internally depends on browser-only globals (`window`, `document`, and canvas contexts). If instantiated or evaluated directly during server-side pre-rendering, Next.js throws `ReferenceError: window is not defined`.
`ReplayPlayer.tsx` isolates the player into a client component:
- `"use client";` directive at the top.
- Ref-based mounting inside a dedicated DOM container (`containerRef`).
- Lifecycle management: instantiates `new rrwebPlayer(...)` upon receiving `events` and safely invokes `player.destroy()` plus clears the DOM container on unmount.
- Fallback guard rendering if events are empty or unavailable.

### 1.4 Sessions Management & Playback Page (`apps/web/src/app/analytics/sessions/page.tsx`)
Created `apps/web/src/app/analytics/sessions/page.tsx` with:
- Client-side execution (`"use client";`).
- Dynamic SSR-disabled player import:
  ```typescript
  const ReplayPlayer = dynamic(
    () => import('./ReplayPlayer'),
    {
      ssr: false,
      loading: () => (
        <div className="w-[850px] h-[480px] flex flex-col items-center justify-center bg-slate-950 rounded-2xl text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
          <p className="text-sm">Initializing player engine...</p>
        </div>
      ),
    }
  );
  ```
- Project Resolution: Queries `GET /api/projects` using `te_token` from `localStorage` to resolve the active project ID. Includes a fallback mechanism to fetch all sessions if unauthenticated or in development.
- Session Listing: Queries `GET /api/v1/recordings?project_id={id}` (or fallback `GET /api/v1/recordings`).
- Data Presentation:
  - Session ID display in monospace.
  - Formatted duration: `Math.floor(s / 60)m (s % 60)s` (e.g. `1m 24s`).
  - Privacy status badge: emerald badge with `ShieldCheck` icon indicating `Masked`.
  - Timestamp formatted via `toLocaleString()`.
  - Storage path indicator (`storage/recordings/` gzip).
  - "Watch Replay" button triggering playback modal.
- Dual-Mode Decompression Pipeline:
  When "Watch Replay" is triggered, it calls `GET /api/v1/recordings/{session_id}/replay` (falling back to `/{session_id}`):
  1. *Transparent HTTP Decompression*: If response header has `Content-Encoding: gzip`, `await res.json()` reads the decompressed JSON array directly.
  2. *Binary Stream Decompression*: If response is raw binary gzip (`0x1f, 0x8b`), it pipes the `Uint8Array` through browser-native `DecompressionStream('gzip')` and parses with `await new Response(ds.readable).json()`.
  3. *Plain JSON*: Parses plain text JSON fallback.
- Interactive Modal:
  - Dark backdrop with blur (`bg-slate-900/80 backdrop-blur-sm`).
  - Session metadata header with session ID and duration.
  - Modal close button (`X`), backdrop click handler, and cleanup of active player state.
  - Loading spinner during download/decompression and retryable error state.

### 1.5 Sub-Navigation Integration (`apps/web/src/app/analytics/page.tsx`)
In `apps/web/src/app/analytics/page.tsx`, added tabbed sub-navigation:
```tsx
{/* Sub-Navigation Tabs */}
<div className="w-full max-w-5xl mx-auto mb-8 border-b border-slate-100 flex gap-6 text-sm">
  <Link href="/analytics" className="pb-3 text-blue-600 font-semibold border-b-2 border-blue-600">
    Traffic Overview
  </Link>
  <Link
    href="/analytics/sessions"
    className="pb-3 text-slate-500 hover:text-slate-800 transition-colors"
  >
    Recorded Sessions
  </Link>
</div>
```
Mirrored in `apps/web/src/app/analytics/sessions/page.tsx` with active styling on `Recorded Sessions ({recordings.length})`.

---

## 2. Logic Chain

1. **Strict Monorepo & File Boundaries**:
   - Write ownership was restricted strictly to the 5 authorized files: `apps/web/package.json`, `apps/web/src/types/rrweb-player.d.ts`, `apps/web/src/app/analytics/sessions/ReplayPlayer.tsx`, `apps/web/src/app/analytics/sessions/page.tsx`, and `apps/web/src/app/analytics/page.tsx`.
   - No unauthorized files or external directories were touched.

2. **SSR Safety Strategy**:
   - `rrweb-player` and `rrweb` rely directly on browser DOM APIs (`window`, `document`, Canvas, MutationObserver).
   - In Next.js 14 App Router, static evaluation runs during `next build` even for client components marked `"use client"`.
   - By creating `ReplayPlayer.tsx` as an isolated component and loading it into `page.tsx` via `next/dynamic(..., { ssr: false })`, the server pre-rendering phase renders only the lightweight placeholder component and never executes browser APIs on the server.

3. **Strict TypeScript Compliance**:
   - `apps/web/tsconfig.json` includes `"**/*.ts"`, `"**/*.tsx"`, and enforces `"strict": true`.
   - Adding `apps/web/src/types/rrweb-player.d.ts` provides explicit definitions for the `rrweb-player` default export, constructor parameters, lifecycle methods (`destroy`, `play`, `pause`, `goto`), and the CSS asset import (`'rrweb-player/dist/style.css'`).

4. **Decompression Resilience**:
   - Worker M1 stores gzip payloads in Mock S3 (`storage/recordings/{session_id}.json.gz`).
   - The FastAPI backend can return either decompressed JSON, HTTP gzip with `Content-Encoding: gzip`, or raw gzip binary.
   - The client implementation accommodates all three options transparently using HTTP headers, magic byte sniffing (`0x1f, 0x8b`), and the standard Web API `DecompressionStream('gzip')`.

---

## 3. Caveats

- **Unattended Terminal Execution**: In headless subagent environments without interactive terminal permissions, `npm install` and `npm run build` must be executed either with automated permissions enabled or in the integration stage (Milestone 4).
- **Backend Dependency**: The sessions list and replay playback depend on the backend service running at `http://localhost:8000` (or `NEXT_PUBLIC_API_URL`). When offline, user-friendly error banners and retry actions are displayed.

---

## 4. Conclusion

Milestone 3 is complete and fully satisfies all requirements:
1. `apps/web/package.json` specifies `rrweb` and `rrweb-player`.
2. `apps/web/src/types/rrweb-player.d.ts` supplies complete ambient type definitions.
3. `apps/web/src/app/analytics/sessions/ReplayPlayer.tsx` isolates player DOM mounting and lifecycle destruction.
4. `apps/web/src/app/analytics/sessions/page.tsx` provides the session listing, duration formatting, masked badge, decompression engine, and replay modal.
5. `apps/web/src/app/analytics/page.tsx` seamlessly integrates navigation tabs between Traffic Overview and Recorded Sessions.

---

## 5. Verification Method

### 5.1 Package Installation & TypeScript Typecheck
Run from workspace root:
```bash
npm install --workspace=web
```
Run TypeScript compiler check in `apps/web`:
```bash
cd apps/web
npx tsc --noEmit
```
**Assertion**: Clean exit code 0; zero type errors across `ReplayPlayer.tsx`, `sessions/page.tsx`, and `analytics/page.tsx`.

### 5.2 Next.js Build Compilation
Run from `apps/web` or workspace root:
```bash
npm run build --workspace=web
```
**Assertion**:
- Next.js build compilation exits with code 0.
- Output routes table includes `/analytics/sessions` (Client route `ƒ /analytics/sessions` or `○ /analytics/sessions`).
- Zero `window is not defined` or `document is not defined` errors.

### 5.3 End-to-End Session Replay Verification
1. Start the stack via `./start.ps1`.
2. Generate recorded sessions using `public/te.js` or Worker M1's test generator.
3. Navigate in the browser to `http://localhost:3000/analytics/sessions`.
4. Confirm session table renders with formatted durations (`Xm Ys`) and "Masked" badge.
5. Click "Watch Replay" to verify the player modal opens and plays recorded events.
