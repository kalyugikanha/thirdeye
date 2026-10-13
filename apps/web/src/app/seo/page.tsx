"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Search, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Sparkles, 
  Globe2, 
  Lock, 
  RefreshCw,
  FileCode2,
  Gauge
} from 'lucide-react';

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

interface SecurityCheck {
  id: string;
  name: string;
  status: string;
  details: string;
}

interface SecurityReport {
  target_url: string;
  grade: string;
  security_score: number;
  response_time_ms?: number;
  checks: SecurityCheck[];
  error?: string;
}

export default function SeoAndSecurityPage() {
  const router = useRouter();
  const [url, setUrl] = useState('https://growinsight.co.in/');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [secReport, setSecReport] = useState<SecurityReport | null>(null);

  const runFullAudit = useCallback(async (targetUrl: string) => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }
    setLoading(true);
    try {
      const [seoRes, secRes] = await Promise.all([
        fetch(apiUrl('/api/v1/seo/audit'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ url: targetUrl })
        }),
        fetch(apiUrl('/api/v1/security/scan'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ url: targetUrl })
        })
      ]);

      if (seoRes.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }

      if (seoRes.ok) {
        const seoData = await seoRes.json();
        setReport(seoData);
      }
      if (secRes.ok) {
        const secData = await secRes.json();
        setSecReport(secData);
      }
    } catch (err) {
      console.error(err);
      setReport({ score: 0, error: 'Network error analyzing URL', issues: [] });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('te_token');
      if (!token) {
        router.push('/login');
        return;
      }
      let initialUrl = 'https://growinsight.co.in/';
      try {
        const projRes = await fetch(apiUrl('/api/projects'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (projRes.ok) {
          const projs = await projRes.json();
          if (Array.isArray(projs) && projs.length > 0 && projs[0].domain) {
            const clean = projs[0].domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
            initialUrl = `https://${clean}/`;
            setUrl(initialUrl);
          }
        }
      } catch (e) {}
      runFullAudit(initialUrl);
    };
    init();
  }, [router, runFullAudit]);

  const handleAuditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    runFullAudit(url);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-8 lg:px-12 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 pb-16">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Technical & Security Scanner
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                SEO & Security Live Audit
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Automated real-time inspection of on-page SEO tags, response speed, SSL/TLS, and HTTP security headers.
              </p>
            </div>
          </div>

          <form onSubmit={handleAuditSubmit} className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Target Website URL
              </label>
              <div className="relative">
                <Globe2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="url"
                  placeholder="https://growinsight.co.in/"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {loading ? 'Scanning Live Site...' : 'Re-Scan Website'}
            </button>
          </form>

          {loading && !report && (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center gap-3 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm font-bold text-slate-800">Scanning {url} in real time...</p>
              <p className="text-xs text-slate-400">Checking HTML meta tags, H1 structure, canonical links, SSL, and security headers.</p>
            </div>
          )}

          {(report || secReport) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column: SEO Technical Report */}
              {report && (
                <div className="flex flex-col gap-5">
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5" /> On-Page SEO Score
                      </span>
                      <h2 className="text-lg font-extrabold text-slate-900 mt-1">Technical SEO Health</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Response: {report.response_time_ms || 0}ms • Size: {report.page_size_kb || 0} KB
                      </p>
                    </div>
                    <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2 ${
                      report.score >= 80 ? 'border-emerald-500 text-emerald-700 bg-emerald-50' :
                      report.score >= 50 ? 'border-amber-500 text-amber-700 bg-amber-50' :
                      'border-red-500 text-red-700 bg-red-50'
                    }`}>
                      <span className="text-2xl font-black">{report.score}</span>
                      <span className="text-[10px] font-bold uppercase">/ 100</span>
                    </div>
                  </div>

                  {report.title && (
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Detected Page Title</div>
                      <div className="text-sm font-bold text-slate-900">{report.title}</div>
                      {report.meta_description && (
                        <>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-3 mb-1">Meta Description</div>
                          <div className="text-xs text-slate-600">{report.meta_description}</div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">SEO Checklist</h3>
                    {report.error ? (
                      <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl">{report.error}</div>
                    ) : (
                      <div className="grid gap-2.5">
                        {report.issues.map((issue) => (
                          <div key={issue.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60">
                            <span className="text-xs font-semibold text-slate-800">{issue.label}</span>
                            {issue.pass ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle className="w-3.5 h-3.5" /> Passed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                                <XCircle className="w-3.5 h-3.5" /> Needs Fix
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right Column: Security Headers Report */}
              {secReport && (
                <div className="flex flex-col gap-5">
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" /> Security & SSL Posture
                      </span>
                      <h2 className="text-lg font-extrabold text-slate-900 mt-1">HTTP Security Grade</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Score: {secReport.security_score}/100 • SSL/TLS & Header Inspection
                      </p>
                    </div>
                    <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2 ${
                      secReport.security_score >= 70 ? 'border-emerald-500 text-emerald-700 bg-emerald-50' :
                      secReport.security_score >= 40 ? 'border-amber-500 text-amber-700 bg-amber-50' :
                      'border-red-500 text-red-700 bg-red-50'
                    }`}>
                      <span className="text-2xl font-black">{secReport.grade}</span>
                      <span className="text-[10px] font-bold uppercase">Grade</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Security Header Checks</h3>
                    <div className="grid gap-2.5">
                      {(secReport.checks || []).map((chk) => (
                        <div key={chk.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">{chk.name}</span>
                            {chk.status === 'pass' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <Lock className="w-3 h-3" /> Protected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                <XCircle className="w-3 h-3" /> Missing
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">{chk.details}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}