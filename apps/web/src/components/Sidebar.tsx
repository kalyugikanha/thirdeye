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
  ChevronRight
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';

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
  const [userEmail, setUserEmail] = useState('scan.pe.in@gmail.com');
  const [domain, setDomain] = useState('growinsight.co.in');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('te_user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.email) setUserEmail(parsed.email);
        if (parsed.role === 'ADMIN' || parsed.email === 'admin@thirdeye.io' || parsed.email === 'scan.pe.in@gmail.com') {
          setIsAdmin(true);
        }
      }

      const token = localStorage.getItem('te_token');
      if (token) {
        fetch(apiUrl('/api/v1/projects/status'), {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.domain) setDomain(data.domain);
            setIsConnected(Boolean(data.is_connected));
          })
          .catch(() => {});
      }
    } catch (e) {}
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('te_token');
    localStorage.removeItem('te_user');
    router.push('/login');
  };

  return (
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
            <span className="text-xs font-semibold text-slate-700 truncate" title={domain}>
              {domain}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Active
          </span>
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
                          alert('Please connect your domain or tracking snippet to unlock this feature.');
                        }
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-all ${
                        isActive
                          ? 'bg-white shadow-sm border border-slate-200/60 text-slate-900 font-bold'
                          : isLocked
                          ? 'text-slate-400 cursor-not-allowed hover:bg-slate-50/50'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-rose-500' : isLocked ? 'text-slate-300' : 'text-slate-400'}`} />
                        <span>{item.title}</span>
                      </div>
                      {isLocked ? (
                        <Lock className="w-3.5 h-3.5 text-slate-300" />
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
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-800 truncate">{userEmail}</p>
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
  );
}
