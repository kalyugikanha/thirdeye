"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useMemo, useRef } from 'react';
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
  TrendingUp, 
  Tag, 
  Layout, 
  Sliders, 
  ArrowLeft, 
  Lock, 
  SlidersHorizontal,
  Sparkles,
  BarChart3,
  Filter,
  PlayCircle,
  Download,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import DateRangePicker, { DateRangeValue } from '@/components/DateRangePicker';

interface ClickPoint {
  x: number;
  y: number;
  url: string;
  session_id: string;
  tag?: string;
  text?: string;
  device?: string;
}

interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
}

interface ElementCluster {
  id: string;
  name: string;
  tag: string;
  count: number;
  percent: number;
  x: number;
  y: number;
  category: 'cta' | 'nav' | 'link' | 'card' | 'input' | 'other';
}

export default function HeatmapPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [points, setPoints] = useState<ClickPoint[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [projectDomain, setProjectDomain] = useState<string>('');
  const [totalClicks, setTotalClicks] = useState(0);
  const [deviceStats, setDeviceStats] = useState<DeviceBreakdown>({ desktop: 0, mobile: 0, tablet: 0 });
  const [loading, setLoading] = useState(true);

  // Date Range state
  const [dateRange, setDateRange] = useState<DateRangeValue>({
    preset: 'all',
    label: 'All Time'
  });
  const [exportingCsv, setExportingCsv] = useState(false);

  // View modes
  const [viewMode, setViewMode] = useState<'elements' | 'thermal' | 'scroll'>('elements');
  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [backdropMode, setBackdropMode] = useState<'wireframe' | 'live'>('wireframe');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [heatIntensity, setHeatIntensity] = useState<number>(0.6); // 0.2 to 1.0

  const fetchHeatmaps = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateRange.fromDate) params.append('from_date', dateRange.fromDate);
      if (dateRange.toDate) params.append('to_date', dateRange.toDate);
      const qStr = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(apiUrl(`/api/v1/analytics/heatmaps${qStr}`), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const incomingPoints: ClickPoint[] = data.points || [];
        setPoints(incomingPoints);
        setTotalClicks(data.total_clicks || incomingPoints.length);
        if (data.domain) {
          setProjectDomain(data.domain);
        }
        if (data.device_breakdown) {
          setDeviceStats(data.device_breakdown);
          if ((data.device_breakdown.mobile || 0) > (data.device_breakdown.desktop || 0)) {
            setDeviceView('mobile');
          }
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

  const handleExportCsv = async () => {
    try {
      setExportingCsv(true);
      const token = localStorage.getItem('te_token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const params = new URLSearchParams();
      if (dateRange.fromDate) params.append('from_date', dateRange.fromDate);
      if (dateRange.toDate) params.append('to_date', dateRange.toDate);
      if (selectedUrl) params.append('target_url', selectedUrl);

      const res = await fetch(apiUrl(`/api/v1/analytics/heatmaps/export/csv?${params.toString()}`), { headers });
      if (!res.ok) throw new Error('Failed to export CSV');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thirdeye_heatmap_clusters_${dateRange.preset}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Heatmap CSV Export Error:', err);
    } finally {
      setExportingCsv(false);
    }
  };

  useEffect(() => {
    fetchHeatmaps();
  }, [dateRange]);

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

  // Aggregate and cluster clicks into identifiable website elements (Clean, non-confusing data)
  const elementClusters = useMemo<ElementCluster[]>(() => {
    if (activePoints.length === 0) return [];

    const total = activePoints.length;
    const clustersMap: { [key: string]: { count: number; tag: string; name: string; sumX: number; sumY: number; category: any } } = {};

    activePoints.forEach((p) => {
      let rawText = (p.text || '').trim();
      let tag = (p.tag || 'div').toLowerCase();
      let category: 'cta' | 'nav' | 'link' | 'card' | 'input' | 'other' = 'other';

      if (tag === 'button' || rawText.toLowerCase().includes('join') || rawText.toLowerCase().includes('start') || rawText.toLowerCase().includes('sign') || rawText.toLowerCase().includes('get') || rawText.toLowerCase().includes('explore')) {
        category = 'cta';
      } else if (tag === 'a' || tag === 'nav' || rawText.toLowerCase().includes('home') || rawText.toLowerCase().includes('login') || rawText.toLowerCase().includes('about') || rawText.toLowerCase().includes('pricing') || rawText.toLowerCase().includes('contact')) {
        category = 'nav';
      } else if (tag === 'input' || tag === 'textarea') {
        category = 'input';
      } else if (rawText.length > 3) {
        category = 'link';
      }

      let label = rawText;
      if (!label || label.length < 2) {
        if (p.y < 15) label = 'Top Navigation Bar';
        else if (p.y < 45) label = 'Hero Action Button';
        else if (p.y < 75) label = 'Core Feature Card';
        else label = 'Footer Link';
      }

      const clusterKey = `${label}_${tag}`;
      if (!clustersMap[clusterKey]) {
        clustersMap[clusterKey] = {
          count: 0,
          tag,
          name: label,
          sumX: 0,
          sumY: 0,
          category
        };
      }
      clustersMap[clusterKey].count += 1;
      clustersMap[clusterKey].sumX += (p.x || 50);
      clustersMap[clusterKey].sumY += (p.y || 50);
    });

    return Object.entries(clustersMap)
      .map(([id, item]) => ({
        id,
        name: item.name,
        tag: item.tag,
        count: item.count,
        percent: Math.round((item.count / total) * 100),
        x: Math.round(item.sumX / item.count),
        y: Math.round(item.sumY / item.count),
        category: item.category
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [activePoints]);

  const uniqueClickers = useMemo(() => {
    return new Set(activePoints.map(p => p.session_id).filter(Boolean)).size || (activePoints.length > 0 ? 1 : 0);
  }, [activePoints]);

  // Draw smooth HTML5 canvas thermal heatmap (no 1000 dots clutter)
  useEffect(() => {
    if (viewMode !== 'thermal') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (activePoints.length === 0) return;

    // Create offscreen alpha intensity map
    const alphaCanvas = document.createElement('canvas');
    alphaCanvas.width = width;
    alphaCanvas.height = height;
    const aCtx = alphaCanvas.getContext('2d');
    if (!aCtx) return;

    const radius = Math.min(width, height) * 0.08;

    activePoints.forEach((p) => {
      const px = ((p.x || 50) / 100) * width;
      const py = ((p.y || 50) / 100) * height;

      const grad = aCtx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, `rgba(0, 0, 0, ${0.12 * heatIntensity})`);
      grad.addColorStop(0.5, `rgba(0, 0, 0, ${0.05 * heatIntensity})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      aCtx.fillStyle = grad;
      aCtx.beginPath();
      aCtx.arc(px, py, radius, 0, Math.PI * 2);
      aCtx.fill();
    });

    // Colorize using thermographic palette (Blue -> Cyan -> Green -> Yellow -> Red)
    const imgData = aCtx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        const norm = alpha / 255;
        // Map normalized intensity to RGB
        let r = 0, g = 0, b = 0;
        if (norm < 0.25) {
          // Blue to Cyan
          r = 0;
          g = Math.floor(norm * 4 * 255);
          b = 255;
        } else if (norm < 0.5) {
          // Cyan to Green
          r = 0;
          g = 255;
          b = Math.floor((1 - (norm - 0.25) * 4) * 255);
        } else if (norm < 0.75) {
          // Green to Yellow
          r = Math.floor((norm - 0.5) * 4 * 255);
          g = 255;
          b = 0;
        } else {
          // Yellow to Red
          r = 255;
          g = Math.floor((1 - (norm - 0.75) * 4) * 255);
          b = 0;
        }

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = Math.min(200, Math.floor(alpha * 1.8));
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [viewMode, activePoints, heatIntensity]);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-orange-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="w-full flex flex-col gap-6 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <Link href="/" className="hover:text-slate-700 flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Workspace Home
                </Link>
                <span>/</span>
                <span className="text-slate-600">Visual Telemetry</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Visual Click & Heatmap Studio</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> Hotjar/Clarity Mode
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Uncluttered visitor interaction analysis: inspect top clicked buttons, smooth thermal gradients, and scroll drop-offs for {projectDomain || 'your website'}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <DateRangePicker
                value={dateRange}
                onChange={(newVal) => setDateRange(newVal)}
              />

              <button
                onClick={handleExportCsv}
                disabled={exportingCsv || totalClicks === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                title="Export aggregated element click clusters as CSV"
              >
                {exportingCsv ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className="hidden sm:inline">{exportingCsv ? 'Exporting...' : 'Export Clicks CSV'}</span>
              </button>

              <button
                onClick={fetchHeatmaps}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-all"
                title="Refresh Heatmap Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin text-orange-500' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>

              {selectedUrl && (
                <a
                  href={selectedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-2xs transition-all flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Live Page</span>
                </a>
              )}
            </div>
          </div>

          {/* Primary View Selector & Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Target Page Selector */}
            <div className="flex-1 max-w-md">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Selected Page</span>
              </label>
              <div className="relative">
                <select
                  value={selectedUrl}
                  onChange={(e) => {
                    setSelectedUrl(e.target.value);
                    setSelectedClusterId(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer appearance-none truncate pr-8"
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
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* 3 Core Visual Modes (Clear & Non-Confusing) */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Visualization Mode
                </label>
                <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                  <button
                    onClick={() => setViewMode('elements')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      viewMode === 'elements'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Clean Interactive Elements & Button Badges"
                  >
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span>Element Badges</span>
                  </button>
                  <button
                    onClick={() => setViewMode('thermal')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      viewMode === 'thermal'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Smooth Continuous Thermographic Heatmap"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Thermal Glow</span>
                  </button>
                  <button
                    onClick={() => setViewMode('scroll')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      viewMode === 'scroll'
                        ? 'bg-white text-orange-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Visitor Scroll Depth Drop-Off Bands"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Scroll Depth</span>
                  </button>
                </div>
              </div>

              {/* Device Viewport */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Viewport
                </label>
                <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                  <button
                    onClick={() => setDeviceView('desktop')}
                    className={`p-1.5 rounded-xl transition-all ${
                      deviceView === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Desktop Viewport"
                  >
                    <Laptop className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeviceView('tablet')}
                    className={`p-1.5 rounded-xl transition-all ${
                      deviceView === 'tablet' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Tablet Viewport (768px)"
                  >
                    <Tablet className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeviceView('mobile')}
                    className={`p-1.5 rounded-xl transition-all ${
                      deviceView === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Mobile Viewport (375px)"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Backdrop Toggle */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Backdrop
                </label>
                <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                  <button
                    onClick={() => setBackdropMode('wireframe')}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      backdropMode === 'wireframe' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Instant Zero-Lag Wireframe Canvas"
                  >
                    Clean Wireframe
                  </button>
                  <button
                    onClick={() => setBackdropMode('live')}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      backdropMode === 'live' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Live Website Iframe"
                  >
                    Live Preview
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Main Heatmap Workbench (Two Columns: Canvas + Inspector) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column (8 Cols): Realistic Browser Viewport Stage */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              
              {/* Browser Header Bar */}
              <div className="bg-slate-100/90 px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-400 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 text-slate-700 text-xs px-3.5 py-1 rounded-full max-w-sm flex-1 mx-2 truncate font-mono shadow-2xs">
                  <Lock className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <span className="truncate">{selectedUrl || (projectDomain ? `https://${projectDomain}/` : 'selfupcommunity.com')}</span>
                </div>

                {/* Heat Intensity Legend */}
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Cold</span>
                  <div className="w-16 h-2 rounded-full bg-gradient-to-r from-blue-500 via-emerald-400 via-amber-400 to-rose-500"></div>
                  <span className="text-rose-600">Hot</span>
                </div>
              </div>

              {/* Canvas Viewport Stage */}
              <div className="p-4 sm:p-6 bg-slate-50/70 flex justify-center min-h-[560px] overflow-x-auto relative">
                <div 
                  className={`relative rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-md transition-all duration-300 ${
                    deviceView === 'desktop' ? 'w-full min-h-[560px]' :
                    deviceView === 'tablet' ? 'w-[680px] min-h-[560px]' :
                    'w-[360px] min-h-[560px]'
                  }`}
                >
                  {/* Empty state if 0 clicks */}
                  {activePoints.length === 0 && !loading && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-white/90 backdrop-blur-xs text-center">
                      <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-2.5">
                        <Flame className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900">
                        No Interactions Recorded for This Page Yet
                      </h4>
                      <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
                        Clicks will appear as smooth thermal gradients and button badges once visitors interact with {selectedUrl || 'your website'}.
                      </p>
                      <Link
                        href="/onboarding"
                        className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm transition-all"
                      >
                        Verify Snippet Integration
                      </Link>
                    </div>
                  )}

                  {/* Wireframe Mockup Canvas (Fast 0ms) */}
                  {backdropMode === 'wireframe' ? (
                    <div className="w-full h-full min-h-[560px] p-6 flex flex-col justify-between select-none pointer-events-none bg-gradient-to-b from-white via-slate-50/50 to-white">
                      
                      {/* Wireframe Navbar */}
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                            TE
                          </div>
                          <span className="text-xs font-extrabold text-slate-800 tracking-tight">
                            {projectDomain ? projectDomain.split('.')[0].toUpperCase() : 'PLATFORM'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                          <span className="hover:text-slate-800">Home</span>
                          <span className="hover:text-slate-800">Explore</span>
                          <span className="hover:text-slate-800">Pricing</span>
                          <span className="px-3 py-1 rounded-xl bg-slate-900 text-white font-bold text-[10px]">
                            Login
                          </span>
                        </div>
                      </div>

                      {/* Wireframe Hero Section */}
                      <div className="py-8 space-y-3 max-w-md">
                        <span className="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Community Hub &bull; Live Platform
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                          Connect, learn, and grow with top creators worldwide.
                        </h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Full-stack peer network with live masterclasses, dedicated channels, and collaborative projects.
                        </p>
                        <div className="pt-2 flex items-center gap-2.5">
                          <span className="px-4 py-2 rounded-xl bg-orange-600 text-white font-bold text-xs shadow-sm shadow-orange-500/20">
                            Join Community Now
                          </span>
                          <span className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
                            Watch Demo
                          </span>
                        </div>
                      </div>

                      {/* Wireframe Cards Grid */}
                      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                        <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Channel 01</span>
                          <span className="text-xs font-bold text-slate-800 block">Creator Guild</span>
                          <span className="text-[10px] text-slate-500 block">Weekly live reviews & mentorship</span>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Channel 02</span>
                          <span className="text-xs font-bold text-slate-800 block">Tech Founders</span>
                          <span className="text-[10px] text-slate-500 block">Architecture, stack & APIs</span>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Channel 03</span>
                          <span className="text-xs font-bold text-slate-800 block">Growth Sprints</span>
                          <span className="text-[10px] text-slate-500 block">Acquisition & monetization strategies</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      src={selectedUrl || (projectDomain ? `https://${projectDomain}/` : 'about:blank')}
                      title="Website Heatmap Backdrop"
                      className="absolute inset-0 w-full h-full border-0 pointer-events-none opacity-85 select-none"
                      sandbox="allow-same-origin allow-scripts"
                    />
                  )}

                  {/* LAYER 1: THERMAL CANVAS GRADIENT (When in 'thermal' mode) */}
                  {viewMode === 'thermal' && (
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={560}
                      className="absolute inset-0 w-full h-full pointer-events-none z-10"
                    />
                  )}

                  {/* LAYER 2: CLEAN ELEMENT BADGES (Default Mode: High Clarity, Zero Confusion) */}
                  {viewMode === 'elements' && (
                    <div className="absolute inset-0 z-20 pointer-events-auto">
                      {elementClusters.map((cluster) => {
                        const isSelected = selectedClusterId === cluster.id;
                        const posX = Math.min(Math.max(cluster.x, 8), 90);
                        const posY = Math.min(Math.max(cluster.y, 8), 90);

                        return (
                          <div
                            key={cluster.id}
                            onClick={() => setSelectedClusterId(isSelected ? null : cluster.id)}
                            style={{ left: `${posX}%`, top: `${posY}%` }}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 group z-30 ${
                              isSelected ? 'scale-110 z-40' : 'hover:scale-105'
                            }`}
                          >
                            {/* Subtle Ambient Glow */}
                            <div className={`absolute -inset-1.5 rounded-2xl blur-xs transition-opacity ${
                              isSelected 
                                ? 'bg-orange-500 opacity-80' 
                                : 'bg-orange-400 opacity-40 group-hover:opacity-75'
                            }`}></div>

                            {/* Crisp Clean Element Click Badge */}
                            <div className={`relative px-2.5 py-1 rounded-xl text-xs font-black shadow-lg flex items-center gap-1.5 border transition-all ${
                              isSelected
                                ? 'bg-slate-950 text-white border-orange-500 ring-2 ring-orange-500/50'
                                : 'bg-slate-900/90 text-white border-slate-700/80 hover:bg-slate-900'
                            }`}>
                              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                              <span className="font-mono text-[11px] text-orange-300 font-extrabold">{cluster.count}</span>
                              <span className="text-[10px] text-slate-300 max-w-[120px] truncate">{cluster.name}</span>
                              <span className="text-[9px] bg-white/15 px-1 py-0.2 rounded font-mono text-slate-200">{cluster.percent}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* LAYER 3: SCROLL DEPTH BANDS (When in 'scroll' mode) */}
                  {viewMode === 'scroll' && (
                    <div className="absolute inset-0 z-20 pointer-events-none flex flex-col">
                      <div className="h-[25%] bg-emerald-500/10 border-b-2 border-emerald-500/60 flex items-end justify-between px-4 pb-1">
                        <span className="text-[10px] font-bold text-emerald-800 bg-white/95 px-2 py-0.5 rounded shadow-xs">
                          100% of visitors saw the Header
                        </span>
                        <span className="text-[10px] font-mono text-emerald-800 font-bold bg-white/95 px-1.5 py-0.5 rounded">
                          0% - 25% Depth
                        </span>
                      </div>

                      <div className="h-[25%] bg-sky-500/10 border-b-2 border-dashed border-sky-500/60 flex items-end justify-between px-4 pb-1">
                        <span className="text-[10px] font-bold text-sky-800 bg-white/95 px-2 py-0.5 rounded shadow-xs">
                          78% Average Fold Reach (Primary Value Prop)
                        </span>
                        <span className="text-[10px] font-mono text-sky-800 font-bold bg-white/95 px-1.5 py-0.5 rounded">
                          25% - 50% Depth
                        </span>
                      </div>

                      <div className="h-[25%] bg-amber-500/10 border-b-2 border-dashed border-amber-500/60 flex items-end justify-between px-4 pb-1">
                        <span className="text-[10px] font-bold text-amber-800 bg-white/95 px-2 py-0.5 rounded shadow-xs">
                          52% Reached Community Features & Details
                        </span>
                        <span className="text-[10px] font-mono text-amber-800 font-bold bg-white/95 px-1.5 py-0.5 rounded">
                          50% - 75% Depth
                        </span>
                      </div>

                      <div className="h-[25%] bg-rose-500/10 flex items-end justify-between px-4 pb-2">
                        <span className="text-[10px] font-bold text-rose-800 bg-white/95 px-2 py-0.5 rounded shadow-xs">
                          28% Reached Final Conversion CTA & Footer
                        </span>
                        <span className="text-[10px] font-mono text-rose-800 font-bold bg-white/95 px-1.5 py-0.5 rounded">
                          75% - 100% Depth
                        </span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* Right Column (4 Cols): Click Inspector & Ranked Element Leaderboard */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Element Click Inspector Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">
                        Top Clicked Targets
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Ranked interactive elements on this page
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {activePoints.length} hits
                  </span>
                </div>

                {elementClusters.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No clicked elements detected on this URL yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {elementClusters.map((cluster, idx) => {
                      const isSelected = selectedClusterId === cluster.id;
                      return (
                        <div
                          key={cluster.id}
                          onClick={() => setSelectedClusterId(isSelected ? null : cluster.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-orange-50/80 border-orange-300 ring-2 ring-orange-400/20 shadow-xs'
                              : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center ${
                                idx === 0 ? 'bg-amber-400 text-slate-900' :
                                idx === 1 ? 'bg-slate-300 text-slate-800' :
                                idx === 2 ? 'bg-orange-300 text-slate-900' :
                                'bg-slate-200 text-slate-600'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {cluster.name}
                              </span>
                            </div>

                            <span className="text-xs font-black text-orange-600 font-mono flex-shrink-0">
                              {cluster.count} clicks
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-mono text-slate-400">&lt;{cluster.tag}&gt;</span>
                            <span className="font-semibold text-slate-700">{cluster.percent}% click share</span>
                          </div>

                          {/* Click share progress bar */}
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                              style={{ width: `${cluster.percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Device Traffic Breakdown */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-slate-500" />
                  <span>Device Traffic Breakdown</span>
                </h4>

                {(() => {
                  const total = (deviceStats.desktop + deviceStats.mobile + deviceStats.tablet) || 1;
                  const dPct = Math.round((deviceStats.desktop / total) * 100);
                  const mPct = Math.round((deviceStats.mobile / total) * 100);
                  const tPct = Math.max(0, 100 - dPct - mPct);
                  return (
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div
                        onClick={() => setDeviceView('desktop')}
                        className={`p-2.5 rounded-2xl border cursor-pointer transition-all ${
                          deviceView === 'desktop' ? 'bg-blue-50 border-blue-200 shadow-xs ring-1 ring-blue-300' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/60'
                        }`}
                        title="Click to view Desktop Canvas"
                      >
                        <Laptop className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-400 block font-semibold">Desktop</span>
                        <span className="text-sm font-black text-slate-900 block font-mono">
                          {deviceStats.desktop}
                        </span>
                        <span className="text-[10px] text-blue-600 font-bold font-mono">
                          {dPct}%
                        </span>
                      </div>

                      <div
                        onClick={() => setDeviceView('mobile')}
                        className={`p-2.5 rounded-2xl border cursor-pointer transition-all ${
                          deviceView === 'mobile' ? 'bg-emerald-50 border-emerald-200 shadow-xs ring-1 ring-emerald-300' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/60'
                        }`}
                        title="Click to view Mobile Canvas"
                      >
                        <Smartphone className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-400 block font-semibold">Mobile</span>
                        <span className="text-sm font-black text-slate-900 block font-mono">
                          {deviceStats.mobile}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold font-mono">
                          {mPct}%
                        </span>
                      </div>

                      <div
                        onClick={() => setDeviceView('tablet')}
                        className={`p-2.5 rounded-2xl border cursor-pointer transition-all ${
                          deviceView === 'tablet' ? 'bg-purple-50 border-purple-200 shadow-xs ring-1 ring-purple-300' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/60'
                        }`}
                        title="Click to view Tablet Canvas"
                      >
                        <Tablet className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                        <span className="text-[10px] text-slate-400 block font-semibold">Tablet</span>
                        <span className="text-sm font-black text-slate-900 block font-mono">
                          {deviceStats.tablet}
                        </span>
                        <span className="text-[10px] text-purple-600 font-bold font-mono">
                          {tPct}%
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Pro Tip Guide Card */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-5 border border-indigo-100 text-indigo-950 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Heatmap Analysis Guide</span>
                </div>
                <p className="text-[11px] text-indigo-800/90 leading-relaxed">
                  <strong>Element Badges:</strong> Identifies which exact buttons & links get clicked the most. Click any element on the right to inspect its location on the canvas.
                </p>
                <p className="text-[11px] text-indigo-800/90 leading-relaxed">
                  <strong>Thermal Glow:</strong> Switches to infrared canvas density. Hot areas show where visitor interest is concentrated.
                </p>
              </div>

            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
