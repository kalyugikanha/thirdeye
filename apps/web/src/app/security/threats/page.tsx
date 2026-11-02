"use client";

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Globe2, 
  Lock, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  Filter, 
  Search, 
  Trash2, 
  Plus, 
  ArrowLeft,
  X,
  Radio,
  ExternalLink,
  Shield,
  KeyRound,
  Terminal,
  FileCheck2,
  CheckCircle2,
  Ban
} from 'lucide-react';

interface ThreatEvent {
  id: number;
  ip_address: string;
  country: string;
  country_code: string;
  threat_type: string;
  target_path: string;
  payload_sample: string;
  severity: string;
  action_taken: string;
  user_agent: string;
  created_at: string;
}

interface BlockedIP {
  id: number;
  ip_address: string;
  reason: string;
  blocked_by: string;
  created_at: string;
}

interface ThreatResponse {
  kpis: {
    total_threats: number;
    blocked_count: number;
    critical_count: number;
    high_count: number;
    active_blocked_ips: number;
    waf_status: string;
    mitigation_rate: string;
  };
  country_distribution: { country: string; count: number }[];
  attack_vectors: { vector: string; count: number }[];
  threats: ThreatEvent[];
}

export default function ThreatsRadarPage() {
  const [data, setData] = useState<ThreatResponse | null>(null);
  const [blockedIps, setBlockedIps] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualReason, setManualReason] = useState('Repeated exploit probing');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadThreats = useCallback(async () => {
    const token = localStorage.getItem('te_token');
    const pid = localStorage.getItem('te_active_project_id') || '';
    const q = pid ? `?project_id=${pid}` : '';
    setLoading(true);
    try {
      const [tRes, bRes] = await Promise.all([
        fetch(apiUrl(`/api/v1/secureeye/threats${q}`), {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(apiUrl(`/api/v1/secureeye/threats/blocked-ips${q}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (tRes.ok) {
        setData(await tRes.json());
      }
      if (bRes.ok) {
        const bData = await bRes.json();
        setBlockedIps(bData.blocked_ips || []);
      }
    } catch (err) {
      console.error('Failed to load threats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreats();
  }, [loadThreats]);

  const handleBlockIp = async (ip: string, reason: string = 'WAF Automated Rule') => {
    setActionLoading(`block_${ip}`);
    try {
      const token = localStorage.getItem('te_token');
      const pid = localStorage.getItem('te_active_project_id') || '';
      const res = await fetch(apiUrl('/api/v1/secureeye/threats/block-ip'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: pid ? parseInt(pid) : undefined,
          ip_address: ip,
          reason
        })
      });
      if (res.ok) {
        showToast(`IP ${ip} permanently added to WAF Blacklist.`);
        setShowBlockModal(false);
        setManualIp('');
        loadThreats();
      }
    } catch (err: any) {
      alert(err.message || 'Block IP failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblockIp = async (id: number, ip: string) => {
    setActionLoading(`unblock_${id}`);
    try {
      const token = localStorage.getItem('te_token');
      const pid = localStorage.getItem('te_active_project_id') || '';
      const res = await fetch(apiUrl(`/api/v1/secureeye/threats/blocked-ips/${id}?project_id=${pid}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast(`IP ${ip} unblocked successfully.`);
        loadThreats();
      }
    } catch (err: any) {
      alert(err.message || 'Unblock failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredThreats = data?.threats.filter(t => {
    if (filterType === 'ALL') return true;
    return t.threat_type === filterType;
  }) || [];

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="w-full flex flex-col gap-6 pb-16">

          {/* Navigation Sub-Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <Link href="/security" className="hover:text-slate-700 flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Cyber Security
                </Link>
                <span>/</span>
                <span className="text-slate-600">Threat Defense</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Live WAF &amp; Real-Time Threat Radar</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> Active Defense
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Continuous Web Application Firewall (WAF) telemetry: inspect blocked SQL injections, path traversal probes, bot scrapers, and manage IP blacklists in real time.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowBlockModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5 text-rose-500" />
                <span>Blacklist Malicious IP</span>
              </button>

              <button
                onClick={loadThreats}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-2xs transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Sub-Navigation Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/security" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
              Command Center
            </Link>
            <Link href="/security/threats" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-xs">
              WAF &amp; Threat Radar
            </Link>
            <Link href="/security/secrets" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
              Secret Leak Shield (DLP)
            </Link>
            <Link href="/security/api-security" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
              API Security &amp; Pen-Test
            </Link>
            <Link href="/security/compliance" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
              Compliance &amp; Trust Badge
            </Link>
          </div>

          {/* Toast Notification */}
          {toast && (
            <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-700 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toast}</span>
            </div>
          )}

          {/* KPI Bento Scorecard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Exploits Blocked</span>
                <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {data?.kpis.blocked_count ?? 0}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  100% of detected intrusions mitigated
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-emerald-600">
                Mitigation Rate: {data?.kpis.mitigation_rate ?? '99.4%'}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Critical / High Severity</span>
                <span className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-black text-rose-600 font-mono tracking-tight">
                  {(data?.kpis.critical_count ?? 0) + (data?.kpis.high_count ?? 0)}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  SQLi, XSS &amp; Path Traversal attacks
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-500">
                {data?.kpis.critical_count ?? 0} Critical &bull; {data?.kpis.high_count ?? 0} High
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Blocked IPs</span>
                <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Ban className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  {blockedIps.length || (data?.kpis.active_blocked_ips ?? 0)}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Permanent WAF drop rules
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-500">
                Zero-tolerance exploit blacklist
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-rose-950 text-white rounded-3xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">
                    Edge WAF Status
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="mt-2">
                  <span className="text-xl font-black tracking-tight block">
                    {data?.kpis.waf_status ?? 'Active & Mitigating'}
                  </span>
                  <span className="text-xs text-slate-300 block mt-0.5 font-mono">
                    Deep inspection of query &amp; body payloads
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 text-[10px] font-mono text-emerald-400 font-bold">
                OWASP Core Ruleset v4.0 Active
              </div>
            </div>

          </div>

          {/* Attack Vectors & Geographic Intelligence */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left (8 Cols): Real-Time Exploit Feed */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>Live Exploit Intrusion Stream</span>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time anomalous requests analyzed and neutralized at the ingress layer.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {['ALL', 'sqli', 'path_traversal', 'xss', 'credential_stuffing', 'bot_scraper'].map((vt) => (
                    <button
                      key={vt}
                      onClick={() => setFilterType(vt)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        filterType === vt
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {vt.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Attacker IP</th>
                      <th className="py-3 px-4">Origin</th>
                      <th className="py-3 px-4">Attack Vector</th>
                      <th className="py-3 px-4">Target URI</th>
                      <th className="py-3 px-4">Payload Sample</th>
                      <th className="py-3 px-4">WAF Action</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredThreats.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {t.ip_address}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700">{t.country}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            t.threat_type === 'sqli' ? 'bg-rose-100 text-rose-700' :
                            t.threat_type === 'path_traversal' ? 'bg-purple-100 text-purple-700' :
                            t.threat_type === 'xss' ? 'bg-amber-100 text-amber-800' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {t.threat_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600 max-w-[140px] truncate" title={t.target_path}>
                          {t.target_path}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-rose-600 max-w-[140px] truncate" title={t.payload_sample}>
                          {t.payload_sample}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            {t.action_taken}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleBlockIp(t.ip_address, `Exploit pattern: ${t.threat_type}`)}
                            disabled={actionLoading === `block_${t.ip_address}`}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                          >
                            Block IP
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right (4 Cols): Blacklisted IPs & Vectors */}
            <div className="lg:col-span-4 space-y-4">
              
              {/* Blocked IPs Manager */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                      <Ban className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      WAF IP Blacklist ({blockedIps.length})
                    </h4>
                  </div>
                </div>

                {blockedIps.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No blacklisted IPs. Click &ldquo;Blacklist Malicious IP&rdquo; to add.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {blockedIps.map((b) => (
                      <div key={b.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-900 block">{b.ip_address}</span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">{b.reason}</span>
                        </div>
                        <button
                          onClick={() => handleUnblockIp(b.id, b.ip_address)}
                          disabled={actionLoading === `unblock_${b.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Unblock this IP"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Geographic Distribution Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Threat Origin Distribution</span>
                </h4>
                <div className="space-y-2">
                  {data?.country_distribution?.slice(0, 5).map((c) => (
                    <div key={c.country} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{c.country}</span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        {c.count} probes
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* MANUAL BLACKLIST IP MODAL */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowBlockModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Blacklist IP Address</h3>
                <p className="text-xs text-slate-500">Permanently drop all incoming traffic from this IP.</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualIp.trim()) handleBlockIp(manualIp.trim(), manualReason);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-700 font-bold mb-1">IP Address to Block</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 185.220.101.5"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason for Blacklist</label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-xs cursor-pointer"
                >
                  {actionLoading ? 'Blacklisting...' : 'Confirm Blacklist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
