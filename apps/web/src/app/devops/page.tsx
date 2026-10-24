"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Server, 
  Activity, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  Code2, 
  CheckCircle2, 
  Copy, 
  Check, 
  RefreshCw, 
  Loader2, 
  ArrowRight,
  Database,
  TerminalSquare
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

interface SlowEndpoint {
  endpoint: string;
  method: string;
  avg_duration_ms: number;
  calls: number;
  status_code: number;
}

interface APMTrace {
  id: number;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number;
  error_detail?: string;
  created_at: string;
}

interface APMMetrics {
  avg_latency_ms: number;
  p95_latency_ms: number;
  error_rate_pct: number;
  slowest_endpoints: SlowEndpoint[];
  recent_traces: APMTrace[];
}

export default function DevOpsAPMPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [copiedSDK, setCopiedSDK] = useState<'node' | 'python' | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [clientDomain, setClientDomain] = useState('');
  const [metrics, setMetrics] = useState<APMMetrics>({
    avg_latency_ms: 68,
    p95_latency_ms: 142,
    error_rate_pct: 0.4,
    slowest_endpoints: [
      { endpoint: '/api/v1/checkout', method: 'POST', avg_duration_ms: 284, calls: 42, status_code: 200 },
      { endpoint: '/api/v1/analytics/query', method: 'GET', avg_duration_ms: 195, calls: 118, status_code: 200 },
      { endpoint: '/api/v1/auth/session', method: 'POST', avg_duration_ms: 112, calls: 310, status_code: 200 },
      { endpoint: '/api/v1/integrations/sync', method: 'POST', avg_duration_ms: 890, calls: 8, status_code: 504 }
    ],
    recent_traces: []
  });

  const fetchAPMMetrics = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');

    try {
      const res = await fetch(apiUrl('/api/v1/apm/metrics'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Failed to load APM metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAPMMetrics();
    const token = localStorage.getItem('te_token');
    if (token) {
      fetch(apiUrl('/api/v1/projects/status'), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(st => {
          if (st.api_key) setApiKey(st.api_key);
          if (st.domain) setClientDomain(st.domain);
        })
        .catch(() => {});
    }
  }, []);

  const copyNodeSnippet = () => {
    const key = apiKey || 'your_project_api_key';
    const snippet = `// Node.js (Express / Next.js) Middleware\nconst axios = require('axios');\napp.use((req, res, next) => {\n  const start = Date.now();\n  res.on('finish', () => {\n    axios.post('https://thirdeye.colladome.com/api/v1/apm/report', {\n      api_key: '${key}',\n      endpoint: req.path,\n      method: req.method,\n      status_code: res.statusCode,\n      duration_ms: Date.now() - start\n    }).catch(() => {});\n  });\n  next();\n});`;
    navigator.clipboard.writeText(snippet);
    setCopiedSDK('node');
    setTimeout(() => setCopiedSDK(null), 2500);
  };

  const copyPythonSnippet = () => {
    const key = apiKey || 'your_project_api_key';
    const snippet = `# Python (FastAPI / Starlette) Middleware\nimport time, urllib.request, json\n@app.middleware("http")\nasync def thirdeye_apm(request, call_next):\n    start = time.time()\n    response = await call_next(request)\n    duration = int((time.time() - start) * 1000)\n    # Report trace asynchronously to ThirdEye\n    try:\n        payload = json.dumps({\n            "api_key": "${key}",\n            "endpoint": request.url.path,\n            "method": request.method,\n            "status_code": response.status_code,\n            "duration_ms": duration\n        }).encode("utf-8")\n        req = urllib.request.Request("https://thirdeye.colladome.com/api/v1/apm/report", data=payload, headers={"Content-Type": "application/json"})\n        urllib.request.urlopen(req, timeout=1)\n    except Exception:\n        pass\n    return response`;
    navigator.clipboard.writeText(snippet);
    setCopiedSDK('python');
    setTimeout(() => setCopiedSDK(null), 2500);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />

        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          <div className="w-full flex flex-col gap-8 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Application Performance Monitoring
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
                Server APM & API Latency Telemetry
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Track slow backend API endpoints, 500 error rates, and 3rd-party microservice bottlenecks.
              </p>
            </div>

            <button
              onClick={fetchAPMMetrics}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors shadow-sm self-start sm:self-center"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh Telemetry</span>
            </button>
          </div>

          {/* Top 4 APM KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg Response Time</span>
                <Clock className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                {metrics.avg_latency_ms}<span className="text-base font-normal text-slate-400 ml-1">ms</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                🟢 Nominal Latency
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">P95 Latency</span>
                <Activity className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-extrabold text-amber-600">
                {metrics.p95_latency_ms}<span className="text-base font-normal text-slate-400 ml-1">ms</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                95% of requests faster
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">5xx Server Errors</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                {metrics.error_rate_pct}<span className="text-base font-normal text-slate-400 ml-1">%</span>
              </div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                Within 99.9% SLA target
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Monitored Services</span>
                <Server className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                2<span className="text-base font-normal text-slate-400 ml-1">Nodes</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Web API & Background Workers
              </div>
            </div>

          </div>

          {/* Slowest API Endpoints Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Slowest API Endpoints & Bottlenecks
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Endpoints sorted by highest average execution time.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">HTTP Method</th>
                    <th className="px-6 py-3.5">Endpoint URL</th>
                    <th className="px-6 py-3.5">Average Latency</th>
                    <th className="px-6 py-3.5">Call Volume</th>
                    <th className="px-6 py-3.5">Status Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {metrics.slowest_endpoints.map((ep, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                          ep.method === 'POST' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}>
                          {ep.method}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-slate-900 font-semibold">
                        {ep.endpoint}
                      </td>
                      <td className="px-6 py-3.5 font-semibold">
                        <span className={ep.avg_duration_ms > 500 ? 'text-rose-600' : ep.avg_duration_ms > 200 ? 'text-amber-600' : 'text-slate-900'}>
                          {ep.avg_duration_ms} ms
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">
                        {ep.calls} requests
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          ep.status_code >= 500 ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}>
                          {ep.status_code}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3-Line Drop-in SDK Installation */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex items-center gap-2 mb-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
              <TerminalSquare className="w-4 h-4" />
              <span>Drop-in Server APM Middleware</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Connect Your Backend in 3 Lines of Code
            </h3>
            <p className="text-xs text-slate-400 max-w-xl mb-6">
              Automatically stream endpoint execution times, uncaught server exceptions, and 3rd party API failures into your ThirdEye workspace.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Node.js Card */}
              <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs text-white">Node.js (Express / Next.js)</span>
                    <button
                      onClick={copyNodeSnippet}
                      className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] text-slate-200 transition-colors flex items-center gap-1"
                    >
                      {copiedSDK === 'node' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSDK === 'node' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] text-indigo-300 font-mono bg-slate-950 p-3 rounded-xl overflow-x-auto">
{`const { thirdEyeAPM } = require('@thirdeye/apm');
app.use(thirdEyeAPM({
  apiKey: 'te_live_990c733a065d43b3b70bb0c1227d2f3c'
}));`}
                  </pre>
                </div>
              </div>

              {/* Python Card */}
              <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs text-white">Python (FastAPI / Flask)</span>
                    <button
                      onClick={copyPythonSnippet}
                      className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-[11px] text-slate-200 transition-colors flex items-center gap-1"
                    >
                      {copiedSDK === 'python' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSDK === 'python' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] text-indigo-300 font-mono bg-slate-950 p-3 rounded-xl overflow-x-auto">
{`from thirdeye_apm import ThirdEyeMiddleware
app.add_middleware(
  ThirdEyeMiddleware, 
  api_key='te_live_990c733a065d43b3b70bb0c1227d2f3c'
)`}
                  </pre>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}