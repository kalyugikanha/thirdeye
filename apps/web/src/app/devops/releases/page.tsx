"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl, API_BASE } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Rocket, 
  Plus, 
  Loader2, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Copy, 
  Check, 
  X, 
  GitCommit,
  Terminal,
  Clock
} from 'lucide-react';

interface ReleaseItem {
  id: number;
  version: string;
  commit_sha: string | null;
  environment: string;
  notes: string | null;
  deployed_by: string;
  created_at: string;
  pre_errors: number;
  post_errors: number;
  error_delta: number;
  status_verdict: 'healthy' | 'regression' | 'improved';
}

export default function ReleasesPage() {
  const router = useRouter();
  const [releases, setReleases] = useState<ReleaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    version: '',
    commit_sha: '',
    environment: 'production',
    notes: '',
  });

  const token = () => localStorage.getItem('te_token');

  const loadData = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const pidQuery = activePid ? `?project_id=${encodeURIComponent(activePid)}` : '';
      const [resRel, resStat] = await Promise.all([
        fetch(apiUrl(`/api/v1/releases${pidQuery}`), { headers: { Authorization: `Bearer ${t}` } }),
        fetch(apiUrl(`/api/v1/projects/status${pidQuery}`), { headers: { Authorization: `Bearer ${t}` } })
      ]);
      if (resRel.ok) setReleases(await resRel.json());
      if (resStat.ok) {
        const s = await resStat.json();
        if (s.api_key) setApiKey(s.api_key);
      }
    } catch (e) {} finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!form.version.trim()) return;
    setSaving(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const res = await fetch(apiUrl('/api/v1/releases'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          ...form,
          project_id: activePid ? Number(activePid) : undefined
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ version: '', commit_sha: '', environment: 'production', notes: '' });
        await loadData();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this release marker?')) return;
    await fetch(apiUrl(`/api/v1/releases/${id}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    });
    await loadData();
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const pidQuery = activePid ? `?project_id=${encodeURIComponent(activePid)}` : '';
      await fetch(apiUrl(`/api/v1/releases/simulate${pidQuery}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      await loadData();
    } finally {
      setSimulating(false);
    }
  };

  const curlSnippet = `curl -X POST "${API_BASE}/api/v1/releases/webhook" \\
  -H "Content-Type: application/json" \\
  -d '{"api_key": "${apiKey || 'YOUR_API_KEY'}", "version": "v1.5.0", "commit_sha": "$GITHUB_SHA"}'`;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                CI/CD Deployment Observability
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-2 flex items-center gap-2">
                <Rocket className="w-8 h-8 text-indigo-600" /> Release & Deployment Impact
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Track production code deployments and automatically detect post-release JavaScript error spikes and performance regressions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50"
              >
                {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-rose-500" />}
                Simulate Releases
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Log Release
              </button>
            </div>
          </div>

          {/* CI/CD Integration Callout */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold flex items-center gap-1.5 text-indigo-300">
                <Terminal className="w-4 h-4" /> 1-Line CI/CD Deploy Webhook
              </span>
              <button
                onClick={copyCurl}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy cURL'}</span>
              </button>
            </div>
            <pre className="font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded-xl overflow-x-auto border border-slate-800">
              {curlSnippet}
            </pre>
          </div>

          {/* Releases Timeline */}
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
              Loading release history...
            </div>
          ) : releases.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              <Rocket className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No releases logged yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Log a release manually or run the CI/CD webhook to track code deployment impact.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {releases.map((rel) => {
                const isReg = rel.status_verdict === 'regression';
                const isImp = rel.status_verdict === 'improved';
                return (
                  <div key={rel.id} className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-base font-extrabold text-slate-900">{rel.version}</span>
                        {rel.commit_sha && (
                          <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            <GitCommit className="w-3 h-3" /> {rel.commit_sha.substring(0, 7)}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                          {rel.environment}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          isReg ? 'bg-rose-50 text-rose-600 border-rose-200' : isImp ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isReg ? 'Error Regression' : isImp ? 'Improved Stability' : 'Healthy Release'}
                        </span>
                      </div>
                      {rel.notes && <p className="text-xs text-slate-600">{rel.notes}</p>}
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Deployed by {rel.deployed_by} · {new Date(rel.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-6 sm:border-l sm:border-slate-100 sm:pl-6">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Pre-Release</p>
                        <p className="text-base font-extrabold text-slate-700 mt-0.5">{rel.pre_errors} errs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Post-Release</p>
                        <p className={`text-base font-extrabold mt-0.5 ${isReg ? 'text-rose-600' : 'text-slate-900'}`}>
                          {rel.post_errors} errs
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Delta</p>
                        <p className={`text-base font-extrabold mt-0.5 ${rel.error_delta > 0 ? 'text-rose-600' : rel.error_delta < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {rel.error_delta > 0 ? `+${rel.error_delta}` : rel.error_delta}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(rel.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Release"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal to Log Release */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-extrabold text-slate-900">Log Production Release</h3>
            <label className="block text-xs font-semibold text-slate-700">
              Version Tag *
              <input
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="v1.4.0"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Git Commit SHA
              <input
                value={form.commit_sha}
                onChange={(e) => setForm({ ...form, commit_sha: e.target.value })}
                placeholder="a1b2c3d"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Environment
              <select
                value={form.environment}
                onChange={(e) => setForm({ ...form, environment: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white"
              >
                <option value="production">production</option>
                <option value="staging">staging</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Release Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Key changes deployed in this version..."
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs h-20 resize-none"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.version.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Log Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
