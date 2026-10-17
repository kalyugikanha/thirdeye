"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  WifiOff, 
  AlertTriangle, 
  Clock, 
  Activity, 
  Sparkles, 
  RefreshCw, 
  Loader2, 
  Video, 
  ArrowUpRight,
  Filter,
  CheckCircle2,
  ServerCrash
} from 'lucide-react';

interface NetworkKPIs {
  total: number;
  errors_5xx: number;
  errors_4xx: number;
  slow_requests: number;
  p95_latency_ms: number;
}

interface EndpointStat {
  endpoint: string;
  total_calls: number;
  failure_count: number;
  failure_rate: number;
  avg_latency_ms: number;
}

interface NetworkRequestItem {
  id: number;
  session_id: string;
  page_url: string;
  endpoint_url: string;
  method: string;
  status_code: number;
  duration_ms: number;
  created_at: string;
}

export default function NetworkInspectorPage() {
  const router = useRouter();
  const [kpis, setKpis] = useState<NetworkKPIs>({
    total: 0,
    errors_5xx: 0,
    errors_4xx: 0,
    slow_requests: 0,
    p95_latency_ms: 0
  });
  const [endpoints, setEndpoints] = useState<EndpointStat[]>([]);
  const [requests, setRequests] = useState<NetworkRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [filterType, setFilterType] = useState<'all' | '5xx' | '4xx' | 'slow'>('all');

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('te_token') : null);

  const loadData = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/network/requests?limit=100'), {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis || { total: 0, errors_5xx: 0, errors_4xx: 0, slow_requests: 0, p95_latency_ms: 0 });
        setEndpoints(data.endpoints || []);
        setRequests(data.recent_requests || []);
      }
    } catch (e) {
      console.error('Failed to load network requests:', e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSimulate = async () => {
    const t = token();
    if (!t) return;
    setSimulating(true);
    try {
      await fetch(apiUrl('/api/v1/network/simulate'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` }
      });
      await loadData();
    } catch (e) {
      console.error('Simulation error:', e);
    } finally {
      setSimulating(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (filterType === '5xx') return r.status_code >= 500;
    if (filterType === '4xx') return r.status_code >= 400 && r.status_code < 500;
    if (filterType === 'slow') return r.duration_ms >= 1000;
    return true;
  });

  const getStatusBadge = (code: number) => {
    if (code >= 500) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">{code} Server Err</span>;
    }
    if (code >= 400) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">{code} Client Err</span>;
    }
    if (code === 0) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-zinc-200 text-zinc-700">Network Cut</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">{code} OK</span>;
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row text-slate-900 font-sans antialiased">
      <Sidebar />

      <main className="flex-1 w-full p-4 lg:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                <WifiOff className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Browser Network XHR & Fetch Inspector</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Zero-Config Auto Intercept
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Real-time privacy-safe monitoring of failing (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">4xx/5xx</code>) or slow (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">&gt;=1000ms</code>) API requests with 1-click session replay linkage.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-60"
            >
              {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Simulate Network Failures
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 my-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Total Intercepted</span>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{kpis.total.toLocaleString()}</div>
            <div className="text-xs text-slate-400 mt-1">Logged requests</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-rose-600">
              <span>5xx Server Errors</span>
              <ServerCrash className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-700 mt-2">{kpis.errors_5xx}</div>
            <div className="text-xs text-rose-500 mt-1">Requires backend fix</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-amber-600">
              <span>4xx Client Errors</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-2">{kpis.errors_4xx}</div>
            <div className="text-xs text-amber-500 mt-1">Auth, 404, rate limits</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-purple-200/80 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-purple-600">
              <span>Slow Calls (&gt;=1s)</span>
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-700 mt-2">{kpis.slow_requests}</div>
            <div className="text-xs text-purple-500 mt-1">Impacting user UX</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>p95 API Latency</span>
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-indigo-700 mt-2">{kpis.p95_latency_ms} ms</div>
            <div className="text-xs text-slate-400 mt-1">95th percentile response</div>
          </div>
        </div>

        {/* Endpoint Failure Aggregation Matrix */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Top Failing API Endpoints</h2>
              <p className="text-xs text-slate-500 mt-0.5">Aggregated breakdown of downstream HTTP failure rates and average latencies.</p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {endpoints.length} active routes tracked
            </span>
          </div>

          {endpoints.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No endpoint failure clusters detected yet. Requests with status &gt;= 400 or duration &gt;= 1000ms will be automatically indexed here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Endpoint</th>
                    <th className="px-4 py-3 text-right">Total Calls</th>
                    <th className="px-4 py-3 text-right">Failures</th>
                    <th className="px-4 py-3">Failure Rate</th>
                    <th className="px-4 py-3 text-right">Avg Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {endpoints.map((ep, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 max-w-xs truncate">
                        {ep.endpoint}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {ep.total_calls.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">
                        {ep.failure_count}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full ${ep.failure_rate > 50 ? 'bg-rose-500' : ep.failure_rate > 20 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${Math.min(100, ep.failure_rate)}%` }} 
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-700 w-10">
                            {ep.failure_rate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                        {ep.avg_latency_ms} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live Requests Stream */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">Intercepted API Requests</h2>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${filterType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All ({requests.length})
              </button>
              <button
                onClick={() => setFilterType('5xx')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${filterType === '5xx' ? 'bg-white text-rose-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                5xx Server
              </button>
              <button
                onClick={() => setFilterType('4xx')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${filterType === '4xx' ? 'bg-white text-amber-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                4xx Client
              </button>
              <button
                onClick={() => setFilterType('slow')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${filterType === 'slow' ? 'bg-white text-purple-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Slow (&gt;=1s)
              </button>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">Clean Network Pipeline</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                No intercepted API failures matching this filter. Click &quot;Simulate Network Failures&quot; above to populate synthetic test calls.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">API Endpoint</th>
                    <th className="px-4 py-3">Page Origin</th>
                    <th className="px-4 py-3 text-right">Latency</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {req.method}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(req.status_code)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-900 max-w-sm truncate" title={req.endpoint_url}>
                        {req.endpoint_url}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={req.page_url}>
                        {req.page_url}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold whitespace-nowrap text-slate-700">
                        <span className={req.duration_ms >= 1000 ? 'text-purple-600' : ''}>
                          {req.duration_ms} ms
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => router.push(`/analytics/sessions?session=${encodeURIComponent(req.session_id)}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                          title="Watch Session Replay around this request"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Replay
                          <ArrowUpRight className="w-3 h-3 opacity-60" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
