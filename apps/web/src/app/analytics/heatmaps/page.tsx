"use client";

import Sidebar from '@/components/Sidebar';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, BarChart, ShieldCheck, Activity, Bell, Sliders, Users, Flame, MousePointerClick, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface ClickPoint {
  x: number;
  y: number;
  url: string;
  session_id: string;
}

export default function HeatmapPage() {
  const [points, setPoints] = useState<ClickPoint[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [targetUrl, setTargetUrl] = useState('');
  const router = useRouter();

  const fetchHeatmaps = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      const res = await fetch('http://localhost:8000/api/v1/analytics/heatmaps', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.points) {
        setPoints(data.points);
        setTotalClicks(data.total_clicks || data.points.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmaps();
  }, []);

  const filteredPoints = targetUrl
    ? points.filter(p => p.url.toLowerCase().includes(targetUrl.toLowerCase()))
    : points;

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Visual Aggregated Click Heatmaps</h1>
              <p className="text-sm text-slate-500 mt-1">Aggregated user click density overlay across tracked pages.</p>
            </div>
            <button
              onClick={fetchHeatmaps}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-1 text-xs font-medium border border-slate-200"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
            </button>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
            <input
              type="text"
              placeholder="Filter by Page URL (e.g. /dashboard or example.com)..."
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-xs font-medium text-slate-500">
              Showing <span className="font-bold text-slate-900">{filteredPoints.length}</span> of {totalClicks} clicks
            </div>
          </div>

          {/* Heatmap Simulation Box */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 relative overflow-hidden min-h-[400px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-4 border-b border-slate-800 pb-3">
              <span className="flex items-center gap-1.5"><MousePointerClick className="w-4 h-4 text-orange-400" /> Heatmap Density Canvas</span>
              <span>1000px x 600px viewport</span>
            </div>

            {/* Click Dots Canvas */}
            <div className="relative w-full h-[320px] bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden">
              {filteredPoints.map((pt, idx) => {
                const posX = Math.min(Math.max(pt.x || 50, 5), 95);
                const posY = Math.min(Math.max(pt.y || 50, 5), 95);
                return (
                  <div
                    key={idx}
                    style={{ left: `${posX}%`, top: `${posY}%` }}
                    className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300 opacity-70 blur-[3px] pointer-events-none transition-all hover:opacity-100 hover:scale-125"
                    title={`Click at (${pt.x}, ${pt.y})`}
                  />
                );
              })}

              {filteredPoints.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                  <Flame className="w-8 h-8 text-slate-700" />
                  <p>No click density points recorded for this URL query yet.</p>
                  <p className="text-[10px] text-slate-600">Clicks tracked by `te.js` automatically plot density dots here.</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-4">
              <div className="flex items-center gap-2">
                <span>Density Gradient:</span>
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span> Low
                <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span> Med
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span> High
              </div>
              <span>Auto-aggregated from live session events</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}