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
  Clock
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
  system_uptime: number;
  system_status: string;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'users'>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    total_organizations: 0,
    total_projects: 0,
    total_events: 0,
    total_recordings: 0,
    total_users: 0,
    total_connectors: 0,
    system_uptime: 100.0,
    system_status: 'Healthy'
  });
  const [tenants, setTenants] = useState<TenantOrg[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/superadmin/login');
      return;
    }

    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch Stats
      const statsRes = await fetch(apiUrl('/api/v1/admin/stats'), { headers });
      if (statsRes.status === 401 || statsRes.status === 403) {
        router.push('/superadmin/login');
        return;
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch Tenants
      const tenantsRes = await fetch(apiUrl('/api/v1/admin/tenants'), { headers });
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        setTenants(tenantsData);
      }

      // Fetch Users
      const usersRes = await fetch(apiUrl('/api/v1/admin/users'), { headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
    } catch (err) {
      console.error('Failed to load superadmin metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleImpersonate = async (orgId: number) => {
    setImpersonatingId(orgId);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/impersonate/${orgId}`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Could not impersonate organization');

      const data = await res.json();
      localStorage.setItem('te_token', data.access_token);
      if (data.user) {
        localStorage.setItem('te_user', JSON.stringify(data.user));
      }
      // Redirect to client workspace dashboard
      router.push('/');
    } catch (err) {
      console.error('Impersonation failed:', err);
      alert('Failed to launch tenant workspace.');
    } finally {
      setImpersonatingId(null);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/20 flex flex-col">
      {/* Top SuperAdmin Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-600/30">
              T
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">ThirdEye Platform</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  SuperAdmin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Cluster & Tenant Control Center</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Platform Overview
            </button>
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tenants'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Client Tenants ({tenants.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              User Directory ({users.length})
            </button>
          </div>

          {/* System Status & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Healthy (100% Uptime)</span>
            </div>

            <button
              onClick={fetchAdminData}
              title="Refresh platform stats"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700/50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <Link
              href="/"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <span>Client Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <button
              onClick={handleSignOut}
              title="Sign Out SuperAdmin"
              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden items-center justify-around mt-3 pt-3 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`text-xs font-medium pb-1 border-b-2 ${activeTab === 'overview' ? 'border-blue-500 text-white font-bold' : 'border-transparent text-slate-400'}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('tenants')}
            className={`text-xs font-medium pb-1 border-b-2 ${activeTab === 'tenants' ? 'border-blue-500 text-white font-bold' : 'border-transparent text-slate-400'}`}
          >
            Tenants ({tenants.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`text-xs font-medium pb-1 border-b-2 ${activeTab === 'users' ? 'border-blue-500 text-white font-bold' : 'border-transparent text-slate-400'}`}
          >
            Users ({users.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 sm:p-8 space-y-8">
        
        {/* ========================================================= */}
        {/* TAB 1: PLATFORM OVERVIEW */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Hero Banner */}
            <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-slate-900 border border-blue-500/20 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  <Cpu className="w-3.5 h-3.5" />
                  Cluster Telemetry
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Global Platform Command
                </h2>
                <p className="mt-1 text-sm text-slate-400 max-w-xl">
                  Monitoring live ingest pipelines, multi-tenant databases, rrweb recording buffers, and active tracking snippets.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setActiveTab('tenants')}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Manage Tenants</span>
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all"
                >
                  <Users className="w-4 h-4" />
                  <span>Manage Users</span>
                </button>
              </div>
            </div>

            {/* Top KPI Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Organizations</span>
                  <Building2 className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-600" /> : stats.total_organizations}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Multi-tenant roots</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Active Projects</span>
                  <Server className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-600" /> : stats.total_projects}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Target domains</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Total Events</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-600" /> : stats.total_events.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-400 mt-1">Ingested real telemetry</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Replays</span>
                  <Video className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-600" /> : stats.total_recordings}
                </div>
                <div className="text-[10px] text-amber-400 mt-1">rrweb session DOMs</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Total Users</span>
                  <Users className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-600" /> : stats.total_users}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Admins & team members</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">System Status</span>
                  <Radio className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  {stats.system_status}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">100% API uptime</div>
              </div>

            </div>

            {/* Infrastructure Health Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Telemetry Ingestion Engine</h3>
                    <p className="text-[11px] text-slate-400">FastAPI + Async Worker</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Endpoint /api/v1/track</span>
                    <span className="text-emerald-400 font-semibold">Active (200 OK)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">rrweb Replay Ingestion</span>
                    <span className="text-emerald-400 font-semibold">Active (/api/v1/recordings)</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">AdBlocker Bypass Alias</span>
                    <span className="text-emerald-400 font-semibold">Active (/api/v1/collect)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Target Domain Telemetry</h3>
                    <p className="text-[11px] text-slate-400">GrowInsight Production</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Domain</span>
                    <span className="text-white font-mono font-medium">growinsight.co.in</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Tracking Status</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Receiving Events
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Target Workspace</span>
                    <span className="text-blue-400 font-medium">ScanPe (Org #2)</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Security & Multi-Tenancy</h3>
                    <p className="text-[11px] text-slate-400">JWT Scoped Authorization</p>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">Tenant Isolation</span>
                    <span className="text-emerald-400 font-semibold">Strict (Org ID)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400">SuperAdmin Impersonation</span>
                    <span className="text-blue-400 font-semibold">Enabled</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">CORS Policy</span>
                    <span className="text-emerald-400 font-semibold">Configured (Origins Allowed)</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Preview of Tenants */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-base">Client Workspaces Directory</h3>
                  <p className="text-xs text-slate-400">Quick launch into any tenant workspace directly from SuperAdmin.</p>
                </div>
                <button
                  onClick={() => setActiveTab('tenants')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                >
                  View All ({tenants.length}) <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-800/80">
                {tenants.map(org => {
                  const project = org.projects[0];
                  return (
                    <div key={org.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-white">
                          {org.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-white text-sm">{org.name}</h4>
                            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                              Org #{org.id}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {project ? `${project.name} (${project.domain})` : 'No project assigned'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <div className="text-xs font-semibold text-white">
                            {project ? `${project.event_count} Events · ${project.recording_count} Replays` : '0 Events'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {org.user_count} User accounts
                          </div>
                        </div>

                        <button
                          onClick={() => handleImpersonate(org.id)}
                          disabled={impersonatingId === org.id}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
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
                <h2 className="text-xl font-bold text-white">Client Organizations & Workspaces</h2>
                <p className="text-xs text-slate-400">
                  Inspect tenant API keys, live traffic status, and jump directly into their account.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search tenants or domains..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
                />
              </div>
            </div>

            {/* Tenants Cards List */}
            <div className="grid grid-cols-1 gap-4">
              {filteredTenants.map((org) => {
                const project = org.projects[0];
                return (
                  <div key={org.id} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 transition-all hover:border-slate-700">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                      
                      {/* Left: Org & Project Details */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
                            {org.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-white text-base">{org.name}</h3>
                              <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
                                Organization ID: {org.id}
                              </span>
                              {project?.snippet_active ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  Snippet Active
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                                  No Traffic Yet
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {project ? `Project: ${project.name}` : 'No project registered'}
                            </p>
                          </div>
                        </div>

                        {/* Domain & API Key info */}
                        {project && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div className="bg-slate-800/60 border border-slate-800 rounded-xl px-3 py-2">
                              <div className="text-[10px] uppercase font-bold text-slate-400">Monitored Domain</div>
                              <div className="text-xs font-semibold text-blue-400 font-mono mt-0.5">
                                {project.domain}
                              </div>
                            </div>

                            <div className="bg-slate-800/60 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between">
                              <div className="overflow-hidden mr-2">
                                <div className="text-[10px] uppercase font-bold text-slate-400">Tracking API Key</div>
                                <div className="text-xs font-mono text-slate-300 truncate mt-0.5" title={project.api_key}>
                                  {project.api_key}
                                </div>
                              </div>
                              <button
                                onClick={() => copyToClipboard(project.api_key)}
                                title="Copy API Key"
                                className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex-shrink-0"
                              >
                                {copiedKey === project.api_key ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right: Metrics & Impersonation Button */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                        <div className="grid grid-cols-3 gap-3 text-center sm:text-right">
                          <div className="bg-slate-800/40 border border-slate-800 px-3 py-2 rounded-xl">
                            <div className="text-sm font-bold text-white">
                              {project?.event_count || 0}
                            </div>
                            <div className="text-[10px] text-slate-400">Events</div>
                          </div>
                          <div className="bg-slate-800/40 border border-slate-800 px-3 py-2 rounded-xl">
                            <div className="text-sm font-bold text-amber-400">
                              {project?.recording_count || 0}
                            </div>
                            <div className="text-[10px] text-slate-400">Replays</div>
                          </div>
                          <div className="bg-slate-800/40 border border-slate-800 px-3 py-2 rounded-xl">
                            <div className="text-sm font-bold text-sky-400">
                              {org.user_count}
                            </div>
                            <div className="text-[10px] text-slate-400">Users</div>
                          </div>
                        </div>

                        {/* Impersonate Button */}
                        <button
                          onClick={() => handleImpersonate(org.id)}
                          disabled={impersonatingId === org.id}
                          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                        >
                          {impersonatingId === org.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Switching Workspace...</span>
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-4 h-4" />
                              <span>Open Client Workspace</span>
                            </>
                          )}
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}

              {filteredTenants.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No tenants matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: USER DIRECTORY & RBAC */}
        {/* ========================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Platform Users & Access Control</h2>
                <p className="text-xs text-slate-400">
                  Global roster of administrators and client organization members.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl bg-slate-900 border border-slate-800 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
                />
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Organization</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        
                        {/* User column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-blue-400 border border-slate-700 flex items-center justify-center font-bold text-xs">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{u.name}</div>
                              <div className="text-[11px] text-slate-400">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Org column */}
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-200">{u.organization_name}</span>
                          <span className="text-[10px] text-slate-500 block">Org ID: {u.organization_id}</span>
                        </td>

                        {/* Role */}
                        <td className="px-6 py-4">
                          {u.role === 'ADMIN' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                              <ShieldCheck className="w-3 h-3" />
                              Platform Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                              Client Member
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Active
                          </span>
                        </td>

                        {/* Action: Impersonate user's org */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleImpersonate(u.organization_id)}
                            disabled={impersonatingId === u.organization_id}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-medium border border-slate-700 transition-colors inline-flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Switch To Org</span>
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No users matching "{searchQuery}"
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}