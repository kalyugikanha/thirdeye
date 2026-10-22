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
        throw new Error(errorData.detail || 'Authentication failed: Invalid SuperAdmin credentials.');
      }

      const data = await res.json();

      // Enforce strict SuperAdmin authorization
      const isSuperAdmin = data.user?.role === 'SUPERADMIN' || data.user?.email === 'admin@thirdeye.io';
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-500/30 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-10 left-10 w-72 h-72 bg-sky-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Cyber grid lines overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-600 p-[1.5px] shadow-2xl shadow-blue-500/30 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center p-2.5">
                <img src="/logo-icon.png" alt="ThirdEye" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
              <Shield className="w-2.5 h-2.5 text-white" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>Master Control Plane</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            ThirdEye SuperAdmin
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-sm">
            Zero-Trust platform portal for multi-tenant telemetry, cluster nodes, and global operations.
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-7 sm:p-8 shadow-2xl shadow-black/80 relative">
          {/* Subtle top edge glow */}
          <div className="absolute -top-[1px] left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="p-3.5 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-2.5 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Master Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@thirdeye.io"
                  required
                  autoComplete="email"
                  className="block w-full rounded-xl bg-slate-800/80 border border-slate-700/80 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Master Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="block w-full rounded-xl bg-slate-800/80 border border-slate-700/80 pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-white transition-colors"
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
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
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
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                256-Bit TLS End-to-End
              </span>
              <span className="text-slate-500 font-mono">ISO/IEC 27001 AUDIT</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-normal text-center">
              Strict access controls enforced. All authentication events, client IPs, and forensic payloads are recorded to immutable security logs.
            </p>
          </div>
        </div>

        {/* Footer switch to client login */}
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-blue-400 transition-colors"
          >
            <span>Looking for Client Workspace Login?</span>
            <span className="text-blue-400 font-semibold flex items-center">
              Client Sign In <ArrowRight className="w-3 h-3 ml-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
