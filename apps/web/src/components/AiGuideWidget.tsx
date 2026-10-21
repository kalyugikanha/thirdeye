"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Sparkles, Loader2, ChevronRight, CheckCircle2, MessageSquare, HelpCircle } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  "Yeh 3 boxes kis liye hain?",
  "Tracking script kaise lagayein?",
  "Kya is script se meri website slow hogi?",
  "Video replay me dead pause kyu aa raha tha?",
  "BYOS Private Storage kya hai?"
];

export default function AiGuideWidget({ domain, isConnected, context = 'dashboard' }: { domain?: string; isConnected?: boolean; context?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcome greeting
  useEffect(() => {
    const activeDomain = domain || 'your website';
    const statusText = isConnected ? 'Active & Tracking' : 'Pending Setup';
    const welcomeText = `🤖 **Namaste! Main hoon ThirdEye AI Guide (Mitr)**\n\nAapki workspace website: **${activeDomain}** (${statusText}).\n\nAap mujhse kisi bhi feature ke baare me pooch sakte hain — Hindi ya English me. Niche diye gaye questions par click karein ya apna sawaal type karein!`;
    
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: welcomeText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [domain, isConnected]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (userQuery?: string) => {
    const textToSend = (userQuery || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: Math.random().toString(36).substring(2),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userQuery) setInput('');
    setLoading(true);

    const token = typeof window !== 'undefined' ? localStorage.getItem('te_token') : null;

    try {
      const res = await fetch(apiUrl('/api/v1/ai/guide'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: textToSend,
          context: context,
          project_domain: domain,
          is_connected: isConnected
        })
      });

      if (!res.ok) {
        throw new Error('Guide assistant unavailable');
      }

      const data = await res.json();
      const botMsg: Message = {
        id: Math.random().toString(36).substring(2),
        sender: 'bot',
        text: data.reply || 'Main abhi aapke sawaal ko process nahi kar saka. Kripya punah prayas karein.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const fallbackMsg: Message = {
        id: Math.random().toString(36).substring(2),
        sender: 'bot',
        text: `🤖 **ThirdEye Mitr Support:**\n\n- **Client Tracking Tag**: Apne website ke \`<head>\` me tag lagayein taaki session replays record ho sakein.\n- **Zero Slowdown Guarantee**: Humara script passive listeners aur \`requestIdleCallback\` use karta hai, isse website par 0% lag hota hai.\n- **Uptime & SSL**: Backend ki availability aur certificate expiry track karta hai.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans select-none">
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-full shadow-[0_10px_30px_rgba(15,23,42,0.4)] hover:shadow-indigo-500/20 hover:scale-105 transition-all border border-slate-700/80 cursor-pointer"
          title="Ask ThirdEye AI Robot Guide"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold block leading-none text-white">AI Robot Guide</span>
            <span className="text-[10px] text-indigo-300 font-medium">Ask in Hindi / English</span>
          </div>
        </button>
      )}

      {/* Floating Chat Modal Drawer */}
      {isOpen && (
        <div className="w-96 max-w-[calc(100vw-2rem)] h-[540px] max-h-[85vh] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold flex items-center gap-1.5 text-white">
                  <span>ThirdEye AI Mitr</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
                    Online
                  </span>
                </h3>
                <p className="text-[10px] text-indigo-200/80">Step-by-step Feature Helper</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Questions Pills */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 shadow-xs transition-all disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-xs'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[9px] text-slate-400 px-1 mt-1 font-medium">{m.timestamp}</span>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 w-36">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Poochiye koi bhi sawaal..."
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

        </div>
      )}
    </div>
  );
}
