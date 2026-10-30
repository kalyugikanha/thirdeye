"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ClipboardList, 
  Loader2, 
  Sparkles, 
  Play, 
  Clock, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Sliders,
  DollarSign,
  TrendingUp,
  ExternalLink,
  Laptop,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Bell,
  ArrowRight,
  Check,
  AlertOctagon,
  X,
  Radio,
  Zap
} from 'lucide-react';

interface FormFieldStat {
  field: string;
  interactions: number;
  avg_duration_ms: number;
  drop_off_count: number;
  drop_off_pct: number;
}

interface FormItem {
  form_id: string;
  url: string;
  starts: number;
  submissions: number;
  completion_rate: number;
  abandonment_rate: number;
  abandoned_session_ids: string[];
  fields: FormFieldStat[];
}

interface FormsResponse {
  kpis: {
    total_starts: number;
    total_submissions: number;
    completion_rate: number;
    abandonment_rate: number;
  };
  forms: FormItem[];
}

interface AbandonedSession {
  session_id: string;
  url: string;
  title: string;
  last_field: string;
  has_replay: boolean;
  device: string;
  friction_tags: string[];
  events_count: number;
  created_at: string | null;
  dispatched_status: string | null;
}

interface RecoveryResponse {
  total_abandoned: number;
  potential_value_at_risk: number;
  average_order_value: number;
  sessions: AbandonedSession[];
}

interface RecoveryConfig {
  id?: number;
  project_id?: number;
  webhook_url: string;
  secret_token: string;
  is_active: boolean;
  trigger_on: string;
  min_hesitation_sec: number;
  total_dispatched: number;
  last_status: string | null;
  last_triggered_at: string | null;
}

interface RecoveryLog {
  id: number;
  session_id: string;
  url: string;
  last_field: string;
  duration_seconds: number;
  status: string;
  response_code: number;
  created_at: string;
}

export default function FormsAnalyticsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'recovery' | 'funnel' | 'logs'>('recovery');
  const [formData, setFormData] = useState<FormsResponse | null>(null);
  const [recoveryData, setRecoveryData] = useState<RecoveryResponse | null>(null);
  const [recoveryConfig, setRecoveryConfig] = useState<RecoveryConfig>({
    webhook_url: '',
    secret_token: '',
    is_active: true,
    trigger_on: 'all_abandoned',
    min_hesitation_sec: 20,
    total_dispatched: 0,
    last_status: null,
    last_triggered_at: null
  });
  const [logs, setLogs] = useState<RecoveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const token = () => localStorage.getItem('te_token');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    const t = token();
    if (!t) return router.push('/login');
    setLoading(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const pidQuery = activePid ? `?project_id=${encodeURIComponent(activePid)}` : '';

      // 1. Load Form Analytics
      const formsRes = await fetch(apiUrl(`/api/v1/analytics/forms${pidQuery}`), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (formsRes.ok) {
        setFormData(await formsRes.json());
      }

      // 2. Load Abandoned Sessions
      const recovRes = await fetch(apiUrl(`/api/v1/analytics/recovery/abandoned-sessions${pidQuery}`), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (recovRes.ok) {
        setRecoveryData(await recovRes.json());
      }

      // 3. Load Webhook Config
      const cfgRes = await fetch(apiUrl(`/api/v1/analytics/recovery/config${pidQuery}`), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (cfgRes.ok) {
        const cData = await cfgRes.json();
        if (cData.config) {
          setRecoveryConfig(cData.config);
        }
      }

      // 4. Load Delivery Logs
      const logsRes = await fetch(apiUrl(`/api/v1/analytics/recovery/logs${pidQuery}`), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogs(lData.logs || []);
      }
    } catch (e: any) {
      console.error('Failed to load recovery data:', e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save Webhook Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save_config');
    try {
      const t = token();
      const activePid = localStorage.getItem('te_active_project_id');
      const res = await fetch(apiUrl('/api/v1/analytics/recovery/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`
        },
        body: JSON.stringify({
          project_id: activePid ? parseInt(activePid) : undefined,
          ...recoveryConfig
        })
      });
      if (res.ok) {
        showToast('Recovery Webhook configuration saved successfully!');
        setConfigModalOpen(false);
        loadData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to save configuration');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving config');
    } finally {
      setActionLoading(null);
    }
  };

  // Dispatch Test Payload
  const handleSendTestWebhook = async () => {
    setActionLoading('test_webhook');
    setTestResult(null);
    try {
      const t = token();
      const activePid = localStorage.getItem('te_active_project_id');
      const res = await fetch(apiUrl('/api/v1/analytics/recovery/test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`
        },
        body: JSON.stringify({
          project_id: activePid ? parseInt(activePid) : undefined,
          webhook_url: recoveryConfig.webhook_url
        })
      });
      const data = await res.json();
      setTestResult(data);
      if (res.ok && data.status === 'delivered') {
        showToast(`Test payload delivered successfully! (HTTP ${data.response_code})`);
      } else {
        showToast(`Webhook responded with HTTP ${data.response_code}`);
      }
      loadData();
    } catch (err: any) {
      setTestResult({ status: 'failed', response_code: 500, message: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Dispatch Recovery for a specific session
  const handleDispatchSession = async (session: AbandonedSession) => {
    setActionLoading(`dispatch_${session.session_id}`);
    try {
      const t = token();
      const activePid = localStorage.getItem('te_active_project_id');
      const res = await fetch(apiUrl('/api/v1/analytics/recovery/dispatch-now'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`
        },
        body: JSON.stringify({
          project_id: activePid ? parseInt(activePid) : undefined,
          session_id: session.session_id,
          url: session.url,
          last_field: session.last_field,
          friction_tags: session.friction_tags
        })
      });
      if (res.ok) {
        showToast(`Recovery webhook dispatched for session ${session.session_id.slice(0, 8)}...`);
        // Update local session status
        setRecoveryData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            sessions: prev.sessions.map(s => s.session_id === session.session_id ? { ...s, dispatched_status: 'delivered' } : s)
          };
        });
      } else {
        const err = await res.json();
        alert(err.detail || 'Dispatch failed. Verify your webhook URL is configured.');
      }
    } catch (err: any) {
      alert(err.message || 'Dispatch error');
    } finally {
      setActionLoading(null);
    }
  };

  const totalAbandoned = recoveryData?.total_abandoned || 0;
  const potentialAtRisk = recoveryData?.potential_value_at_risk || 0;
  const benchmarkRecoverable = Math.round(potentialAtRisk * 0.14); // 14% industry benchmark recovery rate

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="w-full flex flex-col gap-6 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <Link href="/" className="hover:text-slate-700">Workspace Home</Link>
                <span>/</span>
                <span className="text-slate-600">Revenue Growth &amp; Recovery</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Abandoned Checkout &amp; Revenue Recovery Studio</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-rose-500" /> Direct Revenue Engine
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Automatically recover high-intent shoppers who abandon checkout: fire instant WhatsApp/CRM webhooks with 1-click replay links to rescue 10%–18% of dropped orders.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setConfigModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Configure Webhooks</span>
              </button>

              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-2xs transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-700 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Executive Recovery Bento Scorecard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. At-Risk Revenue */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Value at Risk
                </span>
                <span className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  ₹{potentialAtRisk.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Across {totalAbandoned} abandoned checkouts
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1 text-[11px] text-emerald-600 font-bold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>~₹{benchmarkRecoverable.toLocaleString()} recoverable (+14% lift)</span>
              </div>
            </div>

            {/* 2. Abandoned Shoppers */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Abandoned Checkouts
                </span>
                <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <AlertOctagon className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {totalAbandoned}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  High-intent drop-offs
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-semibold">
                Average order benchmark: ₹2,499
              </div>
            </div>

            {/* 3. Form Field Completion */}
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Form Completion Rate
                </span>
                <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight">
                  {formData?.kpis?.completion_rate ?? 0}%
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {formData?.kpis?.total_submissions ?? 0} successful submits
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-semibold">
                {formData?.kpis?.total_starts ?? 0} total form starters
              </div>
            </div>

            {/* 4. Automated Recovery Webhook Engine Status */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">
                    Recovery Webhook Engine
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${recoveryConfig.webhook_url ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                </div>
                <div className="mt-2">
                  <span className="text-lg font-black tracking-tight block">
                    {recoveryConfig.webhook_url ? 'Active & Armed' : 'Unconfigured'}
                  </span>
                  <span className="text-[11px] text-slate-300 block truncate mt-0.5 font-mono">
                    {recoveryConfig.webhook_url || 'No endpoint set'}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {recoveryConfig.total_dispatched} Dispatched
                </span>
                <button
                  onClick={() => setConfigModalOpen(true)}
                  className="text-[10px] font-bold text-white hover:text-orange-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Configure &rarr;
                </button>
              </div>
            </div>

          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200/90 pb-2">
            <button
              onClick={() => setActiveTab('recovery')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'recovery'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-rose-400" />
              <span>Abandoned Checkouts ({totalAbandoned})</span>
            </button>

            <button
              onClick={() => setActiveTab('funnel')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'funnel'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
              <span>Form Field Friction Funnel</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'logs'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5 text-indigo-400" />
              <span>Webhook Delivery Logs ({logs.length})</span>
            </button>
          </div>

          {/* TAB 1: LIVE ABANDONED CHECKOUT SESSIONS */}
          {activeTab === 'recovery' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>Live Abandoned Checkout Opportunities</span>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    High-intent shoppers who added items and entered checkout but abandoned before paying.
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
                  Showing top {recoveryData?.sessions?.length ?? 0} recent drop-offs
                </div>
              </div>

              {recoveryData?.sessions && recoveryData.sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Visitor / Session</th>
                        <th className="py-3 px-4">Abandoned Checkout Page</th>
                        <th className="py-3 px-4">Drop-Off Field</th>
                        <th className="py-3 px-4">Device</th>
                        <th className="py-3 px-4">Friction Signals</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {recoveryData.sessions.map((sess) => (
                        <tr key={sess.session_id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                            <span className="block">{sess.session_id.slice(0, 14)}...</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {sess.created_at ? new Date(sess.created_at).toLocaleTimeString() : 'Recent'}
                            </span>
                          </td>

                          <td className="py-3 px-4 max-w-[240px]">
                            <span className="font-bold text-slate-900 block truncate" title={sess.url}>
                              {sess.title}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate" title={sess.url}>
                              {sess.url}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-mono font-bold">
                              &lt;{sess.last_field}&gt;
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 capitalize">
                              {sess.device === 'mobile' ? (
                                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Laptop className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              {sess.device}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1">
                              {sess.friction_tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    tag === 'rage_click' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                                    tag === 'payment_friction' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                    'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  }`}
                                >
                                  {tag.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {sess.has_replay ? (
                                <Link
                                  href={`/analytics/sessions?session_id=${sess.session_id}`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200/80 font-bold text-xs transition-all shadow-2xs"
                                  title="Watch what the user did right before abandoning"
                                >
                                  <Play className="w-3 h-3 text-orange-600 fill-orange-600" />
                                  <span>Watch Replay</span>
                                </Link>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">No video</span>
                              )}

                              <button
                                onClick={() => handleDispatchSession(sess)}
                                disabled={actionLoading === `dispatch_${sess.session_id}` || sess.dispatched_status === 'delivered'}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                                  sess.dispatched_status === 'delivered'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-2xs'
                                }`}
                              >
                                {actionLoading === `dispatch_${sess.session_id}` ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                                ) : sess.dispatched_status === 'delivered' ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Send className="w-3 h-3 text-rose-300" />
                                )}
                                <span>{sess.dispatched_status === 'delivered' ? 'Dispatched' : 'Send Webhook'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No abandoned checkouts recorded for this timeframe.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FORM FIELD DROP-OFF FUNNEL */}
          {activeTab === 'funnel' && (
            <div className="space-y-4">
              {formData?.forms && formData.forms.length > 0 ? (
                formData.forms.map((form) => (
                  <div key={form.form_id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{form.form_id}</h4>
                        <span className="text-[11px] font-mono text-slate-400">{form.url}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-semibold text-slate-600">
                          {form.starts} Starters
                        </span>
                        <span className="font-bold text-emerald-600">
                          {form.completion_rate}% Completed
                        </span>
                        <span className="font-bold text-rose-600">
                          {form.abandonment_rate}% Drop-Off
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {form.fields.map((f) => (
                        <div key={f.field} className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-slate-800">
                              &lt;{f.field}&gt;
                            </span>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-slate-500 font-mono">
                                Avg Hesitation: {f.avg_duration_ms}ms
                              </span>
                              <span className="font-mono font-bold text-rose-600">
                                {f.drop_off_count} dropped ({f.drop_off_pct}%)
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                              style={{ width: `${Math.min(100, f.drop_off_pct)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
                  No form input friction recorded yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WEBHOOK DELIVERY LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900">Webhook Delivery Audit Trail</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time verification log of recovery webhook payloads dispatched to CRM / WhatsApp / Zapier.
                  </p>
                </div>
                <button
                  onClick={handleSendTestWebhook}
                  disabled={actionLoading === 'test_webhook'}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Send className="w-3 h-3 text-rose-400" />
                  <span>Send Test Webhook</span>
                </button>
              </div>

              {logs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Session ID</th>
                        <th className="py-3 px-4">Target Checkout URL</th>
                        <th className="py-3 px-4">Last Field</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">HTTP Response</th>
                        <th className="py-3 px-4 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                            {log.session_id.slice(0, 16)}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 truncate max-w-xs">
                            {log.url}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-amber-700">
                            &lt;{log.last_field}&gt;
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              log.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            HTTP {log.response_code}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400 text-[10px]">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No recovery webhooks dispatched yet. Click &ldquo;Send Test Webhook&rdquo; or configure your endpoint.
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* WEBHOOK CONFIGURATION MODAL */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setConfigModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Configure Recovery Webhook</h3>
                <p className="text-xs text-slate-500">
                  Connect Zapier, Make, WhatsApp Business API, or Klaviyo.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Target Webhook URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://hooks.zapier.com/hooks/catch/123/abc or CRM URL"
                  value={recoveryConfig.webhook_url}
                  onChange={(e) => setRecoveryConfig({ ...recoveryConfig, webhook_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Secret Signing Token (HMAC SHA-256) <span className="text-slate-400 text-[10px] font-normal">(Optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="Optional secret key for signature verification"
                  value={recoveryConfig.secret_token}
                  onChange={(e) => setRecoveryConfig({ ...recoveryConfig, secret_token: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Trigger Condition
                  </label>
                  <select
                    value={recoveryConfig.trigger_on}
                    onChange={(e) => setRecoveryConfig({ ...recoveryConfig, trigger_on: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value="all_abandoned">All Abandoned Checkouts</option>
                    <option value="high_friction_only">High-Friction Only (Rage Clicks / Hesitation)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Hesitation Threshold
                  </label>
                  <select
                    value={recoveryConfig.min_hesitation_sec}
                    onChange={(e) => setRecoveryConfig({ ...recoveryConfig, min_hesitation_sec: parseInt(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value={15}>15 Seconds</option>
                    <option value={30}>30 Seconds</option>
                    <option value={60}>60 Seconds</option>
                    <option value={90}>90 Seconds</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="active_toggle"
                  checked={recoveryConfig.is_active}
                  onChange={(e) => setRecoveryConfig({ ...recoveryConfig, is_active: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                />
                <label htmlFor="active_toggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Enable Real-Time Abandonment Webhook Triggers
                </label>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl border text-xs font-mono ${
                  testResult.status === 'delivered' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <span className="font-bold block">Status: {testResult.status} (HTTP {testResult.response_code})</span>
                  <span className="text-[10px] block truncate">{testResult.message}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSendTestWebhook}
                  disabled={actionLoading === 'test_webhook' || !recoveryConfig.webhook_url}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading === 'test_webhook' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Test Connection</span>
                </button>

                <button
                  type="submit"
                  disabled={actionLoading === 'save_config'}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-xs cursor-pointer"
                >
                  {actionLoading === 'save_config' ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
