"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  ExternalLink
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      // 1. Fetch timeseries
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

      // 2. Fetch enriched breakdowns
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
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pt-8 px-8 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 pb-16">
          
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Audience Traffic
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Real-Time Traffic Analytics
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Live user sessions, pageviews, visitor retention, and device distributions.
              </p>
            </div>
            <button
              onClick={fetchAnalytics}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Quick Metrics (4 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Users className="w-4 h-4 text-purple-500" /> Total Sessions
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : totalVisitors}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Unique visitor sessions</p>
            </div>

            <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" /> Total Pageviews
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : totalPageviews}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Total page hits tracked</p>
            </div>

            <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <Clock className="w-4 h-4 text-emerald-500" /> Avg Session Duration
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : formatDuration(breakdown.avg_duration_sec)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Time on site per session</p>
            </div>

            <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
                <ArrowDownRight className="w-4 h-4 text-amber-500" /> Bounce Rate
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-slate-900">
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : `${breakdown.bounce_rate_pct}%`}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Single pageview exits</p>
            </div>
          </div>

          {/* Recharts Timeseries Chart */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 lg:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Traffic & Pageview Trends (Last 7 Days)</h2>
                <p className="text-xs text-slate-400">Daily visitor volume and pageview frequency</p>
              </div>
            </div>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-xs gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading analytics data...
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="pageviews" name="Pageviews" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="visitors" name="Unique Visitors" stroke="#9333ea" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#9333ea' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Device & Browser Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Device Breakdown */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Device Distribution</h3>
                    <p className="text-[11px] text-slate-400">Visitor hardware categorization</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  {(breakdown.devices && breakdown.devices.length > 0 ? breakdown.devices : [
                    { name: 'Desktop', count: 1, percentage: 80 },
                    { name: 'Mobile', count: 0, percentage: 15 },
                    { name: 'Tablet', count: 0, percentage: 5 }
                  ]).map((d, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-2 text-slate-700">
                          {d.name === 'Desktop' ? <Laptop className="w-3.5 h-3.5 text-blue-500" /> :
                           d.name === 'Mobile' ? <Smartphone className="w-3.5 h-3.5 text-purple-500" /> :
                           <Tablet className="w-3.5 h-3.5 text-emerald-500" />}
                          {d.name}
                        </span>
                        <span className="text-slate-900 font-bold">{d.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            d.name === 'Desktop' ? 'bg-blue-600' :
                            d.name === 'Mobile' ? 'bg-purple-600' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${Math.max(d.percentage, 4)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Browser Breakdown */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Top Browsers</h3>
                    <p className="text-[11px] text-slate-400">Browser engines utilized by visitors</p>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  {(breakdown.browsers && breakdown.browsers.length > 0 ? breakdown.browsers : [
                    { name: 'Chrome', count: 1, percentage: 85 },
                    { name: 'Safari', count: 0, percentage: 10 },
                    { name: 'Edge', count: 0, percentage: 5 }
                  ]).slice(0, 4).map((b, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-2 text-slate-700">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          {b.name}
                        </span>
                        <span className="text-slate-900 font-bold">{b.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${Math.max(b.percentage, 4)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Real Breakdown Tables: Top Pages & Referrers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Visited Pages */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Top Visited Pages</h3>
                    <p className="text-[11px] text-slate-400">Most viewed URLs on your website</p>
                  </div>
                </div>

                {breakdown.top_pages.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No pageviews recorded yet. Visit your site to populate.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {breakdown.top_pages.map((p, idx) => {
                      const maxViews = Math.max(...breakdown.top_pages.map((item: any) => item.views), 1);
                      const pct = Math.round((p.views / maxViews) * 100);
                      return (
                        <div key={idx} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}</span>
                            <span className="text-xs font-mono text-slate-800 truncate" title={p.url}>
                              {p.url}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-slate-900 w-8 text-right">
                              {p.views}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Top Referrers */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Traffic Sources & Referrers</h3>
                    <p className="text-[11px] text-slate-400">Where your visitors are originating from</p>
                  </div>
                </div>

                {breakdown.top_referrers.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No referral data captured yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {breakdown.top_referrers.map((r, idx) => {
                      const maxViews = Math.max(...breakdown.top_referrers.map((item: any) => item.views), 1);
                      const pct = Math.round((r.views / maxViews) * 100);
                      return (
                        <div key={idx} className="py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}</span>
                            <span className="text-xs font-medium text-slate-800 truncate" title={r.referrer}>
                              {r.referrer}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-purple-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-xs font-bold text-slate-900 w-8 text-right">
                              {r.views}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}