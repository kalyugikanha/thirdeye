"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock, Eye, TrendingUp, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { apiUrl } from '@/lib/api';

interface TopArticle {
  url: string;
  views: number;
  avg_read_time: string;
  scroll_depth: string;
}

interface BlogData {
  total_articles: number;
  avg_read_time_seconds: number;
  avg_scroll_depth_pct: number;
  completion_rate_pct: number;
  top_articles: TopArticle[];
}

export default function BlogsPage() {
  const [data, setData] = useState<BlogData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchBlogData = async () => {
      const token = localStorage.getItem('te_token');
      if (!token) return router.push('/login');
      try {
        const res = await fetch(apiUrl('/api/v1/analytics/blogs'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogData();
  }, [router]);

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-8 px-10 overflow-y-auto">
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-8 pb-12">
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Blog & Content Engagement Analytics</h1>
              <p className="text-sm text-slate-500 mt-1">Track reading time, scroll depth %, and engagement drop-offs for blog content.</p>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> Computing blog engagement metrics...
            </div>
          ) : data ? (
            <div className="flex flex-col gap-8">
              
              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <BookOpen className="w-4 h-4 text-blue-500" /> Articles Tracked
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{data.total_articles}</div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <Clock className="w-4 h-4 text-purple-500" /> Avg Read Time
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{Math.floor(data.avg_read_time_seconds / 60)}m {data.avg_read_time_seconds % 60}s</div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Avg Scroll Depth
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{data.avg_scroll_depth_pct}%</div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                    <Eye className="w-4 h-4 text-orange-500" /> Completion Rate
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{data.completion_rate_pct}%</div>
                </div>
              </div>

              {/* Top Articles Table */}
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Top Performing Blog Articles</h2>

                <div className="grid gap-3">
                  {data.top_articles.map((art, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-4">
                      <div>
                        <span className="font-mono text-xs font-bold text-blue-600 block">{art.url}</span>
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                          <span>{art.views} total views</span> • <span>Avg Read Time: {art.avg_read_time}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          {art.scroll_depth} Scroll
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : null}

        </div>
      </main>
    </div>
  );
}