"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          password: password,
          organization_name: orgName
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
      // Direct new clients straight to onboarding to configure domain & copy tracking snippet
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#14161b] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-blue-500/20">
      {/* Outer Card with 32px rounded corners */}
      <div className="w-full max-w-5xl bg-white rounded-[32px] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[660px] border border-white/10">
        
        {/* Left Column: Blue Gradient with Progression Cards */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-700 via-blue-600 to-sky-400 p-8 sm:p-10 flex flex-col justify-between text-white relative overflow-hidden">
          
          {/* Ambient Glows */}
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
            {/* Pill Badge matching mockup */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-medium mb-4 shadow-sm">
              <span>Join Us to Build</span>
              <span>🤩</span>
            </div>

            {/* Heading & Subtitle */}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Start your Journey
            </h1>
            <p className="mt-2 text-sm text-blue-100/90 leading-relaxed max-w-sm">
              Follow these simple steps to set up your account and activate website tracking.
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
                    Register your account
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Current Step</div>
                </div>
              </div>

              {/* Step 2: Frosted Card */}
              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 flex flex-col justify-between min-h-[110px] text-white">
                <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center text-xs font-semibold">
                  2
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white/95 leading-snug">
                    Set up your workspace
                  </div>
                  <div className="text-[10px] text-blue-100/70 mt-0.5">Domain & team</div>
                </div>
              </div>

              {/* Step 3: Frosted Card */}
              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 flex flex-col justify-between min-h-[110px] text-white">
                <div className="w-6 h-6 rounded-full bg-white/25 text-white flex items-center justify-center text-xs font-semibold">
                  3
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-white/95 leading-snug">
                    Install tracking script
                  </div>
                  <div className="text-[10px] text-blue-100/70 mt-0.5">Live analytics</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clean Form */}
        <div className="lg:col-span-7 p-8 sm:p-12 lg:p-14 flex flex-col justify-between bg-white">
          <div>
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Join Us
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                Create your organization and begin recording live visitor interactions.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3.5 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl leading-relaxed">
                {error}
              </div>
            )}

            {/* Form */}
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Juliette"
                    required
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Organization / Company
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    required
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                  />
                </div>
              </div>

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
                  className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 pr-11 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-all"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  At least 8 characters, letters, numbers, and symbols.
                </p>
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
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Continue</span>
                  )}
                </button>
              </div>
            </form>

            {/* Already have account prompt */}
            <div className="mt-5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
                Log in
              </Link>
            </div>
          </div>

          {/* Legal disclaimer */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              By signing up I confirm that I carefully have read and agree to ThirdEye{' '}
              <Link href="#" className="text-blue-600 hover:underline">Privacy Policy</Link> and{' '}
              <Link href="#" className="text-blue-600 hover:underline">Terms of Service</Link>.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}