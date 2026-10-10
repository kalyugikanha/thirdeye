"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, BarChart, ShieldCheck, Activity, Bell, Search, TrendingUp, Check, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchNotifications = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch(apiUrl('/api/v1/notifications'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('te_token');
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: number) => {
    const token = localStorage.getItem('te_token');
    try {
      await fetch(apiUrl(`/api/v1/notifications/${id}/read`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications & Alerts Center</h1>
              <p className="text-sm text-slate-500 mt-1">Real-time alerts for server downtimes, threshold triggers, and system events.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
                <Bell className="w-8 h-8 text-slate-300" />
                <p className="font-medium text-slate-700">No alerts right now</p>
                <p className="text-xs text-slate-400">System alerts and uptime failure notifications will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`border rounded-2xl p-4 flex items-start justify-between gap-4 transition-all ${
                      n.is_read ? 'bg-white border-slate-100 opacity-75' : 'bg-slate-50 border-slate-200 font-medium'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {n.type === 'error' ? (
                        <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                      ) : n.type === 'warning' ? (
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <Info className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                        <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs font-medium text-slate-600 hover:text-blue-600 bg-white border border-slate-200 px-3 py-1 rounded-full flex items-center gap-1 hover:border-blue-200 transition-colors flex-shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark read
                      </button>
                    )}
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