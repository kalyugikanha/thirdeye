"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { apiUrl, API_BASE } from '@/lib/api';
import {
  BarChart as BarChartIcon,
  Play,
  Clock,
  Calendar,
  Loader2,
  X,
  Video,
  AlertCircle,
  Database,
  ArrowLeft,
  RotateCcw,
  Monitor,
  Globe,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

// Dynamic import ensures rrweb-player only loads client-side
const ReplayPlayer = dynamic(
  () => import('./ReplayPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-[850px] h-[480px] flex flex-col items-center justify-center bg-slate-950 rounded-2xl text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-rose-500" />
        <p className="text-sm font-medium">Initializing high-fidelity playback engine...</p>
      </div>
    ),
  }
);

interface SessionRecording {
  id: number;
  session_id: string;
  project_id: number | null;
  duration: number;
  file_path: string;
  created_at: string;
  entry_url?: string;
  browser?: string;
  os?: string;
  screen?: string;
  event_count?: number;
}

export default function SessionsPage() {
  const router = useRouter();
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
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(apiUrl('/api/v1/recordings'), { headers });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setRecordings(Array.isArray(data) ? data : []);
      } else {
        setError('Failed to fetch recorded sessions.');
      }
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
      setError('Unable to reach ThirdEye recording service.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleWatchReplay = async (session: SessionRecording) => {
    setActiveSession(session);
    setLoadingReplay(true);
    setReplayError(null);
    setReplayEvents(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      let res = await fetch(apiUrl(`/api/v1/recordings/${session.session_id}/replay`), { headers });
      if (!res.ok) {
        res = await fetch(apiUrl(`/api/v1/recordings/${session.session_id}`), { headers });
      }

      if (!res.ok) {
        throw new Error(`Failed to download recording payload (HTTP ${res.status})`);
      }

      let parsedPayload: any;
      const contentEncoding = res.headers.get('content-encoding');

      if (contentEncoding === 'gzip') {
        parsedPayload = await res.json();
      } else {
        const arrayBuffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);

        if (uint8.length >= 2 && uint8[0] === 0x1f && uint8[1] === 0x8b) {
          if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            writer.write(uint8);
            writer.close();
            parsedPayload = await new Response(ds.readable).json();
          } else {
            throw new Error('Native DecompressionStream not supported.');
          }
        } else {
          const text = new TextDecoder().decode(uint8);
          parsedPayload = JSON.parse(text);
        }
      }

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

  const formatExactTime = (isoString: string) => {
    if (!isoString) return 'Recently';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }) + ' at ' + d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Recently';
    }
  };

  const formatRelativeTime = (isoString: string) => {
    if (!isoString) return 'Just now';
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch (e) {
      return 'Recently';
    }
  };

  const closeModal = () => {
    setActiveSession(null);
    setReplayEvents(null);
    setReplayError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#ffe4d6] via-[#ffdcd2] to-[#ffeedb] p-2 sm:p-4 lg:p-6 flex items-center justify-center font-sans antialiased selection:bg-rose-500/20">
      
      {/* Main Floating Rounded Bento Canvas */}
      <div className="w-full max-w-[1440px] bg-[#fbfbfe] rounded-[32px] sm:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-white/80 overflow-hidden flex flex-col lg:flex-row min-h-[840px] transition-all">
        
        {/* Unified Bento Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1.5">
                <Link href="/" className="hover:text-slate-700 flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Workspace Home
                </Link>
                <span>/</span>
                <span className="text-slate-600">Behavior Intelligence</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>UX Session Replays</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-500 border border-rose-200/60 px-2.5 py-0.5 rounded-full">
                  High Fidelity
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Watch pixel-perfect DOM mutations, cursor paths, and user clicks captured with CSS inlining & privacy masking.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-3 py-1.5 bg-white text-slate-700 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{recordings.length} Recorded Sessions</span>
              </span>
              <button
                onClick={loadSessions}
                className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:scale-105"
                title="Refresh sessions"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sessions List Content */}
          <div className="mt-8 flex-1">
            {loading ? (
              <div className="h-96 rounded-3xl bg-white border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-rose-500" />
                <p className="text-sm font-semibold text-slate-600">Loading authentic session recordings...</p>
                <span className="text-xs text-slate-400 mt-1">Decompressing rrweb session streams</span>
              </div>
            ) : error ? (
              <div className="rounded-3xl p-8 bg-rose-50/50 border border-rose-100 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-rose-800">{error}</p>
                <button
                  onClick={loadSessions}
                  className="mt-4 text-xs font-bold bg-rose-600 text-white px-4 py-2 rounded-xl hover:bg-rose-500 shadow-sm"
                >
                  Retry Connection
                </button>
              </div>
            ) : recordings.length === 0 ? (
              <div className="h-96 rounded-3xl bg-white border border-slate-100 flex flex-col items-center justify-center text-center p-8">
                <Video className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-base font-bold text-slate-800">No session recordings captured yet</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 mb-6">
                  Verify that <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">te.js</code> is embedded on your website. Once visitors arrive, their interactive replays will stream here automatically.
                </p>
                <Link
                  href="/onboarding"
                  className="text-xs font-bold bg-slate-900 text-white px-4 py-2.5 rounded-2xl hover:bg-slate-800 shadow-sm transition-all"
                >
                  View Setup Instructions
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ffe4d6] to-[#ffdcd2] text-rose-600 flex items-center justify-center flex-shrink-0 font-bold shadow-sm">
                        <Video className="w-5 h-5" />
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-slate-900 font-mono tracking-tight">
                            {rec.session_id}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Client CSS Inlined & Masked
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                            {formatRelativeTime(rec.created_at)}
                          </span>
                        </div>

                        {rec.entry_url && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate max-w-md font-mono text-[11px] text-slate-500">{rec.entry_url}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatExactTime(rec.created_at)}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <Monitor className="w-3.5 h-3.5 text-slate-400" />
                            {rec.browser || 'Chrome'} on {rec.os || 'Windows'}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {formatDuration(rec.duration)}
                          </span>
                          <span>&bull;</span>
                          <span className="text-slate-400 font-semibold">
                            {rec.event_count || 1} rrweb events
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleWatchReplay(rec)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold shadow-sm transition-all hover:scale-105 self-start sm:self-center flex-shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Watch Replay
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating High-Fidelity Replay Modal Backdrop */}
      {activeSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-[#0b101b] border border-slate-800/80 rounded-[32px] p-6 w-full max-w-5xl shadow-[0_25px_70px_rgba(0,0,0,0.6)] relative flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#ffe4d6] to-[#ffdcd2] text-rose-600 flex items-center justify-center shadow-sm">
                  <Play className="w-4 h-4 fill-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Authentic Visitor Replay</span>
                    <span className="font-mono text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      {activeSession.session_id}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                    <span>{formatExactTime(activeSession.created_at)}</span>
                    <span>&bull;</span>
                    <span>Duration: {formatDuration(activeSession.duration)}</span>
                    {activeSession.entry_url && (
                      <>
                        <span>&bull;</span>
                        <span className="text-slate-300 font-mono">{activeSession.entry_url}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                title="Close replay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Player Viewport */}
            <div className="flex-1 flex items-center justify-center min-h-[480px]">
              {loadingReplay ? (
                <div className="flex flex-col items-center justify-center text-slate-400 py-16">
                  <Loader2 className="w-9 h-9 animate-spin mb-3 text-rose-500" />
                  <p className="text-sm font-bold text-slate-200">Reconstructing DOM & CSS mutations...</p>
                  <span className="text-xs text-slate-500 mt-1">Decompressing full snapshot payload</span>
                </div>
              ) : replayError ? (
                <div className="text-center p-8 bg-slate-900/60 rounded-3xl border border-slate-800">
                  <AlertCircle className="w-9 h-9 text-rose-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-200">{replayError}</p>
                  <button
                    onClick={() => handleWatchReplay(activeSession)}
                    className="mt-4 text-xs font-bold bg-slate-800 text-white px-5 py-2.5 rounded-2xl hover:bg-slate-700"
                  >
                    Retry Playback
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