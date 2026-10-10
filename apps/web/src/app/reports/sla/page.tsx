"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Printer, CheckCircle2, ShieldCheck, Clock, Calendar, Download, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

interface SLAReport {
  organization_id: number;
  target_sla_pct: number;
  actual_sla_pct: number;
  sla_met: boolean;
  total_monitors: number;
  downtime_minutes: number;
  mttr_minutes: number;
  mtbf_hours: number;
  service_credits_due: string;
}

export default function SLAReportsPage() {
  const [report, setReport] = useState<SLAReport | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSLA = async () => {
      const token = localStorage.getItem('te_token');
      if (!token) return router.push('/login');
      try {
        const res = await fetch(apiUrl('/api/v1/reports/sla'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setReport(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSLA();
  }, [router]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between print:hidden">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">SLA Compliance & MTTR/MTBF Reports</h1>
              <p className="text-sm text-slate-500 mt-1">Generate enterprise SLA availability certification reports and MTTR metrics.</p>
            </div>

            <button
              onClick={handlePrint}
              className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print / Export PDF Report
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> Generating SLA compliance calculations...
            </div>
          ) : report ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col gap-8 print:border-none print:shadow-none print:p-0">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-sm">
                    T
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">ThirdEye Observability Suite</h2>
                    <p className="text-xs text-slate-400 font-mono">Service Level Agreement (SLA) Performance Certificate</p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-slate-500">
                  <div>Date: {new Date().toLocaleDateString()}</div>
                  <div>Period: Current Calendar Month</div>
                </div>
              </div>

              {/* Status Banner */}
              <div className={`p-6 rounded-2xl border flex items-center justify-between ${
                report.sla_met ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
              }`}>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold text-base">
                      {report.sla_met ? 'SLA Target Fully Met (99.90% Commitment)' : 'SLA Target Breach Detected'}
                    </h3>
                    <p className="text-xs opacity-80 mt-0.5">
                      Target Availability: {report.target_sla_pct}% | Actual Availability Achieved: {report.actual_sla_pct}%
                    </p>
                  </div>
                </div>
                <div className="text-right font-bold text-2xl">
                  {report.actual_sla_pct}%
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <div className="text-slate-400 text-xs font-semibold uppercase mb-1">Target SLA</div>
                  <div className="text-2xl font-bold text-slate-900">{report.target_sla_pct}%</div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <div className="text-slate-400 text-xs font-semibold uppercase mb-1">Downtime Minutes</div>
                  <div className="text-2xl font-bold text-slate-900">{report.downtime_minutes} mins</div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <div className="text-slate-400 text-xs font-semibold uppercase mb-1">MTTR (Repair Time)</div>
                  <div className="text-2xl font-bold text-slate-900">{report.mttr_minutes} mins</div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <div className="text-slate-400 text-xs font-semibold uppercase mb-1">MTBF (Failure Interval)</div>
                  <div className="text-2xl font-bold text-slate-900">{report.mtbf_hours} hrs</div>
                </div>
              </div>

              {/* Service Credit Summary */}
              <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Service Credit Owed</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Calculated based on SLA breach policies and downtime hours.</p>
                </div>
                <div className="text-xl font-mono font-bold text-emerald-400">
                  {report.service_credits_due}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 text-center font-mono border-t border-slate-100 pt-4">
                Certified by ThirdEye Automated SLA Audit Engine • Organization #{report.organization_id}
              </div>

            </div>
          ) : null}

        </div>
      </main>
    </div>
  );
}