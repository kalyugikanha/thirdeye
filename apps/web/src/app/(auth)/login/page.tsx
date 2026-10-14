"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Invalid email or password');
      }

      const data = await res.json();
      localStorage.setItem('te_token', data.access_token);
      if (data.user) {
        localStorage.setItem('te_user', JSON.stringify(data.user));
      }

      // If user has ADMIN role and logged in with admin@thirdeye.io, take them to superadmin dashboard
      if (email === 'admin@thirdeye.io' || data.user?.role === 'SUPERADMIN') {
        router.push('/superadmin');
      } else {
        // Standard client user (e.g. scan.pe.in@gmail.com with GrowInsight) goes directly to workspace dashboard
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillClientDemo = () => {
    setEmail('scan.pe.in@gmail.com');
    setPassword('AKAsh@123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#14161b] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-blue-500/20">
      {/* Outer Card with 32px rounded corners */}
      <div className="w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px] border border-white/10">
        
        {/* Left Column: Blue Gradient with Progression Cards */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-700 via-blue-600 to-sky-400 p-8 sm:p-10 flex flex-col justify-between text-white relative overflow-hidden">
          
          {/* Subtle background glow */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-900/30 rounded-full blur-3xl pointer-events-none" />

          {/* Top Branding */}
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center font-bold text-white text-base shadow-sm">
              T
            </div>
            <span className="text-xl font-bold tracking-tight text-white">thirdeye</span>
          </div>

          {/* Bottom Journey Section */}
          <div className="relative z-10 mt-12 lg:mt-0">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-medium mb-4 shadow-sm">
              <span>Enterprise Analytics</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </div>

            {/* Heading & Subtitle */}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Start your Journey
            </h1>
            <p className="mt-2 text-sm text-blue-100/90 leading-relaxed max-w-sm">
              Follow these simple steps to monitor your digital growth and live sessions.
            </p>

            {/* 3 Progression Cards */}
            <div className="grid grid-cols-3 gap-2.5 mt-8">
              {/* Step 1: Active White Card */}
              <div className="bg-white rounded-2xl p-3.5 shadow-lg flex flex-col justify-between min-h-[110px] transform hover:scale-[1.02] transition-transform">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  1
                </div>
                <div>
                  <div className="text-[12px] font-bold text-slate-900 leading-snug">
                    Sign in to workspace
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Active</div>
                </div>
              </div>

              {/* Step 2: Frosted Card */}
              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 flex flex-col justify-between min-h-[110px] text-white">
                <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center text-xs font-semibold">
                  2
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white/95 leading-snug">
                    Install snippet
                  </div>
                  <div className="text-[10px] text-blue-100/70 mt-0.5">growinsight.co.in</div>
                </div>
              </div>

              {/* Step 3: Frosted Card */}
              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 flex flex-col justify-between min-h-[110px] text-white">
                <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center text-xs font-semibold">
                  3
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white/95 leading-snug">
                    Replays & metrics
                  </div>
                  <div className="text-[10px] text-blue-100/70 mt-0.5">Live UX</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean White Form */}
        <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-between bg-white">
          <div>
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Sign In
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Access your client analytics workspace and session recordings.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl leading-relaxed">
                {error}
              </div>
            )}

            {/* Form */}
            <form className="space-y-4" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <Link href="#" className="text-xs font-medium text-blue-600 hover:text-blue-500">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 text-sm shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <span>Continue</span>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Demo Login Option */}
            <div className="mt-5">
              <button
                type="button"
                onClick={fillClientDemo}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 hover:bg-blue-50 border border-blue-200/70 text-xs text-blue-700 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    G
                  </div>
                  <div className="text-left">
                    <span className="font-semibold block text-slate-900">1-Click Client Demo (ScanPe)</span>
                    <span className="text-[11px] text-blue-600">growinsight.co.in production workspace</span>
                  </div>
                </div>
                <span className="text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                  Autofill ➔
                </span>
              </button>
            </div>

            {/* Sign up prompt */}
            <div className="mt-5 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-500">
                Register account
              </Link>
            </div>
          </div>

          {/* SuperAdmin Master Access Switcher */}
          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Platform Owner?</span>
            </div>
            <Link
              href="/superadmin/login"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
            >
              <span>SuperAdmin Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}