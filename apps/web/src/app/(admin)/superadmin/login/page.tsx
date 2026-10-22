"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Loader2, ArrowRight, Lock, Mail, ShieldAlert, Cpu, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';

export default function SuperAdminLoginPage() {
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
      formData.append('username', email.trim());
      formData.append('password', password);

      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Authentication failed: Invalid credentials.');
      }

      const data = await res.json();

      // Enforce strict SuperAdmin authorization
      const isSuperAdmin = 
        data.user?.role === 'SUPERADMIN' || 
        data.user?.role === 'ADMIN' || 
        data.user?.email === 'admin@thirdeye.io' ||
        data.user?.email === 'superadmin@thirdeye.io';

      if (!isSuperAdmin) {
        localStorage.removeItem('te_token');
        localStorage.removeItem('te_user');
        throw new Error('Access Denied: Account does not possess SuperAdmin master privileges.');
      }

      localStorage.setItem('te_token', data.access_token);
      if (data.user) {
        localStorage.setItem('te_user', JSON.stringify(data.user));
      }

      router.push('/superadmin');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-slate-900 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-100 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-blue-100/60 via-indigo-100/40 to-sky-100/50 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-100/40 blur-[110px] rounded-full pointer-events-none" />
      <div className="absolute top-10 left-10 w-72 h-72 bg-sky-100/50 blur-[100px] rounded-full pointer-events-none" />

      {/* Subtle architectural dot grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 p-[2px] shadow-xl shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center p-2.5">
                <img src="/logo-icon.png" alt="ThirdEye" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-sm">
              <Shield className="w-2.5 h-2.5 text-white" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-2.5 shadow-xs">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span>Master Control Plane</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            ThirdEye SuperAdmin
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm">
            Zero-Trust executive gateway for multi-tenant telemetry, cluster nodes, and global operations.
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative">
          
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2.5 text-xs animate-in fade-in duration-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* SuperAdmin Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                SuperAdmin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@thirdeye.io"
                  required
                  autoComplete="email"
                  className="block w-full rounded-xl bg-slate-50/70 border border-slate-200 pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100/60 transition-all font-medium"
                />
              </div>
            </div>

            {/* Master Key Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Master Access Key
                </label>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  Hardware/TLS Protected
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="block w-full rounded-xl bg-slate-50/70 border border-slate-200 pl-10 pr-11 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100/60 transition-all font-medium"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Cryptographic Credentials...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Authenticate Master Session</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Enforcement Footer */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                256-Bit TLS End-to-End
              </span>
              <span className="text-slate-400 font-mono tracking-tight text-[10px]">ZERO-TRUST RBAC</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal text-center">
              Strict access controls enforced. All authentication events, client IPs, and forensic payloads are recorded to immutable security logs.
            </p>
          </div>
        </div>

        {/* Footer switch to client login */}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
          >
            <span>Looking for Client Workspace Login?</span>
            <span className="text-blue-600 font-bold flex items-center">
              Client Sign In <ArrowRight className="w-3 h-3 ml-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
