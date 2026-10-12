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
  CheckCircle2
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface NavGroup {
  label: string;
  items: {
    href: string;
    icon: any;
    title: string;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: '/', icon: LayoutDashboard, title: 'Workspace Dashboard' },
      { href: '/analytics', icon: BarChart3, title: 'Traffic Analytics' },
    ]
  },
  {
    label: "User Behavior & UX",
    items: [
      { href: '/analytics/sessions', icon: Video, title: 'Session Replays', badge: 'Live' },
      { href: '/analytics/heatmaps', icon: Flame, title: 'Click Heatmaps' },
      { href: '/analytics/funnels', icon: GitMerge, title: 'Conversion Funnels' },
    ]
  },
  {
    label: "Health & Performance",
    items: [
      { href: '/uptime', icon: Activity, title: 'Uptime & Latency' },
      { href: '/seo', icon: Search, title: 'SEO & Security' },
    ]
  },
  {
    label: "Configuration",
    items: [
      { href: '/onboarding', icon: Code2, title: 'Tracking Code' },
      { href: '/alerts', icon: Bell, title: 'Alerts & Activity' },
    ]
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('scan.pe.in@gmail.com');
  const [domain, setDomain] = useState('scanpe.in');

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('te_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.email) setUserEmail(parsed.email);
      }
    } catch (e) {}
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('te_token');
    localStorage.removeItem('te_user');
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 flex-shrink-0 min-h-screen select-none font-sans">
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
              T
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-white tracking-tight">ThirdEye</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Web Analytics & Replays</p>
            </div>
          </Link>

          {/* Active Site Indicator */}
          <div className="mt-4 p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <Globe2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-200 truncate" title={domain}>
                {domain}
              </span>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Active
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="px-3 py-4 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {group.label}
              </div>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-600/30'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.title}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          isActive ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* User Footer & Logout */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-blue-400 border border-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-slate-200 truncate">{userEmail}</p>
              <p className="text-[10px] text-slate-400">Admin</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
