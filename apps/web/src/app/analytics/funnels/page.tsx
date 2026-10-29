"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import {
  GitMerge,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Video,
  X,
  Smartphone,
  Laptop,
  Tablet,
  Clock,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  HelpCircle
} from 'lucide-react';

interface DroppedUser {
  session_id: string;
  duration: number;
  has_replay: boolean;
  device: string;
  os: string;
  browser: string;
  user_email?: string | null;
  user_name?: string | null;
  last_active?: string | null;
  friction_tags: string[];
}

interface FunnelStep {
  step: number;
  url: string;
  visitors: number;
  conversion_pct: number;
  drop_off_pct: number;
  drop_off_count: number;
  retention_from_start_pct: number;
  device_distribution?: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
  dropped_users?: DroppedUser[];
}

interface FunnelAnalytics {
  funnel_id: number;
  name: string;
  total_entrants: number;
  final_completions: number;
  overall_conversion_pct: number;
  steps: FunnelStep[];
}

interface FunnelMeta {
  id: number;
  project_id: number;
  name: string;
  steps: string[];
  created_at: string;
}

export default function FunnelsPage() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<FunnelMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFunnelId, setActiveFunnelId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<FunnelAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [projectId, setProjectId] = useState<number>(2);
  const [clientDomain, setClientDomain] = useState<string>('selfupcommunity.com');

  // Builder Modal / Card state
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderName, setBuilderName] = useState('');
  const [builderSteps, setBuilderSteps] = useState<string[]>([
    'https://selfupcommunity.com/',
    'https://selfupcommunity.com/courses',
    'https://selfupcommunity.com/cart',
    'https://selfupcommunity.com/student/checkout'
  ]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Drop-Off Inspector Modal State
  const [inspectorStepIndex, setInspectorStepIndex] = useState<number | null>(null);
  const [copiedSession, setCopiedSession] = useState<string | null>(null);

  // Load Funnels List
  const fetchFunnels = useCallback(async () => {
    try {
      setLoading(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      if (!token) {
        router.push('/login');
        return;
      }
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };

      // Get project info
      try {
        const pRes = await fetch(apiUrl('/api/projects'), { headers });
        if (pRes.ok) {
          const projs = await pRes.json();
          if (Array.isArray(projs) && projs.length > 0) {
            setProjectId(projs[0].id);
            if (projs[0].domain) setClientDomain(projs[0].domain);
          }
        }
      } catch (e) {}

      // Get Funnels
      const res = await fetch(apiUrl('/api/v1/funnels'), { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setFunnels(data);
          if (data.length > 0 && !activeFunnelId) {
            setActiveFunnelId(data[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching funnels:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFunnelId, router]);

  // Load Funnel Analytics
  const fetchFunnelAnalytics = useCallback(async (funnelId: number) => {
    try {
      setLoadingAnalytics(true);
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(apiUrl(`/api/v1/funnels/${funnelId}/analytics`), { headers });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Error fetching funnel analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    fetchFunnels();
  }, [fetchFunnels]);

  useEffect(() => {
    if (activeFunnelId) {
      fetchFunnelAnalytics(activeFunnelId);
    }
  }, [activeFunnelId, fetchFunnelAnalytics]);

  // Create Funnel
  const handleCreateFunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('te_token');
    const validSteps = builderSteps.map(s => s.trim()).filter(Boolean);
    if (!builderName.trim() || validSteps.length === 0) return;

    try {
      setCreating(true);
      const res = await fetch(apiUrl('/api/v1/funnels'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: projectId,
          name: builderName.trim(),
          steps: validSteps
        })
      });
      if (res.ok) {
        const created = await res.json();
        setShowBuilder(false);
        setBuilderName('');
        await fetchFunnels();
        setActiveFunnelId(created.id);
      }
    } catch (err) {
      console.error('Error creating funnel:', err);
    } finally {
      setCreating(false);
    }
  };

  // Delete Funnel
  const handleDeleteFunnel = async (funnelId: number) => {
    if (!confirm('Are you sure you want to delete this conversion funnel?')) return;
    try {
      setDeletingId(funnelId);
      const token = localStorage.getItem('te_token');
      const res = await fetch(apiUrl(`/api/v1/funnels/${funnelId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setAnalytics(null);
        setActiveFunnelId(null);
        await fetchFunnels();
      }
    } catch (err) {
      console.error('Error deleting funnel:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSession(text);
    setTimeout(() => setCopiedSession(null), 2000);
  };

  // Preset Loaders
  const loadPreset = (presetType: 'checkout' | 'discovery' | 'pricing') => {
    if (presetType === 'checkout') {
      setBuilderName('SelfUp Master Checkout Funnel');
      setBuilderSteps([
        `https://${clientDomain}/`,
        `https://${clientDomain}/courses`,
        `https://${clientDomain}/cart`,
        `https://${clientDomain}/student/checkout`
      ]);
    } else if (presetType === 'discovery') {
      setBuilderName('Course Catalog Discovery Flow');
      setBuilderSteps([
        `https://${clientDomain}/`,
        `https://${clientDomain}/courses`,
        `https://${clientDomain}/courses?category=business`
      ]);
    } else if (presetType === 'pricing') {
      setBuilderName('Membership & Pricing Conversion');
      setBuilderSteps([
        `https://${clientDomain}/`,
        `https://${clientDomain}/pricing`,
        `https://${clientDomain}/student/checkout`
      ]);
    }
  };

  // Step Array Helpers
  const addStep = () => {
    setBuilderSteps(prev => [...prev, `https://${clientDomain}/`]);
  };

  const removeStep = (index: number) => {
    setBuilderSteps(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateStepValue = (index: number, val: string) => {
    setBuilderSteps(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  // Identify biggest conversion bottleneck
  const biggestDropOff = (() => {
    if (!analytics || !analytics.steps || analytics.steps.length < 2) return null;
    let worst = analytics.steps[1];
    for (let i = 2; i < analytics.steps.length; i++) {
      if (analytics.steps[i].drop_off_pct > worst.drop_off_pct) {
        worst = analytics.steps[i];
      }
    }
    const prev = analytics.steps[worst.step - 2];
    return {
      fromStep: prev,
      toStep: worst,
      dropOffPct: worst.drop_off_pct,
      dropOffCount: worst.drop_off_count
    };
  })();

  const activeInspectorStep = inspectorStepIndex !== null && analytics?.steps ? analytics.steps[inspectorStepIndex] : null;
  const inspectorPrevStep = inspectorStepIndex !== null && inspectorStepIndex > 0 && analytics?.steps ? analytics.steps[inspectorStepIndex - 1] : null;

  return (
    <div className="flex min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-rose-500/30">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-6 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-20">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cohort Journey Engine</span>
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Domain: {clientDomain}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Conversion Funnels & Drop-off Visualizer
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Track sequential user progression through your critical business pathways and inspect 1-click video replays of dropped visitors.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBuilder(!showBuilder)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-lg shadow-rose-500/20 transition-all hover:scale-105 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Funnel</span>
              </button>

              {activeFunnelId && (
                <button
                  onClick={() => fetchFunnelAnalytics(activeFunnelId)}
                  disabled={loadingAnalytics}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  title="Recalculate cohort analytics"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loadingAnalytics ? 'animate-spin text-rose-400' : ''}`} />
                  <span>Refresh</span>
                </button>
              )}
            </div>
          </div>

          {/* Funnel Tabs Navigation */}
          {funnels.length > 0 && (
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 border-b border-slate-800/40">
              <div className="flex items-center gap-2">
                {funnels.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFunnelId(f.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                      activeFunnelId === f.id
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                        : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>{f.name}</span>
                    <span className="text-[10px] font-mono opacity-80">({f.steps?.length || 0} steps)</span>
                  </button>
                ))}
              </div>

              {activeFunnelId && (
                <button
                  onClick={() => handleDeleteFunnel(activeFunnelId)}
                  disabled={deletingId === activeFunnelId}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Delete this funnel"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Funnel</span>
                </button>
              )}
            </div>
          )}

          {/* Interactive Step Builder Card (Collapsible) */}
          {showBuilder && (
            <div className="bg-[#0d131f] border border-slate-800 rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center font-bold">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Create Custom Conversion Funnel</h3>
                    <p className="text-xs text-slate-400">Configure sequential touchpoints to discover where users abandon</p>
                  </div>
                </div>

                {/* 1-Click Preset Buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">1-Click Presets:</span>
                  <button
                    type="button"
                    onClick={() => loadPreset('checkout')}
                    className="text-[11px] font-bold text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-rose-400" />
                    <span>Checkout Funnel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('discovery')}
                    className="text-[11px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Courses Discovery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('pricing')}
                    className="text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    <span>Pricing Funnel</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateFunnel} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Funnel Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SelfUp Master Checkout Flow"
                    value={builderName}
                    onChange={(e) => setBuilderName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Sequential Journey Steps (Order of Visits)
                  </label>
                  <div className="space-y-2">
                    {builderSteps.map((stepUrl, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono font-bold flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={stepUrl}
                          onChange={(e) => updateStepValue(idx, e.target.value)}
                          placeholder={`https://${clientDomain}/step-${idx + 1}`}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-rose-500 transition-colors"
                          required
                        />
                        {builderSteps.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeStep(idx)}
                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                            title="Remove Step"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addStep}
                    className="mt-3 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-rose-400" />
                    <span>Add Another Step</span>
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setShowBuilder(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{creating ? 'Calculating Funnel...' : 'Save & Launch Funnel'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Analytics View */}
          {loadingAnalytics ? (
            <div className="bg-[#0d131f] border border-slate-800 rounded-3xl p-16 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              <p className="text-sm font-bold text-white">Computing sequential cohort progression & drop-offs...</p>
              <span className="text-xs text-slate-500">Cross-referencing 164,000+ telemetry events</span>
            </div>
          ) : analytics ? (
            <div className="space-y-6">

              {/* 1. Executive Funnel Scorecard */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-[#0d131f] border border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Funnel Entrants</span>
                  <div className="text-3xl font-black text-white mt-1">
                    {analytics.total_entrants.toLocaleString()}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Visitors who initiated Step 1</span>
                </div>

                <div className="p-5 rounded-2xl bg-[#0d131f] border border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Final Completions</span>
                  <div className="text-3xl font-black text-emerald-400 mt-1">
                    {analytics.final_completions.toLocaleString()}
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Visitors who reached final goal</span>
                </div>

                <div className="p-5 rounded-2xl bg-[#0d131f] border border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall Conversion Rate</span>
                  <div className="text-3xl font-black text-rose-400 mt-1">
                    {analytics.overall_conversion_pct}%
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">End-to-end completion ratio</span>
                </div>

                <div className="p-5 rounded-2xl bg-[#0d131f] border border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Funnel Steps</span>
                  <div className="text-3xl font-black text-amber-400 mt-1">
                    {analytics.steps.length} Stages
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">Sequential cohort checkpoints</span>
                </div>
              </div>

              {/* 2. Critical Friction & Leak Alert Banner */}
              {biggestDropOff && biggestDropOff.dropOffPct > 40 && (
                <div className="bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-800/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center flex-shrink-0">
                      <Flame className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wider">
                        Critical Conversion Leak Detected
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        <strong className="text-rose-400">{biggestDropOff.dropOffPct}% drop-off</strong> between Step {biggestDropOff.fromStep.step} and Step {biggestDropOff.toStep.step} — lost <strong className="text-white">{biggestDropOff.dropOffCount.toLocaleString()} visitors</strong> before reaching the next stage.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setInspectorStepIndex(biggestDropOff.toStep.step - 1)}
                    className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto cursor-pointer"
                  >
                    <span>Inspect {biggestDropOff.dropOffCount.toLocaleString()} Dropped Replays</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 3. Horizontal Connected Funnel Steps Pipeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Funnel Progression & Drop-Off Leak Map
                  </h3>
                  <span className="text-xs text-slate-500">
                    Cohort progression strictly requires completion of previous stages
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  {analytics.steps.map((step, idx) => {
                    const isFirst = idx === 0;
                    return (
                      <div key={idx} className="flex flex-col gap-3">
                        {/* Step Card */}
                        <div className="p-5 rounded-2xl bg-[#0d131f] border border-slate-800 flex flex-col justify-between h-full hover:border-slate-700 transition-all relative overflow-hidden group">
                          
                          {/* Top row */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white font-mono text-xs font-bold flex items-center justify-center shadow-sm">
                                {step.step}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isFirst
                                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                              }`}>
                                {isFirst ? 'Entry Stage' : `${step.conversion_pct}% Kept`}
                              </span>
                            </div>

                            <div className="font-mono text-xs text-slate-300 font-bold truncate mb-1" title={step.url}>
                              {step.url}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {step.retention_from_start_pct}% of total traffic
                            </span>
                          </div>

                          {/* Bottom row */}
                          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-baseline justify-between">
                            <div>
                              <div className="text-2xl font-black text-white">
                                {step.visitors.toLocaleString()}
                              </div>
                              <span className="text-[11px] text-slate-400">active sessions</span>
                            </div>

                            <Link
                              href={`/analytics/sessions?url=${encodeURIComponent(step.url)}`}
                              className="text-[11px] font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1"
                              title="View all session replays on this page"
                            >
                              <Video className="w-3 h-3 text-rose-400" />
                              <span>Replays</span>
                            </Link>
                          </div>
                        </div>

                        {/* Transition Connector (for non-first steps) */}
                        {!isFirst && (
                          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                              <span className="font-bold text-rose-400">
                                {step.drop_off_pct}% Drop-off
                              </span>
                              <span className="text-slate-500">
                                ({step.drop_off_count.toLocaleString()} lost)
                              </span>
                            </div>

                            <button
                              onClick={() => setInspectorStepIndex(idx)}
                              className="text-[11px] font-bold text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 px-2 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                              title="Inspect exact visitors who dropped off at this stage"
                            >
                              <span>Inspect Dropped</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-[#0d131f] border border-slate-800 rounded-3xl p-16 text-center text-slate-400 flex flex-col items-center">
              <GitMerge className="w-10 h-10 text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-white">No Funnels Created Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Configure a multi-step user journey or use our 1-click presets for {clientDomain}.
              </p>
              <button
                onClick={() => setShowBuilder(true)}
                className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-md transition-all cursor-pointer"
              >
                Create Your First Funnel
              </button>
            </div>
          )}

          {/* ===================== DROP-OFF REPLAY INSPECTOR MODAL ===================== */}
          {inspectorStepIndex !== null && activeInspectorStep && (
            <div
              className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
              onClick={(e) => {
                if (e.target === e.currentTarget) setInspectorStepIndex(null);
              }}
            >
              <div className="bg-[#0b101b] border border-slate-800 rounded-3xl p-6 w-full max-w-4xl shadow-2xl relative flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>Drop-Off Leak Inspector</span>
                        <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          {activeInspectorStep.drop_off_count.toLocaleString()} visitors abandoned
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Step {inspectorPrevStep?.step} ({inspectorPrevStep?.url}) &rarr; Step {activeInspectorStep.step} ({activeInspectorStep.url})
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setInspectorStepIndex(null)}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Device Breakdown Ribbon */}
                {activeInspectorStep.device_distribution && (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span>Mobile Android/iOS</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-white">
                        {activeInspectorStep.device_distribution.mobile}%
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Laptop className="w-4 h-4 text-blue-400" />
                        <span>Desktop Windows/Mac</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-white">
                        {activeInspectorStep.device_distribution.desktop}%
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Tablet className="w-4 h-4 text-purple-400" />
                        <span>Tablet / iPad</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-white">
                        {activeInspectorStep.device_distribution.tablet}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Dropped Visitors List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Sample Replays of Abandoned Visitors ({activeInspectorStep.dropped_users?.length || 0})
                  </div>

                  {activeInspectorStep.dropped_users && activeInspectorStep.dropped_users.length > 0 ? (
                    activeInspectorStep.dropped_users.map((user) => (
                      <div
                        key={user.session_id}
                        className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-200">
                              {user.session_id}
                            </span>
                            <button
                              onClick={() => copyToClipboard(user.session_id)}
                              className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                              title="Copy Session ID"
                            >
                              {copiedSession === user.session_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              {user.browser} on {user.os} ({user.device})
                            </span>
                            {user.duration > 0 && (
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">
                                {Math.floor(user.duration / 60)}m {user.duration % 60}s
                              </span>
                            )}
                          </div>

                          {user.friction_tags && user.friction_tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {user.friction_tags.map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                                >
                                  <Flame className="w-2.5 h-2.5 text-rose-400" />
                                  <span>{tag}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 1-Click Replay Button */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {user.has_replay ? (
                            <Link
                              href={`/analytics/sessions?session_id=${user.session_id}`}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                              target="_blank"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Watch Replay</span>
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </Link>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">
                              Replay Pruned
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      No dropped sessions available for this transition.
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
