"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
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
        throw new Error(errorData.detail || 'Failed to register');
      }

      const data = await res.json();
      localStorage.setItem('te_token', data.access_token);
      router.push('/onboarding'); // Direct to onboarding since they have no projects yet
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-blue-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-sm mb-4">
          T
        </div>
        <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
          Create an Account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-[400px]">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200 sm:rounded-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleRegister}>
            
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700">Full Name</label>
              <div className="mt-1">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="block w-full appearance-none rounded-xl border border-slate-300 px-4 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Company / Organization Name</label>
              <div className="mt-1">
                <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="block w-full appearance-none rounded-xl border border-slate-300 px-4 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email address</label>
              <div className="mt-1">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="block w-full appearance-none rounded-xl border border-slate-300 px-4 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="mt-1 relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="block w-full appearance-none rounded-xl border border-slate-300 px-4 py-2 text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button type="button" className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={loading} className="flex w-full justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Register'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}