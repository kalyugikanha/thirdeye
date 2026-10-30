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
  Loader2,
  AlertOctagon,
  HelpCircle,
  MoveVertical,
  Target,
  ShieldAlert,
  Zap
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
  is_rage?: boolean;
  is_dead?: boolean;
}

interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
}

interface FrustrationSummary {
  rage_clicks: number;
  dead_clicks: number;
  frustration_rate: number;
}

interface ScrollDepthStats {
  reach_25: number;
  reach_50: number;
  reach_75: number;
  reach_100: number;
  falloff_curve: number[];
}

interface ElementCluster {
  id: string;
  name: string;
  tag: string;
  count: number;
  rageCount: number;
  deadCount: number;
  percent: number;
  x: number;
  y: number;
  category: 'cta' | 'nav' | 'link' | 'card' | 'input' | 'other';
}

export default function HeatmapPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const [points, setPoints] = useState<ClickPoint[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [projectDomain, setProjectDomain] = useState<string>('');
  const [totalClicks, setTotalClicks] = useState(0);
  const [deviceStats, setDeviceStats] = useState<DeviceBreakdown>({ desktop: 0, mobile: 0, tablet: 0 });
  const [frustrationStats, setFrustrationStats] = useState<FrustrationSummary>({ rage_clicks: 0, dead_clicks: 0, frustration_rate: 0 });
  const [scrollDepthStats, setScrollDepthStats] = useState<ScrollDepthStats>({
    reach_25: 78,
    reach_50: 52,
    reach_75: 28,
    reach_100: 12,
    falloff_curve: [100, 92, 84, 75, 62, 52, 41, 28, 19, 12, 6]
  });
  const [scrollDepthByUrl, setScrollDepthByUrl] = useState<Record<string, ScrollDepthStats>>({});
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
  const [interactionFilter, setInteractionFilter] = useState<'all' | 'rage' | 'dead'>('all');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [heatIntensity, setHeatIntensity] = useState<number>(0.6); // 0.2 to 1.0

  // Interactive Ruler
  const [rulerY, setRulerY] = useState<number | null>(null);

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
        if (data.frustration_summary) {
          setFrustrationStats(data.frustration_summary);
        }
        if (data.scroll_depth_stats) {
          setScrollDepthStats(data.scroll_depth_stats);
        }
        if (data.scroll_depth_by_url) {
          setScrollDepthByUrl(data.scroll_depth_by_url);
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

  // Points for currently selected URL
  const urlPoints = useMemo(() => {
    if (!selectedUrl) return points;
    const cleanSelected = selectedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return points.filter(p => {
      if (!p.url) return true;
      const cleanP = p.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return cleanP === cleanSelected || cleanP.startsWith(cleanSelected) || cleanSelected.startsWith(cleanP);
    });
  }, [points, selectedUrl]);

  // Active Points considering device viewport & frustration filters
  const activePoints = useMemo(() => {
    let pts = urlPoints;
    if (deviceView === 'mobile') {
      const mobPts = pts.filter(p => p.device === 'mobile');
      if (mobPts.length > 0) pts = mobPts;
    } else if (deviceView === 'tablet') {
      const tabPts = pts.filter(p => p.device === 'tablet');
      if (tabPts.length > 0) pts = tabPts;
    } else {
      const deskPts = pts.filter(p => p.device !== 'mobile' && p.device !== 'tablet');
      if (deskPts.length > 0) pts = deskPts;
    }

    if (interactionFilter === 'rage') {
      return pts.filter(p => p.is_rage);
    }
    if (interactionFilter === 'dead') {
      return pts.filter(p => p.is_dead);
    }
    return pts;
  }, [urlPoints, deviceView, interactionFilter]);

  // Specific counts for this URL
  const urlRageCount = useMemo(() => urlPoints.filter(p => p.is_rage).length, [urlPoints]);
  const urlDeadCount = useMemo(() => urlPoints.filter(p => p.is_dead).length, [urlPoints]);

  // Active scroll stats for selected URL
  const currentScrollStats = useMemo<ScrollDepthStats>(() => {
    if (!selectedUrl) return scrollDepthStats;
    const cleanU = selectedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    for (const [k, v] of Object.entries(scrollDepthByUrl)) {
      const cleanK = k.replace(/^https?:\/\//, '').replace(/\/$/, '');
      if (cleanK === cleanU || cleanU.startsWith(cleanK)) return v;
    }
    return scrollDepthStats;
  }, [selectedUrl, scrollDepthByUrl, scrollDepthStats]);

  // Interpolate retention at any percentage for the interactive laser ruler
  const getRetentionAtPct = (pct: number) => {
    const curve = currentScrollStats.falloff_curve || [100, 92, 84, 75, 62, 52, 41, 28, 19, 12, 6];
    const index = Math.floor(pct / 10);
    if (index >= 10) return curve[10] || 6;
    const rem = (pct % 10) / 10;
    const startVal = curve[index];
    const endVal = curve[index + 1];
    return Math.round(startVal - (startVal - endVal) * rem);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (viewMode !== 'scroll' || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const clientY = e.clientY - rect.top;
    const pct = Math.max(0, Math.min(100, (clientY / rect.height) * 100));
    setRulerY(pct);
  };

  // Aggregate and cluster clicks into identifiable website elements
  const elementClusters = useMemo<ElementCluster[]>(() => {
    if (activePoints.length === 0) return [];

    const total = activePoints.length;
    const clustersMap: { [key: string]: { count: number; rageCount: number; deadCount: number; tag: string; name: string; sumX: number; sumY: number; category: any } } = {};

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
          rageCount: 0,
          deadCount: 0,
          tag,
          name: label,
          sumX: 0,
          sumY: 0,
          category
        };
      }
      clustersMap[clusterKey].count += 1;
      if (p.is_rage) clustersMap[clusterKey].rageCount += 1;
      if (p.is_dead) clustersMap[clusterKey].deadCount += 1;
      clustersMap[clusterKey].sumX += (p.x || 50);
      clustersMap[clusterKey].sumY += (p.y || 50);
    });

    return Object.entries(clustersMap)
      .map(([id, item]) => ({
        id,
        name: item.name,
        tag: item.tag,
        count: item.count,
        rageCount: item.rageCount,
        deadCount: item.deadCount,
        percent: Math.round((item.count / total) * 100),
        x: Math.round(item.sumX / item.count),
        y: Math.round(item.sumY / item.count),
        category: item.category
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [activePoints]);

  // Smooth thermographic canvas gradient
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

    const imgData = aCtx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        const norm = alpha / 255;
        let r = 0, g = 0, b = 0;
        if (norm < 0.25) {
          r = 0;
          g = Math.floor(norm * 4 * 255);
          b = 255;
        } else if (norm < 0.5) {
          r = 0;
          g = 255;
          b = Math.floor((1 - (norm - 0.25) * 4) * 255);
        } else if (norm < 0.75) {
          r = Math.floor((norm - 0.5) * 4 * 255);
          g = 255;
          b = 0;
        } else {
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
                <span>Visual Click &amp; Heatmap Studio</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> Hotjar/Clarity Grade
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Uncluttered visitor interaction analysis: inspect top clicked buttons, realistic smartphone touch radiance, dynamic scroll reach, and frustration rage clicks for {projectDomain || 'your website'}.
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

          {/* Primary View Selector & Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
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
                        {u} {count > 0 ? `(${count} interactions)` : ''}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* 3 Core Visual Modes */}
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
                        ? 'bg-white text-orange-600 shadow-xs'
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
                        ? 'bg-white text-orange-600 shadow-xs'
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
                        ? 'bg-white text-orange-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Visitor Scroll Depth Drop-Off Bands & Laser Ruler"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Scroll Depth &amp; Reach</span>
                  </button>
                </div>
              </div>

              {/* Device Viewport Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Viewport Frame
                </label>
                <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                  <button
                    onClick={() => setDeviceView('desktop')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      deviceView === 'desktop' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Desktop Full-Width"
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    onClick={() => setDeviceView('tablet')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      deviceView === 'tablet' ? 'bg-white text-purple-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Tablet Viewport (768px)"
                  >
                    <Tablet className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tablet</span>
                  </button>
                  <button
                    onClick={() => setDeviceView('mobile')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      deviceView === 'mobile' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Authentic Mobile Chassis (390px)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mobile 390px</span>
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
                      backdropMode === 'wireframe' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Instant Zero-Lag Wireframe Canvas"
                  >
                    Wireframe
                  </button>
                  <button
                    onClick={() => setBackdropMode('live')}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      backdropMode === 'live' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Live Website Iframe"
                  >
                    Live
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Frustration & Friction Filter Bar */}
          <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-orange-400">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white">Interaction &amp; Friction Telemetry</h3>
                  <span className="text-[10px] font-mono uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-bold">
                    {frustrationStats.frustration_rate}% Friction Rate
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Filter heatmap points to isolate rage clicks and dead touch points.
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setInteractionFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  interactionFilter === 'all'
                    ? 'bg-white text-slate-950 shadow-md ring-2 ring-white/50'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                <MousePointerClick className="w-3.5 h-3.5" />
                <span>All Interactions ({urlPoints.length})</span>
              </button>

              <button
                onClick={() => setInteractionFilter('rage')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  interactionFilter === 'rage'
                    ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-400'
                    : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping inline-block" />
                <span>Rage Clicks ({urlRageCount})</span>
              </button>

              <button
                onClick={() => setInteractionFilter('dead')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  interactionFilter === 'dead'
                    ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Dead Taps ({urlDeadCount})</span>
              </button>
            </div>
          </div>

          {/* Main Heatmap Workbench (Two Columns: Canvas Stage + Inspector) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column (8 Cols): Viewport Stage */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              
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
              <div className="p-4 sm:p-6 bg-slate-50/70 flex justify-center min-h-[580px] overflow-x-auto relative">
                
                {/* 1. AUTHENTIC MOBILE CHASSIS (Rendered when deviceView === 'mobile') */}
                {deviceView === 'mobile' ? (
                  <div className="relative w-[380px] bg-slate-900 p-3.5 rounded-[52px] shadow-2xl border-4 border-slate-700/80 ring-1 ring-white/10 select-none flex flex-col">
                    {/* Phone Hardware Side Buttons */}
                    <div className="absolute -left-[6px] top-24 w-1.5 h-10 bg-slate-700 rounded-l-sm" />
                    <div className="absolute -left-[6px] top-38 w-1.5 h-12 bg-slate-700 rounded-l-sm" />
                    <div className="absolute -left-[6px] top-54 w-1.5 h-12 bg-slate-700 rounded-l-sm" />
                    <div className="absolute -right-[6px] top-32 w-1.5 h-16 bg-slate-700 rounded-r-sm" />

                    {/* Smartphone Screen Display */}
                    <div 
                      ref={canvasContainerRef}
                      className="relative w-full min-h-[640px] rounded-[42px] overflow-hidden bg-white flex flex-col shadow-inner"
                    >
                      {/* Dynamic Island / Notch */}
                      <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-40 flex items-center justify-between px-2.5 shadow-md pointer-events-none">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                          <div className="w-1 h-1 rounded-full bg-blue-900/60" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold text-emerald-400">5G</span>
                          <div className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse" />
                        </div>
                      </div>

                      {/* Backdrop Content */}
                      {backdropMode === 'wireframe' ? (
                        <div className="w-full h-full min-h-[640px] p-5 pt-12 flex flex-col justify-between select-none pointer-events-none bg-gradient-to-b from-white via-slate-50/50 to-white">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                              <span className="text-xs font-black tracking-tight text-slate-900">
                                {projectDomain ? projectDomain.split('.')[0].toUpperCase() : 'SELFUP'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700">
                                Mobile App
                              </span>
                            </div>
                            <div className="pt-2 space-y-2">
                              <span className="inline-block text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase">
                                Trending Masterclasses
                              </span>
                              <h2 className="text-base font-black text-slate-900 leading-tight">
                                Build Skills, Build Confidence.
                              </h2>
                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                Join 14,000+ creators and engineers mastering full-stack tech.
                              </p>
                              <div className="pt-1 flex flex-col gap-1.5">
                                <span className="w-full py-2 rounded-xl bg-orange-600 text-white font-bold text-xs text-center shadow-xs">
                                  Explore Courses Now
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2 pt-4 border-t border-slate-100">
                            <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1">
                              <span className="text-[10px] font-bold text-slate-800 block">Full-Stack MERN Sprint</span>
                              <span className="text-[9px] text-slate-500 block">12 live mentor sessions &bull; 4 projects</span>
                            </div>
                            <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1">
                              <span className="text-[10px] font-bold text-slate-800 block">Next.js 15 &amp; Tailwind Architecture</span>
                              <span className="text-[9px] text-slate-500 block">Enterprise deployment &bull; 8 sessions</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <iframe
                          src={selectedUrl || (projectDomain ? `https://${projectDomain}/` : 'about:blank')}
                          title="Website Heatmap Backdrop"
                          className="absolute inset-0 w-full h-full border-0 pointer-events-none opacity-85 select-none pt-8"
                          sandbox="allow-same-origin allow-scripts"
                        />
                      )}

                      {/* THERMAL CANVAS (Mobile) */}
                      {viewMode === 'thermal' && (
                        <canvas
                          ref={canvasRef}
                          width={380}
                          height={640}
                          className="absolute inset-0 w-full h-full pointer-events-none z-10"
                        />
                      )}

                      {/* ELEMENT BADGES & TOUCH RADIANCE (Mobile) */}
                      {viewMode === 'elements' && (
                        <div className="absolute inset-0 z-20 pointer-events-auto">
                          {elementClusters.map((cluster) => {
                            const isSelected = selectedClusterId === cluster.id;
                            const posX = Math.min(Math.max(cluster.x, 10), 90);
                            const posY = Math.min(Math.max(cluster.y, 12), 90);
                            const hasRage = cluster.rageCount > 0;

                            return (
                              <div
                                key={cluster.id}
                                onClick={() => setSelectedClusterId(isSelected ? null : cluster.id)}
                                style={{ left: `${posX}%`, top: `${posY}%` }}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 group z-30 ${
                                  isSelected ? 'scale-110 z-40' : 'hover:scale-105'
                                }`}
                              >
                                {/* 44px Finger Touch Radiance Ring */}
                                <div className={`absolute -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 w-11 h-11 rounded-full pointer-events-none transition-all ${
                                  hasRage
                                    ? 'border-2 border-rose-500 bg-rose-500/25 animate-ping'
                                    : 'border-2 border-orange-500 bg-orange-500/20'
                                }`} />

                                {/* Compact Mobile Badge */}
                                <div className={`relative px-2 py-1 rounded-xl text-[10px] font-black shadow-lg flex items-center gap-1.5 border transition-all ${
                                  hasRage 
                                    ? 'bg-rose-950 text-white border-rose-500 ring-2 ring-rose-500/50'
                                    : isSelected
                                      ? 'bg-slate-950 text-white border-orange-500 ring-2 ring-orange-500/50'
                                      : 'bg-slate-900/90 text-white border-slate-700/80 hover:bg-slate-900'
                                }`}>
                                  <span className={`w-2 h-2 rounded-full ${hasRage ? 'bg-rose-400 animate-pulse' : 'bg-orange-400'}`}></span>
                                  <span className={`font-mono ${hasRage ? 'text-rose-300' : 'text-orange-300'} font-extrabold`}>
                                    {cluster.count}
                                  </span>
                                  <span className="text-[9px] text-slate-300 max-w-[90px] truncate">{cluster.name}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* SCROLL DEPTH BANDS & INTERACTIVE RULER (Mobile) */}
                      {viewMode === 'scroll' && (
                        <div 
                          className="absolute inset-0 z-20 flex flex-col select-none cursor-crosshair"
                          onMouseMove={handleCanvasMouseMove}
                          onMouseLeave={() => setRulerY(null)}
                        >
                          <div className="h-[25%] bg-emerald-500/10 border-b-2 border-emerald-500/60 flex items-end justify-between px-3 pb-1">
                            <span className="text-[9px] font-black text-emerald-900 bg-white/95 px-1.5 py-0.5 rounded shadow-xs">
                              100% saw Header
                            </span>
                            <span className="text-[9px] font-mono font-bold text-emerald-800 bg-white/95 px-1 py-0.5 rounded">
                              0-25%
                            </span>
                          </div>

                          <div className="h-[25%] bg-sky-500/10 border-b-2 border-dashed border-sky-500/60 flex items-end justify-between px-3 pb-1">
                            <span className="text-[9px] font-black text-sky-900 bg-white/95 px-1.5 py-0.5 rounded shadow-xs">
                              {currentScrollStats.reach_25}% Reach Fold
                            </span>
                            <span className="text-[9px] font-mono font-bold text-sky-800 bg-white/95 px-1 py-0.5 rounded">
                              25-50%
                            </span>
                          </div>

                          <div className="h-[25%] bg-amber-500/10 border-b-2 border-dashed border-amber-500/60 flex items-end justify-between px-3 pb-1">
                            <span className="text-[9px] font-black text-amber-900 bg-white/95 px-1.5 py-0.5 rounded shadow-xs">
                              {currentScrollStats.reach_50}% Mid-Page
                            </span>
                            <span className="text-[9px] font-mono font-bold text-amber-800 bg-white/95 px-1 py-0.5 rounded">
                              50-75%
                            </span>
                          </div>

                          <div className="h-[25%] bg-rose-500/10 flex items-end justify-between px-3 pb-2">
                            <span className="text-[9px] font-black text-rose-900 bg-white/95 px-1.5 py-0.5 rounded shadow-xs">
                              {currentScrollStats.reach_75}% Footer Conversion
                            </span>
                            <span className="text-[9px] font-mono font-bold text-rose-800 bg-white/95 px-1 py-0.5 rounded">
                              75-100%
                            </span>
                          </div>

                          {/* Dynamic Interactive Depth Ruler Laser Line */}
                          {rulerY !== null && (
                            <div 
                              style={{ top: `${rulerY}%` }}
                              className="absolute left-0 right-0 z-30 pointer-events-none -translate-y-1/2 flex items-center"
                            >
                              <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                              <div className="absolute right-2 bg-slate-950/95 text-white border border-cyan-400 px-2 py-0.5 rounded-lg shadow-xl text-[9px] font-mono font-bold">
                                {Math.round(rulerY)}% &bull; ~{getRetentionAtPct(rulerY)}%
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Home Indicator line */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-300 rounded-full z-40 pointer-events-none" />
                    </div>
                  </div>
                ) : (
                  /* 2. TABLET OR DESKTOP VIEWPORT */
                  <div 
                    ref={canvasContainerRef}
                    className={`relative rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-md transition-all duration-300 ${
                      deviceView === 'tablet' ? 'w-[720px] min-h-[580px]' : 'w-full min-h-[580px]'
                    }`}
                  >
                    {/* Empty state if 0 interactions */}
                    {activePoints.length === 0 && !loading && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-white/90 backdrop-blur-xs text-center">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-2.5">
                          <Flame className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-bold text-slate-900">
                          No Interactions Recorded for This Filter
                        </h4>
                        <p className="text-xs text-slate-500 max-w-xs mt-1 mb-4">
                          Switch interaction filter or viewport to view recorded activity for {selectedUrl || 'your website'}.
                        </p>
                        <button
                          onClick={() => setInteractionFilter('all')}
                          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm transition-all"
                        >
                          View All Interactions
                        </button>
                      </div>
                    )}

                    {/* Wireframe Mockup Canvas */}
                    {backdropMode === 'wireframe' ? (
                      <div className="w-full h-full min-h-[580px] p-6 flex flex-col justify-between select-none pointer-events-none bg-gradient-to-b from-white via-slate-50/50 to-white">
                        
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
                            <span className="text-[10px] text-slate-500 block">Weekly live reviews &amp; mentorship</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Channel 02</span>
                            <span className="text-xs font-bold text-slate-800 block">Tech Founders</span>
                            <span className="text-[10px] text-slate-500 block">Architecture, stack &amp; APIs</span>
                          </div>
                          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-2xs space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Channel 03</span>
                            <span className="text-xs font-bold text-slate-800 block">Growth Sprints</span>
                            <span className="text-[10px] text-slate-500 block">Acquisition &amp; monetization strategies</span>
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

                    {/* THERMAL CANVAS (Desktop/Tablet) */}
                    {viewMode === 'thermal' && (
                      <canvas
                        ref={canvasRef}
                        width={800}
                        height={580}
                        className="absolute inset-0 w-full h-full pointer-events-none z-10"
                      />
                    )}

                    {/* ELEMENT BADGES (Desktop/Tablet) */}
                    {viewMode === 'elements' && (
                      <div className="absolute inset-0 z-20 pointer-events-auto">
                        {elementClusters.map((cluster) => {
                          const isSelected = selectedClusterId === cluster.id;
                          const posX = Math.min(Math.max(cluster.x, 8), 92);
                          const posY = Math.min(Math.max(cluster.y, 8), 92);
                          const hasRage = cluster.rageCount > 0;

                          return (
                            <div
                              key={cluster.id}
                              onClick={() => setSelectedClusterId(isSelected ? null : cluster.id)}
                              style={{ left: `${posX}%`, top: `${posY}%` }}
                              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 group z-30 ${
                                isSelected ? 'scale-110 z-40' : 'hover:scale-105'
                              }`}
                            >
                              {/* Glowing Ambient Halo */}
                              <div className={`absolute -inset-1.5 rounded-2xl blur-xs transition-opacity ${
                                hasRage
                                  ? 'bg-rose-500 opacity-90 animate-pulse'
                                  : isSelected 
                                    ? 'bg-orange-500 opacity-80' 
                                    : 'bg-orange-400 opacity-40 group-hover:opacity-75'
                              }`}></div>

                              {/* Crisp Clean Element Badge */}
                              <div className={`relative px-2.5 py-1 rounded-xl text-xs font-black shadow-lg flex items-center gap-1.5 border transition-all ${
                                hasRage
                                  ? 'bg-rose-950 text-white border-rose-500 ring-2 ring-rose-500/50'
                                  : isSelected
                                    ? 'bg-slate-950 text-white border-orange-500 ring-2 ring-orange-500/50'
                                    : 'bg-slate-900/90 text-white border-slate-700/80 hover:bg-slate-900'
                              }`}>
                                <span className={`w-2 h-2 rounded-full ${hasRage ? 'bg-rose-400 animate-ping' : 'bg-orange-400'}`}></span>
                                <span className={`font-mono text-[11px] ${hasRage ? 'text-rose-300' : 'text-orange-300'} font-extrabold`}>
                                  {cluster.count}
                                </span>
                                <span className="text-[10px] text-slate-300 max-w-[120px] truncate">{cluster.name}</span>
                                <span className="text-[9px] bg-white/15 px-1 py-0.2 rounded font-mono text-slate-200">{cluster.percent}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* SCROLL DEPTH BANDS & INTERACTIVE RULER (Desktop/Tablet) */}
                    {viewMode === 'scroll' && (
                      <div 
                        className="absolute inset-0 z-20 flex flex-col select-none cursor-crosshair"
                        onMouseMove={handleCanvasMouseMove}
                        onMouseLeave={() => setRulerY(null)}
                      >
                        {/* 4 Depth Bands with Real Calculated Visitor Reach */}
                        <div className="h-[25%] bg-emerald-500/10 border-b-2 border-emerald-500/60 flex items-end justify-between px-4 pb-1.5 transition-colors hover:bg-emerald-500/15">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[11px] font-black text-emerald-900 bg-white/95 px-2.5 py-0.5 rounded-lg shadow-xs border border-emerald-200">
                              100% of visitors saw the Header
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-black text-emerald-800 bg-white/95 px-2 py-0.5 rounded-lg border border-emerald-200">
                            0% &ndash; 25% Depth
                          </span>
                        </div>

                        <div className="h-[25%] bg-sky-500/10 border-b-2 border-dashed border-sky-500/60 flex items-end justify-between px-4 pb-1.5 transition-colors hover:bg-sky-500/15">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                            <span className="text-[11px] font-black text-sky-900 bg-white/95 px-2.5 py-0.5 rounded-lg shadow-xs border border-sky-200">
                              {currentScrollStats.reach_25}% Reached Hero &amp; Value Prop Fold
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-black text-sky-800 bg-white/95 px-2 py-0.5 rounded-lg border border-sky-200">
                            25% &ndash; 50% Depth
                          </span>
                        </div>

                        <div className="h-[25%] bg-amber-500/10 border-b-2 border-dashed border-amber-500/60 flex items-end justify-between px-4 pb-1.5 transition-colors hover:bg-amber-500/15">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-[11px] font-black text-amber-900 bg-white/95 px-2.5 py-0.5 rounded-lg shadow-xs border border-amber-200">
                              {currentScrollStats.reach_50}% Reached Mid-Page Content &amp; Details
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-black text-amber-800 bg-white/95 px-2 py-0.5 rounded-lg border border-amber-200">
                            50% &ndash; 75% Depth
                          </span>
                        </div>

                        <div className="h-[25%] bg-rose-500/10 flex items-end justify-between px-4 pb-2 transition-colors hover:bg-rose-500/15">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-[11px] font-black text-rose-900 bg-white/95 px-2.5 py-0.5 rounded-lg shadow-xs border border-rose-200">
                              {currentScrollStats.reach_75}% Reached Final Conversion &amp; Footer
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-black text-rose-800 bg-white/95 px-2 py-0.5 rounded-lg border border-rose-200">
                            75% &ndash; 100% Depth
                          </span>
                        </div>

                        {/* Dynamic Interactive Depth Ruler Laser Line */}
                        {rulerY !== null && (
                          <div 
                            style={{ top: `${rulerY}%` }}
                            className="absolute left-0 right-0 z-30 pointer-events-none -translate-y-1/2 flex items-center"
                          >
                            <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                            <div className="absolute right-4 bg-slate-950/95 text-white border border-cyan-400/80 px-2.5 py-1 rounded-xl shadow-xl flex items-center gap-2 text-xs font-mono font-bold">
                              <MoveVertical className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-cyan-300">{Math.round(rulerY)}% Depth</span>
                              <span className="text-slate-400">&bull;</span>
                              <span className="text-emerald-400 font-black">~{getRetentionAtPct(rulerY)}% Retention</span>
                            </div>
                          </div>
                        )}

                        {/* Right-Margin Scroll Falloff Bar */}
                        <div className="absolute top-0 bottom-0 right-0 w-3.5 bg-slate-900/10 border-l border-slate-300 flex flex-col justify-between py-2 pointer-events-none">
                          <div className="w-full h-full bg-gradient-to-b from-emerald-500 via-amber-500 to-rose-500 opacity-80 rounded-l" />
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>

            </div>

            {/* Right Column (4 Cols): Click Inspector & Ranked Leaderboard */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Element Click Inspector Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
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
                    No interactions detected for current filter.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {elementClusters.map((cluster, idx) => {
                      const isSelected = selectedClusterId === cluster.id;
                      const hasRage = cluster.rageCount > 0;
                      return (
                        <div
                          key={cluster.id}
                          onClick={() => setSelectedClusterId(isSelected ? null : cluster.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                            hasRage
                              ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400/30'
                              : isSelected
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

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {hasRage && (
                                <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-mono">
                                  {cluster.rageCount} rage
                                </span>
                              )}
                              <span className="text-xs font-black text-orange-600 font-mono">
                                {cluster.count}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-mono text-slate-400">&lt;{cluster.tag}&gt;</span>
                            <span className="font-semibold text-slate-700">{cluster.percent}% click share</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                            <div
                              className={`h-full rounded-full ${
                                hasRage 
                                  ? 'bg-gradient-to-r from-rose-500 to-amber-500' 
                                  : 'bg-gradient-to-r from-amber-500 to-orange-500'
                              }`}
                              style={{ width: `${cluster.percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Device Breakdown Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-slate-500" />
                  <span>Device Traffic Distribution</span>
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
                        title="Click to view Desktop Viewport"
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
                        title="Click to view Mobile Viewport"
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
                        title="Click to view Tablet Viewport"
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

              {/* Scroll Retention Quick Stats */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-5 border border-indigo-100 text-indigo-950 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Fold Retention Summary</span>
                </div>
                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Header / Above Fold:</span>
                    <span className="font-mono font-bold text-emerald-700">100% Reach</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Hero / Value Prop (25%):</span>
                    <span className="font-mono font-bold text-sky-700">{currentScrollStats.reach_25}% Reach</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Mid-Page Catalog (50%):</span>
                    <span className="font-mono font-bold text-amber-700">{currentScrollStats.reach_50}% Reach</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Footer Conversion (75%+):</span>
                    <span className="font-mono font-bold text-rose-700">{currentScrollStats.reach_75}% Reach</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
