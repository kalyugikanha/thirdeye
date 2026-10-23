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
  MessageSquare, 
  Webhook, 
  Mail, 
  SendHorizontal,
  ShieldAlert,
  Sliders,
  Smartphone,
  HelpCircle,
  Clock,
  History,
  ToggleLeft,
  ToggleRight,
  Info,
  Grid,
  Copy,
  Check
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
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_pass?: string;
    phone_number?: string;
    callmebot_api_key?: string;
    routing_key?: string;
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
  { id: 'uptime_down', label: 'Monitor DOWN (HTTP 5xx / Connection Lost)', badge: 'Critical' },
  { id: 'uptime_recovered', label: 'Service RECOVERED (Back Online)', badge: 'Recovery' },
  { id: 'uptime_degraded', label: 'High Latency / Degraded (> 1500ms)', badge: 'Warning' },
  { id: 'ssl_expiry', label: 'SSL Certificate Expiry Warning (< 14 days)', badge: 'Warning' },
  { id: 'error_spike', label: 'JavaScript & API Error Spikes', badge: 'Error' },
  { id: 'quota_limit', label: 'Monthly Event Quota (80% & 100% thresholds)', badge: 'Usage' },
  { id: 'security_finding', label: 'CyberGuard Security Findings', badge: 'Security' },
];

const SEVERITY_LEVELS = [
  { id: 'critical', label: 'Critical / P0' },
  { id: 'error', label: 'Error' },
  { id: 'warning', label: 'Warning' },
  { id: 'info', label: 'Informational' },
];

export default function AlertChannelsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'channels' | 'matrix' | 'logs'>('channels');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  // New Channel Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'slack' | 'discord' | 'telegram' | 'email' | 'whatsapp' | 'teams' | 'pagerduty' | 'webhook'>('email');
  const [url, setUrl] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');

  // Hostinger / SMTP Email state
  const [emailAddress, setEmailAddress] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.hostinger.com');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  // WhatsApp CallMeBot state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callmebotKey, setCallmebotKey] = useState('');
  const [copiedWaText, setCopiedWaText] = useState(false);

  // PagerDuty / Webhook state
  const [routingKey, setRoutingKey] = useState('');
  const [secretToken, setSecretToken] = useState('');

  const [selectedEvents, setSelectedEvents] = useState<string[]>(AVAILABLE_EVENTS.map(e => e.id));
  const [selectedSeverity, setSelectedSeverity] = useState<string[]>(['critical', 'error', 'warning', 'info']);
  const [showGuide, setShowGuide] = useState(true);

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

  const handleMatrixToggle = async (channel: Channel, eventId: string) => {
    const currentEvents = channel.events || AVAILABLE_EVENTS.map(e => e.id);
    const updatedEvents = currentEvents.includes(eventId)
      ? currentEvents.filter(e => e !== eventId)
      : [...currentEvents, eventId];

    // Optimistic update
    setChannels(prev => prev.map(c => c.id === channel.id ? { ...c, events: updatedEvents } : c));

    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/alert-channels/${channel.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ events: updatedEvents })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setCreating(true);
    const token = localStorage.getItem('te_token');

    let cfg: any = {};
    if (type === 'slack' || type === 'discord' || type === 'teams') {
      cfg = { url };
    } else if (type === 'telegram') {
      cfg = { bot_token: botToken, chat_id: chatId };
    } else if (type === 'email') {
      cfg = {
        email: emailAddress,
        smtp_host: smtpHost || 'smtp.hostinger.com',
        smtp_port: Number(smtpPort) || 465,
        smtp_user: smtpUser,
        smtp_pass: smtpPass
      };
    } else if (type === 'whatsapp') {
      cfg = { phone_number: phoneNumber, callmebot_api_key: callmebotKey };
    } else if (type === 'pagerduty') {
      cfg = { routing_key: routingKey };
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
        setSmtpUser('');
        setSmtpPass('');
        setPhoneNumber('');
        setCallmebotKey('');
        setRoutingKey('');
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
                  Omnichannel Routing v1.5
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  Hostinger Mail • WhatsApp • Slack • Telegram • Teams • PagerDuty
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                Alert Destinations & Incident Dispatch
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Connect your Hostinger Webmail, CallMeBot WhatsApp, Slack, or Telegram to receive verified real-time incident alerts.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex items-center bg-slate-200/70 p-1 rounded-2xl border border-slate-200 shrink-0">
              <button
                onClick={() => setActiveTab('channels')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'channels' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Channels ({channels.length})
              </button>
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'matrix' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Routing Matrix</span>
              </button>
              <button
                onClick={() => { setActiveTab('logs'); fetchLogs(); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'logs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Delivery Logs</span>
              </button>
            </div>
          </div>

          {activeTab === 'channels' && (
            <>
              {/* Form Card */}
              <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Connect New Alert Channel</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Select your provider below. Every channel has a live verification test button.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>{showGuide ? 'Hide Setup Guide' : 'Show Setup Guide'}</span>
                  </button>
                </div>

                <form onSubmit={handleCreateChannel} className="space-y-6">
                  {/* Provider Grid */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      1. Choose Notification Provider
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                      {[
                        { id: 'email', label: 'Hostinger Mail', icon: Mail, color: 'text-amber-600' },
                        { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone, color: 'text-emerald-600' },
                        { id: 'slack', label: 'Slack', icon: MessageSquare, color: 'text-emerald-600' },
                        { id: 'telegram', label: 'Telegram', icon: SendHorizontal, color: 'text-sky-500' },
                        { id: 'discord', label: 'Discord', icon: MessageSquare, color: 'text-indigo-600' },
                        { id: 'teams', label: 'MS Teams', icon: MessageSquare, color: 'text-blue-700' },
                        { id: 'pagerduty', label: 'PagerDuty', icon: ShieldAlert, color: 'text-rose-600' },
                        { id: 'webhook', label: 'Webhook', icon: Webhook, color: 'text-slate-700' }
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setType(p.id as any)}
                          className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            type === p.id 
                              ? 'border-blue-600 bg-blue-50/60 text-blue-900 ring-2 ring-blue-600/20 font-bold' 
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                        >
                          <p.icon className={`w-5 h-5 ${p.color}`} />
                          <span className="text-[11px] leading-tight">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Contextual Setup Guide per Selected Provider */}
                  {showGuide && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                      {type === 'email' && (
                        <div>
                          <p className="font-bold text-slate-900 mb-1">Hostinger Webmail Setup (Pre-configured):</p>
                          <p className="text-slate-600">
                            Hostinger SMTP Server (<code>smtp.hostinger.com</code>, Port <code>465</code> SSL) is already pre-filled below. Simply enter your <strong>Hostinger Email Address</strong> (e.g. <code>akash@colladome.com</code>), your <strong>Hostinger Webmail Password</strong>, and who should receive the alerts.
                          </p>
                        </div>
                      )}
                      {type === 'whatsapp' && (
                        <div className="space-y-1.5">
                          <p className="font-bold text-slate-900">CallMeBot Free WhatsApp Setup (Takes 30 Seconds):</p>
                          <ol className="list-decimal pl-5 space-y-1 text-slate-600">
                            <li>Add <strong>+34 644 51 95 23</strong> to your phone contacts (name it <em>ThirdEye Bot</em>).</li>
                            <li className="flex items-center gap-2 flex-wrap">
                              <span>Send this exact WhatsApp message to that contact:</span>
                              <code className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-slate-900">I allow callmebot to send me messages</code>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText('I allow callmebot to send me messages');
                                  setCopiedWaText(true);
                                  setTimeout(() => setCopiedWaText(false), 2000);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                              >
                                {copiedWaText ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedWaText ? 'Copied' : 'Copy Text'}</span>
                              </button>
                            </li>
                            <li>The bot will reply on WhatsApp within 10 seconds with your 6-digit <strong>API Key</strong>. Paste your phone number and that API Key below!</li>
                          </ol>
                        </div>
                      )}
                      {type === 'slack' && (
                        <div>
                          <p className="font-bold text-slate-900 mb-1">Slack Incoming Webhook Setup:</p>
                          <p className="text-slate-600">
                            Open <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">api.slack.com/apps</a> &rarr; <strong>Create New App</strong> (From scratch) &rarr; <strong>Incoming Webhooks</strong> &rarr; Toggle <strong>ON</strong> &rarr; Click <strong>Add New Webhook to Workspace</strong> &rarr; Pick your channel (e.g. <code>#alerts</code>) &rarr; Paste the Webhook URL below.
                          </p>
                        </div>
                      )}
                      {type === 'telegram' && (
                        <div>
                          <p className="font-bold text-slate-900 mb-1">Telegram Bot Setup:</p>
                          <p className="text-slate-600">
                            1) Message <code>@BotFather</code> on Telegram with <code>/newbot</code> and copy the <strong>Bot Token</strong>. 2) Send one <code>Hello</code> message to your new bot. 3) Message <code>@userinfobot</code> to get your numeric <strong>Chat ID</strong>.
                          </p>
                        </div>
                      )}
                      {(type === 'discord' || type === 'teams' || type === 'pagerduty' || type === 'webhook') && (
                        <div>
                          <p className="font-bold text-slate-900 mb-1">{type.toUpperCase()} Integration:</p>
                          <p className="text-slate-600">
                            {type === 'discord' && 'Server Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.'}
                            {type === 'teams' && 'In Microsoft Teams channel → Connectors / Workflows → Incoming Webhook → Copy URL.'}
                            {type === 'pagerduty' && 'In PagerDuty Service → Integrations → Add Events API v2 → Copy the 32-char Integration Routing Key.'}
                            {type === 'webhook' && 'Provide any HTTPS endpoint. ThirdEye signs payloads with HMAC-SHA256 in the X-ThirdEye-Signature header.'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Channel Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      2. Channel Label / Description
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        type === 'email' ? 'e.g. Hostinger Oncall Email (akash@colladome.com)' :
                        type === 'whatsapp' ? 'e.g. Founder WhatsApp Alert' :
                        type === 'slack' ? 'e.g. #devops-critical-alerts' : 'e.g. Production Incident Channel'
                      }
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  {/* Dynamic Provider Input Fields */}
                  {(type === 'slack' || type === 'discord' || type === 'teams') && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        {type === 'slack' ? 'Slack Incoming Webhook URL' : type === 'discord' ? 'Discord Webhook URL' : 'Microsoft Teams Webhook URL'}
                      </label>
                      <input
                        type="url"
                        required
                        placeholder={
                          type === 'slack' ? 'https://hooks.slack.com/services/T000/B000/XXXXX' :
                          type === 'discord' ? 'https://discord.com/api/webhooks/...' :
                          'https://outlook.office.com/webhook/...'
                        }
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
                          placeholder="e.g. 987654321"
                          value={chatId}
                          onChange={(e) => setChatId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {type === 'email' && (
                    <div className="space-y-4 bg-amber-50/40 p-4 rounded-2xl border border-amber-200/70">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Hostinger Sender Email (SMTP Username)
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="e.g. akash@colladome.com"
                            value={smtpUser}
                            onChange={(e) => {
                              setSmtpUser(e.target.value);
                              if (!emailAddress) setEmailAddress(e.target.value);
                            }}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Hostinger Webmail Password
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="Your Hostinger email password"
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            Recipient Email(s)
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="akash@colladome.com, team@..."
                            value={emailAddress}
                            onChange={(e) => setEmailAddress(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            SMTP Host
                          </label>
                          <input
                            type="text"
                            required
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                            SMTP Port (465 SSL / 587 TLS)
                          </label>
                          <input
                            type="number"
                            required
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {type === 'whatsapp' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200/70">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          WhatsApp Phone Number (with Country Code)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. +919876543210"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          CallMeBot 6-Digit API Key
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 123456 (received on WhatsApp)"
                          value={callmebotKey}
                          onChange={(e) => setCallmebotKey(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {type === 'pagerduty' && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        PagerDuty Events API v2 Routing Key
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="32-character integration routing key"
                        value={routingKey}
                        onChange={(e) => setRoutingKey(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 bg-slate-50/50 focus:outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  )}

                  {type === 'webhook' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          HMAC Secret Token (Optional)
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
                      3. Subscribed Incidents & Events
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AVAILABLE_EVENTS.map(ev => (
                        <label 
                          key={ev.id}
                          className="flex items-center justify-between gap-2.5 text-xs text-slate-700 p-2.5 rounded-xl border border-slate-200 bg-slate-50/30 hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <input 
                              type="checkbox"
                              checked={selectedEvents.includes(ev.id)}
                              onChange={() => handleToggleEvent(ev.id)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-medium">{ev.label}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                            {ev.badge}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Severity Filter */}
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      4. Severity Levels
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
                    Secrets are masked (••••) for security
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
                    <p className="text-[11px] text-slate-400 mt-0.5">Connect Hostinger Mail, WhatsApp, Slack, or Telegram above to receive automated notifications.</p>
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
                              ) : ch.type === 'pagerduty' ? (
                                <ShieldAlert className="w-5 h-5 text-rose-600" />
                              ) : (
                                <Webhook className="w-5 h-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
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
                                {ch.config?.url || ch.config?.email || ch.config?.phone_number || (ch.config?.chat_id ? `Telegram Chat: ${ch.config.chat_id}` : `Key: ${ch.config?.routing_key || 'Configured'}`)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center">
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

                            <button
                              type="button"
                              onClick={() => handleTestChannel(ch.id)}
                              disabled={testingId === ch.id}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              {testingId === ch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3 h-3" />}
                              <span>Send Test</span>
                            </button>

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

                        {testResult && testResult.id === ch.id && (
                          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                            testResult.success 
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                            <span>{testResult.message}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'matrix' && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Event-to-Channel Routing Matrix</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control exactly which incident categories trigger notifications on each connected destination. Changes save automatically.
                </p>
              </div>

              {channels.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                  Add at least one channel in the Channels tab to configure the routing matrix.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-3 px-4">Incident Event Category</th>
                        {channels.map(ch => (
                          <th key={ch.id} className="py-3 px-4 text-center">
                            <div className="font-extrabold text-slate-900">{ch.name}</div>
                            <div className="text-[10px] uppercase font-mono text-slate-400">{ch.type}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {AVAILABLE_EVENTS.map(ev => (
                        <tr key={ev.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            <div>{ev.label}</div>
                            <span className="text-[10px] font-mono text-slate-400">{ev.id}</span>
                          </td>
                          {channels.map(ch => {
                            const activeList = ch.events || AVAILABLE_EVENTS.map(e => e.id);
                            const isChecked = activeList.includes(ev.id);
                            return (
                              <td key={ch.id} className="py-3.5 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleMatrixToggle(ch, ev.id)}
                                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Incident Delivery Logs</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Real-time audit trail of all notifications dispatched across your channels, including error reasons.</p>
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
                  No alerts have been dispatched yet. Click &quot;Send Test&quot; on any channel to verify delivery.
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
                        <th className="py-2.5 px-3">Status & Diagnostics</th>
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
                            <div className="flex flex-col gap-1">
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
                              {log.error_message && (
                                <span className="text-[11px] text-rose-600 font-mono max-w-sm truncate" title={log.error_message}>
                                  {log.error_message}
                                </span>
                              )}
                            </div>
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
