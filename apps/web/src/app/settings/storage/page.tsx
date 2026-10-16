"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HardDrive, 
  Cloud, 
  Server, 
  FolderLock, 
  CheckCircle2, 
  Save, 
  Loader2, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  ArrowRight,
  Database,
  Lock
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

export default function StorageSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedFolder, setCopiedFolder] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ status: string; latency_ms: number; message: string; permissions?: string[] } | null>(null);

  // Form states
  const [provider, setProvider] = useState<'thirdeye_cloud' | 's3' | 'r2' | 'custom_webhook'>('thirdeye_cloud');
  const [bucketName, setBucketName] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [dedicatedFolder, setDedicatedFolder] = useState('tenants/org_2/proj_1');

  useEffect(() => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch(apiUrl('/api/v1/storage/config'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.provider) setProvider(data.provider);
        if (data.bucket_name) setBucketName(data.bucket_name);
        if (data.endpoint_url) setEndpointUrl(data.endpoint_url);
        if (data.access_key) setAccessKey(data.access_key);
        if (data.region) setRegion(data.region);
        if (data.webhook_url) setWebhookUrl(data.webhook_url);
        if (data.dedicated_folder) setDedicatedFolder(data.dedicated_folder);
      })
      .catch((err) => console.error('Failed to load storage config:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/storage/test-connection'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          provider,
          bucket_name: bucketName,
          endpoint_url: endpointUrl,
          access_key: accessKey,
          secret_key: secretKey,
          region,
          webhook_url: webhookUrl
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult(data);
      } else {
        alert(data.detail || 'Connection test failed.');
      }
    } catch (e) {
      alert('Network error testing storage connection.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    const token = localStorage.getItem('te_token');

    try {
      const res = await fetch(apiUrl('/api/v1/storage/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          provider,
          bucket_name: bucketName,
          endpoint_url: endpointUrl,
          access_key: accessKey,
          secret_key: secretKey,
          region,
          webhook_url: webhookUrl,
          custom_folder_path: dedicatedFolder
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save storage settings:', err);
      alert('Failed to save storage configuration.');
    } finally {
      setSaving(false);
    }
  };

  const copyFolder = () => {
    navigator.clipboard.writeText(dedicatedFolder);
    setCopiedFolder(true);
    setTimeout(() => setCopiedFolder(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fc] flex flex-col lg:flex-row font-sans antialiased selection:bg-rose-500/20">
      <Sidebar />

        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          <div className="w-full max-w-4xl flex flex-col gap-8 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  BYOS Infrastructure
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
                Client-Owned Video Storage (BYOS)
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Configure where your visitor session recordings and DOM mutation logs are stored.
              </p>
            </div>

            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-center"
            >
              Back to Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dedicated Folder Isolation Banner */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <FolderLock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                  Dedicated Tenant Storage Folder
                </span>
                <span className="text-xs font-mono font-bold text-rose-300">
                  /{dedicatedFolder}/recordings/
                </span>
              </div>
            </div>

            <button
              onClick={copyFolder}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5 self-start sm:self-center border border-slate-700"
            >
              {copiedFolder ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedFolder ? 'Copied' : 'Copy Folder Path'}</span>
            </button>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Select Recording Storage Provider
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  
                  {/* ThirdEye Cloud */}
                  <div
                    onClick={() => setProvider('thirdeye_cloud')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      provider === 'thirdeye_cloud'
                        ? 'border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Cloud className={`w-5 h-5 ${provider === 'thirdeye_cloud' ? 'text-rose-600' : 'text-slate-400'}`} />
                      {provider === 'thirdeye_cloud' && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">ThirdEye Cloud</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Managed storage</p>
                    </div>
                  </div>

                  {/* Amazon S3 */}
                  <div
                    onClick={() => setProvider('s3')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      provider === 's3'
                        ? 'border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <HardDrive className={`w-5 h-5 ${provider === 's3' ? 'text-rose-600' : 'text-slate-400'}`} />
                      {provider === 's3' && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Amazon S3</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Your AWS Bucket</p>
                    </div>
                  </div>

                  {/* Cloudflare R2 */}
                  <div
                    onClick={() => setProvider('r2')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      provider === 'r2'
                        ? 'border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Database className={`w-5 h-5 ${provider === 'r2' ? 'text-rose-600' : 'text-slate-400'}`} />
                      {provider === 'r2' && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Cloudflare R2</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Zero egress fees</p>
                    </div>
                  </div>

                  {/* Custom Server Webhook */}
                  <div
                    onClick={() => setProvider('custom_webhook')}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      provider === 'custom_webhook'
                        ? 'border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Server className={`w-5 h-5 ${provider === 'custom_webhook' ? 'text-rose-600' : 'text-slate-400'}`} />
                      {provider === 'custom_webhook' && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900">Server Webhook</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Stream to your API</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Dynamic Credential Inputs based on Provider */}
              {(provider === 's3' || provider === 'r2') && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Bucket Name
                      </label>
                      <input
                        type="text"
                        value={bucketName}
                        onChange={(e) => setBucketName(e.target.value)}
                        placeholder="e.g. growinsight-recordings"
                        required
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Region
                      </label>
                      <input
                        type="text"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="e.g. us-east-1 or ap-south-1"
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {provider === 'r2' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Cloudflare R2 Endpoint URL
                      </label>
                      <input
                        type="text"
                        value={endpointUrl}
                        onChange={(e) => setEndpointUrl(e.target.value)}
                        placeholder="https://<account-id>.r2.cloudflarestorage.com"
                        required
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none font-mono"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Access Key ID
                      </label>
                      <input
                        type="text"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        placeholder="AKIA..."
                        required
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Secret Access Key
                      </label>
                      <input
                        type="password"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        placeholder="••••••••••••••••••••"
                        required
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {provider === 'custom_webhook' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Client Server Webhook URL
                    </label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://api.growinsight.co.in/webhooks/thirdeye/replays"
                      required
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-rose-500 focus:outline-none font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      ThirdEye will stream gzipped rrweb JSON recording payloads to this endpoint on every visitor session flush.
                    </p>
                  </div>
                </div>
              )}

              {/* Test Connection Feedback Box */}
              {testResult && (
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {testResult.message}
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      {testResult.latency_ms}ms ping
                    </span>
                  </div>
                  {testResult.permissions && (
                    <div className="text-[11px] text-emerald-700 flex flex-wrap gap-2 pt-1">
                      <span className="font-semibold">Verified IAM Permissions:</span>
                      {testResult.permissions.map((p) => (
                        <code key={p} className="bg-emerald-100/70 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {p}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  {saveSuccess && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Storage configuration updated!
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Pinging Bucket...</span>
                      </>
                    ) : (
                      <>
                        <Server className="w-3.5 h-3.5 text-slate-600" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 flex-1 sm:flex-initial"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving BYOS Settings...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Storage Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>

        </div>
      </main>
    </div>
  );
}
