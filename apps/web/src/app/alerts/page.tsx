"use client";

import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  Check, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  RefreshCw,
  Sparkles,
  Loader2,
  CheckCheck
} from 'lucide-react';

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
  const [sendingTest, setSendingTest] = useState(false);
  const router = useRouter();

  const fetchNotifications = async () => {
    const token = localStorage.getItem('te_token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch(apiUrl('/api/v1/notifications'), {
        headers: { Authorization: `Bearer ${token}` }
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
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    for (const n of unread) {
      handleMarkRead(n.id);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    const token = localStorage.getItem('te_token');
    try {
      // Trigger a monitor check on monitor 1 which creates an alert if needed, or dispatch alert
      await fetch(apiUrl('/api/v1/monitors/1/check'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchNotifications();
    } catch (err) {
      console.error(err);
    } finally {
      setSendingTest(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#ffe4d6] via-[#ffdcd2] to-[#ffeedb] p-2 sm:p-4 lg:p-6 flex items-center justify-center font-sans antialiased selection:bg-rose-500/20">
      <div className="w-full max-w-[1440px] bg-[#fbfbfe] rounded-[32px] sm:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border border-white/80 overflow-hidden flex flex-col lg:flex-row min-h-[840px] transition-all">
        <Sidebar />

        <main className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 overflow-y-auto">
          <div className="w-full flex flex-col gap-8 pb-16">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  System Telemetry
                </span>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full border border-rose-200">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
                Alerts & Notifications Hub
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Real-time security events, uptime alerts, and live tracking status notifications.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
                  Mark All Read
                </button>
              )}
              <button
                onClick={handleSendTest}
                disabled={sendingTest}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50"
              >
                {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {sendingTest ? 'Running Check...' : 'Run Diagnostics Check'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                Loading system notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-500">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700">No active alerts</p>
                <p className="text-xs text-slate-400 mt-1">System health, downtime notices, and security triggers will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-2xl p-5 flex items-start justify-between gap-4 transition-all border shadow-sm ${
                      n.is_read ? 'bg-white border-slate-200/60 opacity-80' : 'bg-white border-slate-200 ring-1 ring-blue-500/10'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      {n.type === 'error' ? (
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 flex-shrink-0">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                      ) : n.type === 'warning' ? (
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 flex-shrink-0">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 flex-shrink-0">
                          <Info className="w-5 h-5" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{n.title}</h3>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                        <span className="text-[10px] text-slate-400 mt-2 block font-medium">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors flex-shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark Read
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
    </div>
  );
}