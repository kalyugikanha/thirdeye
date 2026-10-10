"use client";

import { useState } from 'react';
import { ShieldAlert, ShieldCheck, CheckCircle2, XCircle, Loader2, Sparkles, AlertCircle, Lock } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

interface SecurityCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail';
  details: string;
}

interface ScanResult {
  target_url: string;
  grade: string;
  security_score: number;
  response_time_ms: number;
  checks: SecurityCheck[];
  error?: string;
}

export default function SecurityPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setResult(null);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/security/scan'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">OWASP Security Header & SSL Scanner</h1>
              <p className="text-sm text-slate-500 mt-1">Audit external web endpoints for TLS/SSL health, XSS protection, and clickjacking defenses.</p>
            </div>
          </div>

          <form onSubmit={handleScan} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Target Endpoint URL</label>
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
              className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Lock className="w-4 h-4 text-emerald-400" />}
              {loading ? 'Scanning Security Headers...' : 'Run Security Scan'}
            </button>
          </form>

          {result && (
            <div className="flex flex-col gap-6">
              
              {/* Security Grade Banner */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-bold text-slate-900">Security Assessment Report</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{result.target_url}</p>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-xs text-slate-400 uppercase font-semibold">Security Score</div>
                    <div className="text-xl font-bold text-slate-800">{result.security_score} / 100</div>
                  </div>

                  <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-extrabold text-3xl border-2 shadow-sm ${
                    result.grade === 'A+' || result.grade === 'A' ? 'bg-emerald-50 text-emerald-600 border-emerald-300' :
                    result.grade === 'B' ? 'bg-blue-50 text-blue-600 border-blue-300' :
                    result.grade === 'C' ? 'bg-amber-50 text-amber-600 border-amber-300' :
                    'bg-red-50 text-red-600 border-red-300'
                  }`}>
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Grade</span>
                    {result.grade}
                  </div>
                </div>
              </div>

              {/* Security Checks Detail List */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">OWASP Header Audit Checklist</h3>

                <div className="grid gap-3">
                  {result.checks.map((chk) => (
                    <div key={chk.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {chk.status === 'pass' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">{chk.name}</h4>
                          <p className="text-xs text-slate-600 mt-0.5">{chk.details}</p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                        chk.status === 'pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {chk.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}