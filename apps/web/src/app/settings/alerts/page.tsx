"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Send, 
  CheckCircle2, 
  Loader2, 
  Radio, 
  MessageSquare, 
  Webhook, 
  Mail, 
  SendHorizontal,
  ShieldAlert,
  Sliders,
  Check
} from 'lucide-react';

interface Channel {
  id: number;
  name: string;
  type: string;
  config: { url?: string; webhook_url?: string; bot_token?: string; chat_id?: string; email?: string };
  is_active: boolean;
}

export default function AlertChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState('slack');
  const [url, setUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const router = useRouter();

  const fetchChannels = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      const res = await fetch(apiUrl('/api/v1/alert-channels'), {
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
    if (!name) return;
    setCreating(true);
    const token = localStorage.getItem('te_token');

    let cfg: any = {};
    if (type === 'slack' || type === 'discord' || type === 'webhook') {
      cfg = { url };
    } else if (type === 'telegram') {
      cfg = { bot_token: botToken, chat_id: chatId };
    } else if (type === 'email') {
      cfg = { email: emailAddress };
    }

    try {
      const res = await fetch(apiUrl('/api/v1/alert-channels'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, type, config: cfg })
      });
      if (res.ok) {
        setName('');
        setUrl('');
        setBotToken('');
        setChatId('');
        setEmailAddress('');
        fetchChannels();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleTestChannel = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/alert-channels/${id}/test`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTestResult('Test alert payload dispatched successfully to channel!');
        setTimeout(() => setTestResult(null), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteChannel = async (id: number) => {
    if (!confirm('Are you sure you want to remove this alert destination?')) return;
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/alert-channels/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setChannels(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-16">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Incident Routing
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Checkly Multi-Channel Standards
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Multi-Channel Alert Configurations
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Connect Slack, Discord, Telegram, or Custom JSON Webhooks to receive instant failure alerts and automatic recovery notices.
              </p>
            </div>
          </div>

          {testResult && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{testResult}</span>
            </div>
          )}

          {/* Connect New Channel Card */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-xs">
            <h2 className="text-base font-extrabold text-slate-900 mb-1">Add Alert Destination</h2>
            <p className="text-xs text-slate-500 mb-5">
              Choose your preferred communication tool for real-time downtime warnings and recovery events.
            </p>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Channel / Alert Label
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DevOps Core Slack"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Channel Provider
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="slack">Slack Incoming Webhook</option>
                    <option value="discord">Discord Webhook (Rich Embeds)</option>
                    <option value="telegram">Telegram Bot</option>
                    <option value="webhook">Custom HTTP Webhook (JSON)</option>
                    <option value="email">Email Notification</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Inputs based on Channel Type */}
              {type !== 'telegram' && type !== 'email' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Webhook URL
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={
                      type === 'slack' 
                        ? 'https://hooks.slack.com/services/...' 
                        : type === 'discord'
                        ? 'https://discord.com/api/webhooks/...'
                        : 'https://api.yourdomain.com/webhooks/alerts'
                    }
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              )}

              {type === 'telegram' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Telegram Bot Token
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Chat ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="-100123456789 or @channelname"
                      value={chatId}
                      onChange={(e) => setChatId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {type === 'email' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Alert Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="oncall@company.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Save Channel</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Channels List */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Incident Channels ({channels.length})
            </h2>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                Loading channels...
              </div>
            ) : channels.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center text-slate-500">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No alert channels configured</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Add Slack, Discord, or Webhooks above to receive alerts.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {channels.map((ch) => (
                  <div key={ch.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                        {ch.type === 'slack' ? (
                          <MessageSquare className="w-5 h-5 text-emerald-600" />
                        ) : ch.type === 'discord' ? (
                          <MessageSquare className="w-5 h-5 text-indigo-600" />
                        ) : ch.type === 'telegram' ? (
                          <SendHorizontal className="w-5 h-5 text-sky-500" />
                        ) : ch.type === 'email' ? (
                          <Mail className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Webhook className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-slate-900 text-sm">{ch.name}</h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                            {ch.type}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-slate-400 mt-0.5 max-w-md truncate">
                          {ch.config?.url || ch.config?.email || `Telegram Chat: ${ch.config?.chat_id || 'Configured'}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleTestChannel(ch.id)}
                        disabled={testingId === ch.id}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {testingId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
                        <span>Send Test</span>
                      </button>

                      <button
                        onClick={() => handleDeleteChannel(ch.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove Channel"
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
