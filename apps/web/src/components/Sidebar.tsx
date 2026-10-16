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
  Loader2
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
      { href: '/analytics', icon: BarChart3, title: 'Traffic Analytics', lockedUnlessConnected: true },
      { href: '/analytics/sessions', icon: Video, title: 'Session Replays', badge: 'Live', lockedUnlessConnected: true },
      { href: '/analytics/heatmaps', icon: Flame, title: 'Click Heatmaps', lockedUnlessConnected: true },
      { href: '/analytics/errors', icon: AlertTriangle, title: 'Errors & Issues', badge: 'BugTracker' },
    ]
  },
  {
    label: "Health & APM",
    items: [
      { href: '/devops', icon: Cpu, title: 'Server APM & APIs' },
      { href: '/uptime', icon: Activity, title: 'Uptime & SSL' },
      { href: '/seo', icon: Search, title: 'SEO & Performance' },
    ]
  },
  {
    label: "Storage & Ecosystem",
    items: [
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

  const fetchStatus = () => {
    const token = localStorage.getItem('te_token');
    if (token) {
      fetch(apiUrl('/api/v1/projects/status'), {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.domain) setDomain(data.domain);
          if (data.api_key) setApiKey(data.api_key);
          setIsConnected(Boolean(data.is_connected));
        })
        .catch(() => {});
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
      <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-slate-100/80 p-5 flex flex-col justify-between bg-transparent flex-shrink-0 select-none font-sans">
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

          {/* Active Domain Card */}
          <div className="p-3 rounded-2xl bg-white shadow-sm border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <Globe2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-700 truncate" title={domain || 'Workspace'}>
                {domain || 'Workspace'}
              </span>
            </div>
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
    </>
  );
}
