"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Activity, Users, Zap, CheckCircle, Plus, GitBranch, Globe, Database, LayoutTemplate, ShieldCheck, ArrowRight, BarChart, Loader2, Bell, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

export default function Page() {
  const [stats, setStats] = useState({ api_uptime: 0, avg_latency: 0, active_sessions: 0, total_events: 0, last_event_at: null });
  const [loading, setLoading] = useState(true);
  const [connectors, setConnectors] = useState<string[]>(['js_snippet']); // Start with snippet connected
  const [installing, setInstalling] = useState<string | null>(null);

  const router = useRouter();
  const [projectId, setProjectId] = useState<number | null>(null);

  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleAskAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const token = localStorage.getItem('te_token');
      const res = await fetch(apiUrl('/api/v1/insights'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query: aiQuery })
      });
      const data = await res.json();
      setAiResponse(data);
    } catch (e) {
      console.error(e);
      setAiResponse({ insight: "Error fetching insight. Make sure the backend is running." });
    }
    setAiLoading(false);
  };


  useEffect(() => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const initDashboard = async () => {
      try {
        // Fetch projects to get ID
        const projRes = await fetch(apiUrl('/api/projects'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (projRes.status === 401) {
          localStorage.removeItem('te_token');
          router.push('/login');
          return;
        }
        const projects = await projRes.json();
        const activeProjectId = projects.length > 0 ? projects[0].id : null;
        setProjectId(activeProjectId);

        // Fetch Stats
        const statsRes = await fetch(apiUrl('/api/v1/dashboard/stats'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const statsData = await statsRes.json();
        setStats(statsData);
        setLoading(false);
      } catch (err) {
        console.error('Failed to init dashboard:', err);
        setLoading(false);
      }
    };

    initDashboard();
    const interval = setInterval(initDashboard, 5000);
    return () => clearInterval(interval);
  }, [router]);

  const handleInstallConnector = async (provider: string) => {
    if (!projectId) return alert("No active project found. Complete onboarding first.");
    let accessToken = null;
    let metadata = null;

    if (provider === 'github') {
      const token = window.prompt("Enter your GitHub Personal Access Token (or leave blank to test public repos):");
      const repo = window.prompt("Enter the repository to track (e.g. facebook/react):", "facebook/react");
      if (repo === null) return; // cancelled
      accessToken = token || null;
      metadata = { repo };
      localStorage.setItem('te_github_repo', repo); // Save for the devops page
    }

    setInstalling(provider);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/connectors'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ provider, project_id: projectId, access_token: accessToken, metadata })
      });
      if (res.ok) {
        setConnectors([...connectors, provider]);
      }
    } catch (err) {
      console.error('Failed to install connector', err);
    }
    setInstalling(null);
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        
        {/* Top Floating Search (AI Advisor) */}
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between mb-12">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Workspace
          </h1>
          
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative group shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] rounded-full bg-white border border-slate-100 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Sparkles className="h-4 w-4 text-blue-500" />
              </div>
              <input 
                type="text" 
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                className="w-full bg-transparent border-0 rounded-full pl-11 pr-24 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                placeholder="Ask ThirdEye to analyze health, metrics, or users..."
              />
              <div className="absolute inset-y-0 right-2 flex items-center">
                <button onClick={handleAskAI} disabled={aiLoading} className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-xs font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {aiLoading ? 'Thinking...' : 'Ask AI'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/onboarding" className="text-sm font-medium border border-slate-200 px-4 py-1.5 rounded-full hover:bg-slate-50 transition-colors flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Project
            </Link>
          </div>
        </div>

        <div className="w-full max-w-5xl mx-auto flex flex-col gap-12 pb-12">
          
          {/* Section 1: Overall Health & Results (Live Data) */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Overall Platform Health</h2>
              {stats.total_events > 0 ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Tracking Active &bull; {stats.total_events} events received
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                  Waiting for first event from snippet...
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-6">
              {/* Metric 1 */}
              <div className="flex flex-col p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center gap-2 text-slate-500 mb-3 text-sm font-medium">
                  <Activity className="w-4 h-4 text-blue-500" /> Platform Status
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : (stats.total_events > 0 ? '100%' : '0%')}
                  </span>
                  {!loading && <span className="text-xs font-medium text-emerald-500">Online</span>}
                </div>
              </div>

              {/* Metric 2 */}
              <div className="flex flex-col p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center gap-2 text-slate-500 mb-3 text-sm font-medium">
                  <Zap className="w-4 h-4 text-orange-500" /> Total Tracked Events
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : stats.total_events}
                  </span>
                  {!loading && <span className="text-sm font-medium text-slate-500">events</span>}
                </div>
              </div>

              {/* Metric 3: Real Database Connect */}
              <div className="flex flex-col p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center gap-2 text-slate-500 mb-3 text-sm font-medium">
                  <Users className="w-4 h-4 text-purple-500" /> Active Sessions
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : stats.active_sessions}
                  </span>
                  {!loading && <span className="text-xs font-medium text-emerald-500 ml-2">Live</span>}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Easy Connectors (SuperAGI Style) */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Connectors & Agents</h2>
              <button className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline">
                View library <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* JS Snippet */}
              <div className="group flex flex-col p-4 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                    <Globe className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Connected</span>
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">JS Snippet</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">Tracking web sessions, clicks, and heatmaps.</p>
              </div>

              {/* GitHub */}
              <div className={`group flex flex-col p-4 rounded-2xl transition-all relative overflow-hidden ${connectors.includes('github') ? 'bg-white border-slate-100' : 'bg-white border-dashed border-slate-200 cursor-pointer hover:border-solid hover:border-blue-200 hover:bg-blue-50/30'}`}>
                {connectors.includes('github') && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connectors.includes('github') ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400 group-hover:text-blue-600'}`}>
                    <GitBranch className="w-4 h-4" />
                  </div>
                  {connectors.includes('github') ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Connected</span>
                  ) : (
                    <button onClick={() => handleInstallConnector('github')} className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                      {installing === 'github' ? '...' : 'Install'}
                    </button>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">GitHub</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">Tracking deployments and CI/CD health.</p>
              </div>

              {/* Server Agent */}
              <div className={`group flex flex-col p-4 rounded-2xl transition-all relative overflow-hidden ${connectors.includes('server') ? 'bg-white border-slate-100' : 'bg-white border-dashed border-slate-200 cursor-pointer hover:border-solid hover:border-blue-200 hover:bg-blue-50/30'}`}>
                {connectors.includes('server') && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connectors.includes('server') ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:text-blue-600'}`}>
                    <Database className="w-4 h-4" />
                  </div>
                  {connectors.includes('server') ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Connected</span>
                  ) : (
                    <button onClick={() => handleInstallConnector('server')} className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                      {installing === 'server' ? '...' : 'Install'}
                    </button>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">Server Agent</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">Monitor CPU, RAM, and internal DB health.</p>
              </div>

              {/* Google Analytics */}
              <div className={`group flex flex-col p-4 rounded-2xl transition-all relative overflow-hidden ${connectors.includes('google_analytics') ? 'bg-white border-slate-100' : 'bg-white border-dashed border-slate-200 cursor-pointer hover:border-solid hover:border-blue-200 hover:bg-blue-50/30'}`}>
                {connectors.includes('google_analytics') && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>}
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${connectors.includes('google_analytics') ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-400 group-hover:text-blue-600'}`}>
                    <Search className="w-4 h-4" />
                  </div>
                  {connectors.includes('google_analytics') ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Connected</span>
                  ) : (
                    <button onClick={() => handleInstallConnector('google_analytics')} className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-3 py-1 rounded-full group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
                      {installing === 'google_analytics' ? '...' : 'Install'}
                    </button>
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">Google Analytics</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">Sync marketing data and traffic sources.</p>
              </div>

            </div>
          </section>

          {/* Section 3: AI Insights */}
          <section>
             <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Latest AI Insights</h2>
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Sparkles className="w-24 h-24 text-blue-600" />
              </div>
              {aiResponse ? (
                <div>
                   <h3 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
                     <Sparkles className="w-4 h-4 text-blue-600" /> Answer to: "{aiQuery}"
                   </h3>
                   <div className="text-sm text-slate-700 bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                     {aiResponse.insight}
                   </div>
                   {aiResponse.sql_used && (
                     <div className="mt-3">
                       <p className="text-xs text-slate-400 mb-1">Generated SQL Query:</p>
                       <pre className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg overflow-x-auto border border-slate-100">
                         {aiResponse.sql_used}
                       </pre>
                     </div>
                   )}
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-slate-900 text-sm mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" /> Morning Briefing
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm text-slate-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                      <p>Your latest GitHub deployment (#492) improved average API latency by <strong>12ms</strong>.</p>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 flex-shrink-0"></div>
                      <p>We detected a slight drop in checkout conversions. The JS Snippet heatmap shows users hesitating on the new payment form.</p>
                    </li>
                  </ul>
                </>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}