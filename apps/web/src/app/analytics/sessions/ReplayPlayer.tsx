"use client";

import { useEffect, useRef, useMemo, useState } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { Zap, Eye, Clock } from 'lucide-react';

interface ReplayPlayerProps {
  events: any[];
  width?: number;
  height?: number;
  seekTime?: number | null;
  siteUrl?: string;
  isMobile?: boolean;
}

/**
 * Compresses dead pauses/idle gaps in rrweb event streams.
 * If consecutive events have a gap > maxGapMs (default 2500ms),
 * we compress that gap down to targetGapMs (default 1000ms).
 * This eliminates player freezing, aligns the scrubber with true active duration,
 * and fixes the 23-minute timeline issue!
 */
export function compressIdlePauses(rawEvents: any[], maxGapMs = 2500, targetGapMs = 1000): {
  compressedEvents: any[];
  pausesCompressed: number;
  timeSavedMs: number;
  tabSwitches: any[];
} {
  if (!rawEvents || rawEvents.length <= 1) {
    return { compressedEvents: rawEvents || [], pausesCompressed: 0, timeSavedMs: 0, tabSwitches: [] };
  }

  const sorted = [...rawEvents].sort((a, b) => a.timestamp - b.timestamp);
  const compressedEvents: any[] = [];
  const tabSwitches: any[] = [];
  let timeOffset = 0;
  let pausesCompressed = 0;

  for (let i = 0; i < sorted.length; i++) {
    const current = { ...sorted[i] };

    // Check for custom tab visibility events
    if (
      (current.type === 5 && current.data && current.data.tag === 'tab_visibility') ||
      (current.type === 5 && current.data && current.data.state && (current.data.state === 'hidden' || current.data.state === 'visible'))
    ) {
      tabSwitches.push(current);
    }

    if (i > 0) {
      const prevOrig = sorted[i - 1].timestamp;
      const currOrig = sorted[i].timestamp;
      const gap = currOrig - prevOrig;
      if (gap > maxGapMs) {
        timeOffset += (gap - targetGapMs);
        pausesCompressed++;
      }
    }

    current.timestamp = current.timestamp - timeOffset;
    compressedEvents.push(current);
  }

  return {
    compressedEvents,
    pausesCompressed,
    timeSavedMs: timeOffset,
    tabSwitches
  };
}

export default function ReplayPlayer({ events, width = 850, height = 480, seekTime, siteUrl, isMobile }: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);

  // Auto-detect mobile from rrweb meta event if not explicitly specified
  const detectedMobile = useMemo(() => {
    if (typeof isMobile === 'boolean') return isMobile;
    const metaEv = events?.find(e => e.type === 4 && e.data && e.data.width);
    if (metaEv && metaEv.data && metaEv.data.width) {
      return metaEv.data.width < 600;
    }
    return false;
  }, [events, isMobile]);

  const activeWidth = detectedMobile ? Math.min(width, 360) : width;
  const activeHeight = detectedMobile ? Math.max(height, 500) : height;

  // Process and compress idle dead pauses
  const { compressedEvents, pausesCompressed, timeSavedMs, tabSwitches } = useMemo(() => {
    return compressIdlePauses(events);
  }, [events]);

  useEffect(() => {
    if (!containerRef.current || !compressedEvents || compressedEvents.length === 0) {
      return;
    }

    // Determine target origin for base URL stylesheet/asset loading
    let targetOrigin = '';
    if (siteUrl) {
      try {
        const u = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
        targetOrigin = new URL(u).origin;
      } catch (e) {}
    }
    if (!targetOrigin) {
      // Find rrweb Meta event (type 4)
      const metaEv = compressedEvents.find(e => e.type === 4 && e.data && e.data.href);
      if (metaEv && metaEv.data.href) {
        try {
          targetOrigin = new URL(metaEv.data.href).origin;
        } catch (e) {}
      }
    }

    // Clear previous player instances if any
    containerRef.current.innerHTML = '';

    try {
      const player = new rrwebPlayer({
        target: containerRef.current,
        props: {
          events: compressedEvents,
          width: activeWidth,
          height: activeHeight,
          autoPlay: true,
          showController: true,
          skipInactive: true, // Automatically skip pauses
          speedOption: [1, 2, 4, 8],
          UNSAFE_replayCanvas: true,
        },
      });
      playerInstanceRef.current = player;

      // Inject <base href> into replayer iframe so relative stylesheets/images resolve correctly
      const injectBaseTag = () => {
        if (!containerRef.current || !targetOrigin) return;
        const iframe = containerRef.current.querySelector('iframe');
        if (iframe && iframe.contentDocument) {
          const doc = iframe.contentDocument;
          const head = doc.head || doc.getElementsByTagName('head')[0];
          if (head && !head.querySelector('base')) {
            const base = doc.createElement('base');
            base.href = targetOrigin.endsWith('/') ? targetOrigin : `${targetOrigin}/`;
            base.target = '_blank';
            head.insertBefore(base, head.firstChild);
          }
        }
      };

      // Attempt injection immediately and after initial render frame
      injectBaseTag();
      const baseTimer = setTimeout(injectBaseTag, 300);
      const baseTimer2 = setTimeout(injectBaseTag, 1000);

      return () => {
        clearTimeout(baseTimer);
        clearTimeout(baseTimer2);
        try {
          if (playerInstanceRef.current && typeof playerInstanceRef.current.destroy === 'function') {
            playerInstanceRef.current.destroy();
          }
        } catch (e) {
          console.error('Error destroying rrweb-player instance:', e);
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
        playerInstanceRef.current = null;
      };
    } catch (err) {
      console.error('Failed to initialize rrweb-player:', err);
    }
  }, [compressedEvents, width, height, siteUrl]);

  useEffect(() => {
    if (playerInstanceRef.current && typeof seekTime === 'number') {
      try {
        playerInstanceRef.current.goto(seekTime);
        playerInstanceRef.current.play();
      } catch (e) {
        console.warn('Could not seek rrweb player:', e);
      }
    }
  }, [seekTime]);

  if (!events || events.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400 text-sm">
        No recorded events available for playback.
      </div>
    );
  }

  const timeSavedSec = Math.round(timeSavedMs / 1000);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Telemetry Bar above Player */}
      {(pausesCompressed > 0 || tabSwitches.length > 0) && (
        <div className="w-full flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] text-slate-300">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Zap className="w-3.5 h-3.5" />
              <span>Smart Playback</span>
            </span>
            {pausesCompressed > 0 && (
              <span className="text-slate-400">
                &bull; {pausesCompressed} dead pauses compacted ({timeSavedSec}s idle time saved)
              </span>
            )}
          </div>
          {tabSwitches.length > 0 && (
            <span className="flex items-center gap-1 text-amber-400 font-semibold">
              <Eye className="w-3.5 h-3.5" />
              <span>{tabSwitches.length} Tab Switch{tabSwitches.length > 1 ? 'es' : ''}</span>
            </span>
          )}
        </div>
      )}

      <div className={`flex justify-center items-center bg-slate-950 overflow-hidden shadow-2xl transition-all relative ${
        detectedMobile ? 'rounded-[32px] border-[5px] border-slate-700/80 p-1.5 ring-1 ring-slate-600/30' : 'rounded-2xl p-2'
      }`}>
        {detectedMobile && (
          <div className="absolute top-2 w-16 h-1 rounded-full bg-slate-600/70 z-10 pointer-events-none" />
        )}
        <div ref={containerRef} className="rrweb-wrapper" />
      </div>
    </div>
  );
}