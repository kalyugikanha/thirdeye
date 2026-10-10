"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Save, Activity, Flame, ShieldCheck, CheckCircle2, TrendingUp, Sparkles, RefreshCw } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

const AVAILABLE_WIDGETS = [
  { id: 'uptime_summary', name: 'API Uptime Summary', icon: Activity, desc: '99.98% platform health indicator' },
  { id: 'traffic_trends', name: 'Traffic & Pageview Trends', icon: TrendingUp, desc: 'Real-time 7-day visitor timeseries chart' },
  { id: 'active_sessions', name: 'Live Sessions Count', icon: Activity, desc: 'Real-time connected session counter' },
  { id: 'heatmaps_preview', name: 'Heatmaps Density Widget', icon: Flame, desc: 'Quick overview of hot click regions' },
  { id: 'security_grade', name: 'OWASP Security Score', icon: ShieldCheck, desc: 'Live security header compliance grade' },
];

export default function CustomDashboardPage() {
  const [activeWidgets, setActiveWidgets] = useState<string[]>(['uptime_summary', 'traffic_trends', 'security_grade']);
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    fetch(apiUrl('/api/v1/user/dashboard-layout'), {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.widgets) setActiveWidgets(data.widgets);
      })
      .catch(console.error);
  }, [router]);

  const toggleWidget = (id: string) => {
    if (activeWidgets.includes(id)) {
      setActiveWidgets(activeWidgets.filter(w => w !== id));
    } else {
      setActiveWidgets([...activeWidgets, id]);
    }
  };

  const handleSaveLayout = async () => {
    setSaving(true);
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl('/api/v1/user/dashboard-layout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ widgets: activeWidgets })
      });
      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Custom Workspace Dashboard Builder</h1>
              <p className="text-sm text-slate-500 mt-1">Customize which analytics, uptime, and security widgets appear on your homepage.</p>
            </div>

            <button
              onClick={handleSaveLayout}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving Layout...' : 'Save Dashboard Layout'}
            </button>
          </div>

          {savedStatus && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Dashboard layout saved successfully!
            </div>
          )}

          {/* Widget Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toggle Active Widgets</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AVAILABLE_WIDGETS.map((w) => {
                const isSelected = activeWidgets.includes(w.id);
                const Icon = w.icon;
                return (
                  <div
                    key={w.id}
                    onClick={() => toggleWidget(w.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-white border-blue-600 shadow-sm ring-2 ring-blue-100'
                        : 'bg-white/60 border-slate-200 opacity-65 hover:opacity-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                          isSelected ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'border-slate-300'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm">{w.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{w.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Preview Container */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Workspace Preview</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeWidgets.map((wid) => {
                const widgetObj = AVAILABLE_WIDGETS.find(w => w.id === wid);
                if (!widgetObj) return null;
                const Icon = widgetObj.icon;
                return (
                  <div key={wid} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <Icon className="w-4 h-4 text-blue-600" /> {widgetObj.name}
                      </div>
                      <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                    <div className="h-24 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-xs text-slate-400 italic">
                      Live Widget Preview Card
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}