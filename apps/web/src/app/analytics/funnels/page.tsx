"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  ArrowRight, 
  GitMerge, 
  Loader2, 
  Sparkles, 
  TrendingDown, 
  Users, 
  CheckCircle2, 
  Video, 
  ArrowDownRight,
  Globe2,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

interface FunnelStep {
  step: number;
  url: string;
  visitors: number;
  conversion_pct: number;
  drop_off_pct: number;
}

interface FunnelAnalytics {
  funnel_id: number;
  name: string;
  overall_conversion_pct: number;
  steps: FunnelStep[];
}

export default function FunnelsPage() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFunnelId, setActiveFunnelId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<FunnelAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [stepsInput, setStepsInput] = useState('https://growinsight.co.in/, /about-us/, /contact/');
  const [creating, setCreating] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);

  const fetchFunnels = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      const projRes = await fetch(apiUrl('/api/projects'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const projects = await projRes.json();
      if (Array.isArray(projects) && projects.length > 0) {
        setProjectId(projects[0].id);
      }

      const res = await fetch(apiUrl('/api/v1/funnels'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setFunnels(data);
        if (data.length > 0 && !activeFunnelId) {
          setActiveFunnelId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFunnelAnalytics = async (id: number) => {
    setLoadingAnalytics(true);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/funnels/${id}/analytics`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchFunnels();
  }, []);

  useEffect(() => {
    if (activeFunnelId) {
      fetchFunnelAnalytics(activeFunnelId);
    }
  }, [activeFunnelId]);

  const handleCreateFunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !projectId) return;
    setCreating(true);
    const token = localStorage.getItem('te_token');
    const stepsArr = stepsInput.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const res = await fetch(apiUrl('/api/v1/funnels'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, project_id: projectId, steps: stepsArr })
      });
      if (res.ok) {
        setName('');
        const data = await res.json();
        await fetchFunnels();
        setActiveFunnelId(data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const createPresetFunnel = () => {
    setName('GrowInsight High-Intent Lead Flow');
    setStepsInput('https://growinsight.co.in/, /about-us/, /contact/');
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-8 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 pb-16">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                Conversion Tracking
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Conversion Funnel Analytics
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Track multi-step visitor journeys and discover exact drop-off bottlenecks between pages.
              </p>
            </div>
            {activeFunnelId && (
              <button
                onClick={() => fetchFunnelAnalytics(activeFunnelId)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>

          {/* Funnel Selection Tabs */}
          {funnels.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {funnels.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFunnelId(f.id)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                    activeFunnelId === f.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* Visual Funnel Visualization Card */}
          {loadingAnalytics ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center gap-3 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-bold text-slate-800">Calculating funnel conversion stages...</p>
            </div>
          ) : analytics ? (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 lg:p-8 shadow-sm flex flex-col gap-8">
              
              {/* Funnel Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">{analytics.name}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">End-to-end journey from landing page to conversion goal</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Conversion</div>
                    <div className="text-2xl font-black text-emerald-600">
                      {analytics.overall_conversion_pct}%
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Horizontal Connected Step Flow */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                {analytics.steps.map((step, idx) => (
                  <div key={idx} className="relative flex flex-col">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between h-full hover:border-blue-300 transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                            {step.step}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                            {idx === 0 ? 'Entry Stage' : `${step.conversion_pct}% Kept`}
                          </span>
                        </div>
                        <h3 className="text-xs font-mono font-bold text-slate-900 truncate" title={step.url}>
                          {step.url}
                        </h3>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-200/60">
                        <div className="text-2xl font-black text-slate-900">
                          {step.visitors}
                          <span className="text-xs font-normal text-slate-400 ml-1.5">visitors</span>
                        </div>

                        {idx > 0 && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-2">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            {step.drop_off_pct}% Drop-off
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Banner: Watch Sessions of Dropped Visitors */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Inspect User Friction Points</h4>
                    <p className="text-xs text-slate-500">Watch full unmasked session replays to see why visitors dropped off before reaching checkout.</p>
                  </div>
                </div>
                <Link
                  href="/analytics/sessions"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
                >
                  Watch Session Replays
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              <GitMerge className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No funnels created yet</p>
              <p className="text-xs text-slate-400 mt-1">Use the builder below to configure your first visitor funnel.</p>
            </div>
          )}

          {/* Create New Funnel Builder */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Create Custom Funnel</h3>
                <p className="text-xs text-slate-400 mt-0.5">Specify pages in sequential comma-separated order</p>
              </div>
              <button
                type="button"
                onClick={createPresetFunnel}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Load GrowInsight Preset
              </button>
            </div>

            <form onSubmit={handleCreateFunnel} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Funnel Name</label>
                <input
                  type="text"
                  placeholder="e.g. Service Booking Flow"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Steps (Comma separated URLs)</label>
                <input
                  type="text"
                  placeholder="https://growinsight.co.in/, /about-us/, /contact/"
                  value={stepsInput}
                  onChange={(e) => setStepsInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? 'Saving Funnel...' : 'Create Funnel'}
              </button>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}