"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Loader2, ArrowRight, Lock, KeyRound, Server } from 'lucide-react';
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
      formData.append('username', email);
      formData.append('password', password);

      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Invalid superadmin credentials');
      }

      const data = await res.json();
      localStorage.setItem('te_token', data.access_token);
      if (data.user) {
        localStorage.setItem('te_user', JSON.stringify(data.user));
      }

      // Check role
      if (data.user?.role && data.user.role !== 'ADMIN') {
        throw new Error('Access denied: This account does not possess SuperAdmin privileges.');
      }

      router.push('/superadmin');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-500/30 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-xl shadow-blue-500/20 mb-4">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Shield className="w-7 h-7 text-blue-400" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Server className="w-3.5 h-3.5" />
            Control Center Access
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            SuperAdmin Platform Portal
          </h1>
          <p className="mt-1 text-sm text-slate-400 max-w-xs">
            Authenticate to oversee multi-tenant workspaces, global telemetry, and cluster nodes.
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="p-3.5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center leading-relaxed">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                SuperAdmin Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@thirdeye.io"
                  required
                  className="block w-full rounded-xl bg-slate-800/80 border border-slate-700/80 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Master Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="block w-full rounded-xl bg-slate-800/80 border border-slate-700/80 px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-white"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Master Session...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Access Platform Control Center</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Pre-sets */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 text-center mb-2">
              Fast Pre-fill Admin Accounts
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('admin@thirdeye.io', 'password123')}
                className="text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white">Default Admin</div>
                  <div className="text-[10px] text-slate-400">admin@thirdeye.io</div>
                </div>
                <KeyRound className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('scan.pe.in@gmail.com', 'AKAsh@123')}
                className="text-left p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 transition-colors flex items-center justify-between group"
              >
                <div>
                  <div className="font-semibold text-white">ScanPe Master</div>
                  <div className="text-[10px] text-slate-400">scan.pe.in@gmail.com</div>
                </div>
                <KeyRound className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </button>
            </div>
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
