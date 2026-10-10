"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowRight, GitMerge, Loader2, Sparkles, TrendingDown, Users } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

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
  const [funnels, setFunnels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFunnelId, setActiveFunnelId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<FunnelAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [stepsInput, setStepsInput] = useState('/, /pricing, /register');
  const [creating, setCreating] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const router = useRouter();

  const fetchFunnels = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      const projRes = await fetch('http://localhost:8000/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const projects = await projRes.json();
      if (projects.length > 0) setProjectId(projects[0].id);

      const res = await fetch('http://localhost:8000/api/v1/funnels', {
        headers: { 'Authorization': `Bearer ${token}` }
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
      const res = await fetch(`http://localhost:8000/api/v1/funnels/${id}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
      const res = await fetch('http://localhost:8000/api/v1/funnels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Conversion Funnel Analytics</h1>
              <p className="text-sm text-slate-500 mt-1">Track multi-step page progression and discover exact user drop-off bottlenecks.</p>
            </div>
          </div>

          {/* Create Funnel Form */}
          <form onSubmit={handleCreateFunnel} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Funnel Name</label>
              <input
                type="text"
                placeholder="User Onboarding Path"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex-[2] w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Step URLs (Comma separated)</label>
              <input
                type="text"
                placeholder="/, /pricing, /register, /dashboard"
                value={stepsInput}
                onChange={(e) => setStepsInput(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {creating ? 'Creating...' : 'Create Funnel'}
            </button>
          </form>

          {/* Funnels List & Visualizer */}
          <div className="flex flex-col gap-6">
            {/* Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 pb-3">
              {funnels.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFunnelId(f.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeFunnelId === f.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <GitMerge className="w-3.5 h-3.5" /> {f.name}
                </button>
              ))}
            </div>

            {loadingAnalytics ? (
              <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Calculating step conversion metrics...
              </div>
            ) : analytics ? (
              <div className="flex flex-col gap-6">
                
                {/* Overall Conversion Header */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{analytics.name} Conversion Health</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Overall conversion efficiency from first step to final conversion goal.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-blue-600">{analytics.overall_conversion_pct}%</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Total Funnel Conversion</div>
                  </div>
                </div>

                {/* Funnel Steps Visual Bars */}
                <div className="grid gap-4">
                  {analytics.steps.map((st, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                            #{st.step}
                          </span>
                          <span className="font-mono font-semibold text-slate-800 text-xs">{st.url}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-purple-500" /> {st.visitors} visitors
                          </span>
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            {st.conversion_pct}% retention
                          </span>
                          {st.drop_off_pct > 0 && (
                            <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <TrendingDown className="w-3 h-3" /> {st.drop_off_pct}% dropped
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visual Bar */}
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, st.conversion_pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-sm">
                No funnel selected or created. Use the builder above to set up your first conversion funnel!
              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  );
}