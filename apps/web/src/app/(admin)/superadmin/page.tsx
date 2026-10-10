"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Server, Users, Activity, Plug, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function SuperAdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState({ total_organizations: 0, total_projects: 0, total_events: 0, total_connectors: 0 });
  const [projects, setProjects] = useState<{id: number, name: string}[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    const token = localStorage.getItem('te_token');
    try {
      const url = selectedProjectId === 'all' 
        ? 'http://localhost:8000/api/v1/admin/stats'
        : `http://localhost:8000/api/v1/admin/stats?project_id=${selectedProjectId}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return router.push('/login');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch('http://localhost:8000/api/v1/admin/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return router.push('/login');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects list:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [selectedProjectId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 px-8 py-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            T
          </div>
          <h1 className="text-lg font-semibold text-white tracking-wide">ThirdEye <span className="text-slate-500 font-normal">| Super Admin</span></h1>
        </div>
        <div className="flex items-center gap-4">
          
          <select 
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">Global View (All Projects)</option>
            {projects.map(p => (
              <option key={p.id} value={p.id.toString()}>{p.name}</option>
            ))}
          </select>

          <button onClick={fetchStats} className="text-slate-400 hover:text-white transition-colors p-2">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
          <div className="text-sm font-medium bg-slate-800 px-3 py-1.5 rounded-full text-slate-300 border border-slate-700">
            System Online
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Platform Overview</h2>
          <p className="text-slate-500 text-sm">
            {selectedProjectId === 'all' ? 'Global metrics across all tenants and workspaces.' : 'Metrics filtered by selected project.'}
          </p>
        </div>

        {/* Global Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-3 text-slate-400 mb-4">
              <div className="p-2 bg-slate-800 rounded-lg"><Users className="w-5 h-5 text-blue-400" /></div>
              <span className="text-sm font-semibold uppercase tracking-wider">Organizations</span>
            </div>
            <div className="text-4xl font-bold text-white">
              {loading ? <Loader2 className="w-8 h-8 animate-spin text-slate-700" /> : stats.total_organizations}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-3 text-slate-400 mb-4">
              <div className="p-2 bg-slate-800 rounded-lg"><Server className="w-5 h-5 text-indigo-400" /></div>
              <span className="text-sm font-semibold uppercase tracking-wider">Active Projects</span>
            </div>
            <div className="text-4xl font-bold text-white">
              {loading ? <Loader2 className="w-8 h-8 animate-spin text-slate-700" /> : stats.total_projects}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-3 text-slate-400 mb-4">
              <div className="p-2 bg-slate-800 rounded-lg"><Activity className="w-5 h-5 text-emerald-400" /></div>
              <span className="text-sm font-semibold uppercase tracking-wider">Total Events</span>
            </div>
            <div className="text-4xl font-bold text-white">
              {loading ? <Loader2 className="w-8 h-8 animate-spin text-slate-700" /> : stats.total_events.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
            <div className="flex items-center gap-3 text-slate-400 mb-4">
              <div className="p-2 bg-slate-800 rounded-lg"><Plug className="w-5 h-5 text-amber-400" /></div>
              <span className="text-sm font-semibold uppercase tracking-wider">Connectors</span>
            </div>
            <div className="text-4xl font-bold text-white">
              {loading ? <Loader2 className="w-8 h-8 animate-spin text-slate-700" /> : stats.total_connectors}
            </div>
          </div>

        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 border-b border-slate-800 pb-2">Quick Actions</h3>
          <div className="flex gap-4">
            <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-slate-700">
              Go to Client Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}