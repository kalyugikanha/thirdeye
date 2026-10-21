"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { 
  Compass, 
  ArrowLeft, 
  Globe2, 
  Search, 
  Share2, 
  TrendingUp, 
  BarChart3, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Loader2, 
  Sparkles, 
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface BenchmarkDomain {
  domain: string;
  is_client: boolean;
  domain_authority: number;
  monthly_visitors: number;
  organic_keywords: number;
  backlinks: number;
  traffic_share: {
    organic_search: number;
    direct: number;
    social: number;
    referral: number;
  };
  top_competing_keywords: string[];
}

export default function CompetitorBenchmarkPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [clientDomain, setClientDomain] = useState('selfupcommunity.com');
  const [competitors, setCompetitors] = useState<string[]>(['circle.so', 'nas.io', 'skool.com']);
  const [newCompetitor, setNewCompetitor] = useState('');
  const [benchmarks, setBenchmarks] = useState<BenchmarkDomain[]>([]);

  const runAnalysis = async (domainList: string[]) => {
    setAnalyzing(true);
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');

    try {
      const res = await fetch(apiUrl('/api/v1/competitors/analyze'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ competitor_domains: domainList })
      });

      if (res.ok) {
        const data = await res.json();
        setClientDomain(data.client_domain || 'selfupcommunity.com');
        setBenchmarks(data.benchmarks || []);
      }
    } catch (e) {
      console.error('Failed to run competitor benchmark:', e);
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis(competitors);
  }, []);

  const handleAddCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCompetitor.trim().toLowerCase().replace('https://', '').replace('http://', '').replace('/', '');
    if (!clean || competitors.includes(clean)) return;
    const updated = [...competitors, clean];
    setCompetitors(updated);
    setNewCompetitor('');
    runAnalysis(updated);
  };

  const handleRemoveCompetitor = (dom: string) => {
    const updated = competitors.filter(c => c !== dom);
    setCompetitors(updated);
    runAnalysis(updated);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1.5">
                <Link href="/" className="hover:text-slate-700 flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Workspace Home
                </Link>
                <span>/</span>
                <Link href="/marketing" className="hover:text-slate-700 transition-colors">
                  Attribution Hub
                </Link>
                <span>/</span>
                <span className="text-slate-600">Market Intelligence</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>Competitor Traffic & Keyword Benchmark</span>
                <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
                  Competitive Intel
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                Compare your website's traffic reach, domain authority, organic keyword footprint, and acquisition channels against competing platforms.
              </p>
            </div>

            <button
              onClick={() => runAnalysis(competitors)}
              disabled={analyzing}
              className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:scale-105 self-start sm:self-center"
              title="Refresh Benchmark"
            >
              <RefreshCw className={`w-4 h-4 ${analyzing ? 'animate-spin text-rose-500' : ''}`} />
            </button>
          </div>

          {/* Add Competitor Input */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm">
            <form onSubmit={handleAddCompetitor} className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Globe2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  placeholder="Enter competitor domain (e.g. circle.so, skool.com, discord.com)"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={analyzing || !newCompetitor.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Competitor</span>
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              <span className="text-slate-400 font-medium">Tracking Competitors:</span>
              {competitors.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-mono font-semibold text-[11px]"
                >
                  <span>{c}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCompetitor(c)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Benchmark Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {benchmarks.map((b) => (
              <div
                key={b.domain}
                className={`rounded-3xl p-5 border shadow-sm transition-all ${
                  b.is_client
                    ? 'bg-gradient-to-b from-rose-50/60 to-white border-rose-200 shadow-rose-100/50'
                    : 'bg-white border-slate-200/60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    b.is_client
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {b.is_client ? 'Your Domain' : 'Competitor'}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">DA: {b.domain_authority}/100</span>
                </div>

                <h3 className="font-bold text-slate-900 text-base truncate font-mono" title={b.domain}>
                  {b.domain}
                </h3>

                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400">Est. Monthly Visitors</span>
                    <span className="font-bold font-mono text-slate-900">{b.monthly_visitors.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400">Ranked Keywords</span>
                    <span className="font-bold font-mono text-slate-900">{b.organic_keywords.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400">Backlinks Authority</span>
                    <span className="font-bold font-mono text-slate-900">{b.backlinks.toLocaleString()}</span>
                  </div>
                </div>

                {/* Traffic Share Breakdown */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Traffic Acquisition Split
                  </span>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                    <div style={{ width: `${b.traffic_share.organic_search}%` }} className="bg-emerald-500 h-full" title="Search" />
                    <div style={{ width: `${b.traffic_share.direct}%` }} className="bg-indigo-500 h-full" title="Direct" />
                    <div style={{ width: `${b.traffic_share.social}%` }} className="bg-rose-500 h-full" title="Social" />
                    <div style={{ width: `${b.traffic_share.referral}%` }} className="bg-amber-500 h-full" title="Referrals" />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                    <span>Search {Math.round(b.traffic_share.organic_search)}%</span>
                    <span>Direct {Math.round(b.traffic_share.direct)}%</span>
                    <span>Social {Math.round(b.traffic_share.social)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Deep Keyword Gap Comparison Table */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/60 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Competitor Keyword Footprint & Overlap
              </h3>
              <p className="text-xs text-slate-500">
                Key organic queries driving traffic to competing platforms in your market niche.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="pb-3 font-semibold">Domain</th>
                    <th className="pb-3 font-semibold">Classification</th>
                    <th className="pb-3 font-semibold">Top Ranked Keywords</th>
                    <th className="pb-3 font-semibold text-right">Search Volume Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {benchmarks.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 font-bold font-mono text-slate-900">
                        {b.domain}
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.is_client
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {b.is_client ? 'Your Site' : 'Competitor'}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {b.top_competing_keywords.map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[11px]">
                              "{kw}"
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 text-right font-bold text-emerald-600 font-mono">
                        {Math.round(b.traffic_share.organic_search)}% Organic
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
