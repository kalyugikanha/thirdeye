"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Smile, Loader2, Play, Star, Sparkles, MousePointerClick, MessageSquare } from 'lucide-react';

interface FeedbackItem {
  id: number;
  rating: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  comment: string | null;
  url: string;
  browser: string;
  trigger: string;
  session_id: string | null;
  has_replay: boolean;
  created_at: string;
}

interface FeedbackData {
  summary: {
    total: number;
    average_rating: number;
    positive: number;
    neutral: number;
    negative: number;
    positive_pct: number;
    neutral_pct: number;
    negative_pct: number;
  };
  items: FeedbackItem[];
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  neutral: 'bg-amber-50 text-amber-700 border-amber-200',
  negative: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function FeedbackPage() {
  const router = useRouter();
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const [prompt, setPrompt] = useState('How is your experience?');
  const [savingCfg, setSavingCfg] = useState(false);

  const token = () => localStorage.getItem('te_token');

  const load = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push('/login');
      return;
    }
    setError('');
    try {
      const headers = { Authorization: `Bearer ${t}` };
      const [fb, cfg] = await Promise.all([
        fetch(apiUrl('/api/v1/analytics/feedback'), { headers }),
        fetch(apiUrl('/api/v1/feedback/settings'), { headers }),
      ]);
      if (fb.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      if (!fb.ok) throw new Error(`Request failed (${fb.status})`);
      setData(await fb.json());
      if (cfg.ok) {
        const c = await cfg.json();
        setWidgetEnabled(Boolean(c.enabled));
        if (c.prompt) setPrompt(c.prompt);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const saveConfig = async (enabled: boolean) => {
    setSavingCfg(true);
    try {
      const res = await fetch(apiUrl('/api/v1/feedback/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ enabled, prompt }),
      });
      if (res.ok) setWidgetEnabled(enabled);
    } finally {
      setSavingCfg(false);
    }
  };

  const simulate = async () => {
    setSimulating(true);
    try {
      await fetch(apiUrl('/api/v1/feedback/simulate'), { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
      await load();
    } finally {
      setSimulating(false);
    }
  };

  const s = data?.summary;

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Voice of Customer
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-2">Customer Feedback</h1>
              <p className="text-xs text-slate-500 mt-1">
                CSAT ratings from your in-page widget and automatic rage-click prompts, linked to session replays.
              </p>
            </div>
            <button
              onClick={simulate}
              disabled={simulating}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm disabled:opacity-50"
            >
              {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-rose-500" />}
              Simulate Sample Feedback
            </button>
          </div>

          <section className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold text-slate-900">Feedback widget on your website</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {widgetEnabled ? 'Visible to visitors as a floating "Feedback" pill, and shown after rage clicks.' : 'Currently hidden. Turn on to start collecting feedback.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={140}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs w-64"
                aria-label="Widget prompt"
              />
              <button
                onClick={() => saveConfig(!widgetEnabled)}
                disabled={savingCfg}
                className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 ${
                  widgetEnabled ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {widgetEnabled ? 'Enabled — click to disable' : 'Enable widget'}
              </button>
              {widgetEnabled && (
                <button onClick={() => saveConfig(true)} disabled={savingCfg} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">
                  Save prompt
                </button>
              )}
            </div>
          </section>

          {loading && !data ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
              Loading feedback...
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-xs text-rose-700">{error}</div>
          ) : !s || s.total === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
              <Smile className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No feedback yet</p>
              <p className="text-xs text-slate-400 mt-1">Enable the widget above, or simulate sample feedback to preview this page.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average CSAT</p>
                  <p className="text-4xl font-extrabold text-slate-900 mt-1">
                    {s.average_rating.toFixed(1)} <span className="text-base text-slate-400 font-bold">/ 5.0</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{s.total} responses</p>
                </div>
                <div className="lg:col-span-2 bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Sentiment distribution</p>
                  <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${s.positive_pct}%` }} />
                    <div className="bg-amber-400" style={{ width: `${s.neutral_pct}%` }} />
                    <div className="bg-rose-500" style={{ width: `${s.negative_pct}%` }} />
                  </div>
                  <div className="flex gap-5 mt-3 text-xs font-semibold">
                    <span className="text-emerald-600">{s.positive_pct}% Positive</span>
                    <span className="text-amber-600">{s.neutral_pct}% Neutral</span>
                    <span className="text-rose-600">{s.negative_pct}% Negative</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {data!.items.map((f) => (
                  <div key={f.id} className="bg-white border border-slate-200/70 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-0.5" aria-label={`${f.rating} out of 5`}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} className={`w-4 h-4 ${i <= f.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${SENTIMENT_STYLE[f.sentiment]}`}>{f.sentiment}</span>
                        {f.trigger === 'rage_click' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-rose-50 text-rose-600 border-rose-200">
                            <MousePointerClick className="w-3 h-3" /> Rage click
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800 flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                        <span>{f.comment || <span className="text-slate-400 italic">No comment</span>}</span>
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {f.url} · {f.browser} · {new Date(f.created_at).toLocaleString()}
                      </p>
                    </div>
                    {f.session_id && f.has_replay && (
                      <Link
                        href={`/analytics/sessions?session=${encodeURIComponent(f.session_id)}`}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 px-3 py-2 rounded-xl flex-shrink-0 self-start"
                      >
                        <Play className="w-3 h-3" /> Watch Session Replay
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
