"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

import { useState } from 'react';
import { LayoutTemplate, BarChart, ShieldCheck, Activity, Bell, Search, TrendingUp, CheckCircle, XCircle, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface Issue {
  id: string;
  label: string;
  pass: boolean;
}

interface AuditReport {
  score: number;
  title?: string;
  meta_description?: string;
  h1_count?: number;
  has_canonical?: boolean;
  page_size_kb?: number;
  response_time_ms?: number;
  issues: Issue[];
  error?: string;
}

export default function SeoPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setReport(null);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/seo/audit'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error(err);
      setReport({ score: 0, error: 'Network error analyzing URL', issues: [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">SEO & Technical Website Audit</h1>
              <p className="text-sm text-slate-500 mt-1">Run automated on-page technical audits for meta tags, page speed, and structure.</p>
            </div>
          </div>

          <form onSubmit={handleAudit} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Target Website URL</label>
              <input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Auditing...' : 'Run Audit'}
            </button>
          </form>

          {report && (
            <div className="flex flex-col gap-6">
              {/* Score Card */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Technical Health Score</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Based on on-page SEO best practices and page response speed.</p>
                </div>
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold border-4 ${
                  report.score >= 80 ? 'border-emerald-500 text-emerald-600 bg-emerald-50' :
                  report.score >= 50 ? 'border-amber-500 text-amber-600 bg-amber-50' :
                  'border-red-500 text-red-600 bg-red-50'
                }`}>
                  {report.score}
                </div>
              </div>

              {/* Checklist */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Audit Results Checklist</h3>
                
                {report.error ? (
                  <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl">{report.error}</div>
                ) : (
                  <div className="grid gap-3">
                    {report.issues.map((issue) => (
                      <div key={issue.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          {issue.pass ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-slate-800">{issue.label}</span>
                        </div>
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                          issue.pass ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {issue.pass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}