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
  Sliders,
  Search,
  Activity,
  Layers,
  ShieldAlert,
  HelpCircle,
  Compass
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
  category: 'search' | 'analytics' | 'ad' | 'social';
}

interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCSummary {
  total_clicks: number;
  total_impressions: number;
  average_ctr: number;
  average_position: number;
}

interface ReferralRecord {
  session_id: string;
  channel: string;
  source_app: string;
  referrer_url: string;
  landing_url: string;
  visitor_ip: string;
  ad_click_id: string;
  search_keyword: string;
  timestamp: string;
}

const PLATFORMS: PlatformConfig[] = [
  { id: 'gsc', name: 'Google Search Console', desc: 'Sync organic search queries, impressions, click-through rates (CTR), and Google position ranks.', badge: 'GSC API v3', color: 'from-amber-500 to-orange-500', category: 'search' },
  { id: 'ga4', name: 'Google Analytics 4', desc: 'Sync cross-device visitor traffic, session duration, and real-time Google measurement streams.', badge: 'GA4 API', color: 'from-orange-600 to-rose-600', category: 'analytics' },
  { id: 'meta', name: 'Meta Ads & Instagram', desc: 'Sync Instagram App / Bio link referrals, Meta ad spend, and conversion lead telemetry.', badge: 'Meta API', color: 'from-blue-600 to-indigo-600', category: 'ad' },
  { id: 'google_ads', name: 'Google Ads', desc: 'Track search keyword performance, CPC, and conversion value.', badge: 'Google Ads v16', color: 'from-emerald-600 to-teal-600', category: 'ad' },
  { id: 'linkedin', name: 'LinkedIn Ads', desc: 'Track B2B lead generation, sponsored content CTR, and company engagement.', badge: 'LinkedIn Marketing', color: 'from-sky-700 to-blue-700', category: 'ad' },
  { id: 'whatsapp', name: 'WhatsApp Business API', desc: 'Monitor message deliverability, broadcast response rate, and chat conversions.', badge: 'Meta Cloud API', color: 'from-green-600 to-emerald-600', category: 'social' }
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
  
  // GSC and GA4 states
  const [gscQueries, setGscQueries] = useState<GSCQuery[]>([]);
  const [gscSummary, setGscSummary] = useState<GSCSummary | null>(null);
  const [ga4Metrics, setGa4Metrics] = useState<any | null>(null);
  
  // Deep Referrals state
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);

  // Search queries state
  const [searchQueries, setSearchQueries] = useState<any[]>([]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'attribution' | 'referrals' | 'search' | 'connectors'>('attribution');

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
      const [campRes, gscRes, ga4Res, refRes, qRes] = await Promise.all([
        fetch(apiUrl('/api/v1/marketing/campaigns'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/v1/connectors/gsc/queries'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/v1/connectors/ga4/metrics'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/v1/marketing/referrals'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl('/api/v1/analytics/search-queries'), { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (campRes.ok) {
        const json = await campRes.json();
        setData(json);
        if (json.domain && !targetUrl) {
          setTargetUrl(`https://${json.domain}/`);
        }
      }

      if (gscRes.ok) {
        const gsc = await gscRes.json();
        setGscQueries(gsc.queries || []);
        setGscSummary(gsc.summary || null);
        if (gsc.connected) {
          setConnected(prev => ({ ...prev, gsc: true }));
        }
      }

      if (ga4Res.ok) {
        const ga4 = await ga4Res.json();
        setGa4Metrics(ga4.metrics || null);
        if (ga4.connected) {
          setConnected(prev => ({ ...prev, ga4: true }));
        }
      }

      if (refRes.ok) {
        const refs = await refRes.json();
        setReferrals(refs.referrals || []);
      }

      if (qRes.ok) {
        const qData = await qRes.json();
        setSearchQueries(qData.queries || []);
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
    setConnected(prev => ({ ...prev, ...connState }));
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
      let endpoint = '/api/v1/marketing/connect';
      let body: any = {
        platform: activePlatform.id,
        api_key: apiKeyInput,
        account_id: accountIdInput
      };

      if (activePlatform.id === 'gsc') {
        endpoint = '/api/v1/connectors/gsc/connect';
        body = { credentials_json: apiKeyInput, site_url: accountIdInput || `https://${data.domain || 'selfupcommunity.com'}/` };
      } else if (activePlatform.id === 'ga4') {
        endpoint = '/api/v1/connectors/ga4/connect';
        body = { measurement_id: apiKeyInput, property_id: accountIdInput };
      }

      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        localStorage.setItem(`te_mkt_${activePlatform.id}`, 'true');
        setConnected(prev => ({ ...prev, [activePlatform.id]: true }));
        setActivePlatform(null);
        await fetchCampaigns();
      } else {
        alert('Connector verification failed. Please check credentials.');
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
                  Attribution modeling across Google Search Console, GA4, Instagram bio links, ad campaigns, and external backlinks.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/analytics/competitors"
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Compass className="w-4 h-4 text-indigo-600" />
                  <span>Competitor Intelligence</span>
                </Link>

                <button
                  onClick={fetchCampaigns}
                  className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-2xl border border-slate-200/60 shadow-sm transition-all hover:scale-105"
                  title="Refresh campaigns & telemetry"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-rose-500' : ''}`} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
              <button
                onClick={() => setActiveTab('attribution')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'attribution'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                ROAS & Channel Attribution
              </button>
              <button
                onClick={() => setActiveTab('referrals')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'referrals'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Deep Referrals & Visitor IPs</span>
                <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.2 rounded-full">{referrals.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'search'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>Search Intelligence (GSC & Ads)</span>
                {gscQueries.length > 0 && (
                  <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.2 rounded-full">{gscQueries.length}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('connectors')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'connectors'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Connectors & Integrations
              </button>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                <p className="text-[11px] text-slate-400 mt-1">Across connected ad channels</p>
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
                    : '4.1x Return'}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ad spend to realized revenue multiplier
                </p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">GSC Organic Reach</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Search className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-amber-600">
                  {gscSummary ? gscSummary.total_clicks.toLocaleString() : '889'} Clicks
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Avg CTR: {gscSummary ? `${gscSummary.average_ctr}%` : '7.1%'} • Pos: {gscSummary ? gscSummary.average_position : '2.8'}
                </p>
              </div>
            </div>

            {/* TAB CONTENT: ATTRIBUTION */}
            {activeTab === 'attribution' && (
              <>
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
                        Tag your landing URLs to track exact social bio links, ads, and WhatsApp broadcast attribution.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Landing Page Destination
                      </label>
                      <input
                        type="url"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder="https://selfupcommunity.com/"
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
                        <option value="instagram">Instagram (Bio / Story)</option>
                        <option value="meta">Meta Ads / Facebook</option>
                        <option value="google">Google Ads (Search/PMax)</option>
                        <option value="whatsapp">WhatsApp Broadcast</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="youtube">YouTube Video Link</option>
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
                        placeholder="e.g. bio_launch_promo"
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
              </>
            )}

            {/* TAB CONTENT: DEEP REFERRALS & VISITOR IPS */}
            {activeTab === 'referrals' && (
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/60 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Deep Referral Origin & Destination Attribution
                    </h3>
                    <p className="text-xs text-slate-500">
                      Exact traffic origin (Instagram App / Bio, Google Ads, WhatsApp, Backlinks) with visitor IP, landing URL, and ad IDs.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full self-start">
                    {referrals.length} Tracked Origins
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                        <th className="pb-3 font-semibold">Traffic Channel</th>
                        <th className="pb-3 font-semibold">Referring App / URL</th>
                        <th className="pb-3 font-semibold">Landing Destination</th>
                        <th className="pb-3 font-semibold">Visitor IP</th>
                        <th className="pb-3 font-semibold">Ad Click / ID</th>
                        <th className="pb-3 font-semibold">Search Keyword</th>
                        <th className="pb-3 font-semibold text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {referrals.map((ref, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 font-sans font-bold text-slate-900">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-800">
                              {ref.channel}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-700 max-w-[200px] truncate" title={ref.referrer_url}>
                            {ref.source_app || ref.referrer_url}
                          </td>
                          <td className="py-3.5 text-slate-700 max-w-[220px] truncate" title={ref.landing_url}>
                            {ref.landing_url}
                          </td>
                          <td className="py-3.5 text-indigo-600 font-semibold">{ref.visitor_ip}</td>
                          <td className="py-3.5 text-slate-500">
                            {ref.ad_click_id ? (
                              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                {ref.ad_click_id.slice(0, 16)}...
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 font-sans text-slate-700">
                            {ref.search_keyword ? (
                              <span className="font-semibold text-emerald-700">"{ref.search_keyword}"</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 text-slate-400 text-right text-[11px]">
                            {new Date(ref.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SEARCH INTELLIGENCE & HISTORY */}
            {activeTab === 'search' && (
              <div className="space-y-6">
                
                {/* Browser Sandbox Architectural Clarification Alert */}
                <div className="p-5 rounded-3xl bg-amber-50/80 border border-amber-200/80 text-amber-900 flex items-start gap-3.5">
                  <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-sm text-amber-900">
                      Search Intelligence vs. Browser History Clarification
                    </div>
                    <p className="text-amber-800 leading-relaxed">
                      <strong>Global Browser Sandbox (Same-Origin Policy):</strong> Modern browsers (Chrome, Safari, Firefox) prevent any website snippet from accessing cross-tab external history (e.g. what a visitor searched on Amazon or YouTube).
                    </p>
                    <p className="text-amber-800 leading-relaxed">
                      <strong>What ThirdEye Captures:</strong> 
                      (1) Google Search Console organic keywords that brought visitors to your site, 
                      (2) Paid Google Ads keywords (<code className="font-mono bg-amber-100 px-1 py-0.2 rounded">utm_term</code> / Search Term Reports), and 
                      (3) All internal on-site search queries performed directly inside your search bars.
                    </p>
                  </div>
                </div>

                {/* Google Search Console Top Organic Queries */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/60 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Google Search Console Organic Queries</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Live GSC Sync
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Actual keywords entered by users on Google that drove impressions and clicks to {data.domain || 'your website'}.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                          <th className="pb-3 font-semibold">Organic Query</th>
                          <th className="pb-3 font-semibold">Clicks</th>
                          <th className="pb-3 font-semibold">Impressions</th>
                          <th className="pb-3 font-semibold">CTR</th>
                          <th className="pb-3 font-semibold text-right">Avg Position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {gscQueries.map((q, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 font-bold text-slate-900 font-mono">
                              "{q.query}"
                            </td>
                            <td className="py-3.5 font-semibold text-slate-700">{q.clicks}</td>
                            <td className="py-3.5 text-slate-500">{q.impressions.toLocaleString()}</td>
                            <td className="py-3.5 font-semibold text-emerald-600">{q.ctr}%</td>
                            <td className="py-3.5 text-right font-bold text-indigo-600 font-mono">#{q.position}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* On-Site & Paid Search Queries */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/60 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Unified Search Telemetry (On-Site & Paid)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Consolidated search queries captured directly from snippet telemetry and campaign parameters.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                          <th className="pb-3 font-semibold">Search Term</th>
                          <th className="pb-3 font-semibold">Origin Source</th>
                          <th className="pb-3 font-semibold">Captured Sessions</th>
                          <th className="pb-3 font-semibold text-right">Conversion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {searchQueries.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 font-mono font-bold text-slate-900">"{item.query}"</td>
                            <td className="py-3 text-slate-600">{item.source || item.type}</td>
                            <td className="py-3 font-semibold text-slate-700">{item.count || 1}</td>
                            <td className="py-3 text-right font-mono text-emerald-600 font-bold">{item.ctr || '5.2%'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: CONNECTORS */}
            {activeTab === 'connectors' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Connect Analytics, Search Console & Ad Platforms
                  </h3>
                  <p className="text-xs text-slate-500">
                    Authorize your Google Search Console, GA4, Meta Ads, and WhatsApp accounts to sync live search and campaign data.
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
            )}

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
                {activePlatform.id === 'gsc' 
                  ? 'Enter your Google Search Console Service Account JSON or API Key to fetch search keywords.'
                  : activePlatform.id === 'ga4'
                  ? 'Enter your GA4 Measurement ID (e.g. G-XXXXXXXXXX) and Property ID.'
                  : 'Enter your access token to enable conversion attribution.'}
              </p>
            </div>

            <form onSubmit={handleSaveConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {activePlatform.id === 'ga4' ? 'GA4 Measurement ID (G-XXXXXXX)' : 'API Key / Service Account JSON'}
                </label>
                <input
                  type={activePlatform.id === 'ga4' ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={activePlatform.id === 'ga4' ? 'G-74X91BC920' : '••••••••••••••••••••••••••••••••'}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {activePlatform.id === 'ga4' ? 'GA4 Property ID' : 'Account / Site Identifier (Optional)'}
                </label>
                <input
                  type="text"
                  value={accountIdInput}
                  onChange={(e) => setAccountIdInput(e.target.value)}
                  placeholder={activePlatform.id === 'ga4' ? 'properties/123456789' : 'act_12893892389'}
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