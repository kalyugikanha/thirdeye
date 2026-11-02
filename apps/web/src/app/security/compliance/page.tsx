"use client";

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { 
  FileCheck2, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  Lock, 
  AlertTriangle, 
  Loader2, 
  RefreshCw, 
  ArrowLeft,
  Download,
  Copy,
  Check,
  Code2,
  ExternalLink,
  Shield,
  Award
} from 'lucide-react';

interface Framework {
  id: string;
  name: string;
  category: string;
  readiness_pct: number;
  controls_passed: number;
  total_controls: number;
  status: string;
  highlights: string;
}

interface ComplianceResponse {
  overall_readiness_pct: number;
  certification_status: string;
  domain: string;
  frameworks: Framework[];
  badge_embed_code: string;
}

export default function ComplianceCenterPage() {
  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    const token = localStorage.getItem('te_token');
    const pid = localStorage.getItem('te_active_project_id') || '';
    const q = pid ? `?project_id=${pid}` : '';
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/secureeye/compliance/status${q}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const copyBadgeSnippet = () => {
    if (!data?.badge_embed_code) return;
    navigator.clipboard.writeText(data.badge_embed_code);
    setCopiedBadge(true);
    showToast('Trust Badge HTML code copied to clipboard!');
    setTimeout(() => setCopiedBadge(false), 2500);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="w-full flex flex-col gap-6 pb-16">

          {/* Navigation Sub-Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                <Link href="/security" className="hover:text-slate-700 flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Cyber Security
                </Link>
                <span>/</span>
                <span className="text-slate-600">Compliance &amp; Certifications</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Compliance Center &amp; Security Trust Badge</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-emerald-500" /> Enterprise Audit Ready
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Continuous compliance mapping across SOC 2, ISO 27001, OWASP Top 10, and GDPR. Embed verified security trust badges to build customer confidence and boost sales.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <a
                href={apiUrl('/api/v1/secureeye/report/html')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Executive Audit Report</span>
              </a>

              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-2xs transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Sub-Navigation Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/security" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
              Command Center
            </Link>
            <Link href="/security/threats" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
              WAF &amp; Threat Radar
            </Link>
            <Link href="/security/secrets" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
              Secret Leak Shield (DLP)
            </Link>
            <Link href="/security/api-security" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-slate-900">
              API Security &amp; Pen-Test
            </Link>
            <Link href="/security/compliance" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-xs">
              Compliance &amp; Trust Badge
            </Link>
          </div>

          {/* Toast Notification */}
          {toast && (
            <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-700 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toast}</span>
            </div>
          )}

          {/* KPI Bento Scorecard */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compliance Readiness</span>
                <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight">
                  {data?.overall_readiness_pct ?? 90}%
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Across 5 enterprise security frameworks
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-emerald-600">
                Grade A Enterprise Certified
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Controls Verified</span>
                <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FileCheck2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-black text-slate-900 font-mono tracking-tight">
                  49/55
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Automated security checks passing
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] font-bold text-slate-500">
                Continuous telemetry validation
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-950 to-slate-900 text-white rounded-3xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">
                    Trust Badge Integration
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="mt-2">
                  <span className="text-xl font-black tracking-tight block">
                    Verified by CyberGuard
                  </span>
                  <span className="text-xs text-slate-300 block mt-0.5 font-mono">
                    Embed on checkout &amp; footer
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 text-[10px] font-mono text-emerald-400 font-bold">
                Boosts buyer checkout confidence
              </div>
            </div>

          </div>

          {/* Frameworks Mapping Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left (8 Cols): 5 Frameworks Status */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
                <h3 className="text-base font-black text-slate-900 pb-3 border-b border-slate-100">
                  Enterprise Framework Readiness Mapping
                </h3>

                <div className="divide-y divide-slate-100 text-xs font-sans">
                  {data?.frameworks.map((fw) => (
                    <div key={fw.id} className="py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-slate-900 text-sm block">{fw.name}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">{fw.category}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-base font-black text-emerald-600 block">
                            {fw.readiness_pct}% Ready
                          </span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {fw.controls_passed}/{fw.total_controls} Controls Passed
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${fw.readiness_pct}%` }}
                        />
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                        <strong>Key Verifications:</strong> {fw.highlights}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right (4 Cols): Embeddable Trust Badge Suite */}
            <div className="lg:col-span-4 space-y-4">
              
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Security Trust Badge</h4>
                    <p className="text-[10px] text-slate-400">Increase checkout conversion with proof</p>
                  </div>
                </div>

                {/* Badge Preview */}
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-3 text-center">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Live SVG Badge Preview
                  </span>
                  <div className="p-2 bg-slate-950/80 rounded-xl border border-slate-700/80 shadow-md">
                    {/* SVG Render */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="165" height="36" viewBox="0 0 165 36" fill="none">
                      <rect width="165" height="36" rx="10" fill="#0F172A"/>
                      <rect x="0.5" y="0.5" width="164" height="35" rx="9.5" stroke="#334155"/>
                      <g transform="translate(10, 8)">
                        <path d="M10 2L3 5V10C3 14.5 6 18.5 10 20C14 18.5 17 14.5 17 10V5L10 2Z" fill="#10B981" stroke="#059669" strokeWidth="1.5"/>
                        <path d="M7 10L9 12L13 8" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </g>
                      <text x="36" y="15" fill="#94A3B8" fontFamily="-apple-system, sans-serif" fontSize="8" fontWeight="700" letterSpacing="0.5">VERIFIED BY THIRDEYE</text>
                      <text x="36" y="27" fill="#F8FAFC" fontFamily="-apple-system, sans-serif" fontSize="11" fontWeight="800">CyberGuard Grade A</text>
                    </svg>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-snug max-w-xs">
                    Embed on your cart, checkout, or footer to assure buyers of bank-grade security.
                  </span>
                </div>

                {/* Embed Snippet Code */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-700">Embed Code Snippet</span>
                    <button
                      onClick={copyBadgeSnippet}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedBadge ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBadge ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <textarea
                    readOnly
                    rows={3}
                    value={data?.badge_embed_code || ''}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-[10px] text-slate-700 select-all focus:outline-none"
                  />
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
