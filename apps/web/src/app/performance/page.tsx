"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Gauge, Loader2, Sparkles, RefreshCw, Monitor, Smartphone, Zap, Clock, Layers, Activity } from 'lucide-react';

interface MetricCardData {
  p75: number;
  unit: string;
  rating: 'good' | 'needs_improvement' | 'poor';
}

interface RumRoute {
  path: string;
  samples: number;
  lcp_p75: number;
  inp_p75: number;
  cls_p75: number;
  ttfb_p75: number;
  rating: string;
}

interface RumDevice {
  device: string;
  samples: number;
  percentage: number;
  lcp_p75: number;
  rating: string;
}

interface RumData {
  total_samples: number;
  res_score: number;
  status: string;
  metrics: {
    lcp: MetricCardData;
    inp: MetricCardData;
    cls: MetricCardData;
    ttfb: MetricCardData;
  };
  routes: RumRoute[];
  devices: RumDevice[];
}

const BADGE_STYLE: Record<string, string> = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  needs_improvement: 'bg-amber-50 text-amber-700 border-amber-200',
  poor: 'bg-rose-50 text-rose-700 border-rose-200',
};

const BADGE_LABEL: Record<string, string> = {
  good: 'Good',
  needs_improvement: 'Needs Improvement',
  poor: 'Poor',
};

export default function PerformancePage() {
  const router = useRouter();
  const [data, setData] = useState<RumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('te_token');

  const load = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const pidQuery = activePid ? `&project_id=${encodeURIComponent(activePid)}` : '';
      const res = await fetch(apiUrl(`/api/v1/rum/vitals?days=${days}${pidQuery}`), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Failed to load Core Web Vitals');
    } finally {
      setLoading(false);
    }
  }, [days, router]);

  useEffect(() => {
    load();
  }, [load]);

  const simulate = async () => {
    setSimulating(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const pidQuery = activePid ? `?project_id=${encodeURIComponent(activePid)}` : '';
      await fetch(apiUrl(`/api/v1/rum/simulate${pidQuery}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      await load();
    } finally {
      setSimulating(false);
    }
  };

  const m = data?.metrics;

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                Real User Monitoring (RUM)
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
                Core Web Vitals & Speed Insights
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Google p75 Core Web Vitals (LCP, INP, CLS, TTFB) captured directly from real visitor browsers via te.js.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button
                onClick={simulate}
                disabled={simulating}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm disabled:opacity-50"
              >
                {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-rose-400" />}
                Simulate RUM Vitals
              </button>
              <button
                onClick={load}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading && !data ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
              Loading Core Web Vitals telemetry...
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-xs text-rose-700">{error}</div>
          ) : !data || data.total_samples === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              <Gauge className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No Web Vitals samples yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Click &ldquo;Simulate RUM Vitals&rdquo; above or browse your connected website to stream real LCP, INP, and CLS metrics.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Real Experience Score</span>
                    <Gauge className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="my-2">
                    <span className="text-4xl font-extrabold">{data.res_score}</span>
                    <span className="text-sm text-slate-400 font-bold"> / 100</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{data.total_samples} browser samples</span>
                </div>

                {[
                  { key: 'lcp', title: 'LCP (Largest Paint)', hint: 'Target ≤ 2500ms', icon: Zap, val: m?.lcp },
                  { key: 'inp', title: 'INP (Interactivity)', hint: 'Target ≤ 200ms', icon: Activity, val: m?.inp },
                  { key: 'cls', title: 'CLS (Layout Shift)', hint: 'Target ≤ 0.10', icon: Layers, val: m?.cls },
                  { key: 'ttfb', title: 'TTFB (Server Byte)', hint: 'Target ≤ 800ms', icon: Clock, val: m?.ttfb },
                ].map((card) => {
                  const Icon = card.icon;
                  const rating = card.val?.rating || 'good';
                  return (
                    <div key={card.key} className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                          <Icon className="w-3.5 h-3.5" /> {card.title}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${BADGE_STYLE[rating]}`}>
                          {BADGE_LABEL[rating]}
                        </span>
                      </div>
                      <p className="text-3xl font-extrabold text-slate-900 my-2">
                        {card.val?.p75}
                        <span className="text-sm font-semibold text-slate-400 ml-1">{card.val?.unit}</span>
                      </p>
                      <span className="text-[11px] text-slate-400">{card.hint} (p75)</span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white border border-slate-200/70 rounded-3xl shadow-sm overflow-x-auto">
                  <div className="p-6 pb-3">
                    <h2 className="text-sm font-extrabold text-slate-900">Route Performance Breakdown (p75)</h2>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="px-6 py-3 font-bold">Route</th>
                        <th className="px-4 py-3 font-bold">Samples</th>
                        <th className="px-4 py-3 font-bold">LCP</th>
                        <th className="px-4 py-3 font-bold">INP</th>
                        <th className="px-4 py-3 font-bold">CLS</th>
                        <th className="px-4 py-3 font-bold">TTFB</th>
                        <th className="px-6 py-3 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.routes.map((r) => (
                        <tr key={r.path} className="hover:bg-slate-50/60">
                          <td className="px-6 py-3.5 font-mono font-bold text-slate-900">{r.path}</td>
                          <td className="px-4 py-3.5 text-slate-500">{r.samples}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">{r.lcp_p75} ms</td>
                          <td className="px-4 py-3.5 text-slate-700">{r.inp_p75} ms</td>
                          <td className="px-4 py-3.5 text-slate-700">{r.cls_p75}</td>
                          <td className="px-4 py-3.5 text-slate-700">{r.ttfb_p75} ms</td>
                          <td className="px-6 py-3.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${BADGE_STYLE[r.rating]}`}>
                              {BADGE_LABEL[r.rating]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm space-y-4">
                  <h2 className="text-sm font-extrabold text-slate-900">Device Segmentation</h2>
                  <div className="space-y-3">
                    {data.devices.map((d) => (
                      <div key={d.device} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            {d.device === 'Mobile' ? <Smartphone className="w-4 h-4 text-rose-500" /> : <Monitor className="w-4 h-4 text-indigo-500" />}
                            {d.device}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${BADGE_STYLE[d.rating]}`}>
                            LCP {d.lcp_p75} ms
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-900 rounded-full" style={{ width: `${d.percentage}%` }} />
                        </div>
                        <p className="text-[11px] text-slate-500">{d.samples} samples ({d.percentage}% of traffic)</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
