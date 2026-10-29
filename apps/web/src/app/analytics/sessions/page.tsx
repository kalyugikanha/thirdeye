"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import PaginationControls from '@/components/PaginationControls';
import DateRangePicker, { DateRangeValue } from '@/components/DateRangePicker';
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
  Smartphone,
  Tablet,
  Laptop,
  Globe,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ListOrdered,
  Zap,
  Copy,
  Check,
  MousePointer,
  Download
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
  device?: string;
  screen?: string;
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  user_role?: string | null;
  event_count?: number;
}

function getDeviceBadge(rec: SessionRecording) {
  const os = (rec.os || '').toLowerCase();
  const dev = (rec.device || '').toLowerCase();
  const screen = rec.screen || '';
  let width = 0;
  if (screen.includes('x')) {
    width = parseInt(screen.split('x')[0], 10) || 0;
  }
  const isMobile = dev === 'mobile' || os.includes('android') || os.includes('iphone') || os.includes('ios') || (width > 0 && width < 600);
  const isTablet = dev === 'tablet' || os.includes('ipad') || (width >= 600 && width < 1024);

  if (isMobile) {
    return {
      type: 'mobile',
      label: 'Mobile',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
      icon: <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
    };
  }
  if (isTablet) {
    return {
      type: 'tablet',
      label: 'Tablet',
      color: 'text-purple-700 bg-purple-50 border-purple-200/60',
      icon: <Tablet className="w-3.5 h-3.5 text-purple-600" />
    };
  }
  return {
    type: 'desktop',
    label: 'Desktop',
    color: 'text-blue-700 bg-blue-50 border-blue-200/60',
    icon: <Laptop className="w-3.5 h-3.5 text-blue-600" />
  };
}

export default function SessionsPage() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date Range state
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    preset: 'all',
    label: 'All Time'
  });
  const [exportingCsv, setExportingCsv] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Replay modal state
  const [activeSession, setActiveSession] = useState<SessionRecording | null>(null);
  const [replayEvents, setReplayEvents] = useState<any[] | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [clientDomain, setClientDomain] = useState<string>('');

  // Timeline and AI diagnostics state
  const [timeline, setTimeline] = useState<any[] | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [aiTab, setAiTab] = useState<'timeline' | 'ai'>('timeline');
  const [aiDiagnostic, setAiDiagnostic] = useState<any | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      // Fetch client project status to get current domain
      fetch(apiUrl('/api/v1/projects/status'), { headers })
        .then(r => r.json())
        .then(st => {
          if (st.domain) setClientDomain(st.domain);
        })
        .catch(() => {});

      const activePid = typeof window !== 'undefined' ? localStorage.getItem('te_active_project_id') : null;
      const params = new URLSearchParams();
      if (activePid) params.append('project_id', activePid);
      params.append('page', String(page));
      params.append('page_size', String(pageSize));
      if (userSearch.trim()) params.append('search', userSearch.trim());
      if (dateRange.fromDate) params.append('from_date', dateRange.fromDate);
      if (dateRange.toDate) params.append('to_date', dateRange.toDate);

      const res = await fetch(apiUrl(`/api/v1/recordings?${params.toString()}`), { headers });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && Array.isArray(data.items)) {
          setRecordings(data.items);
          setTotalCount(data.total || 0);
          setTotalPages(data.total_pages || 1);
        } else if (Array.isArray(data)) {
          setRecordings(data);
          setTotalCount(data.length);
          setTotalPages(1);
        } else {
          setRecordings([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      } else {
        setError('Failed to fetch recorded sessions.');
      }
    } catch (err) {
      console.error('Failed to fetch recordings:', err);
      setError('Unable to reach ThirdEye recording service.');
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, userSearch, dateRange]);

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const activePid = typeof window !== 'undefined' ? localStorage.getItem('te_active_project_id') : null;

      const params = new URLSearchParams();
      if (activePid) params.append('project_id', activePid);
      if (userSearch.trim()) params.append('search', userSearch.trim());
      if (dateRange.fromDate) params.append('from_date', dateRange.fromDate);
      if (dateRange.toDate) params.append('to_date', dateRange.toDate);

      const res = await fetch(apiUrl(`/api/v1/recordings/export/csv?${params.toString()}`), { headers });
      if (!res.ok) throw new Error('Failed to export CSV');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thirdeye_sessions_${dateRange.preset}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV Export Error:', err);
    } finally {
      setExportingCsv(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Auto-open session replay if session_id is in query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const sid = sp.get('session_id');
      const urlParam = sp.get('url');
      if (sid) {
        setUserSearch(sid);
        handleWatchReplay({
          id: 0,
          session_id: sid,
          project_id: null,
          duration: 0,
          file_path: '',
          created_at: new Date().toISOString()
        });
      } else if (urlParam) {
        setUserSearch(urlParam);
      }
    }
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      if (!token) return;
      const res = await fetch(apiUrl('/api/v1/recordings/simulate'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await loadSessions();
      } else {
        alert('Could not simulate session. Please try again.');
      }
    } catch (e) {
      console.error(e);
      alert('Error generating test session.');
    } finally {
      setSimulating(false);
    }
  };

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

      // Fetch synchronized timeline markers
      setLoadingTimeline(true);
      fetch(apiUrl(`/api/v1/recordings/${session.session_id}/timeline`), { headers })
        .then(r => r.json())
        .then(data => {
          if (data && Array.isArray(data.timeline)) {
            setTimeline(data.timeline);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingTimeline(false));
    } catch (err: any) {
      console.error('Failed to load replay events:', err);
      setReplayError(err.message || 'Unable to decompress or parse session replay.');
    } finally {
      setLoadingReplay(false);
    }
  };

  const handleRunAiDiagnostics = async (sessionId: string) => {
    setLoadingAi(true);
    setAiTab('ai');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      const res = await fetch(apiUrl(`/api/v1/recordings/${sessionId}/ai-diagnose`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAiDiagnostic(data);
      }
    } catch (err) {
      console.error('Failed to run AI diagnostics:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleExportHtml = async (sessionId: string) => {
    setExportingHtml(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(apiUrl(`/api/v1/recordings/${sessionId}/export/html`), { headers });
      if (!res.ok) {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `ThirdEye-Replay-${sessionId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('Failed to download standalone HTML replay:', e);
      alert('Unable to export session replay to offline HTML.');
    } finally {
      setExportingHtml(false);
    }
  };

  useEffect(() => {
    if (recordings.length > 0 && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const targetSessionId = params.get('session');
      if (targetSessionId && (!activeSession || activeSession.session_id !== targetSessionId)) {
        const match = recordings.find(r => r.session_id === targetSessionId);
        if (match) {
          handleWatchReplay(match);
        }
      }
    }
  }, [recordings]);

  const handleTimelineClick = (item: any) => {
    if (typeof item.offset_ms === 'number') {
      setSeekTime(item.offset_ms);
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

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const normalized = (!isoString.endsWith('Z') && !isoString.includes('+') && !isoString.includes('-', 10))
        ? `${isoString}Z`
        : isoString;
      const diffSec = Math.max(0, Math.floor((Date.now() - new Date(normalized).getTime()) / 1000));
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
    setTimeline(null);
    setSeekTime(null);
    setAiDiagnostic(null);
    setAiTab('timeline');
    setCopiedFix(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
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
              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 hover:scale-[1.02]"
                title="Simulate a test session on your domain"
              >
                {simulating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulate Session</span>
                  </>
                )}
              </button>
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
                <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                  <Video className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  No session recordings captured yet {clientDomain ? `for ${clientDomain}` : ''}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mt-1.5 mb-6">
                  Verify that <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono text-[11px]">te.js</code> is embedded on your website. Once visitors arrive, their interactive replays will stream here automatically.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={handleSimulate}
                    disabled={simulating}
                    className="text-xs font-bold bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white px-5 py-2.5 rounded-2xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 hover:scale-105"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating Test Session...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Simulate Test Session on {clientDomain || 'Your Domain'}</span>
                      </>
                    )}
                  </button>
                  <Link
                    href="/onboarding"
                    className="text-xs font-bold bg-slate-900 text-white px-4 py-2.5 rounded-2xl hover:bg-slate-800 shadow-sm transition-all"
                  >
                    View Setup Instructions
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search, Date Range Filter & CSV Export Toolbar */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
                    <input
                      type="text"
                      placeholder="Filter replays by Employee Email, User ID, Role, Session ID, or Entry URL..."
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setPage(1);
                      }}
                      className="w-full text-xs text-slate-900 focus:outline-none px-2 font-medium"
                    />
                    {userSearch && (
                      <button
                        onClick={() => {
                          setUserSearch('');
                          setPage(1);
                        }}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Date Range Picker Component */}
                  <DateRangePicker
                    value={dateRange}
                    onChange={(newVal) => {
                      setDateRange(newVal);
                      setPage(1);
                    }}
                  />

                  {/* Export CSV Button */}
                  <button
                    onClick={handleExportCsv}
                    disabled={exportingCsv || totalCount === 0}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 rounded-2xl text-xs font-bold shadow-2xs transition-all hover:scale-[1.02] flex items-center gap-2 flex-shrink-0 disabled:opacity-50 cursor-pointer"
                    title="Export filtered sessions as CSV"
                  >
                    {exportingCsv ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{exportingCsv ? 'Exporting...' : 'Export CSV'}</span>
                  </button>
                </div>

                {totalCount > 0 && (
                  <PaginationControls
                    page={page}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    totalPages={totalPages}
                    onPageChange={(p) => setPage(p)}
                    onPageSizeChange={(ps) => {
                      setPageSize(ps);
                      setPage(1);
                    }}
                    pageSizeOptions={[10, 20, 50]}
                    itemLabel="sessions"
                  />
                )}

                {recordings.map((rec) => {
                  const devBadge = getDeviceBadge(rec);
                  return (
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
                            {(rec.user_email || rec.user_id) && (
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                                👤 {rec.user_name || rec.user_email || rec.user_id} {rec.user_role ? `• ${rec.user_role}` : ''}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${devBadge.color}`}>
                              {devBadge.icon}
                              <span>{devBadge.label}</span>
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
                            <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                              {devBadge.icon}
                              <span>{rec.browser || 'Chrome'} on {rec.os || (devBadge.type === 'mobile' ? 'Android' : 'Windows')}</span>
                              {rec.screen && (
                                <span className="font-mono text-[11px] text-slate-500">
                                  ({rec.screen})
                                </span>
                              )}
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
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold shadow-sm transition-all hover:scale-105 self-start sm:self-center flex-shrink-0 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        Watch Replay
                      </button>
                    </div>
                  );
                })}

                {totalPages > 1 && (
                  <div className="pt-2">
                    <PaginationControls
                      page={page}
                      pageSize={pageSize}
                      totalCount={totalCount}
                      totalPages={totalPages}
                      onPageChange={(p) => {
                        setPage(p);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      onPageSizeChange={(ps) => {
                        setPageSize(ps);
                        setPage(1);
                      }}
                      pageSizeOptions={[10, 20, 50]}
                      itemLabel="sessions"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

      {/* Floating High-Fidelity Replay Modal Backdrop */}
      {activeSession && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="bg-[#0b101b] border border-slate-800/80 rounded-[32px] p-6 w-full max-w-6xl shadow-[0_25px_70px_rgba(0,0,0,0.6)] relative flex flex-col max-h-[94vh]">
            
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
                    <span>&bull;</span>
                    {(() => {
                      const activeBadge = getDeviceBadge(activeSession);
                      return (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${activeBadge.color}`}>
                          {activeBadge.icon}
                          <span>{activeSession.browser || 'Chrome'} on {activeSession.os || (activeBadge.type === 'mobile' ? 'Android' : 'Windows')} ({activeBadge.label}{activeSession.screen ? ` • ${activeSession.screen}` : ''})</span>
                        </span>
                      );
                    })()}
                    {activeSession.entry_url && (
                      <>
                        <span>&bull;</span>
                        <span className="text-slate-300 font-mono">{activeSession.entry_url}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (activeSession) handleExportHtml(activeSession.session_id);
                  }}
                  disabled={exportingHtml}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow-sm transition-all disabled:opacity-50"
                  title="Download standalone offline HTML player"
                >
                  {exportingHtml ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>{exportingHtml ? 'Exporting...' : 'Export HTML'}</span>
                </button>
                <button
                  onClick={() => {
                    setAiTab('ai');
                    if (activeSession) handleRunAiDiagnostics(activeSession.session_id);
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-90 text-white text-xs font-bold shadow-md transition-all"
                  title="Run automated AI friction diagnosis"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  <span>Analyze with AI</span>
                </button>
                <button
                  onClick={closeModal}
                  className="w-9 h-9 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                  title="Close replay"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content: Dual Pane Player & Timeline / AI Diagnostics */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[560px] overflow-hidden">
              {/* Left Pane: Replay Player */}
              <div className="lg:col-span-8 flex flex-col justify-start items-center bg-slate-950/70 rounded-2xl border border-slate-850 p-3 overflow-y-auto relative">
                {loadingReplay ? (
                  <div className="flex flex-col items-center justify-center text-slate-400 py-24 my-auto">
                    <Loader2 className="w-9 h-9 animate-spin mb-3 text-rose-500" />
                    <p className="text-sm font-bold text-slate-200">Reconstructing DOM & CSS mutations...</p>
                    <span className="text-xs text-slate-500 mt-1">Decompressing full snapshot payload</span>
                  </div>
                ) : replayError ? (
                  <div className="text-center p-8 bg-slate-900/60 rounded-3xl border border-slate-800 my-auto">
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
                  <ReplayPlayer 
                    events={replayEvents} 
                    timeline={timeline}
                    width={getDeviceBadge(activeSession).type === 'mobile' ? 360 : 680} 
                    height={getDeviceBadge(activeSession).type === 'mobile' ? 500 : 420} 
                    isMobile={getDeviceBadge(activeSession).type === 'mobile'}
                    seekTime={seekTime} 
                    siteUrl={activeSession?.entry_url || clientDomain} 
                  />
                ) : null}
              </div>

              {/* Right Pane: Synchronized Timeline & AI Copilot */}
              <div className="lg:col-span-4 flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800/80 p-4 h-[560px] overflow-hidden">
                {/* Tab switcher */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl mb-3 border border-slate-800/60 flex-shrink-0">
                  <button
                    onClick={() => setAiTab('timeline')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      aiTab === 'timeline'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                    <span>Timeline ({timeline?.length || 0})</span>
                  </button>
                  <button
                    onClick={() => {
                      setAiTab('ai');
                      if (!aiDiagnostic && activeSession) {
                        handleRunAiDiagnostics(activeSession.session_id);
                      }
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      aiTab === 'ai'
                        ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI Copilot</span>
                  </button>
                </div>

                {/* Tab 1: Interactive Event Timeline */}
                {aiTab === 'timeline' && (
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {loadingTimeline ? (
                      <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                        <Loader2 className="w-5 h-5 animate-spin mb-2 text-rose-500" />
                        <span>Extracting event markers...</span>
                      </div>
                    ) : timeline && timeline.length > 0 ? (
                      timeline.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleTimelineClick(item)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.01] ${
                            item.severity === 'warning'
                              ? 'bg-amber-950/20 border-amber-800/40 hover:bg-amber-950/40 text-amber-200'
                              : item.severity === 'error'
                              ? 'bg-rose-950/25 border-rose-800/50 hover:bg-rose-950/45 text-rose-200'
                              : 'bg-slate-950/50 border-slate-800/60 hover:bg-slate-800/40 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                              {item.offset_formatted}
                            </span>
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                              {item.event_type}
                            </span>
                          </div>
                          <p className="text-xs font-medium line-clamp-2 leading-relaxed">
                            {item.label}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 text-slate-500 text-xs">
                        No telemetry events recorded for this session.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: AI Copilot Diagnostics */}
                {aiTab === 'ai' && (
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {loadingAi ? (
                      <div className="flex flex-col items-center justify-center h-56 text-slate-400 text-xs text-center p-4">
                        <Sparkles className="w-8 h-8 animate-pulse text-amber-400 mb-2" />
                        <span className="font-bold text-slate-200">Analyzing DOM mutations & friction...</span>
                        <span className="text-slate-500 mt-1">Inspecting rage-clicks, drop-offs, and console errors</span>
                      </div>
                    ) : aiDiagnostic ? (
                      <div className="space-y-3">
                        {/* Friction Gauge */}
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">UX Friction Index</span>
                            <div className="text-lg font-black text-white flex items-center gap-2">
                              <span>{aiDiagnostic.friction_score}/100</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                aiDiagnostic.level_color === 'rose'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : aiDiagnostic.level_color === 'amber'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {aiDiagnostic.friction_level}
                              </span>
                            </div>
                          </div>
                          <Zap className={`w-6 h-6 ${
                            aiDiagnostic.level_color === 'rose' ? 'text-rose-400' : 'text-amber-400'
                          }`} />
                        </div>

                        {/* Intent Summary */}
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Visitor Intent</span>
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                            {aiDiagnostic.intent_summary}
                          </p>
                        </div>

                        {/* Detected Friction Points */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detected Friction Points</span>
                          {aiDiagnostic.friction_points?.map((fp: any, idx: number) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
                              <div className="flex items-center justify-between font-bold text-slate-200 text-[11px] mb-0.5">
                                <span>{fp.type}</span>
                                <span className="text-[10px] font-mono text-slate-400">{fp.element}</span>
                              </div>
                              <p className="text-slate-400 text-[11px] leading-relaxed">{fp.description}</p>
                            </div>
                          ))}
                        </div>

                        {/* Developer Fix Recommendation */}
                        <div className="p-3 rounded-xl bg-gradient-to-br from-rose-950/30 to-amber-950/30 border border-rose-800/40">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Engineering Recommendation</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(aiDiagnostic.developer_recommendation);
                                setCopiedFix(true);
                                setTimeout(() => setCopiedFix(false), 2000);
                              }}
                              className="text-[10px] flex items-center gap-1 text-slate-300 hover:text-white"
                            >
                              {copiedFix ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedFix ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed font-medium">
                            {aiDiagnostic.developer_recommendation}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <button
                          onClick={() => activeSession && handleRunAiDiagnostics(activeSession.session_id)}
                          className="px-4 py-2 bg-gradient-to-r from-rose-500 to-amber-500 text-white rounded-xl text-xs font-bold shadow-md hover:scale-105 transition-all"
                        >
                          Run AI Friction Diagnostic
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}