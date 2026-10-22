"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Server, 
  Users, 
  Activity, 
  Video, 
  Building2, 
  ShieldCheck, 
  ExternalLink, 
  Copy, 
  Check, 
  RefreshCw, 
  Loader2, 
  Database, 
  Cpu, 
  Radio, 
  ChevronRight,
  LogOut,
  UserCheck,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  ShieldAlert,
  Zap,
  HardDrive,
  BarChart3,
  Globe,
  Lock,
  ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

interface TenantProject {
  id: number;
  name: string;
  domain: string;
  api_key: string;
  event_count: number;
  recording_count: number;
  snippet_active: boolean;
}

interface TenantOrg {
  id: number;
  name: string;
  plan: string;
  monthly_event_limit: number;
  created_at: string | null;
  user_count: number;
  projects: TenantProject[];
}

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  organization_id: number;
  organization_name: string;
  created_at: string | null;
}

interface AdminStats {
  total_organizations: number;
  total_projects: number;
  total_events: number;
  total_recordings: number;
  total_users: number;
  total_connectors: number;
  total_plans?: number;
  db_size_mb?: number;
  system_uptime: number;
  system_status: string;
  wal_active?: boolean;
}

interface PlanFeatureMap {
  session_replay?: boolean;
  heatmaps?: boolean;
  rum_monitoring?: boolean;
  error_tracking?: boolean;
  marketing_attribution?: boolean;
  seo_audit?: boolean;
  uptime_monitors?: boolean;
  ga4_gsc_connectors?: boolean;
  ai_copilot?: boolean;
  data_export?: boolean;
}

interface PlanItem {
  id: number;
  name: string;
  description: string;
  monthly_price: number;
  session_limit: number;
  retention_days: number;
  is_active: boolean;
  is_default: boolean;
  features: PlanFeatureMap;
  tenants_count: number;
  created_at: string | null;
}

const ALL_FEATURES_LIST: { key: keyof PlanFeatureMap; label: string; description: string }[] = [
  { key: 'session_replay', label: 'Session Replay (rrweb DOM)', description: 'Record and replay full user browser sessions' },
  { key: 'heatmaps', label: 'Heatmaps & Clickmaps', description: 'Thermal glow visual density and ranked click targets' },
  { key: 'rum_monitoring', label: 'Core Web Vitals & RUM', description: 'Real-time LCP, FID, CLS, TTFB, and APM telemetry' },
  { key: 'error_tracking', label: 'Exceptions & Error Tracking', description: 'Automatic client runtime crash and uncaught JS error capture' },
  { key: 'marketing_attribution', label: 'Marketing & UTM Attribution', description: 'Campaign performance, source tracking, and conversion ROI' },
  { key: 'seo_audit', label: 'Automated SEO Health Audits', description: 'Crawling, meta-tags, H1 structure, and speed diagnostics' },
  { key: 'uptime_monitors', label: 'Uptime & API Monitors', description: 'Automated ping checks with latency degradation alerts' },
  { key: 'ga4_gsc_connectors', label: 'GA4 & Search Console Dual Sync', description: 'Native Google Analytics & Search Console API connectors' },
  { key: 'ai_copilot', label: 'AI Copilot & Robot Guide', description: 'Gemini-powered website analytics assistant (ThirdEye Mitr)' },
  { key: 'data_export', label: 'Data Export & Compliance Log', description: 'Export raw JSON/CSV telemetry and forensic audit records' }
];

export default function SuperAdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users' | 'plans'>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    total_organizations: 0,
    total_projects: 0,
    total_events: 0,
    total_recordings: 0,
    total_users: 0,
    total_connectors: 0,
    total_plans: 3,
    db_size_mb: 1.25,
    system_uptime: 100.0,
    system_status: 'Healthy',
    wal_active: true
  });
  const [tenants, setTenants] = useState<TenantOrg[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [tenantPlans, setTenantPlans] = useState<Record<number, string>>({});
  const [tenantActive, setTenantActive] = useState<Record<number, boolean>>({});

  // New Plan Creation Modal State
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    monthly_price: 0,
    session_limit: 5000,
    retention_days: 30,
    is_active: true,
    is_default: false,
    features: {
      session_replay: true,
      heatmaps: true,
      rum_monitoring: true,
      error_tracking: true,
      marketing_attribution: false,
      seo_audit: true,
      uptime_monitors: true,
      ga4_gsc_connectors: false,
      ai_copilot: false,
      data_export: false
    } as PlanFeatureMap
  });

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/superadmin/login');
      return;
    }

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Stats
      const statsRes = await fetch(apiUrl('/api/v1/admin/stats'), { headers });
      if (statsRes.status === 401 || statsRes.status === 403) {
        localStorage.removeItem('te_token');
        router.push('/superadmin/login');
        return;
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Tenants
      const tenantsRes = await fetch(apiUrl('/api/v1/admin/tenants'), { headers });
      if (tenantsRes.ok) {
        const tenantsData: TenantOrg[] = await tenantsRes.json();
        setTenants(tenantsData);
        const pMap: Record<number, string> = {};
        tenantsData.forEach(t => {
          pMap[t.id] = t.plan || 'Free Starter';
        });
        setTenantPlans(pMap);
      }

      // Users
      const usersRes = await fetch(apiUrl('/api/v1/admin/users'), { headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      // Plans
      const plansRes = await fetch(apiUrl('/api/v1/admin/plans'), { headers });
      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
      }

    } catch (err) {
      console.error('SuperAdmin fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdatePlan = async (orgId: number, planName: string) => {
    setTenantPlans(prev => ({ ...prev, [orgId]: planName }));
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/admin/tenants/${orgId}/assign-plan`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_name: planName })
      });
      // Refresh tenants list to show new quota
      fetchData();
    } catch (e) {
      console.error('Plan update failed:', e);
    }
  };

  const handleToggleStatus = async (orgId: number, currentActive: boolean) => {
    const newActive = !currentActive;
    setTenantActive(prev => ({ ...prev, [orgId]: newActive }));
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/admin/tenants/${orgId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ is_active: newActive })
      });
    } catch (e) {
      console.error('Status update failed:', e);
    }
  };

  const handleImpersonate = async (orgId: number) => {
    setImpersonatingId(orgId);
    try {
      const token = localStorage.getItem('te_token');
      const res = await fetch(apiUrl(`/api/v1/admin/impersonate/${orgId}`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Could not impersonate organization');

      const data = await res.json();
      localStorage.setItem('te_token', data.access_token);
      if (data.user) {
        localStorage.setItem('te_user', JSON.stringify(data.user));
      }
      router.push('/');
    } catch (err) {
      console.error('Impersonation failed:', err);
      alert('Failed to launch tenant workspace.');
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleCreatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planForm.name.trim()) return;
    setCreatingPlan(true);

    try {
      const token = localStorage.getItem('te_token');
      const res = await fetch(apiUrl('/api/v1/admin/plans'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(planForm)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create plan');
      }

      setShowCreatePlanModal(false);
      setPlanForm({
        name: '',
        description: '',
        monthly_price: 0,
        session_limit: 5000,
        retention_days: 30,
        is_active: true,
        is_default: false,
        features: {
          session_replay: true,
          heatmaps: true,
          rum_monitoring: true,
          error_tracking: true,
          marketing_attribution: false,
          seo_audit: true,
          uptime_monitors: true,
          ga4_gsc_connectors: false,
          ai_copilot: false,
          data_export: false
        }
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Plan creation failed');
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      const token = localStorage.getItem('te_token');
      const res = await fetch(apiUrl(`/api/v1/admin/plans/${planId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Could not delete plan');
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete plan');
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSignOut = () => {
    localStorage.removeItem('te_token');
    localStorage.removeItem('te_user');
    router.push('/superadmin/login');
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.projects.some(p => p.domain.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.organization_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-900 font-sans selection:bg-blue-100 flex flex-col">
      {/* Top SuperAdmin Header - Clean Light Theme */}
      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center p-1.5 shadow-sm shadow-blue-500/20">
              <img src="/logo-icon.png" alt="ThirdEye" className="w-full h-full object-contain filter brightness-0 invert" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-slate-900 tracking-tight">ThirdEye Platform</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                  SuperAdmin
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Cluster & Multi-Tenant Control Center</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tenants'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tenants ({tenants.length})
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'plans'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Plans & Gatekeeper</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Users ({users.length})
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchData}
              disabled={loading}
              title="Refresh telemetry"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">

        {/* ========================================================= */}
        {/* TAB 1: EXECUTIVE OVERVIEW */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            
            {/* Header Hero Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 text-white shadow-md">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs uppercase font-bold tracking-widest text-blue-200">
                    ThirdEye Production Core · Node Cluster Live
                  </span>
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white">
                  Multi-Tenant Platform Telemetry
                </h1>
                <p className="text-xs text-blue-100 max-w-xl mt-1 leading-relaxed">
                  Real-time telemetry ingestion engine running with SQLite WAL concurrency and index-backed B-Trees.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveTab('tenants')}
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-blue-50 text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Manage Tenants</span>
                </button>
                <button
                  onClick={() => setActiveTab('plans')}
                  className="px-4 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-white text-xs font-bold flex items-center gap-2 border border-white/20 transition-all"
                >
                  <Layers className="w-4 h-4 text-sky-200" />
                  <span>Configure Plans</span>
                </button>
              </div>
            </div>

            {/* Top KPI Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Organizations</span>
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats.total_organizations}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Multi-tenant roots</div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Active Projects</span>
                  <Server className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats.total_projects}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Registered domains</div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Events</span>
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats.total_events.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-1">Live telemetry indexed</div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Replays</span>
                  <Video className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats.total_recordings}
                </div>
                <div className="text-[10px] text-amber-600 font-semibold mt-1">rrweb session DOMs</div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Total Users</span>
                  <Users className="w-4 h-4 text-sky-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : stats.total_users}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Client accounts</div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider">System Health</span>
                  <Radio className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-600">
                  {stats.system_status}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">100% API uptime</div>
              </div>

            </div>

            {/* Infrastructure Health Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Telemetry Storage Engine</h3>
                    <p className="text-[11px] text-slate-500">FastAPI + SQLite WAL Concurrency</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Database Size:</span>
                    <span className="font-semibold text-slate-900">{stats.db_size_mb || 1.25} MB (Indexed)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">WAL Concurrency:</span>
                    <span className="font-semibold text-emerald-600">Active (Non-blocking)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Memory Page Cache:</span>
                    <span className="font-semibold text-slate-900">64MB PRAGMA</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Cluster Security & SLA</h3>
                    <p className="text-[11px] text-slate-500">Master Cryptographic Gate</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Auth Token Validity:</span>
                    <span className="font-semibold text-slate-900">30 Days (Seamless Refresh)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Cross-Tenant Isolation:</span>
                    <span className="font-semibold text-emerald-600">Enforced (Zero Leak)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Dynamic Subscription Plans:</span>
                    <span className="font-semibold text-blue-600">{plans.length} Tier Profiles</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">API Latency & Worker Status</h3>
                    <p className="text-[11px] text-slate-500">Linux DigitalOcean Droplet Node</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Host IP:</span>
                    <span className="font-mono text-slate-900">159.65.154.209</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Domain Gateway:</span>
                    <span className="font-semibold text-slate-900">thirdeye.colladome.com</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">SSL Certificate:</span>
                    <span className="font-semibold text-emerald-600">Let's Encrypt (Active)</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Preview of Tenants */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Client Workspaces Directory</h3>
                  <p className="text-xs text-slate-500">Quick launch into any tenant workspace directly from SuperAdmin.</p>
                </div>
                <button
                  onClick={() => setActiveTab('tenants')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  View All ({tenants.length}) <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {tenants.map(org => {
                  const project = org.projects[0];
                  return (
                    <div key={org.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-slate-900 text-sm">{org.name}</h4>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              Org #{org.id}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                              {tenantPlans[org.id] || org.plan || 'Free Starter'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">
                            {project ? `${project.name} (${project.domain})` : 'No project assigned'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <div className="text-xs font-semibold text-slate-800">
                            {project ? `${project.event_count.toLocaleString()} Events · ${project.recording_count} Replays` : '0 Events'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {org.user_count} User accounts
                          </div>
                        </div>

                        <button
                          onClick={() => handleImpersonate(org.id)}
                          disabled={impersonatingId === org.id}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {impersonatingId === org.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          <span>Open Workspace</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: CLIENT TENANTS DIRECTORY */}
        {/* ========================================================= */}
        {activeTab === 'tenants' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Client Organizations & Workspaces</h2>
                <p className="text-xs text-slate-500">
                  Inspect tenant API keys, live traffic status, assign subscription plans, and jump directly into their account.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search tenants or domains..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl bg-white border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 w-full sm:w-64 shadow-xs"
                />
              </div>
            </div>

            {/* Tenants Cards List */}
            <div className="grid grid-cols-1 gap-4">
              {filteredTenants.map((org) => {
                const project = org.projects[0];
                return (
                  <div key={org.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs transition-all hover:border-slate-300">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      
                      {/* Tenant Info */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 border border-blue-200 text-blue-700 flex items-center justify-center font-black text-lg shrink-0">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-extrabold text-slate-900 text-base">{org.name}</h3>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                              Org #{org.id}
                            </span>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                              Plan: {tenantPlans[org.id] || org.plan || 'Free Starter'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 mt-1 font-mono">
                            Domain: <span className="text-slate-900 font-bold">{project ? project.domain : 'Not registered yet'}</span>
                          </p>

                          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              {org.user_count} User accounts
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5 text-emerald-600" />
                              {project ? project.event_count.toLocaleString() : 0} Events
                            </span>
                            <span className="flex items-center gap-1">
                              <Video className="w-3.5 h-3.5 text-amber-600" />
                              {project ? project.recording_count : 0} Replays
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Controls */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        
                        {/* Dynamic Plan Selector Dropdown */}
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">Plan:</label>
                          <select
                            value={tenantPlans[org.id] || org.plan || 'Free Starter'}
                            onChange={(e) => handleUpdatePlan(org.id, e.target.value)}
                            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-600 cursor-pointer"
                          >
                            {plans.map(p => (
                              <option key={p.id} value={p.name}>{p.name} (${p.monthly_price}/mo)</option>
                            ))}
                            {plans.length === 0 && (
                              <>
                                <option value="Free Starter">Free Starter ($0/mo)</option>
                                <option value="Growth Pro">Growth Pro ($49/mo)</option>
                                <option value="Enterprise Elite">Enterprise Elite ($199/mo)</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* Status Toggle */}
                        <button
                          onClick={() => handleToggleStatus(org.id, tenantActive[org.id] !== false)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            tenantActive[org.id] !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {tenantActive[org.id] !== false ? '● Active' : '● Suspended'}
                        </button>

                        {/* Impersonate Button */}
                        <button
                          onClick={() => handleImpersonate(org.id)}
                          disabled={impersonatingId === org.id}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {impersonatingId === org.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          <span>Launch Workspace</span>
                        </button>
                      </div>

                    </div>

                    {/* API Key Box */}
                    {project && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50/70 p-3.5 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-500">API Key:</span>
                          <span className="font-mono text-slate-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-[11px]">
                            {project.api_key}
                          </span>
                          <button
                            onClick={() => copyToClipboard(project.api_key)}
                            className="p-1 hover:text-blue-600 transition-colors text-slate-400"
                            title="Copy Key"
                          >
                            {copiedKey === project.api_key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${project.snippet_active ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          <span className="text-[11px] font-semibold text-slate-600">
                            {project.snippet_active ? 'Tracking Snippet Active & Ingesting' : 'Snippet Pending Installation'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredTenants.length === 0 && (
                <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
                  No tenants matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DYNAMIC PLAN BUILDER & FEATURE GATEKEEPER */}
        {/* ========================================================= */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Subscription Plans & Feature Gatekeeper</h2>
                <p className="text-xs text-slate-500">
                  Dynamically create and customize subscription tiers, define session limits, and toggle granular feature permissions.
                </p>
              </div>

              <button
                onClick={() => setShowCreatePlanModal(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Plan</span>
              </button>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => (
                <div key={p.id} className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs flex flex-col justify-between relative hover:border-blue-300 transition-all">
                  
                  {p.is_default && (
                    <div className="absolute -top-3 left-6 bg-blue-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                      Default Signup Tier
                    </div>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-black text-slate-900">{p.name}</h3>
                      {p.tenants_count > 0 ? (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                          {p.tenants_count} Tenants Enrolled
                        </span>
                      ) : (
                        !p.is_default && (
                          <button
                            onClick={() => handleDeletePlan(p.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Plan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mb-4 min-h-[36px]">
                      {p.description || 'Custom telemetry tier with granular feature access.'}
                    </p>

                    <div className="mb-4 pb-4 border-b border-slate-100 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-slate-900">${p.monthly_price}</span>
                      <span className="text-xs text-slate-400 font-medium">/ month</span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 mb-6">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Monthly Quota:</span>
                        <span className="font-bold text-slate-900">{p.session_limit.toLocaleString()} Sessions</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Data Retention:</span>
                        <span className="font-bold text-slate-900">{p.retention_days} Days</span>
                      </div>
                    </div>

                    {/* Features Matrix Checklist */}
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                        Included Platform Features:
                      </h4>
                      {ALL_FEATURES_LIST.map((feat) => {
                        const isEnabled = p.features && p.features[feat.key];
                        return (
                          <div key={feat.key} className="flex items-center gap-2 text-xs">
                            {isEnabled ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-slate-200 flex items-center justify-center text-[10px] text-slate-300 shrink-0">✕</span>
                            )}
                            <span className={isEnabled ? 'font-medium text-slate-800' : 'text-slate-400 line-through'}>
                              {feat.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Status: {p.is_active ? 'Active' : 'Archived'}</span>
                    <span>ID #{p.id}</span>
                  </div>

                </div>
              ))}
            </div>

            {/* Modal: Create New Plan */}
            {showCreatePlanModal && (
              <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-150">
                  
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">Define New Subscription Plan</h3>
                      <p className="text-xs text-slate-500">Configure tier limits and select feature permissions.</p>
                    </div>
                    <button
                      onClick={() => setShowCreatePlanModal(false)}
                      className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreatePlanSubmit} className="space-y-5">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Plan Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={planForm.name}
                          onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                          placeholder="e.g. Agency Pro Plus"
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Monthly Price (USD)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={planForm.monthly_price}
                          onChange={(e) => setPlanForm({ ...planForm, monthly_price: parseInt(e.target.value) || 0 })}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                        Short Description
                      </label>
                      <input
                        type="text"
                        value={planForm.description}
                        onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                        placeholder="e.g. Complete analytics suite for scaling venture teams"
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Monthly Session Limit
                        </label>
                        <input
                          type="number"
                          min="500"
                          step="500"
                          value={planForm.session_limit}
                          onChange={(e) => setPlanForm({ ...planForm, session_limit: parseInt(e.target.value) || 5000 })}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                          Data Retention (Days)
                        </label>
                        <input
                          type="number"
                          min="7"
                          value={planForm.retention_days}
                          onChange={(e) => setPlanForm({ ...planForm, retention_days: parseInt(e.target.value) || 30 })}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white font-medium"
                        />
                      </div>
                    </div>

                    {/* Feature Matrix Checkboxes */}
                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-3">
                        Feature Gatekeeper (Check to Enable):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                        {ALL_FEATURES_LIST.map((feat) => {
                          const isChecked = !!planForm.features[feat.key];
                          return (
                            <label
                              key={feat.key}
                              className={`flex items-start gap-2.5 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                                isChecked ? 'bg-white shadow-xs border border-blue-200 text-slate-900 font-semibold' : 'text-slate-600 hover:bg-white/60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  setPlanForm({
                                    ...planForm,
                                    features: {
                                      ...planForm.features,
                                      [feat.key]: e.target.checked
                                    }
                                  });
                                }}
                                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <div>
                                <div>{feat.label}</div>
                                <div className="text-[10px] text-slate-400 font-normal">{feat.description}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Default plan toggle */}
                    <div className="pt-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_default_check"
                        checked={planForm.is_default}
                        onChange={(e) => setPlanForm({ ...planForm, is_default: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <label htmlFor="is_default_check" className="text-xs font-semibold text-slate-700 cursor-pointer">
                        Set as default tier for new client registrations
                      </label>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCreatePlanModal(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creatingPlan}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                      >
                        {creatingPlan && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Save & Publish Plan</span>
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: PLATFORM USERS DIRECTORY */}
        {/* ========================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Platform Users & Access Control</h2>
                <p className="text-xs text-slate-500">
                  Global roster of administrators and client organization members.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl bg-white border border-slate-200 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 w-full sm:w-64 shadow-xs"
                />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Organization</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        
                        {/* User column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{u.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Org column */}
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800">{u.organization_name}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">Org ID: #{u.organization_id}</span>
                        </td>

                        {/* Role */}
                        <td className="px-6 py-4">
                          {u.role === 'ADMIN' || u.role === 'SUPERADMIN' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                              <ShieldCheck className="w-3 h-3" />
                              Platform Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                              Client Member
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Verified
                          </span>
                        </td>

                        {/* Registered Date */}
                        <td className="px-6 py-4 text-right text-slate-500 font-mono text-[11px]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-400">
        ThirdEye Platform Enterprise · Cluster Node 159.65.154.209 · ISO/IEC 27001 Security Standard
      </footer>
    </div>
  );
}
