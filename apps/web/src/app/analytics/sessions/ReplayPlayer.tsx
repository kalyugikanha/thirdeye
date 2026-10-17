"use client";

import { useEffect, useRef } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';

interface ReplayPlayerProps {
  events: any[];
  width?: number;
  height?: number;
  seekTime?: number | null;
  siteUrl?: string;
}

export default function ReplayPlayer({ events, width = 850, height = 480, seekTime, siteUrl }: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !events || events.length === 0) {
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
      const metaEv = events.find(e => e.type === 4 && e.data && e.data.href);
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
          events,
          width,
          height,
          autoPlay: true,
          showController: true,
          skipInactive: true, // Automatically skip long pauses / idle times
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
  }, [events, width, height, siteUrl]);

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

  return (
    <div className="flex justify-center items-center bg-slate-950 rounded-2xl overflow-hidden p-2 shadow-2xl">
      <div ref={containerRef} className="rrweb-wrapper" />
    </div>
  );
}