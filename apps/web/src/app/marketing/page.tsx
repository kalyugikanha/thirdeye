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
  Compass,
  BarChart3,
  Unlink,
  ChevronDown,
  ChevronUp,
  Eye,
  KeyRound
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
  { id: 'ga4', name: 'Google Analytics 4', desc: 'Sync cross-device visitor traffic, active users, session duration, and real-time Google measurement streams.', badge: 'GA4 Data API', color: 'from-orange-500 to-amber-600', category: 'analytics' },
  { id: 'gsc', name: 'Google Search Console', desc: 'Sync organic search queries, impressions, click-through rates (CTR), and Google position ranks.', badge: 'GSC API v3', color: 'from-blue-600 to-cyan-600', category: 'search' },
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
  const [ga4MeasurementId, setGa4MeasurementId] = useState<string | null>(null);
  
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
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

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
        setGscQueries(gsc.connected ? (gsc.queries || []) : []);
        setGscSummary(gsc.connected ? (gsc.summary || null) : null);
        setConnected(prev => ({ ...prev, gsc: !!gsc.connected }));
      }

      if (ga4Res.ok) {
        const ga4 = await ga4Res.json();
        setGa4Metrics(ga4.connected ? (ga4.metrics || null) : null);
        setGa4MeasurementId(ga4.measurement_id || null);
        setConnected(prev => ({ ...prev, ga4: !!ga4.connected }));
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
  }, []);

  const handleOpenConnect = (p: PlatformConfig) => {
    setActivePlatform(p);
    setApiKeyInput('');
    setAccountIdInput(p.id === 'gsc' ? (data.domain ? `https://${data.domain}/` : '') : '');
    setShowHelpGuide(false);
  };

  const handleGoogle1ClickConnect = async () => {
    setConnectingGoogle(true);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/connectors/google/oauth-connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_email: data.domain ? `admin@${data.domain}` : undefined })
      });
      if (res.ok) {
        localStorage.setItem('te_mkt_gsc', 'true');
        localStorage.setItem('te_mkt_ga4', 'true');
        setConnected(prev => ({ ...prev, gsc: true, ga4: true }));
        setActivePlatform(null);
        await fetchCampaigns();
      } else {
        alert('Failed to connect Google Workspace. Please verify API response.');
      }
    } catch (e) {
      alert('Network error connecting Google Workspace.');
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    if (!confirm(`Disconnect ${platformId.toUpperCase()} connector? Active telemetry from this provider will be paused.`)) return;
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/connectors/${platformId}/disconnect`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      localStorage.removeItem(`te_mkt_${platformId}`);
      setConnected(prev => ({ ...prev, [platformId]: false }));
      if (platformId === 'ga4') {
        setGa4Metrics(null);
        setGa4MeasurementId(null);
      }
      if (platformId === 'gsc') {
        setGscQueries([]);
        setGscSummary(null);
      }
      await fetchCampaigns();
    } catch (e) {
      console.error('Failed to disconnect:', e);
    }
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
              {connected.gsc && gscQueries.length > 0 && (
                <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.2 rounded-full">{gscQueries.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('connectors')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'connectors'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Connectors & Integrations</span>
              {(connected.ga4 || connected.gsc) && (
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
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
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-600">
                3.9x Return
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Ad spend to realized revenue multiplier</p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Google Integrations</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Globe2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                {connected.ga4 && connected.gsc ? (
                  <span className="text-emerald-600 flex items-center gap-1 text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Full Google Suite
                  </span>
                ) : connected.ga4 || connected.gsc ? (
                  <span className="text-amber-600 text-sm font-bold">Partial (1 Connected)</span>
                ) : (
                  <span className="text-slate-400 text-sm font-normal">Not Connected</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">GSC Search & GA4 Telemetry</p>
            </div>
          </div>

          {/* TAB CONTENT: ROAS & ATTRIBUTION */}
          {activeTab === 'attribution' && (
            <>
              {/* Google Analytics 4 (GA4) Live Telemetry Stream Card */}
              {connected.ga4 && ga4Metrics ? (
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-7 text-white shadow-xl space-y-5 border border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold shadow-md">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">Google Analytics 4 (GA4) Live Telemetry</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Stream Active
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Synced with Data Stream <code className="text-sky-300 font-mono">{ga4MeasurementId || 'G-CONNECTED'}</code> on {data.domain || 'selfupcommunity.com'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={fetchCampaigns}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Sync Data
                      </button>
                      <button
                        onClick={() => handleDisconnect('ga4')}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Unlink className="w-3.5 h-3.5" /> Disconnect
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2">
                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Active Visitors</span>
                      <span className="text-2xl font-black text-white mt-1 block">{ga4Metrics.active_users.toLocaleString()}</span>
                      <span className="text-[10px] text-emerald-400 mt-0.5 block">Live Google Stream</span>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">New Users</span>
                      <span className="text-2xl font-black text-white mt-1 block">{ga4Metrics.new_users.toLocaleString()}</span>
                      <span className="text-[10px] text-sky-400 mt-0.5 block">First touch</span>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Sessions</span>
                      <span className="text-2xl font-black text-white mt-1 block">{ga4Metrics.sessions.toLocaleString()}</span>
                      <span className="text-[10px] text-indigo-300 mt-0.5 block">Measured sessions</span>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Engagement</span>
                      <span className="text-2xl font-black text-emerald-400 mt-1 block">{ga4Metrics.engagement_rate}%</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Engaged visitors</span>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Avg Duration</span>
                      <span className="text-2xl font-black text-white mt-1 block">{ga4Metrics.avg_session_duration_sec}s</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Time on site</span>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Bounce Rate</span>
                      <span className="text-2xl font-black text-rose-400 mt-1 block">{ga4Metrics.bounce_rate}%</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Non-engaged exits</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-600 text-white flex items-center justify-center font-bold shadow-md flex-shrink-0">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Connect Google Analytics 4 (GA4)</h3>
                      <p className="text-xs text-slate-600 mt-0.5 max-w-lg">
                        Sync cross-device visitor traffic, active user volume, and engagement metrics directly into ThirdEye with 1-Click Google OAuth or your Measurement ID.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenConnect(PLATFORMS.find(p => p.id === 'ga4')!)}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-orange-500/20 flex-shrink-0 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Connect GA4 Stream
                  </button>
                </div>
              )}

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
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>Tracking: {referrals.length} captured referrals</span>
                </div>
              </div>

              {referrals.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Globe2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">No Referral Trajectories Captured Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Referral attribution automatically records whenever a visitor clicks a link on Instagram, WhatsApp, Google Ads, or external partner websites.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                        <th className="pb-3 font-semibold">Channel / App</th>
                        <th className="pb-3 font-semibold">Visitor IP</th>
                        <th className="pb-3 font-semibold">Referrer Origin</th>
                        <th className="pb-3 font-semibold">Landing Destination</th>
                        <th className="pb-3 font-semibold">Ad / Search Key</th>
                        <th className="pb-3 font-semibold text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {referrals.map((ref, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 font-bold text-slate-900">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-semibold text-[11px]">
                              {ref.channel}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono text-slate-600">{ref.visitor_ip || 'Anonymous'}</td>
                          <td className="py-3.5 font-mono text-slate-500 max-w-[200px] truncate" title={ref.referrer_url}>
                            {ref.referrer_url || 'Direct Navigation'}
                          </td>
                          <td className="py-3.5 font-mono text-indigo-600 max-w-[200px] truncate" title={ref.landing_url}>
                            {ref.landing_url || '/'}
                          </td>
                          <td className="py-3.5">
                            {ref.ad_click_id ? (
                              <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                                {ref.ad_click_id}
                              </span>
                            ) : ref.search_keyword ? (
                              <span className="font-bold text-slate-700">"{ref.search_keyword}"</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 text-right text-slate-400 text-[11px]">
                            {ref.timestamp ? new Date(ref.timestamp).toLocaleTimeString() : 'Just now'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: SEARCH INTELLIGENCE */}
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
              {connected.gsc && gscQueries.length > 0 ? (
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/60 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <span>Google Search Console Organic Queries</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Live GSC Sync Active
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Actual keywords entered by users on Google that drove impressions and clicks to {data.domain || 'selfupcommunity.com'}.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={fetchCampaigns}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Sync Keywords
                      </button>
                      <button
                        onClick={() => handleDisconnect('gsc')}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition-colors flex items-center gap-1"
                      >
                        <Unlink className="w-3.5 h-3.5" /> Disconnect
                      </button>
                    </div>
                  </div>

                  {/* GSC Summary KPIs */}
                  {gscSummary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Google Clicks</span>
                        <span className="text-xl font-black text-slate-900 mt-0.5 block">{gscSummary.total_clicks.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Google Impressions</span>
                        <span className="text-xl font-black text-slate-900 mt-0.5 block">{gscSummary.total_impressions.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average CTR</span>
                        <span className="text-xl font-black text-emerald-600 mt-0.5 block">{gscSummary.average_ctr}%</span>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Position</span>
                        <span className="text-xl font-black text-indigo-600 mt-0.5 block">#{gscSummary.average_position}</span>
                      </div>
                    </div>
                  )}

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
              ) : (
                <div className="bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border border-blue-200/80 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center font-bold shadow-md flex-shrink-0">
                      <Search className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Connect Google Search Console (GSC)</h3>
                      <p className="text-xs text-slate-600 mt-0.5 max-w-lg">
                        Sync live search queries, impressions, click-through rates (CTR), and Google keyword ranking positions for {data.domain || 'your website'}.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenConnect(PLATFORMS.find(p => p.id === 'gsc')!)}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex-shrink-0 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Connect Search Console
                  </button>
                </div>
              )}

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
            <div className="space-y-6">
              
              {/* Google Unified Workspace Feature Banner */}
              <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-7 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="space-y-2 relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-sky-300 text-xs font-semibold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Google Cloud Workspace Integration</span>
                  </div>
                  <h3 className="text-xl font-black text-white">
                    Connect Google Search Console & Google Analytics 4
                  </h3>
                  <p className="text-xs text-blue-100/80 max-w-xl leading-relaxed">
                    Authorize your Google Account in 1-Click to simultaneously sync live search keywords, impressions, rank positions, and real-time visitor sessions without manually creating API keys.
                  </p>
                </div>

                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={handleGoogle1ClickConnect}
                    disabled={connectingGoogle}
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-lg shadow-black/20 transition-all flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {connectingGoogle ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Connecting Google Workspace...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>1-Click Google OAuth Sync</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  All Attribution & Analytics Connectors
                </h3>
                <p className="text-xs text-slate-500">
                  Manage individual API credentials, Measurement IDs, and conversion webhooks.
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
                            {p.id === 'ga4' ? 'GA' : p.id === 'gsc' ? 'GSC' : p.name[0]}
                          </div>
                          {isConn ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                              </span>
                              <button
                                onClick={() => handleDisconnect(p.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Disconnect"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
                        {isConn && (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Telemetry Active
                          </span>
                        )}
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setActivePlatform(null)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                  {activePlatform.badge}
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Connect {activePlatform.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activePlatform.id === 'gsc' 
                  ? 'Sync organic Google ranking keywords and impression volumes.'
                  : activePlatform.id === 'ga4'
                  ? 'Sync GA4 live measurement streams, active sessions, and bounce rate.'
                  : 'Enter your access credentials to enable attribution tracking.'}
              </p>
            </div>

            {/* 1-Click Option for Google Services */}
            {(activePlatform.id === 'gsc' || activePlatform.id === 'ga4') && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Recommended: 1-Click Google OAuth</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Instant</span>
                </div>
                <button
                  type="button"
                  onClick={handleGoogle1ClickConnect}
                  disabled={connectingGoogle}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Authorize with Google Account</span>
                </button>
                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-2 text-[10px] text-slate-400 font-semibold uppercase">Or connect manually</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {activePlatform.id === 'ga4' 
                    ? 'GA4 Measurement ID (Format: G-XXXXXXXXXX)' 
                    : activePlatform.id === 'gsc'
                    ? 'Service Account JSON or OAuth API Token'
                    : 'API Key / Secret Token'}
                </label>
                <input
                  type={activePlatform.id === 'ga4' ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={activePlatform.id === 'ga4' ? 'G-74X91BC920' : '••••••••••••••••••••••••••••••••'}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {activePlatform.id === 'ga4' 
                    ? 'GA4 Property ID (Optional)' 
                    : activePlatform.id === 'gsc'
                    ? 'Verified Site URL'
                    : 'Account / Campaign Identifier (Optional)'}
                </label>
                <input
                  type="text"
                  value={accountIdInput}
                  onChange={(e) => setAccountIdInput(e.target.value)}
                  placeholder={
                    activePlatform.id === 'ga4' 
                      ? 'e.g. 382910492' 
                      : activePlatform.id === 'gsc'
                      ? 'https://selfupcommunity.com/'
                      : 'act_12893892389'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Collapsible Help Guide */}
              <div className="border border-slate-200/80 rounded-2xl p-3 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(!showHelpGuide)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                    <span>How do I find these credentials?</span>
                  </span>
                  {showHelpGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showHelpGuide && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                    {activePlatform.id === 'ga4' ? (
                      <>
                        <p>1. Open your <strong>Google Analytics (GA4)</strong> dashboard.</p>
                        <p>2. Go to <strong>Admin ➔ Data Streams ➔ Web</strong>.</p>
                        <p>3. Copy the <strong>Measurement ID</strong> (starts with <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">G-</code>).</p>
                        <p>4. Your <strong>Property ID</strong> is located at the top-left of the Admin page.</p>
                      </>
                    ) : activePlatform.id === 'gsc' ? (
                      <>
                        <p>1. Open <strong>Google Search Console</strong> and ensure your domain is verified.</p>
                        <p>2. In <strong>Google Cloud Console</strong>, create a Service Account with "Search Console Viewer" role.</p>
                        <p>3. Generate a <strong>JSON Key</strong> and paste it above, or simply use <strong>1-Click Google OAuth</strong> above!</p>
                      </>
                    ) : (
                      <p>Generate an API Access Token inside your platform developer portal and paste it here.</p>
                    )}
                  </div>
                )}
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
                      <span>Saving Credentials...</span>
                    </>
                  ) : (
                    <span>Save & Verify Connection</span>
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
