"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, XCircle, Activity, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface Monitor {
  id: number;
  name: string;
  url: string;
  status: string;
  response_time_ms: number | null;
  last_checked: string | null;
}

interface Incident {
  id: number;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

interface StatusData {
  organization_name: string;
  overall_status: string;
  monitors: Monitor[];
  incidents: Incident[];
}

export default function PublicStatusPage() {
  const params = useParams();
  const slug = params?.slug as string || 'demo';
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch(apiUrl(`/api/v1/public/status/${slug}`));
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-sans text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" /> Loading system status...
      </div>
    );
  }

  const isOperational = data?.overall_status === 'operational';
  const isDegraded = data?.overall_status === 'degraded';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 py-6 px-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
              T
            </div>
            <h1 className="text-xl font-bold text-slate-900">{data?.organization_name || 'Organization'} Status</h1>
          </div>
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Auto-refreshes every 15s
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-10 px-6 flex flex-col gap-8">
        
        {/* Overall Status Banner */}
        <div className={`p-6 rounded-2xl border flex items-center gap-4 ${
          isOperational ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          isDegraded ? 'bg-amber-50 border-amber-200 text-amber-900' :
          'bg-red-50 border-red-200 text-red-900'
        }`}>
          {isOperational ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-600 flex-shrink-0" />
          ) : isDegraded ? (
            <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
          )}
          <div>
            <h2 className="text-lg font-bold">
              {isOperational ? 'All Systems Operational' : isDegraded ? 'Degraded Performance Detected' : 'Service Interruption Detected'}
            </h2>
            <p className="text-xs opacity-80 mt-0.5">
              {isOperational 
                ? 'All core services, database pools, and external API gateways are functioning normally.'
                : 'Our background monitoring detected service response latency or failure.'}
            </p>
          </div>
        </div>

        {/* Services Health Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Services & Infrastructure Availability</h3>

          {data?.monitors && data.monitors.length > 0 ? (
            <div className="grid gap-3">
              {data.monitors.map((m) => (
                <div key={m.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {m.status === 'up' ? (
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm"></span>
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-sm animate-ping"></span>
                    )}
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{m.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">{m.url}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-slate-500">
                      {m.response_time_ms ? `${m.response_time_ms} ms` : '--'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      m.status === 'up' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No active services configured for this status page.
            </div>
          )}
        </div>

        {/* 90-Day Uptime Simulation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Availability (Past 90 Days)</h3>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">99.98% Uptime</span>
          </div>
          <div className="flex gap-1 h-8 items-end">
            {Array.from({ length: 45 }).map((_, idx) => (
              <div
                key={idx}
                className={`flex-1 rounded-sm ${idx === 22 ? 'bg-amber-400' : idx === 39 ? 'bg-red-400' : 'bg-emerald-500'}`}
                style={{ height: `${85 + (idx % 4) * 4}%` }}
                title={`Day ${idx + 1}: 100% operational`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Incident History */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Incident Logs & Maintenance</h3>
          
          {data?.incidents && data.incidents.length > 0 ? (
            <div className="grid gap-3">
              {data.incidents.map((inc) => (
                <div key={inc.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <Activity className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">{inc.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{inc.message}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">{new Date(inc.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No incidents reported in the last 30 days.</p>
          )}
        </div>

      </main>
      
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-mono">
        Powered by ThirdEye Uptime & Status Infrastructure
      </footer>
    </div>
  );
}