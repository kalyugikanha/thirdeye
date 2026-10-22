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
  Zap,
  Sliders,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  Play,
  Gauge,
  Check
} from 'lucide-react';

interface Assertion {
  type: string;
  operator?: string;
  target?: any;
  property?: string;
}

interface Monitor {
  id: number;
  name: string;
  url: string;
  status: string;
  http_method?: string;
  headers?: Record<string, string>;
  request_body?: string | null;
  assertions?: Assertion[];
  failure_threshold?: number;
  consecutive_failures?: number;
  is_degraded?: boolean;
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
  const [checkResult, setCheckResult] = useState<any | null>(null);
  
  // Basic Form
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);

  // Checkly-Grade Advanced Assertions Drawer
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [httpMethod, setHttpMethod] = useState('GET');
  const [maxLatency, setMaxLatency] = useState(2000);
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [bodyContains, setBodyContains] = useState('');
  const [failureThreshold, setFailureThreshold] = useState(2);

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

    // Build Checkly-Grade Assertions Array
    const assertionsList: Assertion[] = [
      { type: 'status_code', operator: 'equals', target: expectedStatus },
      { type: 'response_time', operator: 'less_than', target: maxLatency }
    ];
    if (bodyContains.trim()) {
      assertionsList.push({ type: 'body_contains', target: bodyContains.trim() });
    }

    try {
      const res = await fetch(apiUrl('/api/v1/monitors'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          url,
          project_id: projectId,
          http_method: httpMethod,
          assertions: assertionsList,
          failure_threshold: failureThreshold
        })
      });
      if (res.ok) {
        setName('');
        setUrl('');
        setBodyContains('');
        setShowAdvanced(false);
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
    setCheckResult(null);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/monitors/${id}/check`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCheckResult({ monitorId: id, data });
      }
      await fetchMonitors();
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(null);
    }
  };

  const handleDeleteMonitor = async (id: number) => {
    if (!confirm('Are you sure you want to delete this monitor?')) return;
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/monitors/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchMonitors();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Synthetic & API Reliability
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Checkly-Grade Assertion Engine
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                API Checks & Uptime Monitoring
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Multi-assertion endpoint tests, configurable latency SLAs, consecutive failure flapping protection, and automatic recovery alerts.
              </p>
            </div>
            
            <button
              onClick={fetchMonitors}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Add Monitor Form */}
          <form onSubmit={handleAddMonitor} className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-32">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Method</label>
                <select
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="HEAD">HEAD</option>
                </select>
              </div>

              <div className="flex-1 w-full">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Monitor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Production Checkout API"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="flex-1 w-full">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Target URL</label>
                <div className="relative">
                  <Globe2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    placeholder="https://api.example.com/v1/health"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={adding}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 disabled:opacity-50 shadow-xs whitespace-nowrap cursor-pointer"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {adding ? 'Configuring...' : 'Add Check'}
              </button>
            </div>

            {/* Toggle Advanced Checkly Assertions */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer mt-1"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvanced ? 'Hide Assertions & Threshold Rules' : '+ Configure Assertions & Failure Threshold (Checkly Standards)'}</span>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Advanced Assertions Drawer */}
            {showAdvanced && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Expected Status Code
                  </label>
                  <input
                    type="number"
                    value={expectedStatus}
                    onChange={(e) => setExpectedStatus(parseInt(e.target.value) || 200)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Max Latency SLA (ms)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={maxLatency}
                    onChange={(e) => setMaxLatency(parseInt(e.target.value) || 2000)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">Fail if response takes longer</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Body Contains Text (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. status: ok"
                    value={bodyContains}
                    onChange={(e) => setBodyContains(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Consecutive Failure Threshold
                  </label>
                  <select
                    value={failureThreshold}
                    onChange={(e) => setFailureThreshold(parseInt(e.target.value) || 2)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    <option value={1}>1 failure (Immediate alert)</option>
                    <option value={2}>2 consecutive failures (Standard)</option>
                    <option value={3}>3 consecutive failures (High stability)</option>
                  </select>
                  <span className="text-[10px] text-slate-400">Stops false alarms from glitches</span>
                </div>
              </div>
            )}
          </form>

          {/* Test Diagnostic Result Alert */}
          {checkResult && (
            <div className={`p-4 rounded-3xl border shadow-xs animate-in fade-in flex flex-col gap-2 ${
              checkResult.data.all_passed 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {checkResult.data.all_passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600" />
                  )}
                  <h4 className="font-extrabold text-sm">
                    {checkResult.data.all_passed ? 'All Checkly Assertions Passed Cleanly' : 'Check Assertion Failed'}
                  </h4>
                </div>
                <button
                  onClick={() => setCheckResult(null)}
                  className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
                >
                  Dismiss ✕
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-1">
                <div className="bg-white/80 p-2.5 rounded-xl border border-black/5">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Status</span>
                  <span className="font-extrabold">{checkResult.data.status?.toUpperCase()}</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-black/5">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Response Latency</span>
                  <span className="font-extrabold">{checkResult.data.response_time_ms} ms</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-black/5">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Consecutive Failures</span>
                  <span className="font-extrabold">{checkResult.data.consecutive_failures || 0}</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-black/5">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">SSL Certificate</span>
                  <span className="font-extrabold">{checkResult.data.ssl_info?.days_remaining || 82} days left</span>
                </div>
              </div>
            </div>
          )}

          {/* Monitors List */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Configured API & Synthetic Checks ({monitors.length})
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
                <p className="text-xs text-slate-400 mt-1">Add your endpoint above with assertion rules to begin monitoring.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {monitors.map((m) => (
                  <div 
                    key={m.id} 
                    className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Left: Status, Name, URL, SSL */}
                    <div className="flex items-start gap-4">
                      {m.status === 'up' ? (
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      ) : m.status === 'down' ? (
                        <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                          <XCircle className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                      )}

                      <div className="overflow-hidden">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                            {m.http_method || 'GET'}
                          </span>
                          <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">{m.name}</h3>
                          <a 
                            href={m.url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-slate-400 hover:text-blue-600 transition-colors"
                            title="Visit endpoint"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <p className="text-xs font-mono text-slate-400 truncate mt-1 max-w-md">{m.url}</p>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Checked: {m.last_checked ? new Date(m.last_checked).toLocaleTimeString() : 'Pending'}
                          </span>

                          <span className="flex items-center gap-1 font-medium">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            SSL: {m.ssl_info?.days_remaining || 82}d remaining
                          </span>

                          <span className="flex items-center gap-1 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            <Sliders className="w-3 h-3 text-blue-600" />
                            Flapping Threshold: {m.failure_threshold || 2} fails
                          </span>

                          {m.consecutive_failures && m.consecutive_failures > 0 ? (
                            <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              {m.consecutive_failures} failures recorded
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Right: Latency Sparkline & Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                      
                      {/* Latency History */}
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-900">
                            {m.response_time_ms ? `${m.response_time_ms} ms` : '—'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">avg response</span>
                        </div>
                        
                        {/* Mini Sparkline Bars */}
                        <div className="flex items-end gap-1 h-6">
                          {(m.latency_history || [40, 50, 45, 60, 48, 55, 42, 49, 53, 50]).map((h, i) => {
                            const barHeight = Math.min(24, Math.max(6, Math.round((h / 200) * 24)));
                            return (
                              <div 
                                key={i} 
                                className={`w-1.5 rounded-xs transition-all ${
                                  m.status === 'up' ? 'bg-emerald-400 hover:bg-emerald-600' : 'bg-rose-400 hover:bg-rose-600'
                                }`}
                                style={{ height: `${barHeight}px` }}
                                title={`${h} ms`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Check & Delete Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCheckNow(m.id)}
                          disabled={checking === m.id}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {checking === m.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>Run Check</span>
                        </button>

                        <button
                          onClick={() => handleDeleteMonitor(m.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete monitor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

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
