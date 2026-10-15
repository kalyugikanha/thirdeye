"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Flame, 
  MousePointerClick, 
  RefreshCw, 
  Globe2, 
  ExternalLink, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Layers, 
  Eye, 
  CheckCircle2, 
  Loader2,
  TrendingUp,
  Tag,
  Layout
} from 'lucide-react';
import Link from 'next/link';

interface ClickPoint {
  x: number;
  y: number;
  url: string;
  session_id: string;
  tag?: string;
  text?: string;
}

export default function HeatmapPage() {
  const router = useRouter();
  const [points, setPoints] = useState<ClickPoint[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string>('https://growinsight.co.in/');
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [backdropMode, setBackdropMode] = useState<'live' | 'wireframe'>('live');
  const [hoveredPoint, setHoveredPoint] = useState<ClickPoint | null>(null);

  const fetchHeatmaps = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/v1/analytics/heatmaps'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const incomingPoints = data.points || [];
        setPoints(incomingPoints);
        setTotalClicks(data.total_clicks || incomingPoints.length);
        const distinctUrls = data.urls || [];
        
        // Ensure growinsight.co.in is in the URL list
        const combinedUrls = Array.from(new Set([
          'https://growinsight.co.in/',
          'https://growinsight.co.in/about-us/',
          ...distinctUrls
        ]));
        setUrls(combinedUrls);

        if (!selectedUrl && combinedUrls.length > 0) {
          setSelectedUrl(combinedUrls[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load heatmaps:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmaps();
  }, []);

  const activePoints = selectedUrl
    ? points.filter(p => p.url === selectedUrl || p.url.startsWith(selectedUrl) || selectedUrl.startsWith(p.url))
    : points;

  // Compute top clicked elements on this page
  const elementClicks: { [key: string]: { count: number; tag: string; text: string } } = {};
  activePoints.forEach((p) => {
    const label = p.text ? `"${p.text}"` : (p.tag ? `<${p.tag}>` : 'Interactive Element');
    if (!elementClicks[label]) {
      elementClicks[label] = { count: 0, tag: p.tag || 'div', text: p.text || 'Clicked Area' };
    }
    elementClicks[label].count += 1;
  });

  const sortedElements = Object.entries(elementClicks)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#ffe4d6] via-[#ffdcd2] to-[#ffeedb] p-2 sm:p-4 lg:p-6 flex items-center justify-center font-sans antialiased selection:bg-rose-500/20">
      <div className="w-full max-w-[1440px] bg-[#fbfbfe] rounded-[32px] sm:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-white/80 overflow-hidden flex flex-col lg:flex-row min-h-[840px] transition-all">
        <Sidebar />

        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          <div className="w-full flex flex-col gap-8 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                  UX Behavior
                </span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                Visual Click Heatmaps
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Analyze where visitors click on your website pages with real coordinate density maps.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchHeatmaps}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>
            </div>
          </div>

          {/* Control Bar: URL Picker, Backdrop Mode, Device Toggle */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Page URL Selector */}
            <div className="flex-1 max-w-lg">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Target Webpage
              </label>
              <div className="relative">
                <Globe2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <select
                  value={selectedUrl}
                  onChange={(e) => setSelectedUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer appearance-none"
                >
                  {urls.map((u, i) => (
                    <option key={i} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Backdrop Mode & Device Switcher */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Live vs Wireframe Backdrop */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Backdrop Layer
                </label>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setBackdropMode('live')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      backdropMode === 'live'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Live Web
                  </button>
                  <button
                    onClick={() => setBackdropMode('wireframe')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      backdropMode === 'wireframe'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layout className="w-3.5 h-3.5" />
                    Wireframe
                  </button>
                </div>
              </div>

              {/* Device Viewport Toggle */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Device Viewport
                </label>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setDeviceView('desktop')}
                    className={`p-1.5 rounded-lg transition-all ${
                      deviceView === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Desktop (1440px)"
                  >
                    <Laptop className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeviceView('tablet')}
                    className={`p-1.5 rounded-lg transition-all ${
                      deviceView === 'tablet' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Tablet (768px)"
                  >
                    <Tablet className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeviceView('mobile')}
                    className={`p-1.5 rounded-lg transition-all ${
                      deviceView === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Mobile (375px)"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Total Click Events
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {activePoints.length}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Unique Clickers
              </div>
              <div className="text-2xl font-extrabold text-purple-600">
                {new Set(activePoints.map(p => p.session_id)).size || 1}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Top Click Target
              </div>
              <div className="text-sm font-bold text-slate-900 truncate mt-1.5">
                {sortedElements.length > 0 ? sortedElements[0][1].text : 'Explore Services'}
              </div>
            </div>
          </div>

          {/* In-Context Heatmap Viewport Frame */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
            {/* Browser Top Window Bar */}
            <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              </div>

              {/* URL Address Pill */}
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-4 py-1.5 rounded-full max-w-md truncate font-mono">
                <Globe2 className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="truncate">{selectedUrl || 'https://growinsight.co.in/'}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>{activePoints.length} hits</span>
              </div>
            </div>

            {/* Canvas / Viewport Area */}
            <div className="p-6 flex justify-center bg-slate-950/40 min-h-[540px]">
              <div 
                className={`relative rounded-2xl border border-slate-800 overflow-hidden bg-white shadow-2xl transition-all duration-300 ${
                  deviceView === 'desktop' ? 'w-full min-h-[540px]' :
                  deviceView === 'tablet' ? 'w-[768px] min-h-[540px]' :
                  'w-[400px] min-h-[540px]'
                }`}
              >
                {/* Backdrop Layer */}
                {backdropMode === 'live' ? (
                  <iframe
                    src={selectedUrl || 'https://growinsight.co.in/'}
                    title="Website Heatmap Backdrop"
                    className="absolute inset-0 w-full h-full border-0 pointer-events-none opacity-85 select-none"
                    sandbox="allow-same-origin allow-scripts"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white flex flex-col select-none pointer-events-none p-6 opacity-60">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-8">
                      <div className="h-6 w-28 bg-slate-300 rounded-lg"></div>
                      <div className="flex gap-4">
                        <div className="h-4 w-16 bg-slate-200 rounded"></div>
                        <div className="h-4 w-16 bg-slate-200 rounded"></div>
                        <div className="h-4 w-16 bg-slate-200 rounded"></div>
                      </div>
                    </div>
                    <div className="space-y-4 max-w-lg mb-12">
                      <div className="h-8 w-3/4 bg-slate-300 rounded-xl"></div>
                      <div className="h-4 w-full bg-slate-200 rounded"></div>
                      <div className="h-4 w-2/3 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                )}

                {/* Heatmap Glow Spots Overlay */}
                <div className="absolute inset-0 z-10">
                  {activePoints.map((pt, idx) => {
                    const posX = Math.min(Math.max(pt.x || 50, 4), 96);
                    const posY = Math.min(Math.max(pt.y || 50, 4), 96);
                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredPoint(pt)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        style={{ left: `${posX}%`, top: `${posY}%` }}
                        className="absolute w-9 h-9 -ml-4.5 -mt-4.5 rounded-full cursor-pointer transition-transform hover:scale-150 group z-20"
                      >
                        {/* Outer Heat Glow Halo */}
                        <div className="absolute inset-0 rounded-full bg-red-500 opacity-65 blur-[6px] animate-pulse"></div>
                        {/* Core Hot Dot */}
                        <div className="absolute inset-2.5 rounded-full bg-yellow-300 border-2 border-white shadow-lg"></div>
                      </div>
                    );
                  })}

                  {/* Active Tooltip on Hover */}
                  {hoveredPoint && (
                    <div 
                      style={{ 
                        left: `${Math.min(Math.max(hoveredPoint.x, 15), 85)}%`, 
                        top: `${Math.min(Math.max(hoveredPoint.y - 10, 5), 85)}%` 
                      }}
                      className="absolute z-30 -translate-x-1/2 bg-slate-900 text-white text-xs px-3.5 py-2.5 rounded-xl shadow-2xl pointer-events-none border border-slate-700 flex flex-col gap-0.5"
                    >
                      <div className="font-bold flex items-center gap-1.5 text-amber-300">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        <span>Click Target ({hoveredPoint.x}%, {hoveredPoint.y}%)</span>
                      </div>
                      {hoveredPoint.text && (
                        <div className="text-slate-200 font-medium">
                          Text: "{hoveredPoint.text}"
                        </div>
                      )}
                      {hoveredPoint.tag && (
                        <div className="text-slate-400 text-[10px] font-mono">
                          Tag: &lt;{hoveredPoint.tag}&gt;
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Clicked Elements Table */}
            {sortedElements.length > 0 && (
              <div className="bg-slate-950 p-6 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-orange-400" />
                  Top Clicked Elements on this Page
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sortedElements.map(([name, data], idx) => (
                    <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-slate-200 block truncate">{name}</span>
                        <span className="text-[10px] font-mono text-slate-400">&lt;{data.tag}&gt;</span>
                      </div>
                      <span className="text-xs font-extrabold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                        {data.count} clicks
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
      </div>
    </div>
  );
}