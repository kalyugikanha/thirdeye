"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const cleanDomain = domain.replace('https://', '').replace('http://', '').trim();
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: cleanDomain,
          email: email.trim(),
          password: password,
          name: cleanDomain.split('.')[0] || 'Client'
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to register account');
      }

      const data = await res.json();
      localStorage.setItem('te_token', data.access_token);
      if (data.user) {
        localStorage.setItem('te_user', JSON.stringify(data.user));
      }
      // Direct client straight to workspace dashboard with activation guide
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white grid grid-cols-1 lg:grid-cols-12 font-sans antialiased selection:bg-blue-500/20">
      
      {/* Left Column: Full-Height Blue Gradient with Progression Cards */}
      <div className="lg:col-span-5 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-8 sm:p-12 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden">
        
        {/* Ambient Glows */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-900/40 rounded-full blur-3xl pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/20 p-1.5 flex items-center justify-center shadow-lg flex-shrink-0">
            <img src="/logo-icon.png" alt="ThirdEye" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tight text-white block">ThirdEye</span>
            <span className="text-[10px] text-sky-300 font-bold uppercase tracking-wider block">SEE EVERY MOMENT</span>
          </div>
        </div>

        {/* Journey Section */}
        <div className="relative z-10 my-12 lg:my-0">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-semibold mb-4 shadow-sm">
            <span>Join Us to Build</span>
            <span>🤩</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            Start your <br />
            <span className="text-sky-300">Journey.</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-blue-100/90 leading-relaxed max-w-sm">
            Set up your organization account and activate live website session intelligence in 2 minutes.
          </p>

          {/* 3 Progression Cards */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            <div className="bg-white rounded-2xl p-4 shadow-lg flex flex-col justify-between min-h-[110px] transform hover:scale-[1.02] transition-transform">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                1
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-900 leading-snug">
                  Register
                </div>
                <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Current Step</div>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col justify-between min-h-[110px] text-white">
              <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center text-xs font-semibold">
                2
              </div>
              <div>
                <div className="text-[12px] font-semibold text-white/95 leading-snug">
                  Workspace
                </div>
                <div className="text-[10px] text-blue-100/70 mt-0.5">Domain Setup</div>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col justify-between min-h-[110px] text-white">
              <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center text-xs font-semibold">
                3
              </div>
              <div>
                <div className="text-[12px] font-semibold text-white/95 leading-snug">
                  Install Tag
                </div>
                <div className="text-[10px] text-blue-100/70 mt-0.5">Live Analytics</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="relative z-10 text-xs text-blue-200/80">
          Trusted by modern engineering and product teams worldwide.
        </div>
      </div>

      {/* Right Column: Clean Full-Page Form */}
      <div className="lg:col-span-7 p-8 sm:p-12 lg:p-16 flex flex-col justify-between bg-white overflow-y-auto">
        <div className="max-w-md w-full mx-auto my-auto">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-black tracking-tight text-slate-900">
              Create an account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Start monitoring visitor interactions and session replays with zero setup friction.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-4 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl leading-relaxed">
              {error}
            </div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Target Website / Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. yourcompany.com"
                required
                className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-400">Enter without https:// (subdomains supported)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Work Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Minimum 8 characters</p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 text-sm shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <span>Continue to Setup ➔</span>
                )}
              </button>
            </div>
          </form>

          {/* Already have account prompt */}
          <div className="mt-8 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-blue-600 hover:text-blue-500">
              Sign in to workspace
            </Link>
          </div>
        </div>

        {/* Legal disclaimer */}
        <div className="max-w-md w-full mx-auto pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400">
            By signing up I confirm that I agree to ThirdEye{' '}
            <Link href="#" className="text-blue-600 hover:underline">Privacy Policy</Link> and{' '}
            <Link href="#" className="text-blue-600 hover:underline">Terms of Service</Link>.
          </p>
        </div>
      </div>

    </div>
  );
}