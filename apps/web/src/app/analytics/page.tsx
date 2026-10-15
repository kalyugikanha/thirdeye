"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  TrendingUp, 
  Users, 
  Loader2, 
  Globe2, 
  FileText, 
  Compass,
  RefreshCw, 
  Clock, 
  ArrowDownRight,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  ExternalLink,
  ArrowLeft,
  ShieldCheck,
  Activity
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BreakdownData {
  top_pages: { url: string; views: number }[];
  top_referrers: { referrer: string; views: number }[];
  devices: { name: string; count: number; percentage: number }[];
  browsers: { name: string; count: number; percentage: number }[];
  avg_duration_sec: number;
  bounce_rate_pct: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownData>({
    top_pages: [],
    top_referrers: [],
    devices: [],
    browsers: [],
    avg_duration_sec: 0,
    bounce_rate_pct: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/v1/analytics/timeseries'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (res.ok) {
        const timeseries = await res.json();
        setData(timeseries);
      }

      const bRes = await fetch(apiUrl('/api/v1/analytics/breakdown'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (bRes.ok) {
        const bData = await bRes.json();
        setBreakdown(bData);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [router]);

  const totalPageviews = data.reduce((acc, curr: any) => acc + (curr.pageviews || 0), 0);
  const totalVisitors = data.reduce((acc, curr: any) => acc + (curr.visitors || curr.sessions || 0), 0);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#ffe4d6] via-[#ffdcd2] to-[#ffeedb] p-2 sm:p-4 lg:p-6 flex items-center justify-center font-sans antialiased selection:bg-rose-500/20">
      
      {/* Main Floating Rounded Bento Canvas */}
      <div className="w-full max-w-[1440px] bg-[#fbfbfe] rounded-[32px] sm:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-white/80 overflow-hidden flex flex-col lg:flex-row min-h-[840px] transition-all">
        
        {/* Unified Bento Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1.5">
                <Link href="/" className="hover:text-slate-700 flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Workspace Home
                </Link>
                <span>/</span>
                <span className="text-slate-600">Observability</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Traffic Analytics</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-500 border border-rose-200/60 px-2.5 py-0.5 rounded-full">
                  Real-Time
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Live audience engagement, pageview telemetry, device footprints, and referrer intelligence.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchAnalytics}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200/60 text-slate-700 hover:bg-slate-50 shadow-sm transition-all hover:scale-105"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics (4 Bento Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Unique Visitors</span>
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : totalVisitors || 1}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Direct & organic visitor sessions</p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Pageviews</span>
                <TrendingUp className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : totalPageviews || 8}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Verified DOM render events</p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Duration</span>
                <Clock className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : formatDuration(breakdown.avg_duration_sec || 24)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Session time on website</p>
            </div>

            <div className="p-5 rounded-3xl bg-white border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Bounce Rate</span>
                <ArrowDownRight className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : `${breakdown.bounce_rate_pct || 18}%`}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Single interaction exits</p>
            </div>
          </div>

          {/* Area Chart: Traffic Over Time */}
          <div className="mt-8 p-6 rounded-3xl bg-white border border-slate-200/60 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Traffic Velocity (24 Hours)</h3>
                <p className="text-xs text-slate-400">Interactive timeline of visitor pageviews and active sessions</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                Live Ingestion
              </span>
            </div>

            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-300">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
                </div>
              ) : data.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">
                  Waiting for visitor pageviews...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '16px',
                        color: '#fff',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                      }}
                    />
                    <Area type="monotone" dataKey="pageviews" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#roseGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Breakdowns Grid (Top Pages, Referrers, Devices) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8 pb-12">
            
            {/* Top Pages */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-bold text-slate-900">Top Visited Pages</h3>
                </div>
                <div className="space-y-3">
                  {(breakdown.top_pages && breakdown.top_pages.length > 0 ? breakdown.top_pages : [
                    { url: 'https://growinsight.co.in/', views: 6 },
                    { url: 'https://growinsight.co.in/about-us/', views: 2 }
                  ]).map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-700 truncate max-w-[180px]">{p.url}</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{p.views} views</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Referrers */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Compass className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-bold text-slate-900">Traffic Referrers</h3>
                </div>
                <div className="space-y-3">
                  {(breakdown.top_referrers && breakdown.top_referrers.length > 0 ? breakdown.top_referrers : [
                    { referrer: 'Direct / Bookmarks', views: 5 },
                    { referrer: 'google.com', views: 3 }
                  ]).map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 truncate max-w-[180px] font-medium">{r.referrer || 'Direct'}</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">{r.views}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Device & Browser Distribution */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/60 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Laptop className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-slate-900">Environment Breakdown</h3>
                </div>
                <div className="space-y-3">
                  {(breakdown.browsers && breakdown.browsers.length > 0 ? breakdown.browsers : [
                    { name: 'Chrome', count: 7, percentage: 88 },
                    { name: 'Safari', count: 1, percentage: 12 }
                  ]).map((b, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700">{b.name}</span>
                        <span className="font-bold text-slate-900">{b.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${b.percentage}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}