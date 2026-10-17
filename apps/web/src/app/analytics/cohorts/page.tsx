"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users2, 
  TrendingUp, 
  Sparkles, 
  RefreshCw, 
  Loader2, 
  ArrowUpRight, 
  Calendar,
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

interface CohortRow {
  cohort: string;
  size: number;
  retention: number[];
}

interface CohortResponse {
  cohorts: CohortRow[];
  avg_retention: number[];
}

export default function RetentionCohortsPage() {
  const router = useRouter();
  const [data, setData] = useState<CohortResponse>({ cohorts: [], avg_retention: [] });
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const token = () => (typeof window !== 'undefined' ? localStorage.getItem('te_token') : null);

  const loadData = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/analytics/cohorts?weeks=5'), {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to load cohorts:', e);
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
      await fetch(apiUrl('/api/v1/analytics/cohorts/simulate'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` }
      });
      await loadData();
    } catch (e) {
      console.error('Cohort simulation error:', e);
    } finally {
      setSimulating(false);
    }
  };

  const getHeatmapColor = (pct: number) => {
    if (pct >= 80) return 'bg-indigo-600 text-white font-semibold';
    if (pct >= 60) return 'bg-indigo-500 text-white font-semibold';
    if (pct >= 40) return 'bg-indigo-400 text-white font-medium';
    if (pct >= 25) return 'bg-indigo-200 text-indigo-950 font-medium';
    if (pct >= 10) return 'bg-indigo-100 text-indigo-900';
    if (pct > 0) return 'bg-indigo-50 text-indigo-800';
    return 'bg-slate-50 text-slate-400';
  };

  const avgWeek1 = data.avg_retention?.[1] || 0;
  const avgWeek3 = data.avg_retention?.[3] || 0;
  const totalVisitorsTracked = data.cohorts.reduce((acc, c) => acc + c.size, 0);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row text-slate-900 font-sans antialiased">
      <Sidebar />

      <main className="flex-1 w-full p-4 lg:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Users2 className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Retention Cohort Matrix</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Multi-Period Heatmap
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Analyze product stickiness, activation cliffs, and weekly returning visitor retention across distinct user acquisition cohorts.
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
              Simulate Retention Cohorts
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Tracked Cohorts</span>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">{data.cohorts.length} Weeks</div>
            <div className="text-xs text-slate-400 mt-1">{totalVisitorsTracked} total unique visitors</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Avg Week 1 Retention</span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-indigo-600 mt-2">{avgWeek1}%</div>
            <div className="text-xs text-slate-400 mt-1">Post-onboarding activation</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Avg Week 3 Retention</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-2">{avgWeek3}%</div>
            <div className="text-xs text-slate-400 mt-1">Sustained habit retention</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Week 0 to 1 Drop</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2">{Math.max(0, 100 - avgWeek1).toFixed(1)}%</div>
            <div className="text-xs text-slate-400 mt-1">First-session dropoff</div>
          </div>
        </div>

        {/* Retention Heatmap Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Cohort Retention Matrix (% of Cohort Active)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Rows represent first-seen acquisition weeks; columns track returning active visitor rates over subsequent weeks.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200 inline-block" /> 10-25%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-indigo-400 inline-block" /> 40-60%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-indigo-600 inline-block" /> &gt;80%
              </span>
            </div>
          </div>

          {data.cohorts.length === 0 ? (
            <div className="p-12 text-center">
              <Users2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-900">No Cohort Telemetry Available</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Once visitors browse your site over consecutive weeks, their recurring retention rate will be computed automatically.
              </p>
              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                {simulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Sample Multi-Week Cohorts
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-center text-sm">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Cohort</th>
                    <th className="px-4 py-3 text-right">Size</th>
                    <th className="px-4 py-3">Week 0</th>
                    <th className="px-4 py-3">Week 1</th>
                    <th className="px-4 py-3">Week 2</th>
                    <th className="px-4 py-3">Week 3</th>
                    <th className="px-4 py-3">Week 4</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.cohorts.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 text-left font-medium text-slate-800 text-xs whitespace-nowrap">
                        {row.cohort}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                        {row.size.toLocaleString()}
                      </td>
                      {row.retention.map((pct, colIdx) => (
                        <td key={colIdx} className="p-2">
                          <div className={`py-2 px-3 rounded-lg text-xs transition duration-150 ${getHeatmapColor(pct)}`}>
                            {pct}%
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {/* Average Retention Footer */}
                {data.avg_retention.length > 0 && (
                  <tfoot className="bg-slate-100/80 font-semibold border-t-2 border-slate-200 text-slate-800">
                    <tr>
                      <td className="px-4 py-3 text-left text-xs uppercase font-bold tracking-wider text-slate-700">
                        Average Retention
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                        {totalVisitorsTracked}
                      </td>
                      {data.avg_retention.map((avgPct, i) => (
                        <td key={i} className="p-2">
                          <div className="py-2 px-3 rounded-lg text-xs font-bold bg-white text-indigo-700 border border-slate-200 shadow-2xs">
                            {avgPct}%
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Growth & Activation Diagnostic Card */}
        <div className="bg-linear-to-r from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
              <HelpCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">How to interpret your retention curve</h3>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                A steep drop between <strong>Week 0 and Week 1</strong> suggests an onboarding activation bottleneck. Examine user paths in <strong>User Journey Flows</strong> or identify abandonment in <strong>Conversion Goals</strong> to lift long-term stickiness.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/analytics/journeys"
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-2xs transition"
            >
              Journeys <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/analytics/goals"
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs transition"
            >
              Conversion Goals <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
