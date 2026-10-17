"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  BarChart3, 
  Video, 
  Flame, 
  GitMerge,
  Activity, 
  Search, 
  Code2, 
  Bell, 
  LogOut,
  Globe2,
  HardDrive,
  Cpu,
  Share2,
  ShieldCheck,
  Lock,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  X,
  Loader2,
  Radio,
  FileText,
  CreditCard,
  Target,
  Smile,
  ClipboardList,
  FlaskConical,
  Gauge,
  Plus,
  ChevronDown,
  Bot,
  Users2,
  WifiOff,
  Rocket
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiUrl, API_BASE } from '@/lib/api';

interface NavGroup {
  label: string;
  items: {
    href: string;
    icon: any;
    title: string;
    badge?: string;
    lockedUnlessConnected?: boolean;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Observability",
    items: [
      { href: '/', icon: LayoutDashboard, title: 'Workspace Home' },
      { href: '/live', icon: Radio, title: 'Live Pulse Radar', badge: 'Live' },
      { href: '/analytics', icon: BarChart3, title: 'Traffic Analytics', lockedUnlessConnected: true },
      { href: '/analytics/sessions', icon: Video, title: 'Session Replays', badge: 'Replay', lockedUnlessConnected: true },
      { href: '/analytics/heatmaps', icon: Flame, title: 'Click Heatmaps', lockedUnlessConnected: true },
      { href: '/analytics/cohorts', icon: Users2, title: 'Retention Cohorts', badge: 'Matrix' },
      { href: '/analytics/errors', icon: AlertTriangle, title: 'Errors & Issues', badge: 'BugTracker' },
      { href: '/analytics/journeys', icon: GitMerge, title: 'User Journey Flows', badge: 'Flow' },
      { href: '/analytics/goals', icon: Target, title: 'Conversion Goals', badge: 'ROI' },
      { href: '/analytics/forms', icon: ClipboardList, title: 'Form Analytics', badge: 'CRO' },
      { href: '/analytics/experiments', icon: FlaskConical, title: 'A/B Experiments', badge: 'Split' },
      { href: '/analytics/feedback', icon: Smile, title: 'Customer Feedback', badge: 'CSAT' },
    ]
  },
  {
    label: "Health & APM",
    items: [
      { href: '/performance', icon: Gauge, title: 'Core Web Vitals', badge: 'CWV' },
      { href: '/devops', icon: Cpu, title: 'Server APM & APIs' },
      { href: '/devops/network', icon: WifiOff, title: 'Network & API Inspector', badge: 'XHR' },
      { href: '/devops/releases', icon: Rocket, title: 'Release Impact Tracker', badge: 'CI/CD' },
      { href: '/uptime', icon: Activity, title: 'Uptime & SSL' },
      { href: '/seo', icon: Search, title: 'SEO & Performance' },
    ]
  },
  {
    label: "Intelligence & Reports",
    items: [
      { href: '/copilot', icon: Bot, title: 'AI Copilot Assistant', badge: 'AI' },
      { href: '/reports', icon: FileText, title: 'Executive Reports', badge: 'Export' },
      { href: '/settings/billing', icon: CreditCard, title: 'Plans & Billing' },
      { href: '/settings/storage', icon: HardDrive, title: 'BYOS Storage Hub', badge: 'Client' },
      { href: '/marketing', icon: Share2, title: 'Marketing & Ads' },
      { href: '/alerts', icon: Bell, title: 'System Alerts' },
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showAddDomainModal, setShowAddDomainModal] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainError, setDomainError] = useState('');

  const fetchStatus = (overridePid?: number) => {
    const token = localStorage.getItem('te_token');
    if (token) {
      const storedPid = overridePid || Number(localStorage.getItem('te_active_project_id') || 0);
      const q = storedPid ? `?project_id=${storedPid}` : '';
      fetch(apiUrl(`/api/v1/projects/status${q}`), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.domain) setDomain(data.domain);
          if (data.api_key) setApiKey(data.api_key);
          if (data.project_id) setActiveProjectId(data.project_id);
          setIsConnected(Boolean(data.is_connected));
        })
        .catch(() => {});

      fetch(apiUrl('/api/v1/projects'), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((list) => {
          if (Array.isArray(list)) setProjects(list);
        })
        .catch(() => {});
    }
  };

  const handleSelectProject = (proj: any) => {
    localStorage.setItem('te_active_project_id', String(proj.id));
    setActiveProjectId(proj.id);
    setDomain(proj.domain);
    setApiKey(proj.api_key);
    setIsConnected(Boolean(proj.is_connected));
    setShowProjectMenu(false);
    window.location.reload();
  };

  const handleCreateDomain = async () => {
    setDomainError('');
    if (!newDomain.trim() || !newDomain.includes('.')) {
      setDomainError('Enter a valid domain (e.g. app.company.com)');
      return;
    }
    setAddingDomain(true);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/projects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ domain: newDomain.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDomainError(data.detail || 'Could not add domain');
        return;
      }
      localStorage.setItem('te_active_project_id', String(data.id));
      setNewDomain('');
      setShowAddDomainModal(false);
      fetchStatus(data.id);
      setShowActivationModal(true);
    } catch (e) {
      setDomainError('Failed to create domain');
    } finally {
      setAddingDomain(false);
    }
  };

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('te_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.email) setUserEmail(parsed.email);
        if (parsed.role === 'ADMIN' || parsed.role === 'SUPERADMIN' || parsed.email === 'admin@thirdeye.io') {
          setIsAdmin(true);
        }
      }
      fetchStatus();
    } catch (e) {}
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('te_token');
    localStorage.removeItem('te_user');
    router.push('/login');
  };

  const copySnippet = () => {
    const key = apiKey || 'your_api_key';
    const snippet = `<script>\n  (function(t,h,i,r,d){\n    t.ThirdEye=t.ThirdEye||{};\n    var s=h.createElement('script');\n    s.src='${API_BASE}/public/te.js';\n    s.setAttribute('data-key',i);\n    h.head.appendChild(s);\n  })(window,document,'${key}');\n</script>`;
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  };

  const handleVerify = async () => {
    setVerifying(true);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/projects/status'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsConnected(Boolean(data.is_connected));
        if (data.is_connected) {
          setShowActivationModal(false);
        } else {
          alert('No tracking events detected yet. Please ensure snippet is installed or simulate a test session.');
        }
      }
    } catch (e) {
      alert('Verification request failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/recordings/simulate'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIsConnected(true);
        setShowActivationModal(false);
        router.push('/analytics/sessions');
      } else {
        alert('Simulation failed. Please try again.');
      }
    } catch (e) {
      alert('Error connecting to simulation service.');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <>
      <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-200/80 p-5 flex flex-col justify-between bg-white flex-shrink-0 select-none font-sans min-h-screen">
        <div className="space-y-6">
          
          {/* Brand Header */}
          <Link href="/" className="flex items-center gap-2.5 px-2 group">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
              ✦
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">ThirdEye</span>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-900 text-white px-1.5 py-0.2 rounded-full">
                  Live
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block -mt-1 font-medium">Enterprise Observability</span>
            </div>
          </Link>

          {/* Active Domain & Multi-Project Switcher */}
          <div className="relative">
            <div className="p-3 rounded-2xl bg-white shadow-sm border border-slate-200/60 flex items-center justify-between gap-2">
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="flex items-center gap-2 overflow-hidden flex-1 text-left"
                title="Switch or add domain"
              >
                <Globe2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  {domain || 'Workspace'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
              </button>
              {isConnected ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active
                </span>
              ) : (
                <button 
                  onClick={() => setShowActivationModal(true)}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 transition-colors flex-shrink-0 cursor-pointer"
                  title="Click to Activate"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  Pending
                </button>
              )}
            </div>

            {showProjectMenu && (
              <div className="absolute left-0 right-0 mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Organization Domains ({projects.length || 1})
                </div>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProject(p)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors ${
                      p.id === activeProjectId || p.domain === domain
                        ? 'bg-slate-900 text-white font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{p.domain}</span>
                    {p.is_connected ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowProjectMenu(false);
                    setShowAddDomainModal(true);
                  }}
                  className="w-full flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border-t border-slate-100 mt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Another Domain
                </button>
              </div>
            )}
          </div>

          {/* Navigation Groups */}
          <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1.5">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.label}
                </div>
                <nav className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                    const isLocked = item.lockedUnlessConnected && !isConnected;

                    return (
                      <Link
                        key={item.href}
                        href={isLocked ? '#' : item.href}
                        onClick={(e) => {
                          if (isLocked) {
                            e.preventDefault();
                            setShowActivationModal(true);
                          }
                        }}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-all ${
                          isActive
                            ? 'bg-white shadow-sm border border-slate-200/60 text-slate-900 font-bold'
                            : isLocked
                            ? 'text-slate-400 cursor-pointer hover:bg-slate-50/80'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-rose-500' : isLocked ? 'text-slate-300' : 'text-slate-400'}`} />
                          <span>{item.title}</span>
                        </div>
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200/60">
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span>Unlock</span>
                          </span>
                        ) : item.badge ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            isActive
                              ? 'bg-rose-50 text-rose-500'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Profile & Logout */}
        <div className="pt-4 space-y-2 border-t border-slate-100/80">
          {isAdmin && (
            <Link
              href="/superadmin"
              className="flex items-center justify-between px-3.5 py-2 rounded-2xl text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>SuperAdmin Master</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
            </Link>
          )}

          <div className="p-3 rounded-2xl bg-white shadow-sm border border-slate-200/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {(userEmail ? userEmail.charAt(0) : 'U').toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-800 truncate">{userEmail || 'Loading...'}</p>
                <p className="text-[10px] text-slate-400">Workspace Member</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 1-Click Activation Wizard Modal */}
      {showActivationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setShowActivationModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Activate {domain || 'Your Workspace'}
                </h3>
                <p className="text-xs text-slate-400">
                  Install your tracking script tag to unlock replays, heatmaps & analytics.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Copy Script Tag</span>
                <span className="text-[11px] text-slate-400 font-normal">Add to site &lt;head&gt;</span>
              </div>
              <div className="relative bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-xs overflow-x-auto shadow-inner">
                <code>
                  {`<script src="${API_BASE}/public/te.js" data-key="${apiKey || 'your_api_key'}"></script>`}
                </code>
              </div>
              <button
                onClick={copySnippet}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Script Tag</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin text-amber-600' : ''}`} />
                <span>Verify Connection</span>
              </button>

              <button
                onClick={handleSimulate}
                disabled={simulating}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {simulating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Simulating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulate Test Session</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddDomainModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 relative">
            <button
              onClick={() => setShowAddDomainModal(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-extrabold text-slate-900">Add New Domain</h3>
            <p className="text-xs text-slate-500">
              Register an additional website or subdomain under your organization workspace.
            </p>
            <label className="block text-xs font-semibold text-slate-700">
              Website Domain
              <input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="app.yourdomain.com"
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </label>
            {domainError && <p className="text-xs text-rose-600">{domainError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddDomainModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDomain}
                disabled={addingDomain}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
              >
                {addingDomain && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Add Domain
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
