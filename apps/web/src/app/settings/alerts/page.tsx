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
  XCircle,
  Loader2, 
  Radio, 
  MessageSquare, 
  Webhook, 
  Mail, 
  SendHorizontal,
  ShieldAlert,
  Sliders,
  Check,
  Smartphone,
  ExternalLink,
  HelpCircle,
  Clock,
  History,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Info
} from 'lucide-react';

interface Channel {
  id: number;
  name: string;
  type: string;
  config: {
    url?: string;
    webhook_url?: string;
    bot_token?: string;
    chat_id?: string;
    email?: string;
    phone_number?: string;
    callmebot_api_key?: string;
    secret_token?: string;
  };
  events?: string[];
  severity?: string[];
  is_active: boolean;
}

interface AlertLog {
  id: number;
  channel_id: number;
  channel_name: string;
  channel_type: string;
  title: string;
  alert_type: string;
  status: string;
  response_code: number;
  error_message: string;
  created_at: string;
}

const AVAILABLE_EVENTS = [
  { id: 'uptime_down', label: 'Monitor DOWN (HTTP 5xx / Connection Lost)' },
  { id: 'uptime_recovered', label: 'Service RECOVERED (Back Online)' },
  { id: 'ssl_expiry', label: 'SSL Certificate Expiry Warning (< 14 days)' },
  { id: 'error_spike', label: 'JavaScript & API Error Spikes' },
  { id: 'quota_limit', label: 'Monthly Quota & Event Limits (80% / 100%)' },
];

const SEVERITY_LEVELS = [
  { id: 'critical', label: 'Critical / P0' },
  { id: 'error', label: 'Error' },
  { id: 'warning', label: 'Warning' },
  { id: 'info', label: 'Informational' },
];

export default function AlertChannelsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'channels' | 'logs'>('channels');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  // New Channel Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'slack' | 'discord' | 'telegram' | 'email' | 'whatsapp' | 'webhook'>('slack');
  const [url, setUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callmebotKey, setCallmebotKey] = useState('');
  const [secretToken, setSecretToken] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['uptime_down', 'uptime_recovered', 'ssl_expiry', 'error_spike', 'quota_limit']);
  const [selectedSeverity, setSelectedSeverity] = useState<string[]>(['critical', 'error', 'warning', 'info']);
  const [showGuide, setShowGuide] = useState(false);

  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string } | null>(null);

  const fetchChannels = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      const res = await fetch(apiUrl('/api/v1/alert-channels'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return router.push('/login');
      const data = await res.json();
      if (Array.isArray(data)) setChannels(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return;
    setLogsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/alert-channels/logs'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchLogs();
  }, []);

  const handleToggleEvent = (id: string) => {
    setSelectedEvents(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleToggleSeverity = (id: string) => {
    setSelectedSeverity(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setCreating(true);
    const token = localStorage.getItem('te_token');

    let cfg: any = {};
    if (type === 'slack' || type === 'discord') {
      cfg = { url };
    } else if (type === 'telegram') {
      cfg = { bot_token: botToken, chat_id: chatId };
    } else if (type === 'email') {
      cfg = { email: emailAddress };
    } else if (type === 'whatsapp') {
      cfg = { phone_number: phoneNumber, callmebot_api_key: callmebotKey };
    } else if (type === 'webhook') {
      cfg = { url, secret_token: secretToken };
    }

    try {
      const res = await fetch(apiUrl('/api/v1/alert-channels'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name, 
          type, 
          config: cfg,
          events: selectedEvents,
          severity: selectedSeverity
        })
      });
      if (res.ok) {
        setName('');
        setUrl('');
        setBotToken('');
        setChatId('');
        setEmailAddress('');
        setPhoneNumber('');
        setCallmebotKey('');
        setSecretToken('');
        fetchChannels();
        fetchLogs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (channel: Channel) => {
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/alert-channels/${channel.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !channel.is_active })
      });
      if (res.ok) {
        setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, is_active: !c.is_active } : c));
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
      const res = await fetch(apiUrl(`/api/v1/alert-channels/${id}/test`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTestResult({
        id,
        success: data.success,
        message: data.message || (data.success ? 'Delivered successfully' : 'Failed to deliver')
      });
      fetchLogs();
      setTimeout(() => setTestResult(null), 8000);
    } catch (err) {
      setTestResult({
        id,
        success: false,
        message: 'Network request error'
      });
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
      fetchLogs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fc] text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Omnichannel Routing
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Slack • Discord • Telegram • Email • WhatsApp • Webhook
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Alert Destinations & Incident Dispatch
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Connect your team workspaces to receive automated alerts on website downtimes, SSL expiries, and error storms.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center bg-slate-200/70 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setActiveTab('channels')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'channels' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Channels ({channels.length})
              </button>
              <button
                onClick={() => { setActiveTab('logs'); fetchLogs(); }}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'logs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Delivery Logs</span>
              </button>
            </div>
          </div>

          {activeTab === 'channels' ? (
            <>
              {/* Form Card */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Connect New Alert Channel</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Choose your notification provider and enter its destination details.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{showGuide ? 'Hide Setup Guide' : 'Setup Instructions'}</span>
                  </button>
                </div>

                {/* Setup Guide Box */}
                {showGuide && (
                  <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                    <p className="font-bold text-slate-900">How to set up each provider in 2 minutes:</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600">
                      <li><strong>Slack:</strong> In your Slack workspace, go to Apps & Integrations &gt; Search <em>Incoming Webhooks</em> &gt; Add to Slack &gt; Select a channel (e.g. #alerts) &gt; Copy Webhook URL.</li>
                      <li><strong>Discord:</strong> In your Discord Server Settings &gt; Integrations &gt; Webhooks &gt; New Webhook &gt; Copy Webhook URL.</li>
                      <li><strong>Telegram:</strong> 1) Open Telegram and message <code>@BotFather</code> to create a bot and copy token. 2) Message your new bot once. 3) Message <code>@userinfobot</code> to get your Chat ID.</li>
                      <li><strong>WhatsApp:</strong> Enter your mobile number with country code. For free instant WhatsApp, get a key from <em>callmebot.com</em>.</li>
                      <li><strong>Custom Webhook:</strong> Any HTTP endpoint. ThirdEye sends JSON with <code>X-ThirdEye-Signature</code> HMAC header.</li>
                    </ul>
                  </div>
                )}

                <form onSubmit={handleCreateChannel} className="space-y-6">
                  {/* Provider Grid */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Notification Provider
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      {[
                        { id: 'slack', label: 'Slack', icon: MessageSquare, color: 'text-emerald-600' },
                        { id: 'discord', label: 'Discord', icon: MessageSquare, color: 'text-indigo-600' },
                        { id: 'telegram', label: 'Telegram', icon: SendHorizontal, color: 'text-sky-500' },
                        { id: 'email', label: 'Email', icon: Mail, color: 'text-amber-600' },
                        { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone, color: 'text-emerald-500' },
                        { id: 'webhook', label: 'Webhook', icon: Webhook, color: 'text-blue-600' }
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setType(p.id as any)}
                          className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                            type === p.id 
                              ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-2 ring-blue-600/20 font-bold' 
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <p.icon className={`w-5 h-5 ${p.color}`} />
                          <span className="text-xs">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Channel Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Channel Label / Description
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={type === 'slack' ? 'e.g. #devops-critical-alerts' : 'e.g. Primary On-Call Team'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {/* Dynamic Provider Input Fields */}
                  {(type === 'slack' || type === 'discord') && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        {type === 'slack' ? 'Slack Incoming Webhook URL' : 'Discord Webhook URL'}
                      </label>
                      <input
                        type="url"
                        required
                        placeholder={type === 'slack' ? 'https://hooks.slack.com/services/T000/B000/XXXXX' : 'https://discord.com/api/webhooks/...'}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  )}

                  {type === 'telegram' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Telegram Bot Token
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                          value={botToken}
                          onChange={(e) => setBotToken(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Telegram Chat / Channel ID
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 987654321 or @yourchannel"
                          value={chatId}
                          onChange={(e) => setChatId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {type === 'email' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Recipient Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. oncall@colladome.com"
                        value={emailAddress}
                        onChange={(e) => setEmailAddress(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  )}

                  {type === 'whatsapp' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          WhatsApp Phone Number (with Country Code)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. +919876543210"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          CallMeBot API Key (Free)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 123456"
                          value={callmebotKey}
                          onChange={(e) => setCallmebotKey(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {type === 'webhook' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Target Webhook URL
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://api.yourdomain.com/v1/incidents"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          HMAC Secret Token (Optional for signature verification)
                        </label>
                        <input
                          type="text"
                          placeholder="secret_key_for_hmac_sha256"
                          value={secretToken}
                          onChange={(e) => setSecretToken(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Subscribed Events Selector */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Subscribed Incidents & Events
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AVAILABLE_EVENTS.map(ev => (
                        <label 
                          key={ev.id}
                          className="flex items-center gap-2.5 text-xs text-slate-700 p-2 rounded-xl border border-slate-200 bg-slate-50/30 hover:bg-slate-50 cursor-pointer"
                        >
                          <input 
                            type="checkbox"
                            checked={selectedEvents.includes(ev.id)}
                            onChange={() => handleToggleEvent(ev.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="font-medium">{ev.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Severity Filter */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Severity Levels
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SEVERITY_LEVELS.map(sev => (
                        <label 
                          key={sev.id}
                          className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border cursor-pointer ${
                            selectedSeverity.includes(sev.id)
                              ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <input 
                            type="checkbox"
                            checked={selectedSeverity.includes(sev.id)}
                            onChange={() => handleToggleSeverity(sev.id)}
                            className="hidden"
                          />
                          <span>{sev.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Save & Activate Channel</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Channels List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Active Channels ({channels.length})
                  </h2>
                  <span className="text-[11px] text-slate-400">
                    Continuous heartbeat ping active
                  </span>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-3xl border border-slate-200">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                    Loading alert channels...
                  </div>
                ) : channels.length === 0 ? (
                  <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center text-slate-500">
                    <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No alert destinations configured yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Connect Slack, Discord, or Telegram above to receive automated notifications.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {channels.map((ch) => (
                      <div 
                        key={ch.id} 
                        className={`bg-white border rounded-2xl p-4 shadow-xs transition-all ${
                          ch.is_active ? 'border-slate-200/90' : 'border-slate-200 opacity-60 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                              {ch.type === 'slack' ? (
                                <MessageSquare className="w-5 h-5 text-emerald-600" />
                              ) : ch.type === 'discord' ? (
                                <MessageSquare className="w-5 h-5 text-indigo-600" />
                              ) : ch.type === 'telegram' ? (
                                <SendHorizontal className="w-5 h-5 text-sky-500" />
                              ) : ch.type === 'email' ? (
                                <Mail className="w-5 h-5 text-amber-600" />
                              ) : ch.type === 'whatsapp' ? (
                                <Smartphone className="w-5 h-5 text-emerald-500" />
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
                                {!ch.is_active && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                                    Paused
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-slate-400 mt-0.5 max-w-md truncate">
                                {ch.config?.url || ch.config?.email || ch.config?.phone_number || `Telegram Chat: ${ch.config?.chat_id || 'Configured'}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center">
                            {/* Toggle Active */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(ch)}
                              className="text-slate-500 hover:text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                              title={ch.is_active ? 'Click to Pause' : 'Click to Enable'}
                            >
                              {ch.is_active ? (
                                <ToggleRight className="w-6 h-6 text-emerald-600" />
                              ) : (
                                <ToggleLeft className="w-6 h-6 text-slate-400" />
                              )}
                            </button>

                            {/* Test Button */}
                            <button
                              type="button"
                              onClick={() => handleTestChannel(ch.id)}
                              disabled={testingId === ch.id}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {testingId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
                              <span>Send Test</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteChannel(ch.id)}
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Remove Destination"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Test Result Banner */}
                        {testResult && testResult.id === ch.id && (
                          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                            testResult.success 
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                            <span>{testResult.message}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Logs Tab */
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Incident Delivery Logs</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Audit trail of all recent notifications dispatched across your channels.</p>
                </div>
                <button
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Refresh Logs</span>
                </button>
              </div>

              {logsLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                  Fetching delivery audit trail...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                  <Info className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  No alerts have been dispatched yet. Send a test alert to verify delivery.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold text-[10px]">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Channel</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Incident Title</th>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3 px-3 font-bold text-slate-800">
                            {log.channel_name || 'System Broadcast'}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-500 uppercase">
                            {log.channel_type}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700 max-w-xs truncate" title={log.title}>
                            {log.title}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              log.alert_type === 'critical' || log.alert_type === 'error'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : log.alert_type === 'warning'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : log.alert_type === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {log.alert_type}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 w-max ${
                              log.status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : log.status === 'throttled'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {log.status === 'delivered' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              <span>{log.status} {log.response_code ? `(${log.response_code})` : ''}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
