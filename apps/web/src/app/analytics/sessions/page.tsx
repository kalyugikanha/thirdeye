"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { API_BASE } from '@/lib/api';
import {
  BarChart as BarChartIcon,
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
  ArrowLeft,
  RotateCcw
} from 'lucide-react';

// Dynamic import with ssr: false ensures rrweb-player never executes in server context
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
  project_id: number | null;
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

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;

      let resolvedProjectId: number | null = null;

      // 1. Try to fetch user project if token exists
      if (token) {
        try {
          const projRes = await fetch(`${API_BASE}/api/projects`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (projRes.status === 401) {
            localStorage.removeItem('te_token');
            router.push('/login');
            return;
          }

          if (projRes.ok) {
            const projects = await projRes.json();
            if (Array.isArray(projects) && projects.length > 0) {
              resolvedProjectId = projects[0].id;
              setProjectId(resolvedProjectId);
            }
          }
        } catch (projErr) {
          console.warn('Could not resolve active project, using global recordings fallback:', projErr);
        }
      }

      // 2. Fetch recordings (with project_id if resolved, or general fallback)
      const recordingsUrl = resolvedProjectId
        ? `${API_BASE}/api/v1/recordings?project_id=${resolvedProjectId}`
        : `${API_BASE}/api/v1/recordings`;

      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const recRes = await fetch(recordingsUrl, { headers });

      if (recRes.ok) {
        const recData = await recRes.json();
        setRecordings(Array.isArray(recData) ? recData : []);
      } else {
        // Fallback to unparameterized recordings if project filter failed
        const fallbackRes = await fetch(`${API_BASE}/api/v1/recordings`, { headers });
        if (fallbackRes.ok) {
          const recData = await fallbackRes.json();
          setRecordings(Array.isArray(recData) ? recData : []);
        } else {
          setError('Failed to load session recordings.');
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch recordings:', err);
      setError('Failed to connect to ThirdEye backend.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, router]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle Replay Trigger
  const handleWatchReplay = async (session: SessionRecording) => {
    setActiveSession(session);
    setLoadingReplay(true);
    setReplayError(null);
    setReplayEvents(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      // 1. Try replay endpoint first, fallback to direct session endpoint
      let res = await fetch(`${API_BASE}/api/v1/recordings/${session.session_id}/replay`, { headers });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/api/v1/recordings/${session.session_id}`, { headers });
      }

      if (!res.ok) {
        throw new Error(`Failed to download recording payload (HTTP ${res.status})`);
      }

      let parsedPayload: any;
      const contentEncoding = res.headers.get('content-encoding');

      // Native transparent HTTP decompression by browser fetch
      if (contentEncoding === 'gzip') {
        parsedPayload = await res.json();
      } else {
        // Handle raw binary or gzip stream with DecompressionStream fallback
        const arrayBuffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        // Check gzip magic bytes (0x1f, 0x8b)
        if (uint8.length >= 2 && uint8[0] === 0x1f && uint8[1] === 0x8b) {
          if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(uint8);
            writer.close();
            parsedPayload = await new Response(ds.readable).json();
          } else {
            throw new Error('Native DecompressionStream not supported in this environment.');
          }
        } else {
          // Plain text JSON
          const text = new TextDecoder().decode(uint8);
          parsedPayload = JSON.parse(text);
        }
      }

      // Extract events array whether root array or wrapped object
      const events = Array.isArray(parsedPayload)
        ? parsedPayload
        : parsedPayload && Array.isArray(parsedPayload.events)
        ? parsedPayload.events
        : null;

      if (!events || events.length === 0) {
        throw new Error('Recording payload contains no playback events.');
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
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const closeModal = () => {
    setActiveSession(null);
    setReplayEvents(null);
    setReplayError(null);
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        {/* Header */}
        <div className="w-full max-w-5xl mx-auto mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
            <Link href="/analytics" className="hover:text-blue-600 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to Analytics Overview
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">UX Session Replays</h1>
              <p className="text-sm text-slate-500 mt-1">
                Watch full DOM mutations, mouse movements, and scrolls captured by ThirdEye snippet.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" /> rrweb v2 Enabled
              </span>
              <button
                onClick={loadSessions}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                title="Refresh recordings"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
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

        {/* Sessions Content */}
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
              <button
                onClick={loadSessions}
                className="mt-4 text-xs font-semibold bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-500"
              >
                Try Again
              </button>
            </div>
          ) : recordings.length === 0 ? (
            <div className="border border-slate-100 rounded-3xl p-16 bg-slate-50/40 text-center">
              <Video className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 mb-1">No session recordings yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
                Ensure the tracking snippet (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">public/te.js</code>)
                is loaded on your page with rrweb recording enabled.
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
                  {projectId ? `Sessions for Project #${projectId}` : 'All Recorded Sessions'}
                </h3>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5" /> Compressed in Mock S3 (gzip)
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
                            {rec.session_id}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Masked
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {rec.created_at ? new Date(rec.created_at).toLocaleString() : 'Recently'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDuration(rec.duration)}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                            <Database className="w-3 h-3" />
                            {rec.file_path ? rec.file_path.split('/').pop() : 'storage/recordings'}
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
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
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
                    Duration: {formatDuration(activeSession.duration)} • Recorded on{' '}
                    {activeSession.created_at ? new Date(activeSession.created_at).toLocaleString() : 'Unknown'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                title="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Player Body */}
            <div className="flex-1 flex items-center justify-center min-h-[480px]">
              {loadingReplay ? (
                <div className="flex flex-col items-center justify-center text-slate-400 py-12">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                  <p className="text-sm font-medium">Fetching and decompressing session payload...</p>
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