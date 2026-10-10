"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Workflow, Plus, Play, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

interface Step {
  name: string;
  url: string;
  method: string;
  expected_status: number;
}

interface SyntheticMonitor {
  id: number;
  name: string;
  status: string;
  steps: Step[];
  last_run: string | null;
}

export default function SyntheticPage() {
  const [monitors, setMonitors] = useState<SyntheticMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [step1Url, setStep1Url] = useState('https://httpbin.org/post');
  const [step2Url, setStep2Url] = useState('https://httpbin.org/get');
  const [creating, setCreating] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [runResults, setRunResults] = useState<any>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const router = useRouter();

  const fetchMonitors = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      const projRes = await fetch(apiUrl('/api/projects'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const projects = await projRes.json();
      if (projects.length > 0) setProjectId(projects[0].id);

      const res = await fetch(apiUrl('/api/v1/synthetic/monitors'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMonitors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitors();
  }, []);

  const handleCreateSynthetic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !projectId) return;
    setCreating(true);
    const token = localStorage.getItem('te_token');
    const stepsArr = [
      { name: 'Step 1: Authenticate / Login', url: step1Url, method: 'POST', expected_status: 200 },
      { name: 'Step 2: Fetch Account Profile', url: step2Url, method: 'GET', expected_status: 200 }
    ];
    try {
      const res = await fetch(apiUrl('/api/v1/synthetic/monitors'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, project_id: projectId, steps: stepsArr })
      });
      if (res.ok) {
        setName('');
        fetchMonitors();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleRunScenario = async (id: number) => {
    setRunningId(id);
    setRunResults(null);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/synthetic/monitors/${id}/run`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setRunResults(data);
      fetchMonitors();
    } catch (err) {
      console.error(err);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Synthetic Multi-Step API Scenarios</h1>
              <p className="text-sm text-slate-500 mt-1">Test complex multi-step transactional workflows (Login → Profile Fetch → Action assertions).</p>
            </div>
          </div>

          {/* Builder Form */}
          <form onSubmit={handleCreateSynthetic} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configure New Synthetic Scenario</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Scenario Name</label>
                <input
                  type="text"
                  placeholder="E2E Checkout Flow Test"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Step 1 Endpoint (POST Auth)</label>
                <input
                  type="url"
                  value={step1Url}
                  onChange={(e) => setStep1Url(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Step 2 Endpoint (GET Profile)</label>
                <input
                  type="url"
                  value={step2Url}
                  onChange={(e) => setStep2Url(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> {creating ? 'Saving...' : 'Save Scenario'}
              </button>
            </div>
          </form>

          {/* Scenario Execution Results */}
          {runResults && (
            <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-emerald-400" /> Scenario Execution Output
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  runResults.status === 'passed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}>
                  {runResults.status}
                </span>
              </div>

              <div className="grid gap-3">
                {runResults.steps.map((s: any, idx: number) => (
                  <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      {s.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      <div>
                        <span className="text-slate-200 font-bold">{s.step}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">{s.url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400">{s.response_time_ms} ms</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${s.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                        HTTP {s.status_code} (Expected {s.expected})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scenario List */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Active Scenarios ({monitors.length})</h2>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading synthetic monitors...</div>
            ) : monitors.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
                No synthetic API scenarios configured yet. Create one above!
              </div>
            ) : (
              <div className="grid gap-4">
                {monitors.map((m) => (
                  <div key={m.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${m.status === 'passed' ? 'bg-emerald-500' : m.status === 'failed' ? 'bg-red-500' : 'bg-amber-400'}`}></span>
                        <h3 className="font-semibold text-slate-900 text-base">{m.name}</h3>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{m.steps?.length || 2} steps sequence</p>
                    </div>

                    <button
                      onClick={() => handleRunScenario(m.id)}
                      disabled={runningId === m.id}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {runningId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {runningId === m.id ? 'Running...' : 'Run Scenario'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}