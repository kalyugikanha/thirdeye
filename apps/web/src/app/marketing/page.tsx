"use client";

import Sidebar from '@/components/Sidebar';


import { useState, useEffect } from 'react';
import { LayoutTemplate, BarChart, ShieldCheck, Activity, Bell, Search, TrendingUp, CheckCircle, Plus } from 'lucide-react';
import Link from 'next/link';

interface Platform {
  id: string;
  name: string;
  desc: string;
  color: string;
}

const PLATFORMS: Platform[] = [
  { id: 'meta', name: 'Meta Ads & Instagram', desc: 'Sync campaign impressions, ROAS, and WhatsApp conversion leads.', color: 'bg-blue-600' },
  { id: 'google_ads', name: 'Google Ads', desc: 'Track search keyword performance, CPC, and conversion value.', color: 'bg-emerald-600' },
  { id: 'linkedin', name: 'LinkedIn Ads', desc: 'Track B2B lead generation, sponsored content CTR, and company engagement.', color: 'bg-sky-700' },
  { id: 'whatsapp', name: 'WhatsApp Business API', desc: 'Monitor message deliverability, broadcast response rate, and chat conversions.', color: 'bg-green-500' }
];

export default function MarketingPage() {
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    const state: Record<string, boolean> = {};
    PLATFORMS.forEach(p => {
      state[p.id] = localStorage.getItem(`te_mkt_${p.id}`) === 'true';
    });
    setConnected(state);
  }, []);

  const handleConnect = (id: string) => {
    const key = window.prompt(`Enter API Access Token or Access Key for ${id.toUpperCase()}:`);
    if (key !== null) {
      localStorage.setItem(`te_mkt_${id}`, 'true');
      setConnected(prev => ({ ...prev, [id]: true }));
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Marketing & Ad Tracking Hub</h1>
              <p className="text-sm text-slate-500 mt-1">Connect your advertising accounts to monitor spend, ROAS, and lead performance.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLATFORMS.map((p) => {
              const isConn = connected[p.id];
              return (
                <div key={p.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-6 hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${p.color} text-white flex items-center justify-center font-bold text-base`}>
                        {p.name[0]}
                      </div>
                      {isConn ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(p.id)}
                          className="text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded-full transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Connect
                        </button>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 text-base">{p.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{p.desc}</p>
                  </div>

                  {isConn && (
                    <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Impressions</div>
                        <div className="text-sm font-bold text-slate-800">42.5K</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Clicks</div>
                        <div className="text-sm font-bold text-slate-800">1,280</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">ROAS</div>
                        <div className="text-sm font-bold text-emerald-600">3.8x</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </main>
    </div>
  );
}