"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Users, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/analytics/timeseries'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem('te_token');
          router.push('/login');
          return;
        }
        const timeseries = await res.json();
        setData(timeseries);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [router]);

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Real-Time Traffic Analytics</h1>
            <p className="text-sm text-slate-500 mt-1">Live user sessions, pageviews, and visitor retention over time.</p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                <Users className="w-4 h-4 text-purple-500" /> Total Tracked Sessions
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : data.reduce((acc, curr: any) => acc + curr.sessions, 0)}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" /> Total Pageviews
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : data.reduce((acc, curr: any) => acc + curr.pageviews, 0)}
              </div>
            </div>
          </div>

          {/* Recharts Timeseries Chart */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 mb-6">Traffic & Pageview Trends (Last 7 Days)</h2>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading analytics data...
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="pageviews" name="Pageviews" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="sessions" name="Unique Sessions" stroke="#9333ea" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#9333ea' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}