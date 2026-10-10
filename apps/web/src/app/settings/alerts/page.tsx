"use client";

import Sidebar from '@/components/Sidebar';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, BarChart, ShieldCheck, Activity, Bell, Search, TrendingUp, Plus, Trash2, Send, CheckCircle2, Sliders, Users, Flame } from 'lucide-react';
import Link from 'next/link';

interface Channel {
  id: number;
  name: string;
  type: string;
  config: { url?: string; email?: string };
  is_active: boolean;
}

export default function AlertChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState('slack');
  const [url, setUrl] = useState('');
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const router = useRouter();

  const fetchChannels = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      const res = await fetch('http://localhost:8000/api/v1/alert-channels', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setChannels(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch('http://localhost:8000/api/v1/alert-channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, type, config: { url } })
      });
      if (res.ok) {
        setName('');
        setUrl('');
        fetchChannels();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestChannel = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(`http://localhost:8000/api/v1/alert-channels/${id}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTestResult('Test alert dispatched successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteChannel = async (id: number) => {
    const token = localStorage.getItem('te_token');
    try {
      await fetch(`http://localhost:8000/api/v1/alert-channels/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setChannels(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Multi-Channel Alert Configurations</h1>
              <p className="text-sm text-slate-500 mt-1">Connect Slack, Discord, or Custom Webhooks to receive instant downtime alerts.</p>
            </div>
          </div>

          {testResult && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {testResult}
            </div>
          )}

          {/* Add Channel Form */}
          <form onSubmit={handleCreateChannel} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Channel Name</label>
              <input
                type="text"
                placeholder="DevOps Slack Webhook"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="w-full md:w-48">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Provider Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="slack">Slack</option>
                <option value="discord">Discord</option>
                <option value="webhook">Custom Webhook</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Webhook URL / Destination</label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Channel
            </button>
          </form>

          {/* List Channels */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider font-mono">Configured Channels ({channels.length})</h2>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading channels...</div>
            ) : channels.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
                No external alert channels connected yet. Add a Slack or Discord webhook above!
              </div>
            ) : (
              <div className="grid gap-4">
                {channels.map((c) => (
                  <div key={c.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {c.type}
                        </span>
                        <h3 className="font-semibold text-slate-900 text-base">{c.name}</h3>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-1">{c.config?.url || 'No URL configured'}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleTestChannel(c.id)}
                        disabled={testingId === c.id}
                        className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" /> {testingId === c.id ? 'Sending...' : 'Test'}
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(c.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}