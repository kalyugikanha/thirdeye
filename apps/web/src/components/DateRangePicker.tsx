"use client";

import React, { useState } from 'react';
import { Calendar, ChevronDown, Check, X } from 'lucide-react';

export type DateRangePreset = 'all' | '24h' | '7d' | '30d' | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
  label: string;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (val: DateRangeValue) => void;
  className?: string;
}

export default function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(value.fromDate || '');
  const [customTo, setCustomTo] = useState(value.toDate || '');

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }

    setShowCustom(false);
    const now = new Date();
    let fromDate: string | undefined = undefined;
    let toDate: string | undefined = now.toISOString().split('T')[0];
    let label = 'All Time';

    if (preset === '24h') {
      const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      fromDate = d.toISOString().split('T')[0];
      label = 'Last 24 Hours';
    } else if (preset === '7d') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      fromDate = d.toISOString().split('T')[0];
      label = 'Last 7 Days';
    } else if (preset === '30d') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      fromDate = d.toISOString().split('T')[0];
      label = 'Last 30 Days';
    } else {
      toDate = undefined;
      label = 'All Time';
    }

    onChange({ preset, fromDate, toDate, label });
  };

  const handleApplyCustom = () => {
    if (!customFrom) return;
    const to = customTo || new Date().toISOString().split('T')[0];
    onChange({
      preset: 'custom',
      fromDate: customFrom,
      toDate: to,
      label: `${customFrom} to ${to}`
    });
    setShowCustom(false);
  };

  return (
    <div className={`relative flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs font-sans text-xs ${className}`}>
      <div className="flex items-center gap-1 px-2 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden sm:inline">Range</span>
      </div>

      <button
        type="button"
        onClick={() => handlePresetSelect('all')}
        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
          value.preset === 'all'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        All Time
      </button>

      <button
        type="button"
        onClick={() => handlePresetSelect('24h')}
        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
          value.preset === '24h'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        24h
      </button>

      <button
        type="button"
        onClick={() => handlePresetSelect('7d')}
        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
          value.preset === '7d'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        7 Days
      </button>

      <button
        type="button"
        onClick={() => handlePresetSelect('30d')}
        className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
          value.preset === '30d'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        30 Days
      </button>

      <button
        type="button"
        onClick={() => setShowCustom(!showCustom)}
        className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
          value.preset === 'custom'
            ? 'bg-indigo-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
      >
        <span>{value.preset === 'custom' ? value.label : 'Custom'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
      </button>

      {/* Custom Date Dropdown Popover */}
      {showCustom && (
        <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 z-40 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl flex flex-col gap-3 min-w-[280px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-800 text-xs">Custom Date Interval</span>
            <button
              onClick={() => setShowCustom(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                From Date
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                To Date
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowCustom(false)}
              className="px-3 py-1.5 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              disabled={!customFrom}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
