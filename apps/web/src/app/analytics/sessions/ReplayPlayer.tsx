"use client";

import { useEffect, useRef } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';

interface ReplayPlayerProps {
  events: any[];
  width?: number;
  height?: number;
}

export default function ReplayPlayer({ events, width = 850, height = 480 }: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !events || events.length === 0) {
      return;
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
          speedOption: [1, 2, 4, 8],
        },
      });
      playerInstanceRef.current = player;

      return () => {
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
  }, [events, width, height]);

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