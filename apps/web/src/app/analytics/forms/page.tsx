"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, Loader2, Sparkles, Play, Clock, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react';

interface FormFieldStat {
  field: string;
  interactions: number;
  avg_duration_ms: number;
  drop_off_count: number;
  drop_off_pct: number;
}

interface FormItem {
  form_id: string;
  url: string;
  starts: number;
  submissions: number;
  completion_rate: number;
  abandonment_rate: number;
  abandoned_session_ids: string[];
  fields: FormFieldStat[];
}

interface FormsResponse {
  kpis: {
    total_starts: number;
    total_submissions: number;
    completion_rate: number;
    abandonment_rate: number;
  };
  forms: FormItem[];
}

export default function FormsAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<FormsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
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
      const pidQuery = activePid ? `?project_id=${encodeURIComponent(activePid)}` : '';
      const res = await fetch(apiUrl(`/api/v1/analytics/forms${pidQuery}`), {
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
      setError(e?.message || 'Failed to load form analytics');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const simulate = async () => {
    setSimulating(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const pidQuery = activePid ? `?project_id=${encodeURIComponent(activePid)}` : '';
      await fetch(apiUrl(`/api/v1/analytics/forms/simulate${pidQuery}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      await load();
    } finally {
      setSimulating(false);
    }
  };

  const k = data?.kpis;

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                Conversion Rate Optimization
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
                Form & Checkout Abandonment
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Pinpoint which input fields cause hesitation and abandonment — 100% privacy-safe (field values are never recorded).
              </p>
            </div>
            <button
              onClick={simulate}
              disabled={simulating}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm disabled:opacity-50"
            >
              {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-rose-400" />}
              Simulate Checkout Funnel
            </button>
          </div>

          {loading && !data ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
              Loading form field metrics...
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-xs text-rose-700">{error}</div>
          ) : !data || data.forms.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No form interactions recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Click &ldquo;Simulate Checkout Funnel&rdquo; above to preview field hesitation and drop-off analysis.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Form Starters</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">{k?.total_starts ?? 0}</p>
                </div>
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Completed Submissions</p>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-1">{k?.total_submissions ?? 0}</p>
                </div>
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Completion Rate
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">{k?.completion_rate ?? 0}%</p>
                </div>
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Abandonment Rate
                  </p>
                  <p className="text-3xl font-extrabold text-rose-600 mt-1">{k?.abandonment_rate ?? 0}%</p>
                </div>
              </div>

              {data.forms.map((form) => (
                <section key={form.form_id} className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 font-mono">#{form.form_id}</span>
                        <span className="text-xs text-slate-400 font-mono">{form.url}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {form.starts} started · {form.submissions} submitted ({form.completion_rate}% completion, {form.abandonment_rate}% abandoned)
                      </p>
                    </div>
                    {form.abandoned_session_ids[0] && (
                      <Link
                        href={`/analytics/sessions?session=${encodeURIComponent(form.abandoned_session_ids[0])}`}
                        className="flex items-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 px-3.5 py-2 rounded-xl self-start"
                      >
                        <Play className="w-3.5 h-3.5" /> Watch Abandoned Session
                      </Link>
                    )}
                  </div>

                  <div className="space-y-3">
                    {form.fields.map((f) => (
                      <div key={f.field} className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 font-mono">{f.field}</span>
                            <span className="text-[11px] text-slate-400">{f.interactions} sessions interacted</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden max-w-md">
                            <div
                              className={`h-full rounded-full ${f.drop_off_pct > 25 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.max(8, 100 - f.drop_off_pct)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1 text-slate-600 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> {(f.avg_duration_ms / 1000).toFixed(1)}s avg time
                          </span>
                          <span className={`flex items-center gap-1 font-bold px-2.5 py-1 rounded-lg border ${
                            f.drop_off_count > 0 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>
                            <TrendingDown className="w-3.5 h-3.5" /> {f.drop_off_count} drop-offs ({f.drop_off_pct}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
