"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, BarChart, ShieldCheck, Activity, Bell, Sliders, Users, Flame, UserPlus, Copy, Check, Trash2, Shield } from 'lucide-react';
import Link from 'next/link';

interface Member {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const fetchMembers = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) return router.push('/login');
    try {
      const res = await fetch(apiUrl('/api/v1/team/members'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl('/api/v1/team/invites'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteLink(data.invite_link);
        setInviteEmail('');
      } else {
        alert(data.detail || 'Failed to generate invite');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRemoveMember = async (id: number) => {
    const token = localStorage.getItem('te_token');
    try {
      const res = await fetch(apiUrl(`/api/v1/team/members/${id}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== id));
      } else {
        const errData = await res.json();
        alert(errData.detail || 'Cannot remove member');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team Management & RBAC Controls</h1>
              <p className="text-sm text-slate-500 mt-1">Manage organization members, invite new teammates, and assign access roles.</p>
            </div>
          </div>

          {/* Invite Form */}
          <form onSubmit={handleCreateInvite} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Teammate Email</label>
              <input
                type="email"
                placeholder="developer@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="w-full md:w-48">
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Assigned Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="MEMBER">Member (Standard)</option>
                <option value="ADMIN">Admin (Full Access)</option>
                <option value="VIEWER">Viewer (Read Only)</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Generate Invite Link
            </button>
          </form>

          {inviteLink && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between gap-4">
              <div className="flex-1 truncate text-xs font-mono text-blue-900">
                {inviteLink}
              </div>
              <button
                onClick={handleCopyLink}
                className="bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}

          {/* Members List */}
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Organization Members ({members.length})</h2>

            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading team...</div>
            ) : (
              <div className="grid gap-4">
                {members.map((m) => (
                  <div key={m.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm">
                        {m.name[0] || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 text-base">{m.name}</h3>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            m.role === 'ADMIN' ? 'bg-purple-50 text-purple-600' :
                            m.role === 'MEMBER' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Shield className="w-3 h-3 inline mr-1" />{m.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{m.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Remove Member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}