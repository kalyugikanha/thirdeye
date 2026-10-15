"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { 
  Sparkles, 
  Code2, 
  Server, 
  HardDrive, 
  Play, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  Lock, 
  RefreshCw, 
  ExternalLink, 
  Search, 
  Sliders, 
  Mic, 
  ArrowUp, 
  ShieldCheck, 
  Globe2, 
  Layers, 
  Video, 
  Flame, 
  Cpu, 
  AlertTriangle,
  Loader2,
  ChevronRight,
  Eye,
  LogOut,
  Bell
} from 'lucide-react';
import { apiUrl, API_BASE } from '@/lib/api';

// Dynamic import of ReplayPlayer for modal playback
const ReplayPlayer = dynamic(
  () => import('./analytics/sessions/ReplayPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-[850px] h-[480px] flex flex-col items-center justify-center bg-slate-950 rounded-2xl text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
        <p className="text-sm">Initializing player engine...</p>
      </div>
    ),
  }
);

interface ConnectionStatus {
  is_connected: boolean;
  snippet_active: boolean;
  dns_verified: boolean;
  apm_active: boolean;
  total_events: number;
  total_recordings: number;
  domain: string | null;
  api_key: string | null;
  project_id: number | null;
  dns_token: string | null;
}

interface RecentSession {
  id: number;
  session_id: string;
  duration: number;
  created_at: string;
  url?: string;
  browser?: string;
  os?: string;
  event_count?: number;
}

export default function WorkspaceDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState('Aakash');
  const [userEmail, setUserEmail] = useState('scan.pe.in@gmail.com');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>({
    is_connected: true,
    snippet_active: true,
    dns_verified: true,
    apm_active: false,
    total_events: 8,
    total_recordings: 1,
    domain: 'growinsight.co.in',
    api_key: 'te_live_990c733a065d43b3b70bb0c1227d2f3c',
    project_id: 1,
    dns_token: 'te_txt_growinsight'
  });

  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [searchSession, setSearchSession] = useState('');
  const [activeSession, setActiveSession] = useState<RecentSession | null>(null);
  const [replayEvents, setReplayEvents] = useState<any[] | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [verifying, setVerifying] = useState(false);

  const fetchConnectionStatus = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const storedUser = localStorage.getItem('te_user');
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.name) setUserName(u.name);
        if (u.email) setUserEmail(u.email);
        if (u.role === 'ADMIN' || u.email === 'admin@thirdeye.io' || u.email === 'scan.pe.in@gmail.com') {
          setIsAdmin(true);
        }
      }

      // Check project status
      const res = await fetch(apiUrl('/api/v1/projects/status'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }

      // Fetch recent recordings for the right history feed
      const recRes = await fetch(apiUrl('/api/v1/recordings'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (recRes.ok) {
        const recData = await recRes.json();
        if (Array.isArray(recData)) {
          setRecentSessions(recData.slice(0, 8));
        }
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const handleManualVerify = async () => {
    setVerifying(true);
    await fetchConnectionStatus();
    setTimeout(() => setVerifying(false), 800);
  };

  const copySnippet = () => {
    const key = status.api_key || 'te_live_990c733a065d43b3b70bb0c1227d2f3c';
    const snippet = `<script>\n  (function(t,h,i,r,d){\n    t.ThirdEye=t.ThirdEye||{};\n    var s=h.createElement('script');\n    s.src='${API_BASE}/public/te.js';\n    s.setAttribute('data-key',i);\n    h.head.appendChild(s);\n  })(window,document,'${key}');\n</script>`;
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  const playReplay = async (session: RecentSession) => {
    setActiveSession(session);
    setLoadingReplay(true);
    setReplayEvents(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/recordings/${session.id}/events`));
      if (!res.ok) throw new Error('Failed to load events');
      const data = await res.json();
      setReplayEvents(Array.isArray(data) ? data : data.events || []);
    } catch (err) {
      console.error(err);
      alert('Could not load recording events.');
      setActiveSession(null);
    } finally {
      setLoadingReplay(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('te_token');
    localStorage.removeItem('te_user');
    router.push('/login');
  };

  const filteredSessions = recentSessions.filter(s => 
    (s.url || '').toLowerCase().includes(searchSession.toLowerCase()) ||
    (s.session_id || '').toLowerCase().includes(searchSession.toLowerCase()) ||
    (s.browser || '').toLowerCase().includes(searchSession.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#ffe4d6] via-[#ffdcd2] to-[#ffeedb] p-2 sm:p-4 lg:p-6 flex items-center justify-center font-sans antialiased selection:bg-rose-500/20">
      
      {/* Main Floating Rounded Canvas (Reference Mockup Container) */}
      <div className="w-full max-w-[1440px] bg-[#fbfbfe] rounded-[32px] sm:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-white/80 overflow-hidden flex flex-col lg:flex-row min-h-[840px] transition-all">
        
        {/* ========================================================= */}
        {/* COLUMN 1: MINIMALIST LEFT SIDEBAR */}
        {/* ========================================================= */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-100/80 p-5 flex flex-col justify-between bg-transparent flex-shrink-0">
          <div className="space-y-6">
            
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                ✦
              </div>
              <div>
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">ThirdEye</span>
                <span className="text-[10px] text-slate-400 block -mt-1 font-medium">Observability</span>
              </div>
            </div>

            {/* Nav Menu */}
            <nav className="space-y-1">
              <Link
                href="/"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-white shadow-sm border border-slate-200/60 text-slate-900 font-semibold text-xs"
              >
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Home Dashboard</span>
              </Link>

              <Link
                href={status.is_connected ? "/analytics" : "#"}
                onClick={(e) => { if (!status.is_connected) { e.preventDefault(); alert('Please connect tracking snippet or domain to unlock analytics.'); } }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-colors ${
                  status.is_connected ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium" : "text-slate-400 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span>Traffic Analytics</span>
                </div>
                {!status.is_connected && <Lock className="w-3.5 h-3.5 text-slate-300" />}
              </Link>

              <Link
                href={status.is_connected ? "/analytics/sessions" : "#"}
                onClick={(e) => { if (!status.is_connected) { e.preventDefault(); alert('Connect tracking snippet to unlock live session recordings.'); } }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-colors ${
                  status.is_connected ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium" : "text-slate-400 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Video className="w-4 h-4 text-slate-400" />
                  <span>Session Replays</span>
                </div>
                {status.is_connected ? (
                  <span className="text-[10px] font-bold uppercase bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded-full">
                    {status.total_recordings} Live
                  </span>
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-300" />
                )}
              </Link>

              <Link
                href={status.is_connected ? "/analytics/heatmaps" : "#"}
                onClick={(e) => { if (!status.is_connected) { e.preventDefault(); alert('Connect tracking snippet to unlock click heatmaps.'); } }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-colors ${
                  status.is_connected ? "text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium" : "text-slate-400 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Flame className="w-4 h-4 text-slate-400" />
                  <span>Click Heatmaps</span>
                </div>
                {!status.is_connected && <Lock className="w-3.5 h-3.5 text-slate-300" />}
              </Link>

              <Link
                href="/uptime"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe2 className="w-4 h-4 text-slate-400" />
                  <span>Uptime & SSL</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </Link>

              <Link
                href="/seo"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <span>SEO & Security</span>
              </Link>

              <Link
                href="/onboarding"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium transition-colors"
              >
                <Code2 className="w-4 h-4 text-slate-400" />
                <span>Tracking Tag & Setup</span>
              </Link>
            </nav>

            {/* Multi-Layer Tools */}
            <div className="pt-2 border-t border-slate-100">
              <span className="px-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Deep Diagnostics
              </span>
              <div className="space-y-1">
                <Link
                  href="/alerts"
                  className="flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Bell className="w-3.5 h-3.5 text-slate-400" />
                    <span>Alerts & Notifications</span>
                  </div>
                </Link>

                <Link
                  href="/marketing"
                  className="flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Social & Ads Tracker</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* User Profile Card (Bottom Left of Mockup) */}
          <div className="pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-100/70 rounded-2xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-400 to-amber-300 text-slate-900 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-900 truncate">{userName}</p>
                    <p className="text-[10px] text-slate-500 truncate" title={status.domain || userEmail}>
                      {status.domain || userEmail}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status Pill / SuperAdmin switcher */}
              {isAdmin ? (
                <Link
                  href="/superadmin"
                  className="w-full text-center py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="w-3 h-3 text-indigo-400" />
                  <span>SuperAdmin Portal</span>
                </Link>
              ) : (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/70 border border-slate-200/50 text-[10px]">
                  <span className="text-slate-500">Status</span>
                  <span className={`font-semibold ${status.is_connected ? "text-emerald-600" : "text-amber-600"}`}>
                    {status.is_connected ? "● Connected" : "○ Pending Tag"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* COLUMN 2: CENTER STAGE HERO (SETO MOCKUP COMMAND CENTER) */}
        {/* ========================================================= */}
        <main className="flex-1 p-6 sm:p-8 lg:p-10 flex flex-col justify-between overflow-y-auto">
          <div>
            
            {/* Radiant Glowing Emblem at Top Center (Matches Mockup) */}
            <div className="flex flex-col items-center justify-center text-center pt-2 sm:pt-4 mb-6">
              <div className="relative mb-3 flex items-center justify-center">
                {/* Soft ambient glow */}
                <div className="absolute w-20 h-20 bg-gradient-to-tr from-rose-300 via-violet-300 to-amber-200 rounded-full blur-2xl opacity-70 animate-pulse pointer-events-none" />
                
                {/* 4-point Radiant Star Emblem from Mockup */}
                <svg className="w-12 h-12 relative z-10 text-rose-500 drop-shadow-md" viewBox="0 0 100 100" fill="none">
                  <path
                    d="M50 0 C52 32 68 48 100 50 C68 52 52 68 50 100 C48 68 32 52 0 50 C32 48 48 32 50 0 Z"
                    fill="url(#star-gradient)"
                  />
                  <defs>
                    <linearGradient id="star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Title & User Greeting */}
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                Welcome, {userName}!
              </h1>
              
              {/* Tagline Requested by User */}
              <p className="mt-1.5 text-base sm:text-lg font-semibold text-rose-600/90 tracking-tight">
                Every moment will be captured.
              </p>
              
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-1">
                Full-stack observability across user session replays, server API latency, and responsive errors for <span className="font-semibold text-slate-700">{status.domain || 'your website'}</span>.
              </p>
            </div>

            {/* 3 Pastel Quick-Action Cards (Matches Reference Mockup) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-2xl mx-auto mb-8">
              
              {/* Card 1: Client Tracking Snippet */}
              <div 
                onClick={copySnippet}
                className="bg-white p-4 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between min-h-[140px] group"
              >
                <div className="w-8 h-8 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mb-2">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-rose-600 transition-colors">
                    Client Tracking Tag
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {copiedSnippet ? 'Copied to clipboard!' : 'Install snippet to record live visitor sessions.'}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 text-[10px] font-semibold text-rose-600">
                  <span>{copiedSnippet ? '✓ Copied' : 'Copy Script Tag'}</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 2: Server APM & APIs */}
              <Link 
                href="/uptime"
                className="bg-white p-4 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between min-h-[140px] group"
              >
                <div className="w-8 h-8 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-indigo-600 transition-colors">
                    Server APM & Latency
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Track slow endpoints, 500 errors, and SSL certificate validity.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 text-[10px] font-semibold text-indigo-600">
                  <span>View Uptime Health</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

              {/* Card 3: DNS & BYOS Storage */}
              <Link
                href="/onboarding"
                className="bg-white p-4 rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between min-h-[140px] group"
              >
                <div className="w-8 h-8 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-amber-600 transition-colors">
                    Domain & BYOS Storage
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Verify DNS TXT records & store replays on your own server/S3.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 text-[10px] font-semibold text-amber-600">
                  <span>Manage Setup</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>

            </div>

            {/* Dynamic Status Banner: Activated Workspace vs Feature Lock Onboarding */}
            {status.is_connected ? (
              /* Connected Workspace Metrics Card */
              <div className="max-w-2xl mx-auto bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-md mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-white">{status.domain}</h4>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                          Active & Tracking
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Receiving live visitor DOM mutations and telemetry.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleManualVerify}
                    className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-rose-400' : ''}`} />
                    <span>Ping Status</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-3 pt-4 text-center">
                  <div>
                    <div className="text-xl font-extrabold text-white">{status.total_events}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5">Events</div>
                  </div>
                  <div>
                    <div className="text-xl font-extrabold text-rose-400">{status.total_recordings}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5">Replays</div>
                  </div>
                  <div>
                    <div className="text-xl font-extrabold text-emerald-400">100%</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5">Uptime</div>
                  </div>
                  <div>
                    <div className="text-xl font-extrabold text-amber-400">0</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mt-0.5">Rage Clicks</div>
                  </div>
                </div>
              </div>
            ) : (
              /* Guided Activation Lock Gateway (Requested by User) */
              <div className="max-w-2xl mx-auto bg-amber-50/70 border border-amber-200/80 rounded-3xl p-5 sm:p-6 shadow-sm mb-8">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">
                        Activation Required for {status.domain || 'Your Domain'}
                      </h4>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                        Features Locked
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Session Replays, Click Heatmaps, and Traffic Analytics will automatically unlock as soon as your tracking script tag is placed in your site's <code className="bg-amber-100/70 px-1 py-0.5 rounded text-amber-900 font-mono text-[11px]">&lt;head&gt;</code>.
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <button
                        onClick={copySnippet}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedSnippet ? 'Snippet Copied!' : 'Copy Tracking Tag'}</span>
                      </button>

                      <button
                        onClick={handleManualVerify}
                        disabled={verifying}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-amber-600' : ''}`} />
                        <span>Check Connection</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Bottom Prompt / Command Bar (Matching SETO Reference Image) */}
          <div className="max-w-2xl w-full mx-auto pt-4">
            <div className="bg-white border border-slate-200/80 rounded-3xl p-2.5 sm:p-3 shadow-[0_4px_25px_-5px_rgba(0,0,0,0.05)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-1 px-2">
                <span className="text-rose-500 font-bold text-sm">✦</span>
                <input
                  type="text"
                  placeholder="Initiate a query or filter telemetry across sessions..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && aiPrompt.trim()) {
                      router.push('/analytics');
                    }
                  }}
                  className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => router.push('/onboarding')}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100/70 hover:bg-slate-100 text-slate-600 text-[11px] font-medium transition-colors"
                >
                  <Code2 className="w-3 h-3 text-slate-400" />
                  <span>Snippet</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/uptime')}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100/70 hover:bg-slate-100 text-slate-600 text-[11px] font-medium transition-colors"
                >
                  <Sliders className="w-3 h-3 text-slate-400" />
                  <span>Options</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (aiPrompt.trim()) router.push('/analytics');
                  }}
                  className="w-8 h-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-transform hover:scale-105 shadow-sm"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

        </main>

        {/* ========================================================= */}
        {/* COLUMN 3: RIGHT ACTIVITY & LIVE SESSIONS (MOCKUP RIGHT SIDE) */}
        {/* ========================================================= */}
        <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-100/80 p-5 flex flex-col justify-between bg-transparent flex-shrink-0">
          <div>
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="font-extrabold text-slate-900 text-sm tracking-tight">
                Live Replay Stream
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">
                {recentSessions.length} Recorded
              </span>
            </div>

            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search sessions or pages..."
                value={searchSession}
                onChange={(e) => setSearchSession(e.target.value)}
                className="w-full bg-slate-100/70 border border-slate-200/50 rounded-2xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-rose-400 transition-all"
              />
            </div>

            {/* Sessions Cards Feed (Matches Reference Mockup List) */}
            <div className="space-y-2.5 overflow-y-auto max-h-[580px] pr-1">
              {filteredSessions.map((s, idx) => (
                <div
                  key={s.id || idx}
                  onClick={() => playReplay(s)}
                  className="p-3 bg-white hover:bg-rose-50/40 border border-slate-100 hover:border-rose-200 rounded-2xl shadow-[0_2px_10px_-3px_rgba(0,0,0,0.02)] transition-all cursor-pointer group flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-rose-100 text-slate-600 group-hover:text-rose-600 flex items-center justify-center flex-shrink-0 transition-colors">
                        <Video className="w-3 h-3" />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {s.url ? s.url.replace('https://', '').replace('http://', '').split('?')[0] : 'Visitor Session'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3 text-slate-300" />
                      {s.duration}s
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-50">
                    <span>{s.browser || 'Chrome'} · {s.os || 'Windows'}</span>
                    <span className="text-rose-500 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      <Play className="w-3 h-3 fill-rose-500" /> Watch
                    </span>
                  </div>
                </div>
              ))}

              {filteredSessions.length === 0 && (
                <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <Video className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No session recordings yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Once visitors land on {status.domain || 'your website'}, full rrweb video replays will appear here automatically.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Bottom Launch Replays Action */}
          <div className="pt-4 border-t border-slate-100">
            <Link
              href="/analytics/sessions"
              className="w-full py-2.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-rose-400" />
              <span>Full Replay Hub ({recentSessions.length})</span>
            </Link>
          </div>
        </aside>

      </div>

      {/* ========================================================= */}
      {/* RRWEB REPLAY MODAL */}
      {/* ========================================================= */}
      {activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-4xl w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Session Player: {activeSession.session_id.substring(0, 14)}...
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Duration: {activeSession.duration}s · URL: {activeSession.url || status.domain}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveSession(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-center">
              {loadingReplay ? (
                <div className="py-24 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto mb-3" />
                  <p className="text-xs text-slate-400">Streaming DOM mutation events...</p>
                </div>
              ) : replayEvents && replayEvents.length > 0 ? (
                <ReplayPlayer events={replayEvents} />
              ) : (
                <div className="py-24 text-center text-slate-500 text-xs">
                  No DOM events recorded for this session.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}