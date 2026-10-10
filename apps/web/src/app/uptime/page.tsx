"use client";

import Sidebar from '@/components/Sidebar';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, BarChart, ShieldCheck, Activity, Bell, Search, TrendingUp, Plus, RefreshCw, CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Monitor {
  id: number;
  name: string;
  url: string;
  status: string;
  last_checked: string | null;
  response_time_ms: number | null;
  error_message: string | null;
}

export default function UptimePage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);
  const router = useRouter();

  const fetchMonitors = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const projRes = await fetch('http://localhost:8000/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (projRes.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      const projects = await projRes.json();
      if (projects.length > 0) setProjectId(projects[0].id);

      const res = await fetch('http://localhost:8000/api/v1/monitors', {
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
    const interval = setInterval(fetchMonitors, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !projectId) return;
    setAdding(true);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch('http://localhost:8000/api/v1/monitors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, url, project_id: projectId })
      });
      if (res.ok) {
        setName('');
        setUrl('');
        fetchMonitors();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleCheckNow = async (id: number) => {
    setChecking(id);
    const token = localStorage.getItem('te_token');
    try {
      await fetch(`http://localhost:8000/api/v1/monitors/${id}/check`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchMonitors();
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Uptime & URL Monitoring</h1>
              <p className="text-sm text-slate-500 mt-1">Track HTTP availability and latency across your web applications.</p>
            </div>
          </div>

          {/* Add Monitor Form */}
          <form onSubmit={handleAddMonitor} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Monitor Name</label>
              <input
                type="text"
                placeholder="Production API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Target URL</label>
              <input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {adding ? 'Adding...' : 'Add Monitor'}
            </button>
          </form>

          {/* Monitors List */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Active Monitors ({monitors.length})</h2>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading monitors...</div>
            ) : monitors.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
                No monitors configured yet. Add your first URL above!
              </div>
            ) : (
              <div className="grid gap-4">
                {monitors.map((m) => (
                  <div key={m.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {m.status === 'up' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                      ) : m.status === 'down' ? (
                        <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock className="w-6 h-6 text-amber-500 flex-shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 text-base">{m.name}</h3>
                          <a href={m.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{m.url}</p>
                        {m.error_message && (
                          <p className="text-xs text-red-600 mt-1 font-medium">{m.error_message}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Response Time</div>
                        <div className="text-sm font-bold text-slate-800">
                          {m.response_time_ms !== null ? `${m.response_time_ms} ms` : '--'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Status</div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                          m.status === 'up' ? 'bg-emerald-50 text-emerald-600' :
                          m.status === 'down' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCheckNow(m.id)}
                        disabled={checking === m.id}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-colors"
                        title="Check Now"
                      >
                        <RefreshCw className={`w-4 h-4 ${checking === m.id ? 'animate-spin text-blue-600' : ''}`} />
                      </button>
                    </div>
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