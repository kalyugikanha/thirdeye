# Handoff Report: Frontend Next.js & Session Replay Survey

**Agent**: Explorer 3 (Frontend Survey)  
**Date**: 2026-09-30  
**Target File**: `apps/web/src/app/analytics/sessions/page.tsx`  
**Workspace**: `d:/Project/Our Product/thirdeye`  

---

## 1. Observation

### 1.1 Next.js Version and Monorepo Architecture
- **Root Monorepo Configuration** (`d:/Project/Our Product/thirdeye/package.json`):
  ```json
  {
      "private": true,
      "workspaces": [
          "apps/*",
          "packages/*"
      ],
      "name": "thirdeye-monorepo",
      "scripts": {
          "dev": "npm run dev --workspaces",
          "build": "npm run build --workspaces"
      }
  }
  ```
  The repository is an npm monorepo with workspace packages in `apps/web`, `apps/api`, and `packages/sdk-js`.
- **Frontend Package Configuration** (`d:/Project/Our Product/thirdeye/apps/web/package.json`):
  ```json
  {
    "name": "web",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint"
    },
    "dependencies": {
      "lucide-react": "^1.48.0",
      "next": "14.2.35",
      "react": "^18",
      "react-dom": "^18",
      "recharts": "^3.10.1"
    },
    "devDependencies": {
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      "eslint": "^8",
      "eslint-config-next": "14.2.35",
      "postcss": "^8",
      "tailwindcss": "^3.4.1",
      "typescript": "^5"
    }
  }
  ```
  - **Next.js Version**: `14.2.35`
  - **React**: `^18`
  - **Dependencies missing**: `rrweb` and `rrweb-player` are NOT currently installed.
- **Router Setup**:
  - The application strictly uses **Next.js App Router** located under `apps/web/src/app/`. There is no `pages/` directory.
  - Existing routes:
    - `/` -> `apps/web/src/app/page.tsx` (Dashboard / Workspace)
    - `/(auth)/login` -> `apps/web/src/app/(auth)/login/page.tsx`
    - `/(auth)/register` -> `apps/web/src/app/(auth)/register/page.tsx`
    - `/(admin)/superadmin` -> `apps/web/src/app/(admin)/superadmin/page.tsx`
    - `/analytics` -> `apps/web/src/app/analytics/page.tsx`
    - `/devops` -> `apps/web/src/app/devops/page.tsx`
    - `/onboarding` -> `apps/web/src/app/onboarding/page.tsx`
- **TypeScript Configuration** (`apps/web/tsconfig.json`):
  - `"strict": true`, `"moduleResolution": "bundler"`, path alias `"@/*": ["./src/*"]`.
  - `"include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]`.
- **ESLint Configuration** (`apps/web/.eslintrc.json`):
  - `"extends": ["next/core-web-vitals", "next/typescript"]`.
  - TypeScript lint checks are strictly enforced during `next build`.

### 1.2 Existing Analytics Pages
- **File**: `apps/web/src/app/analytics/page.tsx` (141 lines)
  - Begins with `"use client";`.
  - Authentication check:
    ```typescript
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }
    ```
  - API call pattern:
    ```typescript
    const res = await fetch('http://localhost:8000/api/v1/analytics/timeseries', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401) {
      localStorage.removeItem('te_token');
      router.push('/login');
      return;
    }
    ```
  - Layout components:
    - Left icon sidebar (64px width, `w-16 flex flex-col items-center justify-between py-6 border-r border-slate-100`).
    - Main container (`flex-1 flex flex-col pt-8 px-10 overflow-y-auto`).
    - Max width `max-w-5xl mx-auto`.
    - Cards styled with `border border-slate-100 rounded-3xl p-8 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)]`.
  - Sub-navigation: Currently there are NO sub-navigation tabs or links to session replay in `/analytics`.

### 1.3 Project Resolution Pattern
In `apps/web/src/app/page.tsx` (lines 27-37), the active project is resolved as:
```typescript
const projRes = await fetch('http://localhost:8000/api/projects', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const projects = await projRes.json();
const activeProjectId = projects.length > 0 ? projects[0].id : null;
```

---

## 2. Logic Chain

```
[Observation 1.1: Next.js 14 App Router + React 18 + TS strict mode]
   │
   ▼
[Step 1: Client Component requirement]
`localStorage`, DOM manipulation, and `rrweb-player` require client-side execution.
`apps/web/src/app/analytics/sessions/page.tsx` must be marked `"use client";`.
   │
   ▼
[Step 2: SSR Avoidance for rrweb-player]
Next.js still evaluates/pre-renders Client Components on the Node.js server during build and SSR.
`rrweb-player` and `rrweb` immediately access `window`, `document`, and canvas APIs upon evaluation/instantiation.
Static imports or direct SSR execution cause:
`ReferenceError: window is not defined` or `ReferenceError: document is not defined`.
Therefore:
Option A: Isolate the player into a dedicated client subcomponent (e.g. `ReplayPlayer.tsx`) and dynamically import it using `next/dynamic(() => import('./ReplayPlayer'), { ssr: false })`.
Option B: Dynamically import `rrweb-player` inside a `useEffect` hook (`import('rrweb-player').then(...)`).
Both patterns guarantee zero server-side execution.
   │
   ▼
[Step 3: TypeScript Declaration File]
`tsconfig.json` enforces `"strict": true`, and ESLint uses `next/typescript`.
`rrweb-player` lacks bundled type declarations (`@types/rrweb-player` does not exist on npm).
Without ambient declarations, `next build` fails with:
`TS7016: Could not find a declaration file for module 'rrweb-player'`.
Therefore, a custom declaration file `apps/web/src/types/rrweb-player.d.ts` must be created.
   │
   ▼
[Step 4: Gzip Decompression Mechanics]
User Requirement R3: "fetch the compressed JSON from the backend and play it back".
Backend (FastAPI) compresses with gzip and stores in `storage/recordings/`.
Two client-side scenarios:
1. Standard HTTP: FastAPI endpoint sends `Content-Encoding: gzip` + `Content-Type: application/json`. The browser's native `fetch()` automatically and transparently decompresses the stream, allowing `res.json()` to parse the events array directly.
2. Raw binary stream: If the backend returns raw `application/octet-stream` without `Content-Encoding: gzip`, the client can transparently decompress using standard `DecompressionStream('gzip')` (native Web API supported by all modern browsers).
   │
   ▼
[Step 5: UI & Page Implementation]
`apps/web/src/app/analytics/sessions/page.tsx` must implement:
1. Active project retrieval (`GET /api/projects`).
2. Session recordings listing (`GET /api/v1/recordings?project_id=${projectId}`).
3. Table displaying session ID, recorded timestamp, duration, and a "Watch Replay" button.
4. Modal dialog holding the `rrweb-player` mounted inside a DOM container with `rrweb-player/dist/style.css` applied.
5. In `apps/web/src/app/analytics/page.tsx`, add a navigation tab to navigate smoothly to `/analytics/sessions`.
```

---

## 3. Detailed Technical Specifications & Proposed Implementations

### 3.1 Dependencies
Run at root or in `apps/web`:
```bash
npm install rrweb-player rrweb --workspace=web
```
This updates `apps/web/package.json`:
```json
"dependencies": {
  "lucide-react": "^1.48.0",
  "next": "14.2.35",
  "react": "^18",
  "react-dom": "^18",
  "recharts": "^3.10.1",
  "rrweb": "^2.0.0-alpha.17",
  "rrweb-player": "^1.0.0-alpha.17"
}
```

### 3.2 TypeScript Ambient Typings (`apps/web/src/types/rrweb-player.d.ts`)
Create `apps/web/src/types/rrweb-player.d.ts`:
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
  }
}
```

### 3.3 Replay Player Component (`apps/web/src/app/analytics/sessions/ReplayPlayer.tsx`)
Dedicated SSR-safe component:
```tsx
"use client";

import { useEffect, useRef } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';

interface ReplayPlayerProps {
  events: any[];
  width?: number;
  height?: number;
}

export default function ReplayPlayer({ events, width = 850, height = 480 }: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !events || events.length === 0) return;

    // Clear previous player instances if any
    containerRef.current.innerHTML = '';

    try {
      const player = new rrwebPlayer({
        target: containerRef.current,
        props: {
          events,
          width,
          height,
          autoPlay: true,
          showController: true,
          speedOption: [1, 2, 4, 8],
        },
      });

      return () => {
        try {
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
        } catch (e) {
          console.error('Error cleaning up rrweb-player:', e);
        }
      };
    } catch (err) {
      console.error('Failed to initialize rrweb-player:', err);
    }
  }, [events, width, height]);

  return (
    <div className="flex justify-center items-center bg-slate-950 rounded-2xl overflow-hidden p-2 shadow-2xl">
      <div ref={containerRef} className="rrweb-wrapper" />
    </div>
  );
}
```

### 3.4 Sessions Listing and Replay Page (`apps/web/src/app/analytics/sessions/page.tsx`)
```tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  BarChart,
  LayoutTemplate,
  ShieldCheck,
  Play,
  Clock,
  Calendar,
  Loader2,
  X,
  Video,
  AlertCircle,
  Database,
  ArrowLeft
} from 'lucide-react';

// Dynamic import with ssr: false guarantees no DOM execution on the server
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

interface SessionRecording {
  id: number;
  session_id: string;
  project_id: number;
  duration: number; // in seconds
  file_path: string;
  created_at: string;
}

export default function SessionsPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Replay modal state
  const [activeSession, setActiveSession] = useState<SessionRecording | null>(null);
  const [replayEvents, setReplayEvents] = useState<any[] | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const initSessions = async () => {
      try {
        setLoading(true);
        // 1. Get user project
        const projRes = await fetch(`${API_BASE}/api/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (projRes.status === 401) {
          localStorage.removeItem('te_token');
          router.push('/login');
          return;
        }

        const projects = await projRes.json();
        if (projects.length === 0) {
          setError('No projects found. Please complete onboarding first.');
          setLoading(false);
          return;
        }

        const currentProjectId = projects[0].id;
        setProjectId(currentProjectId);

        // 2. Fetch recordings for this project
        const recRes = await fetch(
          `${API_BASE}/api/v1/recordings?project_id=${currentProjectId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (recRes.ok) {
          const recData = await recRes.json();
          setRecordings(recData);
        } else {
          setError('Failed to load session recordings.');
        }
      } catch (err: any) {
        console.error('Failed to fetch recordings:', err);
        setError('Failed to connect to ThirdEye backend.');
      } finally {
        setLoading(false);
      }
    };

    initSessions();
  }, [router, API_BASE]);

  // Handle Replay Trigger
  const handleWatchReplay = async (session: SessionRecording) => {
    setActiveSession(session);
    setLoadingReplay(true);
    setReplayError(null);
    setReplayEvents(null);

    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(`${API_BASE}/api/v1/recordings/${session.session_id}/replay`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to download recording payload (HTTP ${res.status})`);
      }

      let events: any[];
      const contentEncoding = res.headers.get('content-encoding');

      // If server sent Content-Encoding: gzip, fetch handles decompression automatically
      if (contentEncoding === 'gzip') {
        events = await res.json();
      } else {
        // Fallback for raw binary gzip using browser DecompressionStream
        const arrayBuffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        // Check gzip magic bytes (0x1f, 0x8b)
        if (uint8.length >= 2 && uint8[0] === 0x1f && uint8[1] === 0x8b) {
          const ds = new DecompressionStream('gzip');
          const writer = ds.writable.getWriter();
          writer.write(uint8);
          writer.close();
          events = await new Response(ds.readable).json();
        } else {
          // Plain JSON text
          const text = new TextDecoder().decode(uint8);
          events = JSON.parse(text);
        }
      }

      if (!Array.isArray(events) || events.length === 0) {
        throw new Error('Recording payload contains no events.');
      }

      setReplayEvents(events);
    } catch (err: any) {
      console.error('Failed to load replay events:', err);
      setReplayError(err.message || 'Unable to decompress or parse session replay.');
    } finally {
      setLoadingReplay(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center justify-between py-6 border-r border-slate-100 flex-shrink-0">
        <div className="flex flex-col items-center gap-8">
          <Link
            href="/"
            className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm"
          >
            T
          </Link>
          <nav className="flex flex-col gap-6 text-slate-400">
            <Link href="/" className="p-2 hover:bg-slate-50 rounded-xl hover:text-slate-900 transition-colors">
              <LayoutTemplate className="w-5 h-5" />
            </Link>
            <Link href="/analytics" className="p-2 rounded-xl text-blue-600 bg-blue-50 transition-colors">
              <BarChart className="w-5 h-5" />
            </Link>
            <Link href="/devops" className="p-2 hover:bg-slate-50 rounded-xl hover:text-slate-900 transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </Link>
          </nav>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 cursor-pointer">
          AL
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        {/* Header & Sub-navigation */}
        <div className="w-full max-w-5xl mx-auto mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/analytics" className="hover:text-blue-600 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to Analytics Overview
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">UX Session Replays</h1>
              <p className="text-sm text-slate-500 mt-1">
                Playback recorded user sessions with DOM mutations, mouse movements, and scrolls.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" /> rrweb v2 Enabled
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="w-full max-w-5xl mx-auto mb-8 border-b border-slate-100 flex gap-6 text-sm">
          <Link href="/analytics" className="pb-3 text-slate-500 hover:text-slate-800 transition-colors">
            Traffic Overview
          </Link>
          <Link
            href="/analytics/sessions"
            className="pb-3 text-blue-600 font-semibold border-b-2 border-blue-600"
          >
            Recorded Sessions ({recordings.length})
          </Link>
        </div>

        {/* Sessions Table Area */}
        <div className="w-full max-w-5xl mx-auto">
          {loading ? (
            <div className="border border-slate-100 rounded-3xl p-16 bg-slate-50/50 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-600" />
              <p className="text-sm font-medium">Loading session recordings...</p>
            </div>
          ) : error ? (
            <div className="border border-red-100 rounded-3xl p-8 bg-red-50/40 text-center">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-red-800">{error}</p>
            </div>
          ) : recordings.length === 0 ? (
            <div className="border border-slate-100 rounded-3xl p-16 bg-slate-50/40 text-center">
              <Video className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 mb-1">No session recordings yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                Make sure the tracking snippet (<code className="bg-slate-100 px-1 py-0.5 rounded">public/te.js</code>)
                is embedded in your target page and sending events to ThirdEye.
              </p>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                View Snippet Instructions
              </Link>
            </div>
          ) : (
            <div className="border border-slate-100 rounded-3xl bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">
                  Active Project Sessions (Project #{projectId})
                </h3>
                <span className="text-xs text-slate-400">
                  Compressed & Stored in Mock S3
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-6 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 font-mono">
                            {rec.session_id.substring(0, 16)}...
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Masked
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(rec.created_at).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDuration(rec.duration || 0)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Database className="w-3.5 h-3.5" />
                            gzip
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleWatchReplay(rec)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-xl text-xs font-semibold shadow-sm transition-all hover:shadow"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Watch Replay
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Replay Modal Backdrop */}
      {activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl relative flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Session Replay — <span className="font-mono text-sm">{activeSession.session_id}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Duration: {formatDuration(activeSession.duration || 0)} • Recorded on{' '}
                    {new Date(activeSession.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveSession(null);
                  setReplayEvents(null);
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Player Body */}
            <div className="flex-1 flex items-center justify-center min-h-[480px]">
              {loadingReplay ? (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                  <p className="text-sm">Fetching and decompressing session payload...</p>
                  <span className="text-xs text-slate-500 mt-1">Decompressing Mock S3 gzip payload</span>
                </div>
              ) : replayError ? (
                <div className="text-center p-8">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-200">{replayError}</p>
                  <button
                    onClick={() => handleWatchReplay(activeSession)}
                    className="mt-4 text-xs font-semibold bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-700"
                  >
                    Retry
                  </button>
                </div>
              ) : replayEvents ? (
                <ReplayPlayer events={replayEvents} width={850} height={480} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3.5 Analytics Overview Navigation Update (`apps/web/src/app/analytics/page.tsx`)
In `apps/web/src/app/analytics/page.tsx`, add a sub-navigation bar above the traffic charts:
```tsx
{/* Sub-Navigation */}
<div className="w-full max-w-5xl mx-auto mb-8 border-b border-slate-100 flex gap-6 text-sm">
  <Link href="/analytics" className="pb-3 text-blue-600 font-semibold border-b-2 border-blue-600">
    Traffic Overview
  </Link>
  <Link href="/analytics/sessions" className="pb-3 text-slate-500 hover:text-slate-800 transition-colors">
    Recorded Sessions
  </Link>
</div>
```

---

## 4. Caveats
1. **Interactive Shell Permission in Development**: `run_command` commands that prompt for user elevation/acceptance may time out in unattended subagent environments. The build command `npm run build` must be executed during the implementation phase.
2. **Backend Contract Dependencies**:
   - `GET /api/v1/recordings?project_id={id}`: Expected to return an array of `SessionRecording` objects.
   - `GET /api/v1/recordings/{session_id}/replay`: Expected to serve the gzip payload from `storage/recordings/`. If the backend returns `Content-Encoding: gzip`, the browser natively decompresses it. The frontend code is dual-tolerant and supports both native HTTP decompression and `DecompressionStream('gzip')` binary decompression.
3. **`rrweb-player` Svelte Bundle**: `rrweb-player` relies on inline DOM creation and CSS insertion. Wrapping it with `next/dynamic(..., { ssr: false })` is non-negotiable for stable Next.js production builds.

---

## 5. Conclusion
1. **Frontend Readiness**: The Next.js 14.2.35 App Router frontend is structured cleanly and ready for the Session Replay module.
2. **Installation Requirement**: Add `rrweb` and `rrweb-player` to `apps/web/package.json`.
3. **Type Safety Requirement**: Add `apps/web/src/types/rrweb-player.d.ts` to satisfy Next.js strict mode TypeScript and ESLint (`next/typescript`).
4. **Architecture**: Separate the player into `ReplayPlayer.tsx` and dynamically import it with `{ ssr: false }` into `apps/web/src/app/analytics/sessions/page.tsx`.
5. **Decompression**: Browser `fetch()` + `DecompressionStream('gzip')` provides zero-dependency client-side gzip decompression for Mock S3 recordings.

---

## 6. Verification Method

### 6.1 TypeScript Type Checking
Run from `apps/web`:
```bash
npx tsc --noEmit
```
**Assertion**: Zero type errors across all `.ts` and `.tsx` files, including `rrweb-player` module imports.

### 6.2 Next.js Build Compilation
Run from workspace root:
```bash
npm run build --workspaces
```
Or inside `apps/web`:
```bash
npm run build
```
**Assertion**:
- Next.js build terminates with exit code 0.
- Route table shows `/analytics/sessions` as a generated static or client route.
- No `window is not defined` or `document is not defined` errors during server pre-rendering.

### 6.3 Browser Playback Verification
1. Start the platform via `./start.ps1`.
2. Generate events using `public/te.js` on a test page.
3. Navigate to `http://localhost:3000/analytics/sessions`.
4. Verify sessions are listed with duration and formatted timestamps.
5. Click "Watch Replay" and verify the `rrweb-player` UI loads with progress bar, play/pause controls, and masked text (`***`).
