"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Terminal, Loader2, GitCommit } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

export default function DevOpsPage() {
  const router = useRouter();
  const [commits, setCommits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchCommits = async () => {
      const repo = localStorage.getItem('te_github_repo') || 'facebook/react';
      try {
        const res = await fetch(`http://localhost:8000/api/v1/github/commits?repo=${repo}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem('te_token');
          router.push('/login');
          return;
        }
        const data = await res.json();
        
        if (data.status === 'connected') {
          setCommits(data.commits);
        } else if (data.status === 'disconnected') {
          setError('GitHub Connector is not installed. Go to Workspace to install it.');
        } else {
          setError('Failed to fetch from GitHub: ' + (data.message || 'Unknown error'));
        }
      } catch (err) {
        console.error('Failed to fetch commits:', err);
        setError('Failed to reach API.');
      } finally {
        setLoading(false);
      }
    };

    fetchCommits();
  }, [router]);

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">DevOps & Health</h1>
            <p className="text-sm text-slate-500 mt-1">Monitor API uptime, server latency, and live deployments.</p>
          </div>

          {/* Top Status Timeline Placeholder */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[160px] text-center">
            <Activity className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Uptime Monitoring Timeline</p>
            <p className="text-xs text-slate-400 mt-0.5">(Server Agent Connector coming soon)</p>
          </div>

          {/* GitHub Commit Stream */}
          <div className="bg-slate-950 text-slate-100 rounded-2xl p-6 font-mono text-sm border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-200 text-xs">Live External CI/CD Logs (GitHub)</span>
              </div>
              <span className="text-xs text-slate-500">Repo: {typeof window !== 'undefined' ? (localStorage.getItem('te_github_repo') || 'facebook/react') : 'facebook/react'}</span>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Fetching live commits from GitHub API...
              </div>
            ) : error ? (
              <div className="text-amber-400 text-xs py-4">
                {error}
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {commits.map((c, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-colors">
                    <div className="flex items-start gap-3">
                      <GitCommit className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-200 font-sans font-medium">{c.message}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-mono">By {c.author} • {new Date(c.date).toLocaleString()}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono flex-shrink-0">
                      {c.sha}
                    </span>
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