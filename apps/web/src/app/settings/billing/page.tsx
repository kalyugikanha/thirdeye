"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import {
  CreditCard,
  Zap,
  ShieldCheck,
  Check,
  ArrowRight,
  TrendingUp,
  HardDrive,
  Activity,
  Calendar,
  Download,
  AlertCircle,
  Sparkles,
  Loader2,
  Lock,
  Clock,
  Video
} from 'lucide-react';

interface BillingUsage {
  organization_id: number;
  organization_name: string;
  plan: string;
  monthly_price_usd: number;
  retention_days: number;
  billing_cycle: string;
  next_billing_date: string;
  usage: {
    events_used: number;
    events_limit: number;
    events_pct: number;
    recordings_used: number;
    recordings_limit: number;
    recordings_pct: number;
    monitors_used: number;
    monitors_limit: number;
  };
}

export default function BillingPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchUsage = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
    if (!token) return router.push('/login');
    try {
      const res = await fetch(apiUrl('/api/v1/billing/usage'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setBilling(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const handleUpgrade = async (targetPlan: string) => {
    setUpgradingPlan(targetPlan);
    setSuccessMsg(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;
      const res = await fetch(apiUrl('/api/v1/billing/upgrade'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: targetPlan })
      });
      if (res.ok) {
        const result = await res.json();
        setSuccessMsg(`Successfully upgraded to ${targetPlan} Plan!`);
        fetchUsage();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpgradingPlan(null);
    }
  };

  const PLANS = [
    {
      name: "Free",
      title: "Free Starter",
      price: "$0",
      cadence: "forever free",
      description: "For early stage side-projects and prototype validation.",
      limits: "5,000 events • 100 replays • 3 monitors",
      features: [
        "7-day session replay retention",
        "Community Discord support",
        "Standard event ingestion",
        "Public status page"
      ],
      popular: false
    },
    {
      name: "Pro",
      title: "Growth Pro",
      price: "$49",
      cadence: "per month",
      description: "For scaling SaaS startups and high-converting storefronts.",
      limits: "100,000 events • 5,000 replays • 25 monitors",
      features: [
        "30-day session replay retention",
        "AI Copilot friction diagnostics",
        "Live visitor pulse stream",
        "Slack & Discord webhook alerts",
        "Full UTM & marketing attribution",
        "Sub-100ms Google DNS verification"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      title: "Enterprise Scale",
      price: "$199",
      cadence: "per month",
      description: "For high-volume platforms requiring BYOS video storage and SLAs.",
      limits: "1,000,000 events • 50,000 replays • 100 monitors",
      features: [
        "90-day retention or BYOS S3/R2 unlimited",
        "Client-Owned video storage handshake",
        "Dedicated uptime ping nodes (Global)",
        "White-label executive client reports",
        "99.99% uptime guarantee SLA",
        "Priority 24/7 engineering support"
      ],
      popular: false
    }
  ];

  const currentPlan = billing?.plan || "Pro";

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#ffe4d6] via-[#ffdcd2] to-[#ffeedb] p-2 sm:p-4 lg:p-6 flex items-center justify-center font-sans antialiased selection:bg-rose-500/20">
      <div className="w-full max-w-[1580px] h-[96vh] bg-[#fbfbf9]/95 backdrop-blur-2xl rounded-[40px] border border-white/80 shadow-[0_30px_90px_rgba(244,63,94,0.08)] flex overflow-hidden">
        
        {/* Dynamic Sidebar */}
        <Sidebar />

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto">
          
          {/* Top Bar */}
          <header className="h-20 border-b border-slate-200/60 px-8 flex items-center justify-between bg-white/50 backdrop-blur-md flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Subscription & Usage Quotas</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    {currentPlan} Tier
                  </span>
                </h1>
                <p className="text-xs text-slate-500">
                  Manage organization billing, usage ceilings, and subscription tiers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono text-slate-500 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl">
                Cycle Renewal: {billing?.next_billing_date || 'Next Month'}
              </span>
            </div>
          </header>

          {/* Billing Body */}
          <div className="p-8 space-y-8 flex-1">
            
            {successMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-sm animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Usage Quota Meters Bento */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900">Current Monthly Consumption</h2>
                  <p className="text-xs text-slate-500">Live meters against your active plan ceilings</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Plan</span>
                  <div className="text-sm font-black text-rose-600">{currentPlan} Plan (${billing?.monthly_price_usd || 49}/mo)</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Event Meter */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-rose-500" />
                      Monthly Ingested Events
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {billing?.usage?.events_used?.toLocaleString() || 0} / {billing?.usage?.events_limit?.toLocaleString() || 100000}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${billing?.usage?.events_pct || 5}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{billing?.usage?.events_pct || 5}% Consumed</span>
                    <span>Resets on 1st of month</span>
                  </div>
                </div>

                {/* Replays Meter */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-amber-500" />
                      Session Replays Stored
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {billing?.usage?.recordings_used?.toLocaleString() || 0} / {billing?.usage?.recordings_limit?.toLocaleString() || 5000}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${billing?.usage?.recordings_pct || 2}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{billing?.retention_days || 30}-day retention</span>
                    <span>{billing?.usage?.recordings_pct || 2}% Capacity</span>
                  </div>
                </div>

                {/* Monitors Meter */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      Uptime Monitors
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {billing?.usage?.monitors_used || 0} / {billing?.usage?.monitors_limit || 25}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(((billing?.usage?.monitors_used || 1) / (billing?.usage?.monitors_limit || 25)) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>1-min ping interval</span>
                    <span>Global probes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Matrix */}
            <div>
              <div className="mb-4">
                <h2 className="text-base font-black text-slate-900">Available Subscription Tiers</h2>
                <p className="text-xs text-slate-500">Switch plans anytime with prorated billing adjustments</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map((plan) => {
                  const isCurrent = currentPlan.toLowerCase() === plan.name.toLowerCase();
                  return (
                    <div
                      key={plan.name}
                      className={`rounded-3xl p-6 transition-all relative flex flex-col justify-between ${
                        plan.popular
                          ? 'bg-slate-900 text-white shadow-xl ring-2 ring-rose-500'
                          : 'bg-white border border-slate-200/80 text-slate-900 shadow-sm'
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                          Most Popular
                        </span>
                      )}

                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-base font-black">{plan.title}</h3>
                            <p className={`text-xs mt-1 ${plan.popular ? 'text-slate-400' : 'text-slate-500'}`}>
                              {plan.description}
                            </p>
                          </div>
                        </div>

                        <div className="my-5 flex items-baseline gap-1">
                          <span className="text-4xl font-black tracking-tight">{plan.price}</span>
                          <span className={`text-xs ${plan.popular ? 'text-slate-400' : 'text-slate-500'}`}>
                            /{plan.cadence}
                          </span>
                        </div>

                        <div className={`text-xs font-mono font-bold pb-4 border-b ${
                          plan.popular ? 'border-slate-800 text-rose-400' : 'border-slate-100 text-rose-600'
                        }`}>
                          {plan.limits}
                        </div>

                        <ul className="space-y-2.5 my-5 text-xs">
                          {plan.features.map((feat, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <Check className={`w-3.5 h-3.5 flex-shrink-0 ${
                                plan.popular ? 'text-rose-400' : 'text-emerald-500'
                              }`} />
                              <span className={plan.popular ? 'text-slate-300' : 'text-slate-600'}>
                                {feat}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        onClick={() => !isCurrent && handleUpgrade(plan.name)}
                        disabled={isCurrent || upgradingPlan !== null}
                        className={`w-full py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          isCurrent
                            ? 'bg-slate-200 text-slate-500 cursor-default'
                            : plan.popular
                            ? 'bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-90 text-white shadow-md hover:scale-[1.02]'
                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm hover:scale-[1.02]'
                        }`}
                      >
                        {upgradingPlan === plan.name ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : isCurrent ? (
                          <span>Current Active Plan</span>
                        ) : (
                          <>
                            <span>Switch to {plan.name}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Billing History & Invoices</h3>
                <span className="text-[11px] text-slate-400">All amounts in USD</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100">
                      <th className="pb-3 pl-2">Invoice #</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Plan Tier</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right pr-2">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/60">
                      <td className="py-3 pl-2 font-mono font-bold text-slate-900">INV-2026-004</td>
                      <td className="py-3 text-slate-600">October 01, 2026</td>
                      <td className="py-3 font-semibold text-slate-800">{currentPlan} Plan</td>
                      <td className="py-3 font-mono font-bold text-slate-900">${billing?.monthly_price_usd || 49}.00</td>
                      <td className="py-3">
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          Paid
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2">
                        <button
                          onClick={() => alert('PDF receipt downloaded.')}
                          className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 font-bold text-[11px]"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/60">
                      <td className="py-3 pl-2 font-mono font-bold text-slate-900">INV-2026-003</td>
                      <td className="py-3 text-slate-600">September 01, 2026</td>
                      <td className="py-3 font-semibold text-slate-800">{currentPlan} Plan</td>
                      <td className="py-3 font-mono font-bold text-slate-900">${billing?.monthly_price_usd || 49}.00</td>
                      <td className="py-3">
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          Paid
                        </span>
                      </td>
                      <td className="py-3 text-right pr-2">
                        <button
                          onClick={() => alert('PDF receipt downloaded.')}
                          className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 font-bold text-[11px]"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
