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
    <div className="min-h-screen w-full bg-white grid grid-cols-1 lg:grid-cols-12 font-sans antialiased selection:bg-blue-500/20">
      
      {/* Left Column: Full-Height Blue Gradient Showcase */}
      <div className="lg:col-span-5 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 p-8 sm:p-12 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden">
        {/* Ambient glow effects */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-900/40 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center font-extrabold text-white text-lg shadow-sm">
            ✦
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white block">ThirdEye</span>
            <span className="text-[11px] text-blue-200/90 font-medium -mt-1 block">Enterprise Observability & Replays</span>
          </div>
        </div>

        {/* Hero Showcase Center */}
        <div className="relative z-10 my-12 lg:my-0">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-semibold mb-5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Real-Time Visitor Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            Every moment <br />
            <span className="text-sky-300">captured live.</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-blue-100/90 leading-relaxed max-w-md">
            Full-stack session recording, rage-click telemetry, instant UX friction detection, and multi-tenant performance monitoring.
          </p>

          {/* 3 Step Progression Cards */}
          <div className="grid grid-cols-3 gap-3 mt-10">
            <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 flex flex-col justify-between min-h-[110px] text-white">
              <div className="w-7 h-7 rounded-full bg-white text-blue-700 flex items-center justify-center text-xs font-black shadow-sm">
                1
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-snug">Sign in</div>
                <div className="text-[10px] text-blue-200 mt-0.5">Secure Workspace</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 flex flex-col justify-between min-h-[110px] text-white/90">
              <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-bold">
                2
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-snug">Embed Script</div>
                <div className="text-[10px] text-blue-200/70 mt-0.5">Zero-Lag Snippet</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 flex flex-col justify-between min-h-[110px] text-white/90">
              <div className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-bold">
                3
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-snug">Watch Replays</div>
                <div className="text-[10px] text-blue-200/70 mt-0.5">Instant Telemetry</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-blue-200/80 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          <span>7-Day Auto-Retention • GDPR Compliant • Zero-Tracking Leak</span>
        </div>
      </div>

      {/* Right Column: Clean Full-Page Form */}
      <div className="lg:col-span-7 p-8 sm:p-14 lg:p-20 flex flex-col justify-between bg-white overflow-y-auto">
        <div className="max-w-md w-full mx-auto my-auto py-8">
          
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Sign In to Workspace
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Access your client dashboard, live visitor stream, and session replays.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl leading-relaxed">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Work Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Password
                </label>
                <Link href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-500">
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
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Continue to Workspace ➔</span>
                )}
              </button>
            </div>
          </form>

          {/* Registration link */}
          <div className="mt-8 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link href="/register" className="font-bold text-blue-600 hover:text-blue-500">
              Register new client workspace
            </Link>
          </div>
        </div>

        {/* Bottom Platform Owner Access */}
        <div className="max-w-md w-full mx-auto pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span>Platform Administrator?</span>
          </div>
          <Link
            href="/superadmin/login"
            className="font-bold text-slate-700 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
          >
            <span>SuperAdmin Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

    </div>
  );
}