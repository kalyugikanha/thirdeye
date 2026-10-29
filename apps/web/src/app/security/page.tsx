"use client";

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import PaginationControls from '@/components/PaginationControls';
import PortalNewsBanner from '@/components/PortalNewsBanner';
import { apiUrl } from '@/lib/api';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  Server,
  Globe2,
  Terminal,
  Bug,
  Gauge,
  ClipboardCheck,
  BookOpen,
  Play,
  Plus,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Eye,
  Cpu,
  FileCode2,
  Activity,
  FileText,
  Download,
  ExternalLink,
  Shield,
  KeyRound,
  ChevronDown
} from 'lucide-react';

export default function SecureEyeMasterPage() {
  const [activeTab, setActiveTab] = useState<'surface' | 'findings' | 'qa' | 'launch' | 'playbooks' | 'catalog'>('surface');
  const [overview, setOverview] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Scan controls
  const [targetUrl, setTargetUrl] = useState('');
  const [scanMode, setScanMode] = useState<'passive' | 'safe_active' | 'deep_authorized'>('safe_active');
  const [scanning, setScanning] = useState(false);
  const [inspectingLocal, setInspectingLocal] = useState(false);

  // Ownership verification modal & state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyTokenData, setVerifyTokenData] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyMethod, setVerifyMethod] = useState<'auto' | 'dns_txt' | 'token_file' | 'telemetry'>('auto');
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Retest state
  const [retestingId, setRetestingId] = useState<number | null>(null);
  const [retestFeedback, setRetestFeedback] = useState<{ [id: number]: { status: string; message: string } }>({});

  // Report export dropdown
  const [showReportDropdown, setShowReportDropdown] = useState(false);

  // Findings filters & pagination
  const [sevFilter, setSevFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [findingsPage, setFindingsPage] = useState<number>(1);
  const [findingsPageSize, setFindingsPageSize] = useState<number>(5);

  // QA Engine controls
  const [fuzzRunning, setFuzzRunning] = useState(false);
  const [fuzzOutput, setFuzzOutput] = useState<any>(null);
  const [loadRunning, setLoadRunning] = useState(false);
  const [loadReqs, setLoadReqs] = useState(12);
  const [loadConc, setLoadConc] = useState(4);
  const [loadKind, setLoadKind] = useState<'load' | 'spike'>('load');
  const [loadOutput, setLoadOutput] = useState<any>(null);

  // New QA test case modal/form
  const [newCaseTitle, setNewCaseTitle] = useState('');
  const [newCaseSuite, setNewCaseSuite] = useState('regression');
  const [newCaseArea, setNewCaseArea] = useState('Functional');
  const [newCaseSteps, setNewCaseSteps] = useState('');
  const [addingCase, setAddingCase] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchAll = async () => {
    const token = localStorage.getItem('te_token');
    const pid = localStorage.getItem('te_active_project_id') || '';
    const q = pid ? `?project_id=${pid}` : '';
    try {
      const [ovRes, catRes] = await Promise.all([
        fetch(apiUrl(`/api/v1/secureeye/overview${q}`), {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(apiUrl(`/api/v1/secureeye/catalog${q}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      if (ovRes.ok) {
        const ovData = await ovRes.json();
        setOverview(ovData);
        if (!targetUrl && ovData.project?.domain) {
          setTargetUrl(`https://${ovData.project.domain}`);
        }
      }
      if (catRes.ok) {
        setCatalog(await catRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleRunFullScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setScanning(true);
    const token = localStorage.getItem('te_token');
    const pid = Number(localStorage.getItem('te_active_project_id') || 0) || undefined;
    try {
      const res = await fetch(apiUrl('/api/v1/secureeye/scan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          url: targetUrl,
          project_id: pid,
          scan_mode: scanMode,
          authorized_consent: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult(data);
        await fetchAll();
      } else {
        alert(data.detail || 'Scan blocked by guardrail');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleInspectServerSockets = async () => {
    setInspectingLocal(true);
    const token = localStorage.getItem('te_token');
    const pid = localStorage.getItem('te_active_project_id') || '';
    const q = pid ? `?project_id=${pid}` : '';
    try {
      await fetch(apiUrl(`/api/v1/secureeye/agent/inspect-local${q}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchAll();
    } catch (e) {
      console.error(e);
    } finally {
      setInspectingLocal(false);
    }
  };

  const handleOpenVerifyModal = async () => {
    setShowVerifyModal(true);
    setVerifyResult(null);
    const token = localStorage.getItem('te_token');
    const pid = localStorage.getItem('te_active_project_id') || '';
    const q = pid ? `?project_id=${pid}` : '';
    try {
      const res = await fetch(apiUrl(`/api/v1/secureeye/verification-token${q}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setVerifyTokenData(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyOwnership = async () => {
    setVerifying(true);
    setVerifyResult(null);
    const token = localStorage.getItem('te_token');
    const pid = Number(localStorage.getItem('te_active_project_id') || 0) || undefined;
    try {
      const res = await fetch(apiUrl('/api/v1/secureeye/verify-ownership'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: pid,
          method: verifyMethod
        })
      });
      const data = await res.json();
      setVerifyResult(data);
      if (data.verified) {
        await fetchAll();
      }
    } catch (e) {
      setVerifyResult({ verified: false, message: 'Network or server error during verification.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleRetestFinding = async (findingId: number) => {
    setRetestingId(findingId);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/secureeye/findings/${findingId}/retest`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setRetestFeedback(prev => ({
        ...prev,
        [findingId]: { status: data.status, message: data.message }
      }));
      await fetchAll();
    } catch (e) {
      setRetestFeedback(prev => ({
        ...prev,
        [findingId]: { status: 'error', message: 'Failed to contact retest server.' }
      }));
    } finally {
      setRetestingId(null);
    }
  };

  const handleOpenPrintReport = () => {
    setShowReportDropdown(false);
    const pid = localStorage.getItem('te_active_project_id') || '';
    const q = pid ? `?project_id=${pid}` : '';
    window.open(apiUrl(`/api/v1/secureeye/report/html${q}`), '_blank');
  };

  const handleDownloadCSV = () => {
    setShowReportDropdown(false);
    const pid = localStorage.getItem('te_active_project_id') || '';
    const q = pid ? `?project_id=${pid}` : '';
    window.location.href = apiUrl(`/api/v1/secureeye/report/csv${q}`);
  };

  const handleUpdateFinding = async (findingId: number, status: string) => {
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/secureeye/findings/${findingId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      await fetchAll();
    } catch (e) {}
  };

  const handleRunFuzzer = async () => {
    setFuzzRunning(true);
    const token = localStorage.getItem('te_token');
    const pid = Number(localStorage.getItem('te_active_project_id') || 0) || undefined;
    try {
      const res = await fetch(apiUrl('/api/v1/secureeye/qa/fuzz'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ target_url: targetUrl, project_id: pid })
      });
      if (res.ok) {
        setFuzzOutput(await res.json());
        await fetchAll();
      }
    } catch (e) {
    } finally {
      setFuzzRunning(false);
    }
  };

  const handleRunLoadTest = async () => {
    setLoadRunning(true);
    const token = localStorage.getItem('te_token');
    const pid = Number(localStorage.getItem('te_active_project_id') || 0) || undefined;
    try {
      const res = await fetch(apiUrl('/api/v1/secureeye/qa/load-test'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_url: targetUrl,
          project_id: pid,
          total_requests: loadReqs,
          concurrency: loadConc,
          test_kind: loadKind
        })
      });
      if (res.ok) {
        setLoadOutput(await res.json());
        await fetchAll();
      }
    } catch (e) {
    } finally {
      setLoadRunning(false);
    }
  };

  const handleToggleTestCase = async (caseId: number, nextStatus: string) => {
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/secureeye/qa/test-cases/${caseId}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: nextStatus,
          evidence: nextStatus === 'passed' ? 'Verified & Signed Off by QA' : 'Marked for review'
        })
      });
      await fetchAll();
    } catch (e) {}
  };

  const handleCreateTestCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseTitle.trim()) return;
    setAddingCase(true);
    const token = localStorage.getItem('te_token');
    const pid = Number(localStorage.getItem('te_active_project_id') || 0) || undefined;
    try {
      const res = await fetch(apiUrl('/api/v1/secureeye/qa/test-cases'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: pid,
          suite: newCaseSuite,
          area: newCaseArea,
          title: newCaseTitle.trim(),
          test_type: 'manual',
          perspective: 'black_box',
          steps: newCaseSteps || 'Execute scenario & verify expected behavior',
          expected_result: 'Passes functional and security assertions'
        })
      });
      if (res.ok) {
        setNewCaseTitle('');
        setNewCaseSteps('');
        await fetchAll();
      }
    } catch (e) {
    } finally {
      setAddingCase(false);
    }
  };

  const copyCode = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const summary = overview?.summary || {
    security_score: 92,
    grade: 'A',
    open_findings_count: 0,
    total_findings_count: 0,
    severity_breakdown: { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 },
    launch_readiness_pct: 85,
    launch_passed: 12,
    launch_total: 14,
    qa_total_cases: 19,
    qa_passed_cases: 17
  };

  const findingsList: any[] = (overview?.findings || []).filter((f: any) => {
    if (sevFilter !== 'ALL' && f.severity !== sevFilter) return false;
    if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
    return true;
  });

  const launchCases: any[] = (overview?.qa_test_cases || []).filter((c: any) => c.suite === 'launch_checklist');
  const qaSuiteCases: any[] = (overview?.qa_test_cases || []).filter((c: any) => c.suite !== 'launch_checklist');

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* In-Portal Critical Security & Quota Broadcast Banner */}
        <PortalNewsBanner />

        <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 lg:px-10 pb-16">
          
          {/* Top Enterprise Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      SecureEye: Cybersecurity & QA Command Center
                    </h1>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      3-Phase Blueprint
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Continuous Attack Surface Monitoring • 0.0.0.0 Exposure Detection • 14-Point Pre-Launch QA Gate
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Asset Guardrail & Verification Trigger */}
              <button
                type="button"
                onClick={handleOpenVerifyModal}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-left transition-all cursor-pointer group"
                title="Click to view DNS TXT / Token File verification details"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Asset Guardrail</span>
                  <span className="text-[10px] font-extrabold text-indigo-600 opacity-80 group-hover:opacity-100">Verify ⚙</span>
                </div>
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5 mt-0.5 font-mono text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {overview?.project?.domain || 'Verified Workspace'}
                </span>
              </button>

              <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center min-w-[110px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Security Score</span>
                <span className="text-lg font-black text-slate-900">{summary.security_score}/100 <span className="text-xs font-bold text-slate-500">({summary.grade})</span></span>
              </div>

              <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Launch Readiness</span>
                <span className="text-lg font-black text-indigo-600">{summary.launch_readiness_pct}% <span className="text-xs font-bold text-slate-500">({summary.launch_passed}/{summary.launch_total})</span></span>
              </div>

              {/* Executive Report Export Button & Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowReportDropdown(!showReportDropdown)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Executive Report</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </button>

                {showReportDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1">
                    <button
                      type="button"
                      onClick={handleOpenPrintReport}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-slate-900 font-extrabold">Print / PDF Executive Report</div>
                        <div className="text-[10px] text-slate-500 font-medium">Full CIA Triad & QA Audit Sign-off</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadCSV}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer transition-colors"
                    >
                      <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                        <Download className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-slate-900 font-extrabold">Export Findings CSV</div>
                        <div className="text-[10px] text-slate-500 font-medium">10-field structured spreadsheet</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Scan Bar */}
          <form onSubmit={handleRunFullScan} className="bg-white border border-slate-200/90 rounded-3xl p-4 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-end">
            <div className="flex-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Target Asset (Domain / URL)
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://selfupcommunity.com"
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            <div className="w-full lg:w-64">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Ethical Scan Mode (Section 2C)
              </label>
              <select
                value={scanMode}
                onChange={(e) => setScanMode(e.target.value as any)}
                className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 cursor-pointer transition-all"
              >
                <option value="passive">Passive (Headers, TLS, DNS, Recon)</option>
                <option value="safe_active">Safe Active (+15 Port Scan & Exposure)</option>
                <option value="deep_authorized">Deep Authorized (+CORS, API & Secret Probe)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={scanning}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" /> : <Lock className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{scanning ? 'Running Stage 1–3 Scan...' : 'Run SecureEye Audit'}</span>
            </button>

            <button
              type="button"
              onClick={handleInspectServerSockets}
              disabled={inspectingLocal}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              title="Inspect local server listening sockets (ss -tlnp) to detect 0.0.0.0 binds"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${inspectingLocal ? 'animate-spin' : ''}`} />
              <span>Sync Inside Sockets (0.0.0.0)</span>
            </button>
          </form>

          {/* Sleek Horizontal Segmented Control Track */}
          <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/70 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[
              { id: 'surface', label: '1. Attack Surface & 0.0.0.0 Radar', icon: Server },
              { id: 'findings', label: `2. Findings Tracker (${summary.open_findings_count} Open)`, icon: ShieldAlert },
              { id: 'qa', label: '3. QA, Fuzzer & Load Engine', icon: Gauge },
              { id: 'launch', label: `4. 14-Point Launch Gate (${summary.launch_readiness_pct}%)`, icon: ClipboardCheck },
              { id: 'playbooks', label: '5. Server Hardening & Logs', icon: Terminal },
              { id: 'catalog', label: '6. Blueprint Attack Catalog', icon: BookOpen },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* ================= TAB 1: ATTACK SURFACE & 0.0.0.0 RADAR ================= */}
          {activeTab === 'surface' && (
            <div className="space-y-6">
              {/* Inside vs Outside 0.0.0.0 Detector Card */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Server className="w-5 h-5 text-rose-600" />
                      <h2 className="text-base font-extrabold text-slate-900">
                        Inside (`ss -tlnp`) vs. Outside (External Port Scan) — The `0.0.0.0` Detector
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Compares internal listening socket binds (`0.0.0.0` / `:::` vs loopback `127.0.0.1`) against external internet reachability.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-3 py-1 rounded-full font-bold ${
                      overview?.inside_agent?.env_permissions_ok
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      .env Locked: {overview?.inside_agent?.env_permissions_ok ? 'Yes (Safe)' : 'World-Readable!'}
                    </span>
                    <span className="px-3 py-1 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      FIM Integrity: {overview?.inside_agent?.fim_status?.integrity || 'Verified'} ({overview?.inside_agent?.fim_status?.monitored_files || 4} files)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Port</th>
                        <th className="py-2.5 px-3">Process / Service</th>
                        <th className="py-2.5 px-3">Inside Bind Address</th>
                        <th className="py-2.5 px-3">Wildcard `0.0.0.0`?</th>
                        <th className="py-2.5 px-3">Risk Level</th>
                        <th className="py-2.5 px-3">SecureEye Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(overview?.inside_agent?.listening_sockets || []).map((s: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-extrabold text-slate-900">:{s.port}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{s.process}</td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              s.is_wildcard_0000
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {s.bind}:{s.port}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {s.is_wildcard_0000 ? (
                              <span className="text-rose-600 font-bold">Yes (All Interfaces)</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">No (Loopback Only)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              s.risk === 'critical'
                                ? 'bg-rose-100 text-rose-700'
                                : s.risk === 'high'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {s.risk}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{s.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Live Scan Results (When Scan Triggered) */}
              {scanResult && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Recon & Subdomains */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Globe2 className="w-4 h-4 text-indigo-600" />
                      Stage 1: Passive Recon, DNS & Subdomains ({scanResult.recon?.subdomains?.length || 0})
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">SPF Anti-Spoofing</span>
                        <span className={`font-extrabold ${scanResult.recon?.spf_configured ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {scanResult.recon?.spf_configured ? 'Configured (Pass)' : 'Missing (Vulnerable)'}
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">DMARC Policy</span>
                        <span className={`font-extrabold ${scanResult.recon?.dmarc_configured ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {scanResult.recon?.dmarc_configured ? 'Configured (Pass)' : 'Missing (Vulnerable)'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Certificate Transparency Subdomains (crt.sh)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(scanResult.recon?.subdomains || []).map((sub: string) => (
                          <span key={sub} className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-mono text-[11px] font-semibold">
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sensitive File Exposure Probe */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-rose-600" />
                      Stage 2: Sensitive File & Secret Exposure Probe (12 Paths)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {(scanResult.sensitive_paths || []).map((sp: any) => (
                        <div
                          key={sp.path}
                          className={`p-2.5 rounded-2xl border text-xs flex items-center justify-between ${
                            sp.exposed
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : 'bg-slate-50 border-slate-200/60 text-slate-700'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="font-mono font-bold block">{sp.path}</span>
                            <span className="text-[10px] opacity-75">{sp.label}</span>
                          </div>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            sp.exposed ? 'bg-rose-600 text-white' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {sp.exposed ? 'EXPOSED' : 'SAFE'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* External Port Scan Matrix (when scanResult has inside_vs_outside_ports) */}
              {scanResult?.inside_vs_outside_ports?.length > 0 && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Stage 3: External 15-Port Probe vs. Inside Socket Comparison on `{scanResult.host}`
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {scanResult.inside_vs_outside_ports.map((p: any) => (
                      <div
                        key={p.port}
                        className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                          p.outside_reachable && ![80, 443].includes(p.port)
                            ? 'bg-rose-50 border-rose-200'
                            : 'bg-slate-50 border-slate-200/70'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-extrabold text-sm text-slate-900">
                            Port {p.port} ({p.service})
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            p.outside_reachable && ![80, 443].includes(p.port)
                              ? 'bg-rose-600 text-white'
                              : p.outside_reachable
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {p.outside_reachable ? 'OPEN EXTERNALLY' : 'CLOSED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Inside Bind: <code className="font-mono font-bold">{p.inside_bind}</code> ({p.inside_process})
                        </p>
                        <p className="text-[10px] font-bold text-slate-500">{p.status_label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: FINDINGS & REMEDIATION TRACKER ================= */}
          {activeTab === 'findings' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {['ALL', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSevFilter(sev)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                        sevFilter === sev
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {['ALL', 'open', 'accepted', 'fixed'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${
                        statusFilter === st
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {findingsList.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-2">
                  <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h3 className="text-base font-extrabold text-slate-900">No Matching Findings</h3>
                  <p className="text-xs text-slate-500">Click &ldquo;Run SecureEye Audit&rdquo; above to scan your asset and populate structured findings.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {findingsList.slice((findingsPage - 1) * findingsPageSize, findingsPage * findingsPageSize).map((f: any) => (
                    <div key={f.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                              f.severity === 'Critical'
                                ? 'bg-rose-600 text-white'
                                : f.severity === 'High'
                                ? 'bg-orange-500 text-white'
                                : f.severity === 'Medium'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {f.severity} • CVSS {f.cvss_score}
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              CIA Impact: {f.cia_impact}
                            </span>
                            <span className="text-xs font-mono text-slate-500">{f.asset}</span>
                          </div>
                          <h3 className="text-base font-extrabold text-slate-900">{f.title}</h3>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl ${
                            f.status === 'fixed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : f.status === 'accepted'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            Status: {f.status}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRetestFinding(f.id)}
                            disabled={retestingId === f.id}
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            title="Retest this specific vulnerability live on the server"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${retestingId === f.id ? 'animate-spin text-indigo-600' : ''}`} />
                            <span>{retestingId === f.id ? 'Retesting...' : 'Retest Live'}</span>
                          </button>

                          {f.status !== 'fixed' && (
                            <button
                              onClick={() => handleUpdateFinding(f.id, 'fixed')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              Mark Fixed
                            </button>
                          )}
                          {f.status === 'open' && (
                            <button
                              onClick={() => handleUpdateFinding(f.id, 'accepted')}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                            >
                              Accept Risk
                            </button>
                          )}
                          {f.status !== 'open' && (
                            <button
                              onClick={() => handleUpdateFinding(f.id, 'open')}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                            >
                              Re-Open
                            </button>
                          )}
                        </div>
                      </div>

                      {retestFeedback[f.id] && (
                        <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 border font-bold ${
                          retestFeedback[f.id].status === 'fixed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}>
                          {retestFeedback[f.id].status === 'fixed' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                          )}
                          <span>{retestFeedback[f.id].message}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 space-y-1">
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 block">1. What & Root Cause</span>
                          <p className="text-slate-800 font-semibold">{f.description}</p>
                          <p className="text-slate-500 pt-1"><strong>Root Cause:</strong> {f.root_cause}</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-950 text-slate-200 space-y-1 font-mono">
                          <span className="text-[10px] font-extrabold uppercase text-rose-400 block font-sans">2. Safe Proof Evidence</span>
                          <p className="text-[11px] break-all">{f.evidence}</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                          <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">3. How to Fix (Remediation)</span>
                          <pre className="text-[11px] text-emerald-950 whitespace-pre-wrap font-mono">{f.fix_steps}</pre>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
                        <div className="flex flex-wrap gap-1.5">
                          {(f.references || []).map((ref: string) => (
                            <span key={ref} className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-mono font-bold text-[10px]">
                              {ref}
                            </span>
                          ))}
                        </div>
                        <span>Owner: {f.owner} • Last Seen: {f.last_seen ? new Date(f.last_seen).toLocaleString() : 'Just now'}</span>
                      </div>
                    </div>
                  ))}

                  {findingsList.length > findingsPageSize && (
                    <div className="pt-2">
                      <PaginationControls
                        page={findingsPage}
                        pageSize={findingsPageSize}
                        totalCount={findingsList.length}
                        totalPages={Math.max(Math.ceil(findingsList.length / findingsPageSize), 1)}
                        onPageChange={(p) => setFindingsPage(p)}
                        onPageSizeChange={(ps) => {
                          setFindingsPageSize(ps);
                          setFindingsPage(1);
                        }}
                        pageSizeOptions={[5, 10, 20]}
                        itemLabel="findings"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: PHASE 1 QA ENGINE (FUZZER, LOAD & TEST CASES) ================= */}
          {activeTab === 'qa' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Boundary & Smart-Monkey Fuzzer */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Bug className="w-5 h-5 text-rose-600" />
                        Boundary, Negative & Smart-Monkey Fuzzer
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Probes target with boundary values (0, -1, overflow, 1024B buffer, special chars, RTL/Unicode) to catch 5xx crashes & stack-trace leaks.
                      </p>
                    </div>
                    <button
                      onClick={handleRunFuzzer}
                      disabled={fuzzRunning}
                      className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {fuzzRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {fuzzRunning ? 'Fuzzing...' : 'Run Boundary Fuzzer'}
                    </button>
                  </div>

                  {fuzzOutput && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold px-2">
                        <span>Passed: {fuzzOutput.passed_vectors}/{fuzzOutput.total_vectors} vectors</span>
                        <span className={fuzzOutput.error_5xx_count > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          5xx Crashes: {fuzzOutput.error_5xx_count} • Stack Leaks: {fuzzOutput.stack_leaks}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {(fuzzOutput.cases || []).map((c: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-800">{c.case}</span>
                              <span className="text-[10px] font-mono text-slate-400 ml-2">{c.latency_ms}ms</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              c.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              HTTP {c.status_code} ({c.passed ? 'SAFE' : 'FAIL'})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Safe Capped Load & Spike Tester */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-indigo-600" />
                        Safe Capped Load & Spike Tester (Section 1D)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Measures p50, p95, p99 latency, throughput (RPS), and 5xx resilience under concurrent burst load.
                      </p>
                    </div>
                    <button
                      onClick={handleRunLoadTest}
                      disabled={loadRunning}
                      className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {loadRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                      {loadRunning ? 'Testing...' : 'Run Load Test'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <label className="block font-bold text-slate-600">
                      Test Mode
                      <select
                        value={loadKind}
                        onChange={(e) => setLoadKind(e.target.value as any)}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold"
                      >
                        <option value="load">Load Test</option>
                        <option value="spike">Spike Burst</option>
                      </select>
                    </label>
                    <label className="block font-bold text-slate-600">
                      Total Requests (Cap 25)
                      <input
                        type="number"
                        min={4}
                        max={25}
                        value={loadReqs}
                        onChange={(e) => setLoadReqs(Number(e.target.value))}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono"
                      />
                    </label>
                    <label className="block font-bold text-slate-600">
                      Concurrency (Cap 8)
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={loadConc}
                        onChange={(e) => setLoadConc(Number(e.target.value))}
                        className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-mono"
                      />
                    </label>
                  </div>

                  {loadOutput && (
                    <div className="grid grid-cols-4 gap-2 pt-2 text-center">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">p50 Latency</span>
                        <span className="text-sm font-extrabold text-slate-900">{loadOutput.p50_ms} ms</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">p95 Latency</span>
                        <span className="text-sm font-extrabold text-indigo-600">{loadOutput.p95_ms} ms</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Throughput</span>
                        <span className="text-sm font-extrabold text-emerald-600">{loadOutput.rps} RPS</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Success Rate</span>
                        <span className="text-sm font-extrabold text-slate-900">
                          {loadOutput.success_count}/{loadOutput.total_requests}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* QA Test-Case Manager */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-slate-900">
                  Phase 1 QA Test-Case Manager (Smoke, Sanity, Regression, Boundary, Negative & UAT)
                </h3>

                <form onSubmit={handleCreateTestCase} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
                  <select
                    value={newCaseSuite}
                    onChange={(e) => setNewCaseSuite(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="smoke">Smoke Suite</option>
                    <option value="sanity">Sanity Suite</option>
                    <option value="regression">Regression Suite</option>
                    <option value="boundary">Boundary Suite</option>
                    <option value="negative">Negative Suite</option>
                    <option value="uat">UAT (User Acceptance)</option>
                  </select>
                  <input
                    value={newCaseArea}
                    onChange={(e) => setNewCaseArea(e.target.value)}
                    placeholder="Module (e.g. Auth, Checkout)"
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                  <input
                    value={newCaseTitle}
                    onChange={(e) => setNewCaseTitle(e.target.value)}
                    placeholder="Test Case Title..."
                    className="md:col-span-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    required
                  />
                  <button
                    type="submit"
                    disabled={addingCase}
                    className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-2 text-xs font-extrabold flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Test Case
                  </button>
                </form>

                <div className="space-y-2">
                  {qaSuiteCases.map((tc: any) => (
                    <div key={tc.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-extrabold uppercase text-[10px]">
                            {tc.suite}
                          </span>
                          <span className="font-extrabold text-slate-900">{tc.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Steps: {tc.steps} • Expected: {tc.expected_result}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {['passed', 'failed', 'flaky'].map((st) => (
                          <button
                            key={st}
                            onClick={() => handleToggleTestCase(tc.id, st)}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase ${
                              tc.status === st
                                ? st === 'passed'
                                  ? 'bg-emerald-600 text-white'
                                  : st === 'failed'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-500 text-white'
                                : 'bg-white border border-slate-200 text-slate-600'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: 14-POINT WEBSITE LAUNCH CHECKLIST ================= */}
          {activeTab === 'launch' && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Section 7: &ldquo;Just Launched a Website&rdquo; — 14-Area Required Testing Gate
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Combines automated ThirdEye/SecureEye telemetry checks with manual QA sign-off before production release.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-indigo-600">
                    {summary.launch_passed} / {summary.launch_total} Areas Verified ({summary.launch_readiness_pct}%)
                  </span>
                  <div className="w-48 bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${summary.launch_readiness_pct}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {launchCases.map((item: any) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border flex items-start justify-between gap-3 ${
                      item.status === 'passed'
                        ? 'bg-emerald-50/40 border-emerald-200/80'
                        : 'bg-amber-50/40 border-amber-200/80'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {item.status === 'passed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        )}
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                          {item.area}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-bold">
                          {item.test_type}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                      <p className="text-[11px] text-slate-500">{item.evidence}</p>
                    </div>

                    <button
                      onClick={() => handleToggleTestCase(item.id, item.status === 'passed' ? 'pending' : 'passed')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase flex-shrink-0 ${
                        item.status === 'passed'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {item.status === 'passed' ? 'Verified ✓' : 'Sign Off'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= TAB 5: PHASE 3 SERVER HARDENING PLAYBOOKS & AUDIT LOGS ================= */}
          {activeTab === 'playbooks' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {[
                  { key: 'ufw', title: '1. UFW Default-Deny & 0.0.0.0 Lockdown', code: catalog?.playbooks?.ufw_lockdown || '' },
                  { key: 'nginx', title: '2. Nginx Reverse-Proxy & OWASP Headers', code: catalog?.playbooks?.nginx_hardening || '' },
                  { key: 'agent', title: '3. Inside-View Server Agent (secureeye-agent.py)', code: catalog?.playbooks?.inside_agent_script || '' },
                ].map((pb) => (
                  <div key={pb.key} className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-black uppercase tracking-tight text-slate-900">{pb.title}</h3>
                      <button
                        onClick={() => copyCode(pb.key, pb.code)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                      >
                        {copiedKey === pb.key ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === pb.key ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="bg-slate-950 text-slate-200 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-80 leading-relaxed [scrollbar-width:thin]">
                      {pb.code}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Scan Audit Log */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Product Guardrail: Immutable Scan Audit Log (Section 9.5)
                </h3>
                <div className="space-y-2">
                  {(overview?.scan_audit_logs || []).map((log: any) => (
                    <div key={log.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white font-mono text-[10px] font-bold uppercase">
                          {log.scan_mode}
                        </span>
                        <span className="font-mono font-bold text-slate-800">{log.target}</span>
                        <span className="text-slate-500">by {log.user_email}</span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {log.summary?.elapsed_ms}ms • {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 6: BLUEPRINT ATTACK CATALOG & 12 ROOT CAUSES ================= */}
          {activeTab === 'catalog' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-slate-900">
                  Section 2: The 12 Root Causes of Security Breaches
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(catalog?.root_causes || []).map((rc: any) => (
                    <div key={rc.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1 text-xs">
                      <span className="text-[10px] font-extrabold uppercase text-rose-600">Root Cause #{rc.id}</span>
                      <h4 className="font-extrabold text-slate-900 text-sm">{rc.cause}</h4>
                      <p className="text-slate-600"><strong>Example:</strong> {rc.example}</p>
                      <p className="text-emerald-700 font-semibold"><strong>Defense:</strong> {rc.fix}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-extrabold text-slate-900">
                  Section 4: Master Attack Catalog (Concept, Root Cause & Prevention)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(catalog?.attack_catalog || []).map((ac: any, i: number) => (
                    <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1 text-xs">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        {ac.category}
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm pt-1">{ac.name}</h4>
                      <p className="text-slate-600"><strong>Concept:</strong> {ac.concept}</p>
                      <p className="text-rose-700"><strong>Root Cause:</strong> {ac.root_cause}</p>
                      <p className="text-emerald-700 font-semibold"><strong>Detect / Prevent:</strong> {ac.prevention}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Ownership Verification Modal */}
        {showVerifyModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Domain Ownership Verification</h3>
                    <p className="text-xs text-slate-500">SecureEye Section 0: Verify ownership prior to Deep Authorized scans</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Verification Methods Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                {[
                  { id: 'auto', label: '1. Auto / Telemetry' },
                  { id: 'dns_txt', label: '2. DNS TXT' },
                  { id: 'token_file', label: '3. Token File' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setVerifyMethod(m.id as any)}
                    className={`py-2 px-2.5 rounded-xl transition-all cursor-pointer ${
                      verifyMethod === m.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Instruction Details based on method */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-3">
                {verifyMethod === 'auto' && (
                  <div className="space-y-2">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      Active Telemetry Pass-Through
                    </div>
                    <p className="text-slate-600">
                      If the ThirdEye tracking script (<code className="font-mono font-bold text-slate-800">te.js</code>) is already embedded and collecting live visitor sessions or events on <code className="font-mono font-bold text-indigo-700">{overview?.project?.domain || 'this domain'}</code>, ownership is confirmed automatically.
                    </p>
                  </div>
                )}

                {verifyMethod === 'dns_txt' && (
                  <div className="space-y-2.5">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Globe2 className="w-4 h-4 text-indigo-600" />
                      DNS TXT Record Configuration
                    </div>
                    <p className="text-slate-600">
                      Add the following TXT record to your DNS zone provider (Cloudflare, GoDaddy, Hostinger, etc.):
                    </p>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between items-center text-slate-500 text-[10px] font-sans font-bold uppercase">
                        <span>DNS Host: <code>@</code></span>
                        <span>Type: <code>TXT</code></span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <code className="text-indigo-600 font-bold break-all">
                          {verifyTokenData?.dns_txt?.txt_value || `thirdeye-verification=${overview?.project?.verification_token || 'thirdeye-verify-token'}`}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCode('txt_val', verifyTokenData?.dns_txt?.txt_value || `thirdeye-verification=${overview?.project?.verification_token}`)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 flex-shrink-0 cursor-pointer"
                        >
                          {copiedKey === 'txt_val' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'txt_val' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {verifyMethod === 'token_file' && (
                  <div className="space-y-2.5">
                    <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <FileCode2 className="w-4 h-4 text-emerald-600" />
                      Token File Verification (HTTP Probe)
                    </div>
                    <p className="text-slate-600">
                      Upload a plain text file accessible via public HTTP(S) at the root of your web server:
                    </p>
                    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 font-mono text-[11px]">
                      <div>
                        <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block">File Path:</span>
                        <code className="text-slate-900 font-bold">/.well-known/thirdeye-verify.txt</code>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <div className="truncate">
                          <span className="text-[10px] text-slate-400 font-sans font-bold uppercase block">File Content:</span>
                          <code className="text-emerald-700 font-bold">{verifyTokenData?.token || overview?.project?.verification_token}</code>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyCode('token_val', verifyTokenData?.token || overview?.project?.verification_token || '')}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 flex-shrink-0 cursor-pointer"
                        >
                          {copiedKey === 'token_val' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'token_val' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {verifyResult && (
                <div className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                  verifyResult.verified
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {verifyResult.verified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span className="font-semibold">{verifyResult.message}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleVerifyOwnership}
                  disabled={verifying}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-2 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{verifying ? 'Verifying Asset...' : 'Verify Domain Ownership Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
