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
  Tag
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
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
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
        setPoints(data.points || []);
        setTotalClicks(data.total_clicks || (data.points ? data.points.length : 0));
        const distinctUrls = data.urls || [];
        setUrls(distinctUrls);
        if (distinctUrls.length > 0 && !selectedUrl) {
          setSelectedUrl(distinctUrls[0]);
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
    ? points.filter(p => p.url === selectedUrl)
    : points;

  // Compute top clicked elements on this page
  const elementClicks: { [key: string]: { count: number; tag: string; text: string } } = {};
  activePoints.forEach((p) => {
    const label = p.text ? `"${p.text}" (${p.tag || 'element'})` : (p.tag ? `<${p.tag}>` : 'Page area');
    if (!elementClicks[label]) {
      elementClicks[label] = { count: 0, tag: p.tag || 'div', text: p.text || 'Clicked area' };
    }
    elementClicks[label].count += 1;
  });

  const sortedElements = Object.entries(elementClicks)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-8 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 pb-16">
          
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                Refresh Data
              </button>
            </div>
          </div>

          {/* Control & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Page URL Selector */}
            <div className="flex-1 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                <Globe2 className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Target Webpage
                </label>
                {urls.length > 0 ? (
                  <select
                    value={selectedUrl}
                    onChange={(e) => setSelectedUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  >
                    {urls.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. https://scanpe.in/"
                    value={selectedUrl}
                    onChange={(e) => setSelectedUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                )}
              </div>
            </div>

            {/* Viewport Width Controls */}
            <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5">
              <span className="text-xs font-medium text-slate-400 mr-1 hidden lg:inline">Viewport:</span>
              <button
                onClick={() => setDeviceView('desktop')}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  deviceView === 'desktop' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Desktop (100% width)"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop</span>
              </button>
              <button
                onClick={() => setDeviceView('tablet')}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  deviceView === 'tablet' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Tablet (768px)"
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tablet</span>
              </button>
              <button
                onClick={() => setDeviceView('mobile')}
                className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  deviceView === 'mobile' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Mobile (420px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mobile</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Total Page Clicks
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
                {new Set(activePoints.map(p => p.session_id)).size}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Most Clicked Target
              </div>
              <div className="text-sm font-bold text-slate-900 truncate mt-1.5">
                {sortedElements.length > 0 ? sortedElements[0][1].text : 'N/A'}
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
                <span className="truncate">{selectedUrl || 'https://scanpe.in/'}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>{activePoints.length} hits</span>
              </div>
            </div>

            {/* Canvas / Viewport Area */}
            <div className="p-6 flex justify-center bg-slate-950/40 min-h-[500px]">
              <div 
                className={`relative rounded-2xl border border-slate-800 overflow-hidden bg-white shadow-2xl transition-all duration-300 ${
                  deviceView === 'desktop' ? 'w-full min-h-[520px]' :
                  deviceView === 'tablet' ? 'w-[768px] min-h-[520px]' :
                  'w-[420px] min-h-[520px]'
                }`}
              >
                {/* Simulated Website Wireframe Background */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white flex flex-col select-none pointer-events-none p-6 opacity-40">
                  {/* Mock Navbar */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-8">
                    <div className="h-6 w-24 bg-slate-300 rounded-lg"></div>
                    <div className="flex gap-4">
                      <div className="h-4 w-14 bg-slate-200 rounded"></div>
                      <div className="h-4 w-14 bg-slate-200 rounded"></div>
                      <div className="h-4 w-14 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                  {/* Mock Hero Section */}
                  <div className="space-y-4 max-w-lg mb-12">
                    <div className="h-8 w-3/4 bg-slate-300 rounded-xl"></div>
                    <div className="h-4 w-full bg-slate-200 rounded"></div>
                    <div className="h-4 w-2/3 bg-slate-200 rounded"></div>
                    <div className="pt-2 flex gap-3">
                      <div className="h-9 w-28 bg-blue-300 rounded-xl"></div>
                      <div className="h-9 w-24 bg-slate-200 rounded-xl"></div>
                    </div>
                  </div>
                  {/* Mock Grid */}
                  <div className="grid grid-cols-3 gap-4 mt-auto">
                    <div className="h-28 bg-slate-100 rounded-xl border border-slate-200 p-3">
                      <div className="h-4 w-12 bg-slate-200 rounded mb-2"></div>
                      <div className="h-3 w-full bg-slate-100 rounded"></div>
                    </div>
                    <div className="h-28 bg-slate-100 rounded-xl border border-slate-200 p-3">
                      <div className="h-4 w-12 bg-slate-200 rounded mb-2"></div>
                      <div className="h-3 w-full bg-slate-100 rounded"></div>
                    </div>
                    <div className="h-28 bg-slate-100 rounded-xl border border-slate-200 p-3">
                      <div className="h-4 w-12 bg-slate-200 rounded mb-2"></div>
                      <div className="h-3 w-full bg-slate-100 rounded"></div>
                    </div>
                  </div>
                </div>

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
                        className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full cursor-pointer transition-transform hover:scale-150 group z-20"
                      >
                        {/* Outer Heat Halo */}
                        <div className="absolute inset-0 rounded-full bg-red-500 opacity-60 blur-[6px] animate-pulse"></div>
                        {/* Core Hot Dot */}
                        <div className="absolute inset-2 rounded-full bg-yellow-300 border-2 border-white shadow-md"></div>
                      </div>
                    );
                  })}

                  {activePoints.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                      <MousePointerClick className="w-12 h-12 text-slate-300 mb-3" />
                      <h3 className="font-semibold text-slate-700 text-sm">No clicks recorded on this page yet</h3>
                      <p className="text-xs text-slate-400 max-w-sm mt-1">
                        Visit <code className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{selectedUrl || 'your website'}</code> and click on buttons or text. Coordinates will plot here in real time!
                      </p>
                    </div>
                  )}

                  {/* Active Tooltip on Hover */}
                  {hoveredPoint && (
                    <div 
                      style={{ 
                        left: `${Math.min(Math.max(hoveredPoint.x, 15), 85)}%`, 
                        top: `${Math.min(Math.max(hoveredPoint.y - 12, 5), 85)}%` 
                      }}
                      className="absolute z-30 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-2 rounded-xl shadow-xl pointer-events-none border border-slate-700 flex flex-col gap-0.5"
                    >
                      <div className="font-bold flex items-center gap-1.5 text-amber-300">
                        <Flame className="w-3.5 h-3.5 text-orange-400" />
                        <span>Click at ({hoveredPoint.x}%, {hoveredPoint.y}%)</span>
                      </div>
                      {hoveredPoint.text && (
                        <div className="text-slate-200">
                          Text: "{hoveredPoint.text}"
                        </div>
                      )}
                      {hoveredPoint.tag && (
                        <div className="text-slate-400 text-[10px] font-mono">
                          Element: &lt;{hoveredPoint.tag}&gt;
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Heatmap Legend Bar */}
            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-300">Heat Density:</span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Cold
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Warm
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Hot
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Hover any dot to inspect clicked button or element tag
              </span>
            </div>
          </div>

          {/* Top Clicked Elements Breakdown Table */}
          {sortedElements.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-orange-500" /> Top Clicked Elements on this Page
              </h3>
              <div className="divide-y divide-slate-100">
                {sortedElements.map(([label, el], idx) => {
                  const share = Math.round((el.count / activePoints.length) * 100);
                  return (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {el.text}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            Tag: &lt;{el.tag}&gt;
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
                          <div className="bg-orange-500 h-full rounded-full" style={{ width: `${share}%` }}></div>
                        </div>
                        <span className="text-xs font-extrabold text-slate-800 w-12 text-right">
                          {el.count} clicks
                        </span>
                        <span className="text-xs font-semibold text-slate-400 w-10 text-right">
                          {share}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}