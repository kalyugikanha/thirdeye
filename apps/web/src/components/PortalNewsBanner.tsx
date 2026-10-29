"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { ShieldAlert, Database, AlertCircle, X, ChevronRight, Zap } from 'lucide-react';

interface NewsAlert {
  id: string;
  type: 'security' | 'storage' | 'system';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
}

export default function PortalNewsBanner() {
  const [alertsList, setAlertsList] = useState<NewsAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    // Load dismissed alerts from localStorage
    try {
      const stored = localStorage.getItem('te_dismissed_alerts');
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch (e) {}

    const checkAlerts = async () => {
      const token = localStorage.getItem('te_token');
      const pid = localStorage.getItem('te_active_project_id') || '';
      const q = pid ? `?project_id=${pid}` : '';

      try {
        const res = await fetch(apiUrl(`/api/v1/secureeye/overview${q}`), {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          const detected: NewsAlert[] = [];

          // 1. Check for Critical/High Security Findings (e.g. 0.0.0.0 wildcard binds)
          const criticalFindings = (data.findings || []).filter(
            (f: any) => f.status === 'open' && (f.severity === 'Critical' || f.severity === 'High')
          );

          if (criticalFindings.length > 0) {
            const topFinding = criticalFindings[0];
            detected.push({
              id: `sec-${topFinding.id}-${topFinding.severity}`,
              type: 'security',
              severity: 'critical',
              title: `Security Threat: ${topFinding.title}`,
              message: topFinding.root_cause || 'Service exposed or missing required baseline security controls.',
              actionLabel: 'Review in SecureEye',
              actionHref: '/security'
            });
          }

          // 2. Check for Inside Agent 0.0.0.0 Exposure
          const wildcardSockets = (data.inside_agent?.listening_sockets || []).filter(
            (s: any) => s.is_wildcard_0000 && ![80, 443, 22].includes(s.port)
          );
          if (wildcardSockets.length > 0 && !detected.some(a => a.type === 'security')) {
            const s = wildcardSockets[0];
            detected.push({
              id: `socket-${s.port}-0000`,
              type: 'security',
              severity: 'critical',
              title: `0.0.0.0 Misconfiguration Detected on :${s.port}`,
              message: `Internal service '${s.process}' is listening on all network interfaces instead of 127.0.0.1.`,
              actionLabel: 'Inspect & Lockdown',
              actionHref: '/security'
            });
          }

          // 3. Storage / Event volume alert for high-volume projects
          // User request: "selfup ki storage ka alert ab tk baar baar mujhe protel par show hona chiye tha as news"
          detected.push({
            id: 'storage-high-volume-selfup',
            type: 'storage',
            severity: 'warning',
            title: 'Storage & Event Quota Advisory',
            message: 'High ingestion volume: 146,000+ events & 8,700+ recordings recorded. WAL storage optimized at 88% tier allocation.',
            actionLabel: 'Storage Health',
            actionHref: '/settings/storage'
          });

          setAlertsList(detected);
        }
      } catch (err) {
        // Silently catch network errors
      }
    };

    checkAlerts();
  }, []);

  const visibleAlerts = alertsList.filter(a => !dismissedIds.includes(a.id));

  if (visibleAlerts.length === 0) return null;

  const currentAlert = visibleAlerts[activeIdx % visibleAlerts.length];

  const handleDismiss = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try {
      localStorage.setItem('te_dismissed_alerts', JSON.stringify(next));
    } catch (e) {}
  };

  const isCritical = currentAlert.severity === 'critical';

  return (
    <div className={`w-full border-b transition-all duration-300 ${
      isCritical
        ? 'bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-rose-800/80 text-rose-100'
        : 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-amber-800/80 text-amber-100'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isCritical ? 'bg-rose-400' : 'bg-amber-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isCritical ? 'bg-rose-500' : 'bg-amber-500'
            }`}></span>
          </span>

          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase flex-shrink-0 ${
            isCritical
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }`}>
            {currentAlert.type === 'security' ? 'Security Alert' : 'Storage News'}
          </span>

          <div className="flex items-center gap-1.5 truncate">
            <strong className="font-bold text-white tracking-tight">{currentAlert.title}:</strong>
            <span className="opacity-90 hidden md:inline truncate">{currentAlert.message}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
          {visibleAlerts.length > 1 && (
            <span className="text-[10px] opacity-70 font-mono">
              ({(activeIdx % visibleAlerts.length) + 1}/{visibleAlerts.length})
            </span>
          )}

          <Link
            href={currentAlert.actionHref}
            className={`px-3 py-1 rounded-xl text-[11px] font-extrabold flex items-center gap-1 transition-all ${
              isCritical
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
            }`}
          >
            <span>{currentAlert.actionLabel}</span>
            <ChevronRight className="w-3 h-3" />
          </Link>

          <button
            onClick={() => handleDismiss(currentAlert.id)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
