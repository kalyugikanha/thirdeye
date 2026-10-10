"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutTemplate, 
  BarChart, 
  Video, 
  Flame, 
  ShieldCheck, 
  Activity, 
  Bell, 
  Search, 
  TrendingUp, 
  Sliders, 
  Users,
  ShieldAlert,
  GitMerge,
  Globe,
  BookOpen,
  Workflow,
  LayoutGrid,
  FileText
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', icon: LayoutTemplate, title: 'Workspace Dashboard' },
  { href: '/custom-dashboard', icon: LayoutGrid, title: 'Custom Dashboard Builder' },
  { href: '/analytics', icon: BarChart, title: 'Analytics Overview' },
  { href: '/analytics/sessions', icon: Video, title: 'Session Replays (rrweb)' },
  { href: '/analytics/heatmaps', icon: Flame, title: 'Click Heatmaps' },
  { href: '/analytics/funnels', icon: GitMerge, title: 'Conversion Funnels' },
  { href: '/analytics/blogs', icon: BookOpen, title: 'Blog Content Analytics' },
  { href: '/devops', icon: ShieldCheck, title: 'DevOps & CI/CD Health' },
  { href: '/uptime', icon: Activity, title: 'Uptime & URL Monitoring' },
  { href: '/uptime/synthetic', icon: Workflow, title: 'Synthetic API Scenarios' },
  { href: '/status/demo', icon: Globe, title: 'Public Status Page' },
  { href: '/alerts', icon: Bell, title: 'Alerts & Notifications' },
  { href: '/seo', icon: Search, title: 'SEO & Technical Audit' },
  { href: '/security', icon: ShieldAlert, title: 'OWASP Security Scanner' },
  { href: '/marketing', icon: TrendingUp, title: 'Marketing Hub' },
  { href: '/reports/sla', icon: FileText, title: 'SLA Compliance & MTTR Reports' },
  { href: '/settings/alerts', icon: Sliders, title: 'Alert Channels Settings' },
  { href: '/settings/team', icon: Users, title: 'Team Management & RBAC' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 flex flex-col items-center justify-between py-6 border-r border-slate-100 flex-shrink-0 bg-white min-h-screen">
      <div className="flex flex-col items-center gap-6">
        {/* Brand Logo */}
        <Link 
          href="/" 
          className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm hover:bg-blue-700 transition-colors"
          title="ThirdEye Home"
        >
          T
        </Link>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2 text-slate-400">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.title}
                className={`p-2 rounded-xl transition-all relative group ${
                  isActive 
                    ? 'text-blue-600 bg-blue-50 font-semibold' 
                    : 'hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Avatar Placeholder */}
      <div 
        className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors"
        title="Admin User"
      >
        AL
      </div>
    </aside>
  );
}
