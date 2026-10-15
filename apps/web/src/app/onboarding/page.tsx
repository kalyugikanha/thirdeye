"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  Copy, 
  TerminalSquare, 
  Loader2, 
  Globe2, 
  Save, 
  ArrowRight, 
  Check, 
  ExternalLink,
  Code2,
  Settings2,
  Sparkles
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl, API_BASE } from '@/lib/api';

interface Project {
  id: number;
  name: string;
  domain: string;
  api_key: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  
  // Form states
  const [projectName, setProjectName] = useState('GrowInsight Production');
  const [domain, setDomain] = useState('growinsight.co.in');
  const [apiKey, setApiKey] = useState('te_live_990c733a065d43b3b70bb0c1227d2f3c');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const loadProjects = async () => {
      try {
        const res = await fetch(apiUrl('/api/projects'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
          localStorage.removeItem('te_token');
          router.push('/login');
          return;
        }
        if (res.ok) {
          const projects = await res.json();
          if (Array.isArray(projects) && projects.length > 0) {
            const p = projects[0];
            setActiveProject(p);
            setProjectName(p.name || 'GrowInsight Production');
            setDomain(p.domain || 'growinsight.co.in');
            if (p.api_key) setApiKey(p.api_key);
          }
        }
      } catch (err) {
        console.error('Failed to load project details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [router]);

  // Handle Domain & Name Update
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !domain.trim()) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem('te_token');
      const cleanDomain = domain.replace('https://', '').replace('http://', '').replace(/\/$/, '').trim();

      if (activeProject) {
        // Update existing project via PATCH
        const res = await fetch(apiUrl(`/api/projects/${activeProject.id}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: projectName.trim(),
            domain: cleanDomain
          })
        });

        if (res.ok) {
          const updated = await res.json();
          setActiveProject(updated);
          setDomain(updated.domain);
          setProjectName(updated.name);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      } else {
        // Create new project if none existed
        const res = await fetch(apiUrl('/api/projects'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            name: projectName.trim(),
            domain: cleanDomain,
            api_key: apiKey
          })
        });

        if (res.ok) {
          const created = await res.json();
          setActiveProject(created);
          setDomain(created.domain);
          setProjectName(created.name);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      }
    } catch (err) {
      console.error('Failed to update project settings:', err);
      alert('Failed to update settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    const code = `<script>\n  (function(t,h,i,r,d){\n    t.ThirdEye=t.ThirdEye||{};\n    var s=h.createElement('script');\n    s.src='${API_BASE}/public/te.js';\n    s.setAttribute('data-key',i);\n    h.head.appendChild(s);\n  })(window,document,'${apiKey}');\n</script>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#ffe4d6] via-[#ffdcd2] to-[#ffeedb] p-2 sm:p-4 lg:p-6 flex items-center justify-center font-sans antialiased selection:bg-rose-500/20">
      <div className="w-full max-w-[1440px] bg-[#fbfbfe] rounded-[32px] sm:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-white/80 overflow-hidden flex flex-col lg:flex-row min-h-[840px] transition-all">
        <Sidebar />

        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          <div className="w-full max-w-5xl flex flex-col gap-8 pb-16">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Project & Snippet Hub
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
                Website Tracking & Domain Settings
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Manage your website domain and copy your live tracking snippet.
              </p>
            </div>

            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-center"
            >
              Go to Workspace Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CARD 1: Domain & Project Settings (EDITABLE) */}
          <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Active Website & Project Details</h2>
                  <p className="text-xs text-slate-400">Update your target domain anytime without breaking your tracking code.</p>
                </div>
              </div>
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Settings Saved!
                </span>
              )}
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                    placeholder="e.g. GrowInsight Production"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Website Primary Domain
                  </label>
                  <div className="flex rounded-xl shadow-sm">
                    <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 font-mono">
                      https://
                    </span>
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      required
                      placeholder="growinsight.co.in"
                      className="block w-full min-w-0 flex-1 rounded-none rounded-r-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Globe2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>Current Site:</span>
                  <a 
                    href={`https://${domain.replace('https://', '')}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="font-mono text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    https://{domain.replace('https://', '')}/ <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>

          {/* CARD 2: Active Tracking Snippet Code */}
          <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Your JavaScript Tracking Snippet</h2>
                  <p className="text-xs text-slate-400">
                    Paste this exact code in your WordPress site to capture sessions, pageviews, and clicks.
                  </p>
                </div>
              </div>

              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Code Copied!' : 'Copy Snippet'}
              </button>
            </div>

            {/* Code Box */}
            <div className="bg-slate-950 rounded-2xl p-5 overflow-x-auto border border-slate-800/80 my-4 shadow-inner">
              <pre className="text-xs text-emerald-400 font-mono leading-relaxed select-all">
                <span className="text-slate-500">&lt;script&gt;</span>{'\n'}
                {'  '}(<span className="text-purple-400">function</span>(t,h,i,r,d){'{'}{'\n'}
                {'    '}t.ThirdEye=t.ThirdEye||{'{'}{'}'};{'\n'}
                {'    '}<span className="text-purple-400">var</span> s=h.createElement(<span className="text-amber-300">'script'</span>);{'\n'}
                {'    '}s.src=<span className="text-amber-300">'{API_BASE}/public/te.js'</span>;{'\n'}
                {'    '}s.setAttribute(<span className="text-amber-300">'data-key'</span>,i);{'\n'}
                {'    '}h.head.appendChild(s);{'\n'}
                {'  '}{'}'})(window,document,<span className="text-amber-300">'{apiKey}'</span>);{'\n'}
                <span className="text-slate-500">&lt;/script&gt;</span>
              </pre>
            </div>

            {/* Key info pill */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Permanent API Key:</span>
                <span className="font-mono bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-slate-200">
                  {apiKey}
                </span>
              </div>
              <span className="flex items-center gap-1.5 font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Active in Production
              </span>
            </div>
          </div>

          {/* CARD 3: WordPress Quick Guide */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-3xl p-6 lg:p-8 border border-blue-100">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" /> How to install in WordPress (2 Simple Steps):
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm space-y-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Via WPCode Plugin (Recommended)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  In your WordPress Admin, go to <strong>Plugins &rarr; Add New</strong>, search for <strong>WPCode (Insert Headers and Footers)</strong> and install it.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Then click <strong>Code Snippets &rarr; Header & Footer</strong>, paste this code into the <strong>Header</strong> box, and click Save!
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm space-y-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h4 className="font-bold text-slate-900 text-sm">Directly in Theme (header.php)</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Alternatively, in WordPress Admin go to <strong>Appearance &rarr; Theme File Editor</strong>.
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Open <code className="bg-slate-100 px-1 rounded font-mono">header.php</code>, paste the code right before the closing <code className="bg-slate-100 px-1 rounded font-mono">&lt;/head&gt;</code> tag, and save the file.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
      </div>
    </div>
  );
}