"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { 
  Share2, 
  TrendingUp, 
  CheckCircle2, 
  Plus, 
  Copy, 
  Check, 
  ArrowLeft, 
  ExternalLink, 
  Sparkles, 
  DollarSign, 
  MousePointerClick, 
  Users, 
  X, 
  Loader2,
  Globe2,
  RefreshCw,
  Sliders
} from 'lucide-react';

interface ChannelMetrics {
  name: string;
  sessions: number;
  clicks: number;
  conversions: number;
  spend_usd: number;
  roas: number;
  cpc_usd: number;
}

interface MarketingData {
  channels: ChannelMetrics[];
  domain: string;
  total_conversions: number;
  total_spend_usd: number;
}

interface PlatformConfig {
  id: string;
  name: string;
  desc: string;
  badge: string;
  color: string;
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'meta', name: 'Meta Ads & Instagram', desc: 'Sync campaign impressions, ROAS, and WhatsApp conversion leads.', badge: 'Meta API', color: 'from-blue-600 to-indigo-600' },
  { id: 'google_ads', name: 'Google Ads', desc: 'Track search keyword performance, CPC, and conversion value.', badge: 'Google Ads v16', color: 'from-emerald-600 to-teal-600' },
  { id: 'linkedin', name: 'LinkedIn Ads', desc: 'Track B2B lead generation, sponsored content CTR, and company engagement.', badge: 'LinkedIn Marketing', color: 'from-sky-700 to-blue-700' },
  { id: 'whatsapp', name: 'WhatsApp Business API', desc: 'Monitor message deliverability, broadcast response rate, and chat conversions.', badge: 'Meta Cloud API', color: 'from-green-600 to-emerald-600' }
];

export default function MarketingPage() {
  const router = useRouter();
  const [data, setData] = useState<MarketingData>({
    channels: [],
    domain: '',
    total_conversions: 0,
    total_spend_usd: 0
  });
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  
  // Connect modal state
  const [activePlatform, setActivePlatform] = useState<PlatformConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [savingConn, setSavingConn] = useState(false);

  // UTM Builder state
  const [targetUrl, setTargetUrl] = useState('');
  const [utmSource, setUtmSource] = useState('instagram');
  const [utmMedium, setUtmMedium] = useState('social');
  const [utmCampaign, setUtmCampaign] = useState('launch_promo');
  const [copiedUtm, setCopiedUtm] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');

    try {
      const res = await fetch(apiUrl('/api/v1/marketing/campaigns'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.domain && !targetUrl) {
          setTargetUrl(`https://${json.domain}/`);
        }
      }
    } catch (e) {
      console.error('Failed to load marketing telemetry:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const connState: Record<string, boolean> = {};
    PLATFORMS.forEach(p => {
      connState[p.id] = localStorage.getItem(`te_mkt_${p.id}`) === 'true';
    });
    setConnected(connState);
  }, []);

  const handleOpenConnect = (p: PlatformConfig) => {
    setActivePlatform(p);
    setApiKeyInput('');
    setAccountIdInput('');
  };

  const handleSaveConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlatform) return;
    setSavingConn(true);
    const token = localStorage.getItem('te_token');

    try {
      const res = await fetch(apiUrl('/api/v1/marketing/connect'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          platform: activePlatform.id,
          api_key: apiKeyInput,
          account_id: accountIdInput
        })
      });

      if (res.ok) {
        localStorage.setItem(`te_mkt_${activePlatform.id}`, 'true');
        setConnected(prev => ({ ...prev, [activePlatform.id]: true }));
        setActivePlatform(null);
        await fetchCampaigns();
      }
    } catch (err) {
      alert('Failed to connect marketing account.');
    } finally {
      setSavingConn(false);
    }
  };

  // Generate UTM link
  const generatedUtmUrl = targetUrl
    ? `${targetUrl.replace(/\/$/, '')}/?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`
    : '';

  const copyUtmLink = () => {
    if (!generatedUtmUrl) return;
    navigator.clipboard.writeText(generatedUtmUrl);
    setCopiedUtm(true);
    setTimeout(() => setCopiedUtm(false), 2500);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />

        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          <div className="w-full flex flex-col gap-8 pb-16">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1.5">
                  <Link href="/" className="hover:text-slate-700 flex items-center gap-1 transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Workspace Home
                  </Link>
                  <span>/</span>
                  <span className="text-slate-600">Growth Attribution</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                  <span>Marketing & Ad Attribution Hub</span>
                  <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
                    Multi-Channel
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
                  Attribution modeling across social ads, search keywords, WhatsApp campaigns, and organic website traffic.
                </p>
              </div>

              <button
                onClick={fetchCampaigns}
                className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:scale-105 self-start sm:self-center"
                title="Refresh campaigns"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-500' : ''}`} />
              </button>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Ad Spend</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ${data.total_spend_usd.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Across all connected ad accounts</p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tracked Conversions</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-emerald-600">
                  {data.total_conversions} Goals
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Attributed to paid & social campaigns</p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Blended ROAS</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-rose-600">
                  {data.total_spend_usd > 0 
                    ? `${(data.channels.filter(c => c.spend_usd > 0).reduce((a, b) => a + (b.roas || 0), 0) / Math.max(data.channels.filter(c => c.spend_usd > 0).length, 1)).toFixed(1)}x Return` 
                    : '0.0x Return'}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {data.total_spend_usd > 0 ? 'Ad spend to realized revenue multiplier' : 'Connect ad account or UTM links to calculate'}
                </p>
              </div>
            </div>

            {/* UTM Campaign Link Generator Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/60 shadow-sm space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-400 text-white flex items-center justify-center font-bold shadow-sm">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    UTM Campaign Link Builder
                  </h3>
                  <p className="text-xs text-slate-500">
                    Generate tagged tracking URLs for social bios, WhatsApp broadcasts, and PPC ads.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destination Page URL
                  </label>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://yourdomain.com/landing"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign Source (utm_source)
                  </label>
                  <select
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="meta">Meta Ads / Facebook</option>
                    <option value="google">Google Ads</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="newsletter">Email Newsletter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign Name (utm_campaign)
                  </label>
                  <input
                    type="text"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="e.g. spring_promo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-mono focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Generated URL Box */}
              {generatedUtmUrl && (
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full flex-1 bg-slate-950 text-slate-200 p-3 rounded-2xl font-mono text-xs truncate shadow-inner">
                    {generatedUtmUrl}
                  </div>
                  <button
                    onClick={copyUtmLink}
                    className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm flex-shrink-0"
                  >
                    {copiedUtm ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied Link!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Campaign Link</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Channel Attribution Breakdown Table */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Channel Conversion & ROAS Attribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time performance metrics broken down by marketing origin.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Live Attribution
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="pb-3 font-semibold">Traffic Channel</th>
                      <th className="pb-3 font-semibold">Sessions</th>
                      <th className="pb-3 font-semibold">Clicks</th>
                      <th className="pb-3 font-semibold">Conversions</th>
                      <th className="pb-3 font-semibold">Spend</th>
                      <th className="pb-3 font-semibold">Est. CPC</th>
                      <th className="pb-3 font-semibold text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.channels.map((ch, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          <span>{ch.name}</span>
                        </td>
                        <td className="py-3.5 text-slate-700 font-semibold">{ch.sessions}</td>
                        <td className="py-3.5 text-slate-700">{ch.clicks}</td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {ch.conversions} Leads
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-700 font-mono">
                          {ch.spend_usd > 0 ? `$${ch.spend_usd}` : 'Free'}
                        </td>
                        <td className="py-3.5 text-slate-700 font-mono">
                          {ch.cpc_usd > 0 ? `$${ch.cpc_usd}` : '-'}
                        </td>
                        <td className="py-3.5 font-bold text-emerald-600 text-right font-mono">
                          {ch.roas > 0 ? `${ch.roas}x` : 'Organic'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Connect Ad Platforms Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Connect Advertising & Messaging Accounts
                </h3>
                <p className="text-xs text-slate-500">
                  Authorize your ad accounts to sync campaign spend and automatic conversion tracking.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLATFORMS.map((p) => {
                  const isConn = connected[p.id];
                  return (
                    <div
                      key={p.id}
                      className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-5 hover:shadow-md transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${p.color} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
                            {p.name[0]}
                          </div>
                          {isConn ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                            </span>
                          ) : (
                            <button
                              onClick={() => handleOpenConnect(p)}
                              className="text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> Connect API
                            </button>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.desc}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span>Protocol: {p.badge}</span>
                        {isConn && <span className="text-emerald-600 font-semibold">Live Telemetry Active</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </main>

      {/* Connect API Modal */}
      {activePlatform && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setActivePlatform(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Connect {activePlatform.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter your access token to enable conversion attribution.
              </p>
            </div>

            <form onSubmit={handleSaveConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  API Access Token / Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ad Account ID (Optional)
                </label>
                <input
                  type="text"
                  value={accountIdInput}
                  onChange={(e) => setAccountIdInput(e.target.value)}
                  placeholder="act_12893892389"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActivePlatform(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConn}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {savingConn ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Authenticate Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}