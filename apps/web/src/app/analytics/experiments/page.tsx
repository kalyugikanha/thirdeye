"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Loader2, Plus, Sparkles, Trash2, Pause, Play, Trophy, X } from 'lucide-react';

interface VariantStats {
  exposures: number;
  conversions: number;
  conversion_rate: number;
}

interface ExperimentItem {
  id: number;
  key: string;
  name: string;
  status: 'running' | 'paused';
  target_url: string;
  selector: string | null;
  control_text: string;
  variant_text: string;
  goal_target: string;
  traffic_split: number;
  control: VariantStats;
  variant: VariantStats;
  lift_pct: number;
  winner: 'A' | 'B' | 'tie';
}

export default function ExperimentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ExperimentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulatingId, setSimulatingId] = useState<number | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    key: '',
    name: '',
    target_url: '/pricing',
    selector: '#cta-btn',
    control_text: 'Start Free Trial',
    variant_text: 'Get Instant Access →',
    goal_target: '/thank-you',
    traffic_split: '50',
  });

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
      const res = await fetch(apiUrl(`/api/v1/experiments${pidQuery}`), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setItems(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const createExp = async () => {
    setFormError('');
    if (!form.key.trim() || !form.name.trim()) {
      setFormError('Experiment key and name are required.');
      return;
    }
    setSaving(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const res = await fetch(apiUrl('/api/v1/experiments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          key: form.key,
          name: form.name,
          target_url: form.target_url,
          selector: form.selector,
          control_text: form.control_text,
          variant_text: form.variant_text,
          goal_target: form.goal_target,
          traffic_split: parseInt(form.traffic_split || '50', 10),
          project_id: activePid ? Number(activePid) : undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.detail || 'Could not create experiment');
      }
      setShowModal(false);
      setForm({ ...form, key: '', name: '' });
      await load();
    } catch (e: any) {
      setFormError(e?.message || 'Could not create experiment');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (exp: ExperimentItem) => {
    const next = exp.status === 'running' ? 'paused' : 'running';
    await fetch(apiUrl(`/api/v1/experiments/${exp.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ status: next }),
    });
    await load();
  };

  const removeExp = async (id: number) => {
    if (!confirm('Delete this experiment?')) return;
    await fetch(apiUrl(`/api/v1/experiments/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    });
    await load();
  };

  const simulateTraffic = async (id: number) => {
    setSimulatingId(id);
    try {
      await fetch(apiUrl(`/api/v1/experiments/${id}/simulate`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      await load();
    } finally {
      setSimulatingId(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                Split Testing & Feature Flags
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
                A/B Experiments Engine
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Run deterministic 50/50 split tests or feature flags via <code className="font-mono">ThirdEye.getVariant(key)</code> and measure conversion lift.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> New Experiment
            </button>
          </div>

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
              Loading experiments...
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-xs text-rose-700">{error}</div>
          ) : items.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No experiments created yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Create an A/B test or feature flag to compare Control (A) against Variant (B).
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {items.map((exp) => (
                <div key={exp.id} className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-extrabold text-slate-900">{exp.name}</h2>
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">{exp.key}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          exp.status === 'running' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {exp.status}
                        </span>
                        {exp.lift_pct !== 0 && (
                          <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            exp.lift_pct > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {exp.lift_pct > 0 ? `+${exp.lift_pct}% Lift` : `${exp.lift_pct}%`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Target: <span className="font-mono">{exp.target_url}</span> · Goal: <span className="font-mono">{exp.goal_target}</span>
                        {exp.selector ? ` · Selector: ${exp.selector}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => simulateTraffic(exp.id)}
                        disabled={simulatingId === exp.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                      >
                        {simulatingId === exp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Simulate Split Traffic
                      </button>
                      <button
                        onClick={() => toggleStatus(exp)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                        title={exp.status === 'running' ? 'Pause' : 'Resume'}
                      >
                        {exp.status === 'running' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => removeExp(exp.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`p-4 rounded-2xl border ${exp.winner === 'A' ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50/70 border-slate-200/70'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-700">Control (A) — {exp.control_text}</span>
                        {exp.winner === 'A' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Trophy className="w-3 h-3" /> Leading
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900 mt-2">{exp.control.conversion_rate}%</p>
                      <p className="text-[11px] text-slate-500">
                        {exp.control.conversions} conversions / {exp.control.exposures} visitors
                      </p>
                    </div>

                    <div className={`p-4 rounded-2xl border ${exp.winner === 'B' ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50/70 border-slate-200/70'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-700">Variant (B) — {exp.variant_text}</span>
                        {exp.winner === 'B' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Trophy className="w-3 h-3" /> Winner
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900 mt-2">{exp.variant.conversion_rate}%</p>
                      <p className="text-[11px] text-slate-500">
                        {exp.variant.conversions} conversions / {exp.variant.exposures} visitors
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-3 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-extrabold text-slate-900">Create A/B Experiment</h3>

            <label className="block text-xs font-semibold text-slate-700">
              Experiment Key
              <input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                placeholder="pricing_cta_test"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Display Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Pricing Hero CTA Copy"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                CSS Selector (optional)
                <input
                  value={form.selector}
                  onChange={(e) => setForm({ ...form, selector: e.target.value })}
                  placeholder="#cta-btn"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Conversion Goal URL
                <input
                  value={form.goal_target}
                  onChange={(e) => setForm({ ...form, goal_target: e.target.value })}
                  placeholder="/thank-you"
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold text-slate-700">
                Control (A) Label
                <input
                  value={form.control_text}
                  onChange={(e) => setForm({ ...form, control_text: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                Variant (B) Copy
                <input
                  value={form.variant_text}
                  onChange={(e) => setForm({ ...form, variant_text: e.target.value })}
                  className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </label>
            </div>

            {formError && <p className="text-xs text-rose-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">
                Cancel
              </button>
              <button
                onClick={createExp}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Launch Experiment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
