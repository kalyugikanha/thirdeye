"use client";

import { useState } from 'react';
import { CheckCircle, ArrowRight, Copy, TerminalSquare, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(2); // Start at project step
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [domain, setDomain] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !domain) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('te_token');
      if (!token) return router.push('/login');

      const response = await fetch('http://localhost:8000/api/projects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: projectName,
          domain: domain
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.api_key);
        setStep(3); // Move to install step
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const code = `<script>\n  (function(t,h,i,r,d){\n    t.ThirdEye=t.ThirdEye||{};\n    var s=h.createElement('script');\n    s.src='http://localhost:8000/public/te.js';\n    s.setAttribute('data-key',i);\n    h.head.appendChild(s);\n  })(window,document,'${apiKey}');\n</script>`;
    navigator.clipboard.writeText(code);
    alert('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col pt-16 px-6">
      
      <div className="max-w-3xl mx-auto w-full">
        {/* Progress Tracker */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              <CheckCircle className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold text-slate-800">Account</span>
          </div>
          <div className="h-px bg-slate-200 flex-1 mx-4"></div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${step >= 2 ? 'bg-blue-600 text-white' : 'border-2 border-slate-200 text-slate-400'}`}>
              {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
            </div>
            <span className={`text-sm font-semibold ${step >= 2 ? 'text-slate-800' : 'text-slate-400'}`}>Project</span>
          </div>
          <div className="h-px bg-slate-200 flex-1 mx-4"></div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-blue-600 text-white shadow-sm' : 'border-2 border-slate-200 text-slate-400'}`}>
              3
            </div>
            <span className={`text-sm font-semibold ${step >= 3 ? 'text-slate-800' : 'text-slate-400'}`}>Install</span>
          </div>
        </div>

        {/* Content Area - Step 2: Project Info */}
        {step === 2 && (
          <>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">
                Set up your first project
              </h1>
              <p className="text-slate-500">
                Create a project to start tracking your app's performance, UX, and AI insights.
              </p>
            </div>

            <div className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-8 max-w-xl mx-auto">
              <form className="space-y-6" onSubmit={handleGenerate}>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Project Name</label>
                  <input 
                    type="text" 
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    required
                    placeholder="e.g. Acme Corp Production" 
                    className="block w-full rounded-xl border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Primary Domain</label>
                  <div className="flex rounded-xl shadow-sm">
                    <span className="inline-flex items-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-4 text-slate-500 sm:text-sm">
                      https://
                    </span>
                    <input 
                      type="text" 
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      required
                      placeholder="acme.com" 
                      className="block w-full min-w-0 flex-1 rounded-none rounded-r-xl border border-slate-200 px-4 py-3 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm" 
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Tracking Code'} 
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Content Area - Step 3: Install Snippet */}
        {step === 3 && (
          <>
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-3">
                Install your tracking snippet
              </h1>
              <p className="text-slate-500">
                Paste this code inside the <code>&lt;head&gt;</code> tag of your website to start receiving data.
              </p>
            </div>

            <div className="bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-3xl p-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <TerminalSquare className="w-4 h-4 text-blue-500" />
                  JavaScript Snippet
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Code
                </button>
              </div>
              
              <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto mb-8">
                <pre className="text-sm text-emerald-400 font-mono leading-relaxed">
                  <span className="text-slate-400">&lt;script&gt;</span>{'\n'}
                  {'  '}(<span className="text-purple-400">function</span>(t,h,i,r,d){'{'}{'\n'}
                  {'    '}t.ThirdEye=t.ThirdEye||{'{'}{'}'};{'\n'}
                  {'    '}<span className="text-purple-400">var</span> s=h.createElement(<span className="text-amber-300">'script'</span>);{'\n'}
                  {'    '}s.src=<span className="text-amber-300">'http://localhost:8000/public/te.js'</span>;{'\n'}
                  {'    '}s.setAttribute(<span className="text-amber-300">'data-key'</span>,i);{'\n'}
                  {'    '}h.head.appendChild(s);{'\n'}
                  {'  '}{'}'})(window,document,<span className="text-amber-300">'{apiKey}'</span>);{'\n'}
                  <span className="text-slate-400">&lt;/script&gt;</span>
                </pre>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => router.push('/')}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}