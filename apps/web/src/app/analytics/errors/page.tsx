"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import {
  AlertTriangle,
  Code2,
  Cpu,
  Flame,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Smartphone,
  Server,
  MousePointerClick,
  CheckCircle2,
  Lightbulb,
  Clock,
  Globe,
  Loader2,
  Terminal,
  ExternalLink,
  Video
} from 'lucide-react';

interface CodeError {
  id: number;
  session_id?: string;
  status?: string;
  message: string;
  filename: string;
  lineno: number;
  colno: number;
  stack: string;
  type: string;
  url: string;
  count: number;
  last_seen: string | null;
  browser: string;
  os: string;
}

interface LayoutError {
  id: number;
  type: string;
  url: string;
  scroll_width: number;
  viewport_width: number;
  count: number;
  last_seen: string | null;
}

interface SlowAPI {
  id: number;
  endpoint: string;
  method: string;
  duration_ms: number;
  status_code: number;
  error_detail?: string;
  created_at: string | null;
}

interface RageClick {
  id: number;
  url: string;
  tag: string;
  text: string;
  selector?: string;
  clicks: number;
  coordinates?: { x: number | null; y: number | null };
  session_id?: string;
  created_at: string | null;
}

interface Recommendation {
  title: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  action: string;
}

interface ErrorsData {
  summary: {
    code_errors: number;
    layout_errors: number;
    slow_apis: number;
    rage_clicks: number;
    health_score: number;
  };
  code_errors: CodeError[];
  layout_errors: LayoutError[];
  slow_apis: SlowAPI[];
  rage_clicks: RageClick[];
  recommendations: Recommendation[];
}

export default function ErrorsIntelligencePage() {
  const router = useRouter();
  const [data, setData] = useState<ErrorsData>({
    summary: { code_errors: 0, layout_errors: 0, slow_apis: 0, rage_clicks: 0, health_score: 100 },
    code_errors: [],
    layout_errors: [],
    slow_apis: [],
    rage_clicks: [],
    recommendations: []
  });
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'code' | 'layout' | 'apis' | 'rage' | 'recommendations'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');

    try {
      const res = await fetch(apiUrl('/api/v1/analytics/errors'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch error diagnostics:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const handleSimulate = async () => {
    setSimulating(true);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/analytics/errors/simulate'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchErrors();
      } else {
        alert('Simulation failed. Please try again.');
      }
    } catch (e) {
      alert('Error triggering diagnostic simulator.');
    } finally {
      setSimulating(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleToggleStatus = async (err: CodeError) => {
    const nextStatus = (err.status || 'open') === 'open' ? 'resolved' : 'open';
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/errors/${err.id}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        setData(prev => ({
          ...prev,
          code_errors: prev.code_errors.map(item =>
            item.id === err.id ? { ...item, status: nextStatus } : item
          )
        }));
      }
    } catch (e) {
      console.error('Failed to toggle error status:', e);
    }
  };

  const totalIssues =
    data.summary.code_errors +
    data.summary.layout_errors +
    data.summary.slow_apis +
    data.summary.rage_clicks;

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />

        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          <div className="w-full flex flex-col gap-8 pb-16">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1.5">
                  <Link href="/" className="hover:text-slate-700 flex items-center gap-1 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Workspace Home
                  </Link>
                  <span>/</span>
                  <span className="text-slate-600">Full-Stack Diagnostics</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  <span>Errors & Issues Intelligence</span>
                  <span className="text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200/60 px-2.5 py-0.5 rounded-full">
                    AI Correlated
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                  Automatically correlates JavaScript exceptions, responsive breakpoint overflows, slow API routes, and user rage click frustration.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleSimulate}
                  disabled={simulating}
                  className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 hover:scale-[1.02]"
                >
                  {simulating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Simulating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Simulate Sample Errors</span>
                    </>
                  )}
                </button>

                <button
                  onClick={fetchErrors}
                  className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:scale-105"
                  title="Refresh Diagnostics"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* 4 KPI Health Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Code Exceptions */}
              <div 
                onClick={() => setActiveTab('code')}
                className={`p-5 rounded-3xl bg-white border cursor-pointer transition-all hover:shadow-md ${
                  activeTab === 'code' ? 'border-rose-400 ring-2 ring-rose-100 shadow-sm' : 'border-slate-200/60 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                    JS Errors
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {data.summary.code_errors}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Runtime stack exceptions</p>
              </div>

              {/* Card 2: Responsive Breakpoint Overflows */}
              <div 
                onClick={() => setActiveTab('layout')}
                className={`p-5 rounded-3xl bg-white border cursor-pointer transition-all hover:shadow-md ${
                  activeTab === 'layout' ? 'border-amber-400 ring-2 ring-amber-100 shadow-sm' : 'border-slate-200/60 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    UI Overflow
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {data.summary.layout_errors}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Horizontal layout breaks</p>
              </div>

              {/* Card 3: Slow APIs (>500ms) */}
              <div 
                onClick={() => setActiveTab('apis')}
                className={`p-5 rounded-3xl bg-white border cursor-pointer transition-all hover:shadow-md ${
                  activeTab === 'apis' ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-sm' : 'border-slate-200/60 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Server className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Latency &gt;500ms
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">
                  {data.summary.slow_apis}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Bottleneck server routes</p>
              </div>

              {/* Card 4: Platform Health Score */}
              <div 
                onClick={() => setActiveTab('recommendations')}
                className={`p-5 rounded-3xl bg-white border cursor-pointer transition-all hover:shadow-md ${
                  activeTab === 'recommendations' ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-sm' : 'border-slate-200/60 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Reliability
                  </span>
                </div>
                <div className="text-2xl font-black text-emerald-600 tracking-tight">
                  {data.summary.health_score}%
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Full-stack stability score</p>
              </div>

            </div>

            {/* Filter Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <span>All Telemetry</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                  {totalIssues}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === 'code'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Code Exceptions</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700">
                  {data.summary.code_errors}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('layout')}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === 'layout'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Responsive Overflow</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800">
                  {data.summary.layout_errors}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('apis')}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === 'apis'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Slow APIs</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-700">
                  {data.summary.slow_apis}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('rage')}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === 'rage'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <MousePointerClick className="w-3.5 h-3.5" />
                <span>Rage Clicks</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-orange-100 text-orange-800">
                  {data.summary.rage_clicks}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('recommendations')}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  activeTab === 'recommendations'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                <span>AI Recommendations</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                  {data.recommendations.length}
                </span>
              </button>
            </div>

            {/* AI Recommendations Highlight Box */}
            {(activeTab === 'all' || activeTab === 'recommendations') && data.recommendations.length > 0 && (
              <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      ThirdEye Root-Cause Diagnostic Recommendations
                    </h3>
                    <p className="text-xs text-slate-500">
                      Actionable developer fixes correlated from real user interactions.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                  {data.recommendations.map((rec, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/90 border border-slate-200/60 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          {rec.category}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          rec.severity === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {rec.severity} Severity
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{rec.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{rec.description}</p>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 font-medium">
                        <span className="font-bold text-slate-900">Recommended Action: </span>
                        {rec.action}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Telemetry List */}
            <div className="space-y-3.5">
              {loading ? (
                <div className="h-64 rounded-3xl bg-white border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-rose-500" />
                  <p className="text-sm font-semibold text-slate-600">Analyzing error telemetry...</p>
                </div>
              ) : totalIssues === 0 ? (
                <div className="h-80 rounded-3xl bg-white border border-slate-100 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Zero Active Errors Detected</h3>
                  <p className="text-xs text-slate-400 max-w-md mt-1 mb-6">
                    No runtime JavaScript exceptions, mobile viewport overflows, or slow APIs have been encountered.
                  </p>
                  <button
                    onClick={handleSimulate}
                    disabled={simulating}
                    className="text-xs font-bold bg-slate-900 text-white px-5 py-2.5 rounded-2xl hover:bg-slate-800 shadow-sm transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Simulate Sample Diagnostics</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Section: Code Errors */}
                  {(activeTab === 'all' || activeTab === 'code') &&
                    data.code_errors.map((err) => {
                      const isExpanded = expandedId === `code_${err.id}`;
                      const isResolved = (err.status || 'open') === 'resolved';
                      return (
                        <div
                          key={`code_${err.id}`}
                          className={`rounded-3xl border p-5 shadow-sm hover:shadow-md transition-all space-y-3 ${
                            isResolved ? 'bg-emerald-50/20 border-emerald-200/80' : 'bg-white border-slate-200/60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold flex-shrink-0 ${
                                isResolved ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              }`}>
                                <Code2 className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    isResolved
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {isResolved ? 'Resolved' : 'Open Issue'}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                    JavaScript Exception
                                  </span>
                                  <span className="text-xs font-semibold text-slate-400">
                                    {err.count} occurrence{err.count > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <h4 className={`text-sm font-bold mt-1 font-mono ${
                                  isResolved ? 'text-slate-500 line-through' : 'text-slate-900'
                                }`}>
                                  {err.message}
                                </h4>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Globe className="w-3 h-3" /> {err.url}
                                  </span>
                                  <span>•</span>
                                  <span>{err.browser} on {err.os}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                              {err.session_id && (
                                <Link
                                  href={`/analytics/sessions?session=${err.session_id}`}
                                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1.5"
                                  title="Watch session replay where this error occurred"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  <span>Watch Session</span>
                                </Link>
                              )}
                              <button
                                onClick={() => handleToggleStatus(err)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                  isResolved
                                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isResolved ? 'Reopen' : 'Mark Resolved'}</span>
                              </button>
                              <button
                                onClick={() => toggleExpand(`code_${err.id}`)}
                                className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5"
                              >
                                <span>{isExpanded ? 'Hide Stack' : 'Inspect Stack'}</span>
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="pt-3 border-t border-slate-100 space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                                <span>{err.filename}:{err.lineno}:{err.colno}</span>
                              </div>
                              <div className="bg-slate-950 text-rose-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto shadow-inner">
                                <pre className="whitespace-pre-wrap">{err.stack || err.message}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* Section: Responsive Layout Overflows */}
                  {(activeTab === 'all' || activeTab === 'layout') &&
                    data.layout_errors.map((lay) => (
                      <div
                        key={`layout_${lay.id}`}
                        className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold flex-shrink-0">
                            <Smartphone className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                Responsive Layout Overflow
                              </span>
                              <span className="text-xs font-semibold text-slate-400">
                                {lay.count} device{lay.count > 1 ? 's' : ''} affected
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 mt-1">
                              Horizontal scroll leakage on {lay.url}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Document width ({lay.scroll_width}px) exceeds mobile viewport ({lay.viewport_width}px) by {lay.scroll_width - lay.viewport_width}px.
                            </p>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/60 text-xs text-amber-900 font-mono flex items-center gap-2">
                          <span>Overflow: +{lay.scroll_width - lay.viewport_width}px</span>
                        </div>
                      </div>
                    ))}

                  {/* Section: Slow APIs */}
                  {(activeTab === 'all' || activeTab === 'apis') &&
                    data.slow_apis.map((api) => (
                      <div
                        key={`api_${api.id}`}
                        className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">
                            <Server className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                High Latency API
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-700">
                                {api.method} {api.endpoint}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Response duration exceeded latency SLA threshold (target &lt;500ms).
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-black text-rose-600 font-mono">
                              {api.duration_ms}ms
                            </div>
                            <div className="text-[10px] text-slate-400">Response Duration</div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                            api.status_code >= 500
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            HTTP {api.status_code}
                          </span>
                        </div>
                      </div>
                    ))}

                  {/* Section: Rage Clicks */}
                  {(activeTab === 'all' || activeTab === 'rage') &&
                    data.rage_clicks.map((rage) => (
                      <div
                        key={`rage_${rage.id}`}
                        className="bg-white rounded-3xl border border-slate-200/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold flex-shrink-0">
                            <MousePointerClick className="w-5 h-5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-800 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                                UX Frustration Trigger
                              </span>
                              <span className="text-xs font-bold text-slate-900 font-mono">
                                {rage.text ? `"${rage.text}"` : `<${rage.tag}>`}
                              </span>
                              {rage.selector && (
                                <code className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-slate-900 text-amber-300 border border-slate-800">
                                  {rage.selector}
                                </code>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              Visitor repeatedly clicked element <span className="font-bold text-slate-800">{rage.clicks} times</span> within 500ms on{' '}
                              <span className="font-mono text-slate-700">{rage.url}</span>.
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                              {rage.coordinates?.x !== undefined && rage.coordinates?.x !== null && (
                                <span className="font-mono text-slate-500">
                                  Coordinates: (x: {rage.coordinates.x}px, y: {rage.coordinates.y}px)
                                </span>
                              )}
                              {rage.created_at && (
                                <span>Recorded: {new Date(rage.created_at).toLocaleTimeString()}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center">
                          {rage.session_id && (
                            <Link
                              href={`/analytics/sessions?session=${rage.session_id}`}
                              className="px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-bold transition-all flex items-center gap-1.5"
                              title="Watch visitor rage click session replay"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Watch Session</span>
                            </Link>
                          )}
                          <div className="p-2.5 bg-orange-50 rounded-2xl border border-orange-200/60 text-xs text-orange-900 font-bold flex items-center gap-1.5">
                            <span>{rage.clicks} Rapid Clicks</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>

          </div>
        </main>
    </div>
  );
}
