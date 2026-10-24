"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import {
  Users2,
  ShieldAlert,
  Smartphone,
  Search,
  Video,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Layers,
  Cpu,
  Wifi,
  BatteryCharging,
  Code2,
  RefreshCw,
  Loader2,
  Lock,
  Building2,
  FileWarning
} from 'lucide-react';

interface IdentifiedUser {
  user_id: string;
  user_email: string;
  user_name: string;
  user_role: string;
  department: string;
  events_count: number;
  sessions_count: number;
  audit_actions_count: number;
  last_seen: string | null;
  last_url: string;
  latest_session_id: string | null;
}

interface AuditLog {
  id: number;
  session_id: string | null;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  user_role: string | null;
  department: string | null;
  action: string;
  target_resource: string | null;
  risk_level: string;
  ip_address: string | null;
  created_at: string | null;
}

interface AppOverview {
  kpis: {
    crash_free_rate_pct: number;
    total_app_events: number;
    total_crashes: number;
    anr_count: number;
    active_versions_count: number;
  };
  versions: {
    version: string;
    platform: string;
    sessions: number;
    events: number;
    crashes: number;
    crash_free_pct: number;
  }[];
  devices: { device: string; count: number }[];
  screens: { screen: string; views: number }[];
  crashes: {
    id: number;
    session_id: string;
    user_id: string | null;
    user_email: string | null;
    platform: string;
    app_version: string;
    os_version: string | null;
    device_model: string | null;
    error_type: string;
    message: string;
    stack_trace: string | null;
    screen_name: string | null;
    memory_free_mb: number | null;
    battery_pct: number | null;
    network_type: string | null;
    created_at: string | null;
  }[];
}

export default function InternalAndAppTrackingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'employees' | 'audit' | 'mobile'>('employees');
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [internalData, setInternalData] = useState<{
    kpis: { total_identified_users: number; total_audit_actions: number; high_risk_actions: number; identified_sessions: number };
    identified_users: IdentifiedUser[];
    audit_logs: AuditLog[];
    portal_routes: { url: string; views: number }[];
  }>({
    kpis: { total_identified_users: 0, total_audit_actions: 0, high_risk_actions: 0, identified_sessions: 0 },
    identified_users: [],
    audit_logs: [],
    portal_routes: []
  });

  const [appData, setAppData] = useState<AppOverview>({
    kpis: { crash_free_rate_pct: 100, total_app_events: 0, total_crashes: 0, anr_count: 0, active_versions_count: 0 },
    versions: [],
    devices: [],
    screens: [],
    crashes: []
  });

  const fetchAll = async (q = searchQuery) => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    setLoading(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const pidParam = activePid ? `&project_id=${activePid}` : '';
      const [intRes, appRes] = await Promise.all([
        fetch(apiUrl(`/api/v1/internal/overview?days=30${pidParam}${q ? `&search=${encodeURIComponent(q)}` : ''}`), {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(apiUrl(`/api/v1/app/overview?days=30${pidParam}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (intRes.ok) setInternalData(await intRes.json());
      if (appRes.ok) setAppData(await appRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSimulateInternal = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return;
    setSimulating(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      await fetch(apiUrl(`/api/v1/internal/simulate${activePid ? `?project_id=${activePid}` : ''}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchAll();
    } finally {
      setSimulating(false);
    }
  };

  const handleSimulateApp = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return;
    setSimulating(true);
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      await fetch(apiUrl(`/api/v1/app/simulate${activePid ? `?project_id=${activePid}` : ''}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchAll();
    } finally {
      setSimulating(false);
    }
  };

  const riskBadge = (risk: string) => {
    const r = (risk || 'low').toLowerCase();
    if (r === 'critical') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (r === 'high') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (r === 'medium') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">
                    Internal Portals, Employee Audit &amp; Mobile App Tracker
                  </h1>
                  <p className="text-xs text-slate-500">
                    Track identified employees (`ThirdEye.identify`), sensitive admin operations (`ThirdEye.audit`), and Mobile App crashes/screens (`React Native`, `Flutter`, `iOS`, `Android`).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Link
                href="/settings/applications"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Get Portal &amp; Mobile SDKs</span>
              </Link>
              <button
                onClick={() => fetchAll()}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
              <button
                onClick={() => setActiveTab('employees')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'employees' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users2 className="w-4 h-4" />
                <span>Employee &amp; User Sessions ({internalData.kpis.total_identified_users})</span>
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Admin Audit Trail ({internalData.kpis.total_audit_actions})</span>
              </button>
              <button
                onClick={() => setActiveTab('mobile')}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'mobile' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile &amp; App Health ({appData.kpis.total_crashes} Crashes)</span>
              </button>
            </div>

            {activeTab !== 'mobile' ? (
              <button
                onClick={handleSimulateInternal}
                disabled={simulating}
                className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Simulate Employee &amp; Audit Events</span>
              </button>
            ) : (
              <button
                onClick={handleSimulateApp}
                disabled={simulating}
                className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                <span>Simulate Mobile App Screens &amp; Crash</span>
              </button>
            )}
          </div>

          {/* TAB 1: IDENTIFIED EMPLOYEES & PORTAL USERS */}
          {activeTab === 'employees' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Identified Employees / Users</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{internalData.kpis.total_identified_users}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Tracked via <code>ThirdEye.identify()</code></p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Identified Sessions</span>
                  <div className="text-2xl font-black text-indigo-600 mt-1">{internalData.kpis.identified_sessions}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Linked with session replay</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Admin Audit Events</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{internalData.kpis.total_audit_actions}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Sensitive actions recorded</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">High / Critical Risk Ops</span>
                  <div className="text-2xl font-black text-rose-600 mt-1">{internalData.kpis.high_risk_actions}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Auto-dispatched to Alert Channels</p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by employee email, user ID, role (e.g. Super_Admin, Finance), or department..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    fetchAll(e.target.value);
                  }}
                  className="w-full text-xs text-slate-900 focus:outline-none"
                />
              </div>

              {/* Employee Table */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Identified Portal &amp; Application Users
                  </h3>
                  <span className="text-[11px] text-slate-400">Click Watch Sessions to view exact screen replay</span>
                </div>

                {internalData.identified_users.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Users2 className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No identified portal users yet</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Call <code>ThirdEye.identify(user.id, &#123; email, name, role, department &#125;)</code> in your internal portal or click <strong>Simulate Employee &amp; Audit Events</strong> above to test.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <th className="py-3 px-5">Employee / User</th>
                          <th className="py-3 px-4">Role &amp; Dept</th>
                          <th className="py-3 px-4">Sessions</th>
                          <th className="py-3 px-4">Events</th>
                          <th className="py-3 px-4">Audit Actions</th>
                          <th className="py-3 px-4">Last Visited Screen</th>
                          <th className="py-3 px-5 text-right">Session Replay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {internalData.identified_users.map((u) => (
                          <tr key={u.user_id} className="hover:bg-slate-50/80">
                            <td className="py-3.5 px-5">
                              <div className="font-bold text-slate-900">{u.user_name || u.user_email || u.user_id}</div>
                              <div className="text-[11px] font-mono text-slate-500">{u.user_email || `ID: ${u.user_id}`}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {u.user_role || 'Member'}
                              </span>
                              <span className="ml-1.5 text-[11px] text-slate-500">{u.department}</span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800">{u.sessions_count}</td>
                            <td className="py-3.5 px-4 text-slate-600">{u.events_count}</td>
                            <td className="py-3.5 px-4">
                              <span className={`font-bold ${u.audit_actions_count > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                {u.audit_actions_count}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                              {u.last_url || '/'}
                            </td>
                            <td className="py-3.5 px-5 text-right">
                              <Link
                                href={`/analytics/sessions?user=${encodeURIComponent(u.user_email || u.user_id)}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Watch Sessions</span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: INTERNAL ADMIN AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Internal Admin &amp; Sensitive Operation Audit Trail
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    High &amp; Critical risk actions automatically trigger alerts to your connected Email/Slack channels.
                  </p>
                </div>
              </div>

              {internalData.audit_logs.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No internal audit actions logged yet</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Call <code>ThirdEye.audit(&quot;export_csv&quot;, &#123; target: &quot;users_table&quot;, risk_level: &quot;high&quot; &#125;)</code> or click <strong>Simulate Employee &amp; Audit Events</strong>.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <th className="py-3 px-5">Risk Level</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Actor (Employee)</th>
                        <th className="py-3 px-4">Target Resource</th>
                        <th className="py-3 px-4">IP Address</th>
                        <th className="py-3 px-5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {internalData.audit_logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-5">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${riskBadge(log.risk_level)}`}>
                              {log.risk_level}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{log.action}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{log.user_name || log.user_email || log.user_id || 'System'}</div>
                            <div className="text-[11px] text-slate-500">{log.user_role} • {log.department}</div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">{log.target_resource || '-'}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{log.ip_address || '-'}</td>
                          <td className="py-3.5 px-5 text-[11px] text-slate-400">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MOBILE & APP TELEMETRY */}
          {activeTab === 'mobile' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Crash-Free Sessions</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{appData.kpis.crash_free_rate_pct}%</div>
                  <p className="text-[11px] text-slate-500 mt-1">Mobile &amp; App stability</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">App Screen Views</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{appData.kpis.total_app_events}</div>
                  <p className="text-[11px] text-slate-500 mt-1">In-app screen transitions</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total App Crashes</span>
                  <div className="text-2xl font-black text-rose-600 mt-1">{appData.kpis.total_crashes}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Unhandled exceptions</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ANR (UI Freeze &gt;5s)</span>
                  <div className="text-2xl font-black text-amber-600 mt-1">{appData.kpis.anr_count}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Main thread blocks</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active App Releases</span>
                  <div className="text-2xl font-black text-indigo-600 mt-1">{appData.kpis.active_versions_count}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Tracked build versions</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Release Versions */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">App Version Stability</h3>
                  {appData.versions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No mobile versions tracked yet</p>
                  ) : (
                    <div className="space-y-2.5">
                      {appData.versions.map((v) => (
                        <div key={v.version} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-slate-900">v{v.version} <span className="text-[10px] font-mono uppercase bg-white px-2 py-0.5 rounded border border-slate-200 ml-1">{v.platform}</span></div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{v.sessions} sessions • {v.events} screens</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-black ${v.crash_free_pct >= 98 ? 'text-emerald-600' : 'text-amber-600'}`}>{v.crash_free_pct}% free</div>
                            <div className="text-[10px] text-rose-600 font-bold">{v.crashes} crashes</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top App Screens */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Top Mobile Screens</h3>
                  {appData.screens.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No screen_view events yet</p>
                  ) : (
                    <div className="space-y-2">
                      {appData.screens.map((s) => (
                        <div key={s.screen} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs">
                          <span className="font-mono font-bold text-slate-800 truncate">{s.screen}</span>
                          <span className="font-extrabold text-indigo-600">{s.views} views</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Devices */}
                <div className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Device Models &amp; OS</h3>
                  {appData.devices.length === 0 ? (
                    <p className="text-xs text-slate-400 py-6 text-center">No mobile devices reported yet</p>
                  ) : (
                    <div className="space-y-2">
                      {appData.devices.map((d) => (
                        <div key={d.device} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 text-xs">
                          <span className="font-bold text-slate-800 truncate">{d.device}</span>
                          <span className="font-mono text-slate-600">{d.count} events</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Crash & ANR Stack Traces */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Mobile Crash &amp; ANR Diagnostics (with Device Memory, Battery &amp; Stack Trace)
                  </h3>
                </div>
                {appData.crashes.length === 0 ? (
                  <div className="p-10 text-center text-xs text-slate-400">
                    Zero mobile crashes or ANRs recorded. Click <strong>Simulate Mobile App Screens &amp; Crash</strong> above to test crash diagnostics.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {appData.crashes.map((c) => (
                      <div key={c.id} className="p-5 space-y-2.5 hover:bg-slate-50/50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              c.error_type === 'anr' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {c.error_type}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900">{c.message}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                            <span>{c.device_model || c.platform} ({c.os_version || 'OS'})</span>
                            <span>v{c.app_version}</span>
                            {c.memory_free_mb && <span>RAM Free: {c.memory_free_mb}MB</span>}
                            {c.battery_pct && <span>Battery: {c.battery_pct}%</span>}
                            {c.network_type && <span className="uppercase">{c.network_type}</span>}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Screen: <strong className="font-mono text-slate-800">{c.screen_name || 'Unknown'}</strong> • User: <strong className="font-mono text-slate-800">{c.user_email || c.user_id || 'Anonymous'}</strong>
                        </div>
                        {c.stack_trace && (
                          <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
                            {c.stack_trace}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
