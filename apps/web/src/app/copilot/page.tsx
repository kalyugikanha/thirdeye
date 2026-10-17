"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bot, 
  Sparkles, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Terminal, 
  Code2, 
  TrendingUp, 
  Users, 
  Zap, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface CopilotResponse {
  title: string;
  summary: string;
  persona: string;
  ai_analysis: string;
  recommended_actions: string[];
  metrics_cited: string[];
  context_snapshot: Record<string, any>;
}

export default function CopilotPage() {
  const router = useRouter();
  const [persona, setPersona] = useState<'engineering' | 'product' | 'growth' | 'executive'>('engineering');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'copilot'; text: string; data?: CopilotResponse }>>([]);
  const [context, setContext] = useState<Record<string, any> | null>(null);

  const token = () => localStorage.getItem('te_token');

  const loadContext = useCallback(async () => {
    const t = token();
    if (!t) {
      router.push('/login');
      return;
    }
    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const pidQuery = activePid ? `?project_id=${encodeURIComponent(activePid)}` : '';
      const res = await fetch(apiUrl(`/api/v1/copilot/context${pidQuery}`), {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        setContext(await res.json());
      }
    } catch (e) {}
  }, [router]);

  useEffect(() => {
    loadContext();
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const qParam = sp.get('q');
      if (qParam && qParam.trim()) {
        handleAsk(qParam.trim());
      }
    }
  }, [loadContext]);

  const handleAsk = async (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim()) return;

    const userMsg = { sender: 'user' as const, text: q };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setQuery('');
    setLoading(true);

    try {
      const activePid = localStorage.getItem('te_active_project_id');
      const res = await fetch(apiUrl('/api/v1/copilot/ask'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({
          query: q,
          persona,
          project_id: activePid ? Number(activePid) : undefined,
        }),
      });

      if (res.ok) {
        const data: CopilotResponse = await res.json();
        setMessages(prev => [...prev, { sender: 'copilot', text: data.ai_analysis || data.summary, data }]);
      } else {
        setMessages(prev => [...prev, { sender: 'copilot', text: 'Sorry, I encountered an issue analyzing your workspace data.' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { sender: 'copilot', text: 'Failed to communicate with ThirdEye AI Copilot.' }]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = {
    engineering: [
      "What are the top JavaScript errors and API failures right now?",
      "How is our Core Web Vitals LCP performance trending?",
      "Did our latest deployment cause any error regressions?"
    ],
    product: [
      "Which steps in the user journey have the highest drop-off rate?",
      "What are users saying in recent CSAT feedback and rage clicks?",
      "Which form fields cause the most checkout abandonment?"
    ],
    growth: [
      "How are our conversion goals and attributed revenue performing?",
      "What is the status of our active A/B experiments?",
      "Show me our weekly visitor retention cohort trends."
    ],
    executive: [
      "Give me a high-level briefing on workspace reliability and traffic.",
      "Are all uptime monitors and SLA thresholds currently passing?",
      "What are the top 3 action items my team should focus on today?"
    ]
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />
      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full flex flex-col gap-8 pb-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                Universal Observability Intelligence
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-2 flex items-center gap-2">
                <Bot className="w-8 h-8 text-rose-500" /> ThirdEye AI Copilot
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Context-aware AI assistant querying real-time telemetry from your connected applications and databases.
              </p>
            </div>

            {/* Persona Switcher Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200/80 rounded-2xl shadow-sm self-start">
              {[
                { key: 'engineering', label: 'Engineering', icon: Code2 },
                { key: 'product', label: 'Product & UX', icon: Users },
                { key: 'growth', label: 'Growth & CRO', icon: TrendingUp },
                { key: 'executive', label: 'Executive', icon: Zap },
              ].map(tab => {
                const Icon = tab.icon;
                const active = persona === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setPersona(tab.key as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Live Context Telemetry Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white border border-slate-200/70 rounded-3xl p-5 shadow-sm space-y-4">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Live Workspace Context
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Domain</span>
                    <span className="font-mono font-bold text-slate-900 truncate max-w-[120px]">{context?.domain || 'Connected'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Sessions (7d)</span>
                    <span className="font-bold text-slate-900">{context?.total_sessions_7d ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Code Errors</span>
                    <span className={`font-bold ${(context?.code_errors_7d ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {context?.code_errors_7d ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Network 5xx/4xx</span>
                    <span className="font-bold text-slate-900">{context?.network_api_failures_7d ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Avg LCP</span>
                    <span className="font-bold text-slate-900">{context?.avg_lcp_ms ?? 0} ms</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Avg CSAT</span>
                    <span className="font-bold text-emerald-600">{context?.avg_csat_score ?? 5.0} / 5.0</span>
                  </div>
                </div>
              </div>

              {/* Persona Starter Suggestions */}
              <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-3">
                <p className="text-xs font-bold flex items-center gap-1.5 text-rose-400">
                  <Sparkles className="w-3.5 h-3.5" /> Suggested Inquiries
                </p>
                <div className="space-y-2">
                  {samplePrompts[persona].map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAsk(p)}
                      className="w-full text-left text-xs p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 transition-colors flex items-center justify-between group"
                    >
                      <span className="line-clamp-2">{p}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-rose-400 flex-shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat & Diagnostic Work Area */}
            <div className="lg:col-span-3 flex flex-col bg-white border border-slate-200/70 rounded-3xl shadow-sm min-h-[580px] overflow-hidden">
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                    <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4 border border-rose-100">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      ThirdEye AI Copilot is Ready
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
                      Ask any question about user navigation drop-offs, JavaScript errors, Core Web Vitals, API latency, or conversion attribution.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-slate-900 text-white font-medium'
                          : 'bg-[#f8f9fc] border border-slate-200 text-slate-800 space-y-3'
                      }`}>
                        {m.sender === 'copilot' && m.data && (
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                              <Bot className="w-4 h-4 text-rose-500" /> {m.data.title}
                            </span>
                            <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                              {m.data.persona}
                            </span>
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        {m.data?.recommended_actions && m.data.recommended_actions.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-slate-200">
                            <span className="font-bold text-[11px] text-slate-700">Recommended Next Steps:</span>
                            {m.data.recommended_actions.map((act, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-slate-600">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                <span>{act}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                      ThirdEye AI is querying live workspace context...
                    </div>
                  </div>
                )}
              </div>

              {/* Prompt Input Box */}
              <div className="p-4 bg-slate-50/60 border-t border-slate-200/80">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAsk();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Ask ThirdEye Copilot (${persona} persona)...`}
                    className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                  <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Ask</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
