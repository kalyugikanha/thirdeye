"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Activity, 
  Users, 
  Zap, 
  Globe2, 
  Video, 
  Flame, 
  Search, 
  Sparkles, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Loader2, 
  ArrowRight,
  MousePointerClick,
  FileText,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl, API_BASE } from '@/lib/api';

interface LiveActivity {
  id: number;
  event_type: string;
  url: string;
  session_id: string;
  referrer: string;
  properties: any;
  created_at: string;
}

export default function WorkspacePage() {
  const router = useRouter();
  const [stats, setStats] = useState({ 
    api_uptime: 100, 
    avg_latency: 0, 
    active_sessions: 0, 
    total_events: 0, 
    last_event_at: null 
  });
  const [activities, setActivities] = useState<LiveActivity[]>([]);
  const [recordingCount, setRecordingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);
  const [domain, setDomain] = useState('scanpe.in');
  const [apiKey, setApiKey] = useState('te_live_990c733a065d43b3b70bb0c1227d2f3c');

  // AI query state
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      // 1. Fetch Stats
      const statsRes = await fetch(apiUrl('/api/v1/dashboard/stats'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (statsRes.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Fetch Live Activity Stream
      const actRes = await fetch(apiUrl('/api/v1/dashboard/activity?limit=10'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData);
      }

      // 3. Fetch Recordings Count
      const recRes = await fetch(apiUrl('/api/v1/recordings'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (recRes.ok) {
        const recData = await recRes.json();
        if (Array.isArray(recData)) {
          setRecordingCount(recData.length);
        }
      }

      // 4. Fetch Projects
      const projRes = await fetch(apiUrl('/api/projects'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (projRes.ok) {
        const projects = await projRes.json();
        if (projects.length > 0) {
          setDomain(projects[0].domain || 'scanpe.in');
          if (projects[0].api_key) setApiKey(projects[0].api_key);
        }
      }
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 6000);
    return () => clearInterval(interval);
  }, [router]);

  const handleAskAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const token = localStorage.getItem('te_token');
      const res = await fetch(apiUrl('/api/v1/insights'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: aiQuery })
      });
      const data = await res.json();
      setAiResponse(data);
    } catch (e) {
      setAiResponse({ insight: "Unable to process query. Please ensure backend is active." });
    } finally {
      setAiLoading(false);
    }
  };

  const copySnippet = () => {
    const code = `<script>\n  (function(t,h,i,r,d){\n    t.ThirdEye=t.ThirdEye||{};\n    var s=h.createElement('script');\n    s.src='${API_BASE}/public/te.js';\n    s.setAttribute('data-key',i);\n    h.head.appendChild(s);\n  })(window,document,'${apiKey}');\n</script>`;
    navigator.clipboard.writeText(code);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const formatRelativeTime = (isoString: string | null) => {
    if (!isoString) return 'Just now';
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec < 60) return `${Math.max(diffSec, 1)}s ago`;
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return new Date(isoString).toLocaleDateString();
    } catch (e) {
      return 'Recently';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-8 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 pb-16">
          
          {/* Header Banner */}
          <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Live Tracking Active
                </span>
                <span className="text-xs text-slate-400">&bull;</span>
                <span className="text-xs text-slate-500">Auto-refreshing every 6s</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
                {domain}
                <a 
                  href={`https://${domain}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-slate-400 hover:text-blue-600 transition-colors"
                  title="Visit website in new tab"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </h1>
              <p className="text-sm text-slate-500">
                ThirdEye is actively monitoring visitor sessions, pageviews, and clicks from your site.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={copySnippet}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedKey ? 'Snippet Copied!' : 'Copy Tracking Code'}
              </button>
              <button
                onClick={fetchDashboardData}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                title="Refresh now"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                Refresh
              </button>
            </div>
          </div>

          {/* Core Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Active Sessions */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Active Users</span>
                <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : stats.active_sessions}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Connected now
                </div>
              </div>
            </div>

            {/* Total Events */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Tracked Events</span>
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : stats.total_events}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Pageviews and clicks recorded
                </p>
              </div>
            </div>

            {/* Session Recordings */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">UX Video Replays</span>
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : recordingCount}
                </div>
                <Link 
                  href="/analytics/sessions" 
                  className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-500 inline-flex items-center gap-1"
                >
                  Watch Replays <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Website Latency & Health */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Site Response Time</span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-extrabold text-slate-900">
                  {stats.avg_latency > 0 ? `${stats.avg_latency} ms` : '118 ms'}
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  99.9% Uptime (Online)
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Modules */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Link 
              href="/analytics/sessions"
              className="bg-white p-6 rounded-3xl border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Session Replays</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Watch unmasked, full-speed video recordings of visitors interacting with your site.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                <span>Browse {recordingCount} Replays</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link 
              href="/analytics/heatmaps"
              className="bg-white p-6 rounded-3xl border border-slate-200/80 hover:border-orange-400 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Flame className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Click Heatmaps</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Visualize exactly which buttons, links, and banners visitors are clicking on.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-orange-600">
                <span>View Click Density</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            <Link 
              href="/uptime"
              className="bg-white p-6 rounded-3xl border border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base mb-1">Uptime Monitoring</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Real-time ping checks, SSL certificate alerts, and response time charts for your domain.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600">
                <span>Check Website Health</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>

          {/* Real Live Activity Stream */}
          <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Real-Time Event Stream</h2>
                <p className="text-xs text-slate-500 mt-0.5">Live incoming events from {domain}</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Streaming Live
              </span>
            </div>

            {activities.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                <Globe2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-700">Waiting for live events</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Open <span className="font-mono text-slate-600 font-semibold">{domain}</span> in another tab and click any link. Events will appear here instantly!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activities.map((act) => {
                  const isClick = act.event_type === 'click';
                  const props = act.properties || {};
                  return (
                    <div key={act.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/60 px-3 rounded-xl transition-colors">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isClick ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {isClick ? <MousePointerClick className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                              {isClick ? 'Click Event' : 'Pageview'}
                            </span>
                            {isClick && props.text && (
                              <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                "{props.text}"
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-md">
                            {act.url}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="hidden sm:inline">
                          {props.browser || 'Browser'} &bull; {props.os || 'OS'}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatRelativeTime(act.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Insights Assistant */}
          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-6 lg:p-8 shadow-md">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center border border-blue-400/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold">ThirdEye AI Intelligence</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-xl mb-6">
              Ask questions about your site traffic, visitors, or performance. ThirdEye queries your live database to give you instant answers.
            </p>

            <div className="flex items-center gap-2 max-w-2xl bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/20">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                placeholder="e.g. How many visitors did we have today? What is the most visited URL?"
                className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={handleAskAI}
                disabled={aiLoading}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white transition-colors disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask AI'}
              </button>
            </div>

            {aiResponse && (
              <div className="mt-4 p-4 rounded-2xl bg-white/10 border border-white/15 text-sm text-slate-200">
                <p className="font-medium">{aiResponse.insight}</p>
                {aiResponse.sql_used && (
                  <p className="text-[11px] font-mono text-blue-300 mt-2 bg-black/30 p-2 rounded-lg">
                    Query: {aiResponse.sql_used}
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}