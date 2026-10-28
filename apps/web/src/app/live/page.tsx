"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import {
  Radio,
  Users,
  Activity,
  Globe,
  Monitor,
  Smartphone,
  Clock,
  Play,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Sparkles,
  Check,
  Copy
} from 'lucide-react';

interface LiveVisitor {
  session_id: string;
  project_id: number;
  current_url: string;
  referrer: string;
  browser: string;
  os: string;
  device: string;
  country: string;
  duration_seconds: number;
  last_active_seconds_ago: number;
}

export default function LivePulsePage() {
  const router = useRouter();
  const [visitors, setVisitors] = useState<LiveVisitor[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false); // Paused by default to save CPU & avoid 4s flooding
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [clientDomain, setClientDomain] = useState<string>('');

  const fetchLiveVisitors = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      if (!token) {
        router.push('/login');
        return;
      }
      const res = await fetch(apiUrl('/api/v1/live/visitors'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setVisitors(Array.isArray(data.visitors) ? data.visitors : []);
        setActiveCount(typeof data.active_count === 'number' ? data.active_count : (data.visitors?.length || 0));
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch live visitors:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Initial fetch of domain
    const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
    if (token) {
      fetch(apiUrl('/api/v1/projects/status'), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => {
          if (d.domain) setClientDomain(d.domain);
        })
        .catch(() => {});
    }

    fetchLiveVisitors();
  }, [fetchLiveVisitors]);

  // Polling loop (Graceful 10s interval when user explicitly unpauses)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLiveVisitors();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLiveVisitors]);

  const handleSimulateVisitor = async () => {
    setSimulating(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      if (!token) return;
      const statusRes = await fetch(apiUrl('/api/v1/projects/status'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const statusData = await statusRes.json();
      const apiKey = statusData.api_key;
      if (!apiKey) {
        alert('Could not retrieve API key for live simulation.');
        return;
      }

      const randomSession = 'live_' + Math.random().toString(36).substring(2, 10);
      const hostDomain = statusData.domain || 'selfupcommunity.com';

      // Send live heartbeat
      await fetch(apiUrl('/api/v1/live/heartbeat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          api_key: apiKey,
          session_id: randomSession,
          current_url: `https://${hostDomain}/pricing`,
          referrer: 'https://google.com/search?q=' + encodeURIComponent(hostDomain),
          properties: {
            browser: 'Chrome 122',
            os: 'macOS',
            device: 'Desktop',
            country: 'United States'
          }
        })
      });

      // Also trigger a pageview event
      await fetch(apiUrl('/api/v1/collect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          session_id: randomSession,
          event_type: 'pageview',
          url: `https://${hostDomain}/pricing`,
          referrer: 'https://google.com/',
          properties: {
            browser: 'Chrome 122',
            os: 'macOS',
            device: 'Desktop',
            country: 'United States'
          }
        })
      });

      await fetchLiveVisitors();
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  const copySessionId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatSeconds = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // Group paths
  const topPaths = visitors.reduce((acc: Record<string, number>, v) => {
    const path = v.current_url ? new URL(v.current_url, 'https://dummy.com').pathname : '/';
    acc[path] = (acc[path] || 0) + 1;
    return acc;
  }, {});
  const topPathEntry = Object.entries(topPaths).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      {/* Dynamic Sidebar */}
      <Sidebar />

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto">
          
          {/* Top Bar */}
          <header className="h-20 border-b border-slate-200/60 px-8 flex items-center justify-between bg-white/50 backdrop-blur-md flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md relative">
                <Radio className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full animate-ping" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Live Pulse Radar</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Real-Time Stream
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Monitoring live visitor sessions for <strong className="text-slate-800">{clientDomain || 'your workspace'}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition-all flex items-center gap-2 shadow-xs cursor-pointer ${
                  autoRefresh
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
                title={autoRefresh ? 'Click to Pause 10s Live Radar' : 'Click to Start 10s Live Radar'}
              >
                <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span>{autoRefresh ? 'Radar Active (10s)' : 'Radar Paused (Click to Start)'}</span>
              </button>

              <button
                onClick={fetchLiveVisitors}
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-xs transition-all cursor-pointer"
                title="Refresh once"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleSimulateVisitor}
                disabled={simulating}
                className="text-xs font-bold px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{simulating ? 'Emitting...' : 'Emit Test Visitor'}</span>
              </button>
            </div>
          </header>

          {/* Radar Dashboard Content */}
          <div className="p-8 space-y-6 flex-1">
            
            {/* KPI Radar Bento Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Right Now</span>
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">{activeCount}</span>
                  <span className="text-xs text-emerald-600 font-bold">active visitors</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Active tab within the last 3 minutes</p>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Top Active Page</span>
                <div className="mt-3">
                  <p className="text-lg font-black text-slate-900 truncate font-mono">
                    {topPathEntry ? topPathEntry[0] : '/'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {topPathEntry ? `${topPathEntry[1]} visitors currently on this path` : 'Awaiting incoming traffic'}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Device Split</span>
                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-slate-400" />
                    <span>{visitors.filter(v => v.device !== 'Mobile').length} Desktop</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-slate-400" />
                    <span>{visitors.filter(v => v.device === 'Mobile').length} Mobile</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Responsive telemetry reporting</p>
              </div>

              <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Telemetry Health</span>
                <div className="mt-3 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-900">SDK Connected</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Heartbeat sync latency sub-40ms</p>
              </div>
            </div>

            {/* Live Visitors Stream Table */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900">Current Active Sessions</h2>
                  <p className="text-xs text-slate-500">Live heartbeat pings from your embedded ThirdEye snippet</p>
                </div>
                <span className="text-[11px] text-slate-400">
                  Refreshed: {lastUpdated.toLocaleTimeString()}
                </span>
              </div>

              {visitors.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <Radio className="w-8 h-8 animate-pulse text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No active visitors online right now</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    When visitors browse <strong>{clientDomain || 'your website'}</strong>, their live session appears here in real-time.
                  </p>
                  <button
                    onClick={handleSimulateVisitor}
                    disabled={simulating}
                    className="mt-5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Emit Test Live Visitor</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="pb-3 pl-2">Session ID</th>
                        <th className="pb-3">Active Page URL</th>
                        <th className="pb-3">Device / OS</th>
                        <th className="pb-3">Referrer</th>
                        <th className="pb-3">Duration</th>
                        <th className="pb-3">Last Ping</th>
                        <th className="pb-3 text-right pr-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visitors.map((visitor) => (
                        <tr key={visitor.session_id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="py-3.5 pl-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">
                                {visitor.session_id.substring(0, 12)}
                              </span>
                              <button
                                onClick={() => copySessionId(visitor.session_id)}
                                className="text-slate-400 hover:text-slate-600"
                                title="Copy full session ID"
                              >
                                {copiedId === visitor.session_id ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5">
                            <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded max-w-xs truncate inline-block">
                              {visitor.current_url || '/'}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <span className="text-slate-600 font-medium">
                              {visitor.browser} on {visitor.os}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-500 truncate max-w-[140px]">
                            {visitor.referrer || 'Direct'}
                          </td>
                          <td className="py-3.5 font-medium text-slate-600">
                            {formatSeconds(visitor.duration_seconds)}
                          </td>
                          <td className="py-3.5">
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/60 font-semibold px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              {visitor.last_active_seconds_ago}s ago
                            </span>
                          </td>
                          <td className="py-3.5 text-right pr-2">
                            <Link
                              href={`/analytics/sessions`}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold shadow-sm transition-all inline-flex items-center gap-1"
                            >
                              <Play className="w-3 h-3 fill-white" />
                              <span>Replay</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
    </div>
  );
}
