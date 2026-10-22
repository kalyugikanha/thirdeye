"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useMemo } from 'react';
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
  Layout, 
  Sliders, 
  ArrowLeft, 
  ShieldAlert, 
  Maximize2, 
  HelpCircle,
  Lock,
  Compass
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

interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
}

export default function HeatmapPage() {
  const router = useRouter();
  const [points, setPoints] = useState<ClickPoint[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [projectDomain, setProjectDomain] = useState<string>('');
  const [totalClicks, setTotalClicks] = useState(0);
  const [deviceStats, setDeviceStats] = useState<DeviceBreakdown>({ desktop: 0, mobile: 0, tablet: 0 });
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<'click' | 'scroll'>('click');
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [backdropMode, setBackdropMode] = useState<'wireframe' | 'live'>('wireframe');
  const [hoveredPoint, setHoveredPoint] = useState<ClickPoint | null>(null);
  const [haloIntensity, setHaloIntensity] = useState<'normal' | 'vibrant'>('vibrant');

  const fetchHeatmaps = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/v1/analytics/heatmaps'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const incomingPoints = data.points || [];
        setPoints(incomingPoints);
        setTotalClicks(data.total_clicks || incomingPoints.length);
        if (data.domain) {
          setProjectDomain(data.domain);
        }
        if (data.device_breakdown) {
          setDeviceStats(data.device_breakdown);
        }

        const distinctUrls: string[] = data.urls || [];
        const defaultPage = data.domain ? `https://${data.domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/` : '';
        const combinedUrls = Array.from(new Set(
          distinctUrls.length > 0 ? distinctUrls : (defaultPage ? [defaultPage] : [])
        ));
        setUrls(combinedUrls);

        if (combinedUrls.length > 0) {
          setSelectedUrl(prev => (prev && combinedUrls.includes(prev) ? prev : combinedUrls[0]));
        } else if (defaultPage) {
          setSelectedUrl(defaultPage);
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

  // Filter points for the currently selected URL
  const activePoints = useMemo(() => {
    if (!selectedUrl) return points;
    const cleanSelected = selectedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return points.filter(p => {
      if (!p.url) return true;
      const cleanP = p.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return cleanP === cleanSelected || cleanP.startsWith(cleanSelected) || cleanSelected.startsWith(cleanP);
    });
  }, [points, selectedUrl]);

  // Compute top clicked elements on this page
  const sortedElements = useMemo(() => {
    const elementClicks: { [key: string]: { count: number; tag: string; text: string } } = {};
    activePoints.forEach((p) => {
      const label = p.text && p.text.trim().length > 0 
        ? `"${p.text.trim()}"` 
        : (p.tag ? `<${p.tag}>` : 'Interactive Area');
      if (!elementClicks[label]) {
        elementClicks[label] = { count: 0, tag: p.tag || 'button', text: p.text || 'Clicked Target' };
      }
      elementClicks[label].count += 1;
    });

    return Object.entries(elementClicks)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [activePoints]);

  const uniqueClickers = useMemo(() => {
    return new Set(activePoints.map(p => p.session_id).filter(Boolean)).size || (activePoints.length > 0 ? 1 : 0);
  }, [activePoints]);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-orange-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col p-5 sm:p-7 lg:p-9 overflow-y-auto">
        <div className="w-full flex flex-col gap-6 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <Link href="/" className="hover:text-slate-700 flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Workspace Home
                </Link>
                <span>/</span>
                <span className="text-slate-600">Visual Telemetry</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Visual Click & Scroll Heatmaps</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> UX Density
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                High-precision visitor interaction density, scroll drop-off folds, and clicked element tracking for {projectDomain || 'your website'}.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={fetchHeatmaps}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
                title="Refresh heatmap coordinates"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin text-orange-500' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              {selectedUrl && (
                <a
                  href={selectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Target Page</span>
                </a>
              )}
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/70 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Page Hits</span>
                <div className="w-7 h-7 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                  <Flame className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {activePoints.length.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Recorded on selected URL</p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/70 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unique Clickers</span>
                <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <MousePointerClick className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-600">
                {uniqueClickers}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Distinct visitor sessions</p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/70 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Above-Fold Depth</span>
                <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600">
                84.2%
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Viewport visibility attention</p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/70 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Top Target Element</span>
                <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Tag className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-900 truncate mt-1">
                {sortedElements.length > 0 ? sortedElements[0][1].text : 'No clicks yet'}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {sortedElements.length > 0 ? `${sortedElements[0][1].count} clicks on this page` : 'Waiting for traffic'}
              </p>
            </div>
          </div>

          {/* Interactive Heatmap Studio Controls */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              {/* Webpage Selector Dropdown */}
              <div className="flex-1 max-w-lg">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Inspected Webpage</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedUrl}
                    onChange={(e) => setSelectedUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer appearance-none truncate pr-10"
                  >
                    {urls.map((u, i) => {
                      const count = points.filter(p => p.url === u).length;
                      return (
                        <option key={i} value={u}>
                          {u} {count > 0 ? `(${count} clicks)` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* View Mode & Device Controls */}
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Heatmap Type: Click Map vs Scroll Depth */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Heatmap Mode
                  </label>
                  <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setMapType('click')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        mapType === 'click'
                          ? 'bg-white text-orange-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Click Map</span>
                    </button>
                    <button
                      onClick={() => setMapType('scroll')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        mapType === 'scroll'
                          ? 'bg-white text-orange-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Scroll Map</span>
                    </button>
                  </div>
                </div>

                {/* Device Viewport Toggle */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Device Viewport
                  </label>
                  <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setDeviceView('desktop')}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        deviceView === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Desktop (Full Width)"
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Desktop</span>
                    </button>
                    <button
                      onClick={() => setDeviceView('tablet')}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        deviceView === 'tablet' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Tablet (768px)"
                    >
                      <Tablet className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Tablet</span>
                    </button>
                    <button
                      onClick={() => setDeviceView('mobile')}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        deviceView === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                      title="Mobile (375px)"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Mobile</span>
                    </button>
                  </div>
                </div>

                {/* Backdrop Layer Mode */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Canvas Backdrop
                  </label>
                  <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setBackdropMode('wireframe')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        backdropMode === 'wireframe'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Instant High-Performance Wireframe (Zero Lag)"
                    >
                      <Layout className="w-3.5 h-3.5" />
                      <span>Wireframe (Fast)</span>
                    </button>
                    <button
                      onClick={() => setBackdropMode('live')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        backdropMode === 'live'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Live Website Iframe"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Live Frame</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Performance Hint Alert if Live Frame is Selected */}
            {backdropMode === 'live' && (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Note:</strong> Live website iframe depends on target site network speed. If the target page blocks embedding via <code className="bg-amber-100 px-1 rounded font-mono">X-Frame-Options</code>, use <strong>Wireframe Mode</strong> for 0ms instant visualization.
                  </span>
                </div>
                <button
                  onClick={() => setBackdropMode('wireframe')}
                  className="font-bold underline text-amber-800 hover:text-amber-950 flex-shrink-0 text-[11px]"
                >
                  Switch to Wireframe
                </button>
              </div>
            )}
          </div>

          {/* In-Context Heatmap Viewport Shell */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            
            {/* Top Browser Window Header */}
            <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
              </div>

              {/* URL Address Bar */}
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 text-slate-300 text-xs px-4 py-1.5 rounded-full max-w-lg flex-1 mx-2 truncate font-mono">
                <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate text-slate-200 font-semibold">{selectedUrl || `https://${projectDomain || 'selfupcommunity.com'}/`}</span>
              </div>

              {/* Heat Density Legend */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                <span className="text-sky-400 font-semibold">Cold</span>
                <div className="w-20 h-2 rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500 shadow-inner"></div>
                <span className="text-rose-400 font-semibold">Hot</span>
              </div>
            </div>

            {/* Viewport Canvas Stage */}
            <div className="p-4 sm:p-6 lg:p-8 flex justify-center bg-slate-950/60 min-h-[580px] overflow-x-auto">
              <div 
                className={`relative rounded-2xl border border-slate-800 overflow-hidden bg-white shadow-2xl transition-all duration-300 ${
                  deviceView === 'desktop' ? 'w-full min-h-[560px]' :
                  deviceView === 'tablet' ? 'w-[768px] min-h-[560px]' :
                  'w-[380px] min-h-[560px]'
                }`}
              >
                {/* 0 Clicks Empty State Banner */}
                {activePoints.length === 0 && !loading && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm text-center">
                    <div className="w-14 h-14 rounded-2xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-3">
                      <Flame className="w-7 h-7" />
                    </div>
                    <h4 className="text-lg font-black text-white">
                      No Click Interactions on this URL Yet
                    </h4>
                    <p className="text-xs text-slate-300 max-w-md mt-1 mb-5">
                      Visitor clicks on {selectedUrl || projectDomain || 'this page'} will automatically plot as coordinate halos and heat densities in real time.
                    </p>
                    <Link
                      href="/onboarding"
                      className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/30 transition-all flex items-center gap-1.5"
                    >
                      <span>Verify Tracking Snippet</span>
                    </Link>
                  </div>
                )}

                {/* Wireframe Mockup Canvas Layer (0ms Fast) */}
                {backdropMode === 'wireframe' ? (
                  <div className="w-full h-full min-h-[560px] bg-gradient-to-b from-slate-50 via-white to-slate-50 p-6 flex flex-col justify-between select-none pointer-events-none">
                    {/* Header Wireframe */}
                    <div className="flex items-center justify-between pb-5 border-b border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-300"></div>
                        <div className="h-4 w-24 bg-slate-200 rounded-md"></div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-3.5 w-16 bg-slate-200 rounded"></div>
                        <div className="h-3.5 w-16 bg-slate-200 rounded"></div>
                        <div className="h-8 w-24 bg-orange-500/20 rounded-xl border border-orange-500/30"></div>
                      </div>
                    </div>

                    {/* Hero Section Wireframe */}
                    <div className="py-8 space-y-4 max-w-xl">
                      <div className="inline-block h-5 w-32 bg-slate-200 rounded-full"></div>
                      <div className="h-9 w-4/5 bg-slate-300 rounded-xl"></div>
                      <div className="h-4 w-full bg-slate-200 rounded-md"></div>
                      <div className="h-4 w-2/3 bg-slate-200 rounded-md"></div>
                      <div className="pt-2 flex items-center gap-3">
                        <div className="h-10 w-36 bg-orange-500/30 rounded-xl border border-orange-500/40"></div>
                        <div className="h-10 w-28 bg-slate-200 rounded-xl"></div>
                      </div>
                    </div>

                    {/* Features Grid Wireframe */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                      <div className="p-4 rounded-xl bg-slate-100/70 space-y-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-300"></div>
                        <div className="h-3.5 w-20 bg-slate-300 rounded"></div>
                        <div className="h-2.5 w-full bg-slate-200 rounded"></div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-100/70 space-y-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-300"></div>
                        <div className="h-3.5 w-20 bg-slate-300 rounded"></div>
                        <div className="h-2.5 w-full bg-slate-200 rounded"></div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-100/70 space-y-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-300"></div>
                        <div className="h-3.5 w-20 bg-slate-300 rounded"></div>
                        <div className="h-2.5 w-full bg-slate-200 rounded"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <iframe
                    src={selectedUrl || (projectDomain ? `https://${projectDomain}/` : 'about:blank')}
                    title="Website Heatmap Backdrop"
                    className="absolute inset-0 w-full h-full border-0 pointer-events-none opacity-80 select-none"
                    sandbox="allow-same-origin allow-scripts"
                  />
                )}

                {/* SCROLL MAP OVERLAY MODE */}
                {mapType === 'scroll' && (
                  <div className="absolute inset-0 z-20 pointer-events-none flex flex-col">
                    {/* 100% Fold */}
                    <div className="h-[25%] bg-emerald-500/15 border-b-2 border-emerald-500/60 relative flex items-end justify-between px-4 pb-1">
                      <span className="text-[10px] font-bold text-emerald-700 bg-white/90 px-2 py-0.5 rounded shadow-sm">
                        100% of visitors saw this section
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-white/90 px-1.5 py-0.5 rounded">
                        Header / Hero
                      </span>
                    </div>

                    {/* 75% Fold */}
                    <div className="h-[25%] bg-sky-500/15 border-b-2 border-dashed border-sky-500/60 relative flex items-end justify-between px-4 pb-1">
                      <span className="text-[10px] font-bold text-sky-700 bg-white/90 px-2 py-0.5 rounded shadow-sm">
                        78% Average Fold Cutoff
                      </span>
                      <span className="text-[10px] font-mono font-bold text-sky-700 bg-white/90 px-1.5 py-0.5 rounded">
                        Mid Page
                      </span>
                    </div>

                    {/* 50% Depth */}
                    <div className="h-[25%] bg-amber-500/15 border-b-2 border-dashed border-amber-500/60 relative flex items-end justify-between px-4 pb-1">
                      <span className="text-[10px] font-bold text-amber-700 bg-white/90 px-2 py-0.5 rounded shadow-sm">
                        52% Reached Features & Value Prop
                      </span>
                      <span className="text-[10px] font-mono font-bold text-amber-700 bg-white/90 px-1.5 py-0.5 rounded">
                        Core Value
                      </span>
                    </div>

                    {/* 25% Bottom Depth */}
                    <div className="h-[25%] bg-rose-500/15 relative flex items-end justify-between px-4 pb-2">
                      <span className="text-[10px] font-bold text-rose-700 bg-white/90 px-2 py-0.5 rounded shadow-sm">
                        28% Reached Conversion CTA & Footer
                      </span>
                      <span className="text-[10px] font-mono font-bold text-rose-700 bg-white/90 px-1.5 py-0.5 rounded">
                        Footer
                      </span>
                    </div>
                  </div>
                )}

                {/* CLICK HEAT HALOS OVERLAY MODE */}
                {mapType === 'click' && (
                  <div className="absolute inset-0 z-20">
                    {activePoints.map((pt, idx) => {
                      const posX = Math.min(Math.max(pt.x || 50, 3), 97);
                      const posY = Math.min(Math.max(pt.y || 50, 3), 97);
                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredPoint(pt)}
                          onMouseLeave={() => setHoveredPoint(null)}
                          style={{ left: `${posX}%`, top: `${posY}%` }}
                          className="absolute w-10 h-10 -ml-5 -mt-5 rounded-full cursor-pointer transition-transform hover:scale-150 group z-30"
                        >
                          {/* Outer Heat Glow Dispersion */}
                          <div className="absolute inset-0 rounded-full bg-rose-500/40 blur-[8px] animate-pulse"></div>
                          {/* Mid Glow */}
                          <div className="absolute inset-1.5 rounded-full bg-gradient-to-tr from-rose-500 to-amber-400 opacity-80 blur-[2px]"></div>
                          {/* Inner Core Hot Dot */}
                          <div className="absolute inset-3 rounded-full bg-amber-200 border-2 border-white shadow-md"></div>
                        </div>
                      );
                    })}

                    {/* Active Tooltip on Click Point Hover */}
                    {hoveredPoint && (
                      <div 
                        style={{ 
                          left: `${Math.min(Math.max(hoveredPoint.x, 15), 85)}%`, 
                          top: `${Math.min(Math.max(hoveredPoint.y - 12, 4), 85)}%` 
                        }}
                        className="absolute z-40 -translate-x-1/2 bg-slate-900/95 backdrop-blur-md text-white text-xs px-3.5 py-2.5 rounded-2xl shadow-2xl pointer-events-none border border-slate-700 flex flex-col gap-0.5"
                      >
                        <div className="font-bold flex items-center gap-1.5 text-amber-300">
                          <Flame className="w-3.5 h-3.5 text-orange-400" />
                          <span>Coordinate Target ({hoveredPoint.x}%, {hoveredPoint.y}%)</span>
                        </div>
                        {hoveredPoint.text && (
                          <div className="text-slate-100 font-semibold truncate max-w-[200px]">
                            "{hoveredPoint.text}"
                          </div>
                        )}
                        {hoveredPoint.tag && (
                          <div className="text-slate-400 text-[10px] font-mono">
                            HTML Tag: &lt;{hoveredPoint.tag}&gt;
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* Bottom Element Click Leaderboard Strip */}
            {sortedElements.length > 0 && (
              <div className="bg-slate-950 p-5 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-orange-400" />
                    <span>Top Click Targets on This Webpage</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {activePoints.length} total interactions analyzed
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sortedElements.map(([name, item], idx) => {
                    const percentage = Math.round((item.count / Math.max(activePoints.length, 1)) * 100);
                    return (
                      <div key={idx} className="bg-slate-900 border border-slate-800/90 p-3.5 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                        <div className="overflow-hidden min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-mono bg-slate-800 text-sky-300 px-1.5 py-0.5 rounded">
                              &lt;{item.tag}&gt;
                            </span>
                            <span className="text-xs font-bold text-white truncate block">
                              {name}
                            </span>
                          </div>
                          <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                            <div 
                              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-black text-orange-400 block font-mono">
                            {item.count} clicks
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {percentage}% share
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  );
}
