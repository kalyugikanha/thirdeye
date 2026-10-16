"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GitMerge, Loader2, Play, ArrowRight, RefreshCw, TrendingDown } from 'lucide-react';

interface JourneyNode {
  name: string;
  step: number;
  count: number;
  percentage: number;
  drop_off: number;
  drop_off_pct: number;
  sample_session_ids: string[];
  children: JourneyNode[];
}

interface JourneyData {
  total_sessions: number;
  depth: number;
  top_paths: { steps: string[]; sessions: number; percentage: number; sample_session_ids: string[] }[];
  tree: JourneyNode[];
}

function NodeRow({ node, rootCount }: { node: JourneyNode; rootCount: number }) {
  const widthPct = Math.max(4, Math.round((node.count / Math.max(rootCount, 1)) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-xs font-bold text-slate-800 truncate font-mono" title={node.name}>{node.name}</span>
            <span className="text-[11px] text-slate-500 flex-shrink-0">
              {node.count} sessions · {node.percentage}%
              {node.drop_off > 0 && (
                <span className="ml-2 text-rose-500 font-semibold">
                  <TrendingDown className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                  {node.drop_off_pct}% exit
                </span>
              )}
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-500 to-orange-400 rounded-full" style={{ width: `${widthPct}%` }} />
          </div>
        </div>
        {node.sample_session_ids[0] && (
          <Link
            href={`/analytics/sessions?session=${encodeURIComponent(node.sample_session_ids[0])}`}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors"
          >
            <Play className="w-3 h-3" /> Replay
          </Link>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="ml-5 pl-4 border-l-2 border-slate-200 space-y-3">
          {node.children.map((c) => (
            <NodeRow key={`${c.step}-${c.name}`} node={c} rootCount={rootCount} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function JourneysPage() {
  const router = useRouter();
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [depth, setDepth] = useState(4);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl(`/api/v1/analytics/journeys?depth=${depth}&days=${days}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setData(await res.json());
    } catch (e: any) {
      setError(e?.message || 'Failed to load journeys');
    } finally {
      setLoading(false);
    }
  }, [depth, days, router]);

  useEffect(() => {
    load();
  }, [load]);

  const rootCount = data?.total_sessions || 1;

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                Path Analysis
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">User Journey Flows</h1>
              <p className="text-xs text-slate-500 mt-1">
                See the routes visitors actually take through your site, where they drop off, and replay them in one click.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
                aria-label="Time range"
              >
                <option value={1}>Last 24 hours</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <select
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
                aria-label="Steps"
              >
                {[2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>{d} steps</option>
                ))}
              </select>
              <button
                onClick={load}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loading && !data ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
              Analysing visitor trajectories...
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-xs text-rose-700">{error}</div>
          ) : !data || data.total_sessions === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              <GitMerge className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No journeys yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Once visitors browse your tracked site, their navigation paths will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sessions analysed</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-1">{data.total_sessions}</p>
                </div>
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Top entry page</p>
                  <p className="text-lg font-extrabold text-slate-900 mt-2 font-mono truncate">{data.tree[0]?.name || '/'}</p>
                </div>
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Most common path</p>
                  <p className="text-xs font-bold text-slate-900 mt-2 font-mono truncate">
                    {data.top_paths[0]?.steps.join(' → ') || '-'}
                  </p>
                </div>
              </div>

              <section className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-extrabold text-slate-900">Top paths</h2>
                <div className="divide-y divide-slate-100">
                  {data.top_paths.map((p, i) => (
                    <div key={i} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {p.steps.map((s, idx) => (
                          <span key={idx} className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">{s}</span>
                            {idx < p.steps.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[11px] text-slate-500">{p.sessions} · {p.percentage}%</span>
                        {p.sample_session_ids[0] && (
                          <Link
                            href={`/analytics/sessions?session=${encodeURIComponent(p.sample_session_ids[0])}`}
                            className="flex items-center gap-1 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1 rounded-lg"
                          >
                            <Play className="w-3 h-3" /> Watch Replays
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm space-y-5">
                <h2 className="text-sm font-extrabold text-slate-900">Path tree</h2>
                {data.tree.map((n) => (
                  <NodeRow key={n.name} node={n} rootCount={rootCount} />
                ))}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
