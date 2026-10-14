"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Activity, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  Globe2,
  Lock,
  Loader2,
  Zap
} from 'lucide-react';

interface Monitor {
  id: number;
  name: string;
  url: string;
  status: string;
  last_checked: string | null;
  response_time_ms: number | null;
  error_message: string | null;
  ssl_info?: {
    valid: boolean;
    days_remaining: number;
    issuer: string;
  };
  latency_history?: number[];
}

export default function UptimePage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const router = useRouter();

  const fetchMonitors = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const projRes = await fetch(apiUrl('/api/projects'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (projRes.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      const projects = await projRes.json();
      if (Array.isArray(projects) && projects.length > 0) {
        setProjectId(projects[0].id);
      }

      const res = await fetch(apiUrl('/api/v1/monitors'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMonitors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !projectId) return;
    setAdding(true);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/monitors'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, url, project_id: projectId })
      });
      if (res.ok) {
        setName('');
        setUrl('');
        fetchMonitors();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleCheckNow = async (id: number) => {
    setChecking(id);
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/monitors/${id}/check`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchMonitors();
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-8 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 pb-16">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Site Reliability
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Uptime & Latency Monitoring
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Real-time HTTP availability pings, SSL expiration tracking, and response time sparklines.
              </p>
            </div>
            <button
              onClick={fetchMonitors}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Add Monitor Form */}
          <form onSubmit={handleAddMonitor} className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Monitor Label</label>
              <input
                type="text"
                placeholder="GrowInsight About Us Page"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target Endpoint URL</label>
              <div className="relative">
                <Globe2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="url"
                  placeholder="https://growinsight.co.in/about-us/"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm whitespace-nowrap"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {adding ? 'Adding...' : 'Add Monitor'}
            </button>
          </form>

          {/* Monitors List */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Configured Monitors ({monitors.length})
              </h2>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                Loading monitor telemetry...
              </div>
            ) : monitors.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">No monitors configured yet</p>
                <p className="text-xs text-slate-400 mt-1">Add your target URL above to begin monitoring.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {monitors.map((m) => (
                  <div 
                    key={m.id} 
                    className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Left: Status, Name, URL, SSL */}
                    <div className="flex items-start gap-4">
                      {m.status === 'up' ? (
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : m.status === 'down' ? (
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 flex-shrink-0">
                          <XCircle className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 flex-shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                      )}

                      <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">{m.name}</h3>
                          <a 
                            href={m.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Visit website"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <p className="text-xs font-mono text-slate-400 truncate mt-0.5 max-w-md">{m.url}</p>

                        {/* SSL Badge */}
                        {m.ssl_info && m.ssl_info.valid && (
                          <div className="flex items-center gap-1.5 mt-2.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <Lock className="w-3 h-3 text-emerald-600" />
                              SSL Valid • {m.ssl_info.days_remaining} Days Remaining
                            </span>
                          </div>
                        )}

                        {m.error_message && (
                          <p className="text-xs text-rose-600 mt-2 font-medium bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                            {m.error_message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Latency Sparkline, Response Time, Check Now */}
                    <div className="flex flex-wrap items-center gap-6 self-end lg:self-auto">
                      
                      {/* 10-point Sparkline Bar Chart */}
                      {m.latency_history && m.latency_history.length > 0 && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Response Trend</div>
                          <div className="flex items-end gap-1 h-8">
                            {m.latency_history.map((val, idx) => {
                              const maxVal = Math.max(...(m.latency_history || [120]), 200);
                              const hPct = Math.min(100, Math.max(15, Math.round((val / maxVal) * 100)));
                              return (
                                <div
                                  key={idx}
                                  title={`${val} ms`}
                                  className="w-1.5 rounded-t bg-blue-500/80 hover:bg-blue-600 transition-colors"
                                  style={{ height: `${hPct}%` }}
                                ></div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Current Latency */}
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Response Time</div>
                        <div className="text-base font-black text-slate-900 mt-0.5">
                          {m.response_time_ms !== null ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-black">
                              <Zap className="w-3.5 h-3.5" />
                              {m.response_time_ms} ms
                            </span>
                          ) : '--'}
                        </div>
                      </div>

                      {/* Last Checked */}
                      <div className="text-right hidden sm:block">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last Checked</div>
                        <div className="text-xs font-semibold text-slate-600 mt-0.5">
                          {m.last_checked ? new Date(m.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                        </div>
                      </div>

                      {/* Check Now Trigger Button */}
                      <button
                        onClick={() => handleCheckNow(m.id)}
                        disabled={checking === m.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors disabled:opacity-50"
                      >
                        {checking === m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        {checking === m.id ? 'Checking...' : 'Check Now'}
                      </button>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}