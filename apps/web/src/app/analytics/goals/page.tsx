"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Target, Loader2, Plus, Trash2, Play, X, DollarSign, Percent, CheckCircle2 } from 'lucide-react';

interface Goal {
  id: number;
  name: string;
  type: 'url' | 'click' | 'custom';
  target: string;
  revenue_usd: number;
  completions: number;
  conversion_rate: number;
  revenue: number;
  replay_session_ids: string[];
}

interface GoalsData {
  kpis: { total_sessions: number; total_completions: number; conversion_rate: number; total_revenue: number };
  goals: Goal[];
}

const TYPE_LABEL: Record<string, string> = { url: 'URL Destination', click: 'Click Action', custom: 'Custom Event' };
const TYPE_HINT: Record<string, string> = {
  url: '/thank-you (use * as wildcard, e.g. /order/*)',
  click: '#checkout-btn or .cta-button',
  custom: 'purchase (event name sent via ThirdEye.track)',
};

export default function GoalsPage() {
  const router = useRouter();
  const [data, setData] = useState<GoalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'url', target: '', revenue_usd: '0' });

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
      const res = await fetch(apiUrl('/api/v1/goals'), { headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const createGoal = async () => {
    setFormError('');
    if (!form.name.trim() || !form.target.trim()) {
      setFormError('Name and target are required.');
      return;
    }
    const revenue = parseInt(form.revenue_usd || '0', 10);
    if (Number.isNaN(revenue) || revenue < 0) {
      setFormError('Revenue must be a non-negative number.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/v1/goals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name: form.name, type: form.type, target: form.target, revenue_usd: revenue }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not create goal');
      }
      setShowModal(false);
      setForm({ name: '', type: 'url', target: '', revenue_usd: '0' });
      await load();
    } catch (e: any) {
      setFormError(e?.message || 'Could not create goal');
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async (id: number) => {
    if (!confirm('Delete this goal?')) return;
    await fetch(apiUrl(`/api/v1/goals/${id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    await load();
  };

  const k = data?.kpis;

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Revenue Attribution
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">Conversion Goals</h1>
              <p className="text-xs text-slate-500 mt-1">
                Track destination pages, button clicks and custom events — with no extra code on your site.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> New Goal
            </button>
          </div>

          {loading && !data ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
              Loading goals...
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-xs text-rose-700">{error}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Goal completions
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">{k?.total_completions ?? 0}</p>
                </div>
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Percent className="w-3.5 h-3.5" /> Overall conversion
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">{k?.conversion_rate ?? 0}%</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{k?.total_sessions ?? 0} sessions (30 days)</p>
                </div>
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <DollarSign className="w-3.5 h-3.5" /> Attributed revenue
                  </p>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-1">${(k?.total_revenue ?? 0).toLocaleString()}</p>
                </div>
              </div>

              {!data || data.goals.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
                  <Target className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700">No goals defined</p>
                  <p className="text-xs text-slate-400 mt-1">Create your first goal to start measuring conversions and revenue.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200/70 rounded-3xl shadow-sm overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="px-6 py-3 font-bold">Goal</th>
                        <th className="px-4 py-3 font-bold">Type</th>
                        <th className="px-4 py-3 font-bold">Completions</th>
                        <th className="px-4 py-3 font-bold w-48">Conversion</th>
                        <th className="px-4 py-3 font-bold">Revenue</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.goals.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50/60">
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-900">{g.name}</p>
                            <p className="font-mono text-[11px] text-slate-400 mt-0.5">{g.target}</p>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{TYPE_LABEL[g.type] || g.type}</td>
                          <td className="px-4 py-4 font-bold text-slate-900">{g.completions}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, g.conversion_rate)}%` }} />
                              </div>
                              <span className="font-bold text-slate-700 w-12 text-right">{g.conversion_rate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-bold text-emerald-600">${g.revenue.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {g.replay_session_ids[0] && (
                                <Link
                                  href={`/analytics/sessions?session=${encodeURIComponent(g.replay_session_ids[0])}`}
                                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 px-2.5 py-1 rounded-lg"
                                >
                                  <Play className="w-3 h-3" /> Watch Replays
                                </Link>
                              )}
                              <button
                                onClick={() => deleteGoal(g.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                title="Delete goal"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-extrabold text-slate-900">New conversion goal</h3>

            <label className="block text-xs font-semibold text-slate-700">
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Completed signup"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Goal type
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal bg-white"
              >
                <option value="url">URL Destination</option>
                <option value="click">Click Action (CSS selector)</option>
                <option value="custom">Custom Event</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Target
              <input
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder={TYPE_HINT[form.type]}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal font-mono"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Revenue per conversion (USD)
              <input
                type="number"
                min={0}
                value={form.revenue_usd}
                onChange={(e) => setForm({ ...form, revenue_usd: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-normal"
              />
            </label>

            {formError && <p className="text-xs text-rose-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">
                Cancel
              </button>
              <button
                onClick={createGoal}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
