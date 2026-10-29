"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Zap,
  Eye,
  Clock,
  Maximize2,
  Minimize2,
  MousePointer,
  Flame,
  Volume2,
  Smartphone,
  Laptop,
  Compass,
  Sparkles,
  Info
} from 'lucide-react';

export interface TimelineItem {
  id: number;
  offset_ms: number;
  offset_formatted: string;
  event_type: string;
  label: string;
  url?: string;
  severity?: 'info' | 'warning' | 'error';
  properties?: any;
}

interface ReplayPlayerProps {
  events: any[];
  timeline?: TimelineItem[] | null;
  width?: number;
  height?: number;
  seekTime?: number | null;
  siteUrl?: string;
  isMobile?: boolean;
  onTimeUpdate?: (currentMs: number) => void;
}

/**
 * Compresses dead pauses/idle gaps in rrweb event streams.
 * If consecutive events have a gap > maxGapMs (default 2500ms),
 * we compress that gap down to targetGapMs (default 1000ms).
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

/**
 * Maps an original uncompressed timeline offset (ms) to its compressed position
 */
export function mapOffsetToCompressed(originalOffsetMs: number, rawEvents: any[], maxGapMs = 2500, targetGapMs = 1000): number {
  if (!rawEvents || rawEvents.length <= 1) return originalOffsetMs;
  const sorted = [...rawEvents].sort((a, b) => a.timestamp - b.timestamp);
  const startTs = sorted[0].timestamp;
  const targetTs = startTs + originalOffsetMs;

  let timeOffset = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].timestamp > targetTs) break;
    const prevOrig = sorted[i - 1].timestamp;
    const currOrig = sorted[i].timestamp;
    const gap = currOrig - prevOrig;
    if (gap > maxGapMs) {
      timeOffset += (gap - targetGapMs);
    }
  }
  return Math.max(0, originalOffsetMs - timeOffset);
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getMarkerMeta(event_type: string, severity?: string) {
  const type = (event_type || '').toLowerCase();
  const sev = (severity || '').toLowerCase();

  if (sev === 'error' || type.includes('error') || type === 'rage_click' || type === 'form_abandon') {
    return {
      dotColor: 'bg-rose-500 ring-rose-400/80 shadow-[0_0_8px_rgba(244,63,94,0.7)]',
      textColor: 'text-rose-400',
      category: type === 'rage_click' ? 'RAGE CLICK' : type === 'form_abandon' ? 'FORM ABANDON' : 'CONSOLE ERROR',
      icon: Flame,
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    };
  }
  if (sev === 'warning' || type.includes('form') || type === 'search_query' || type === 'site_search') {
    return {
      dotColor: 'bg-amber-400 ring-amber-300/80 shadow-[0_0_8px_rgba(251,191,36,0.7)]',
      textColor: 'text-amber-400',
      category: type.includes('form') ? 'FORM ACTION' : 'SEARCH QUERY',
      icon: Zap,
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    };
  }
  if (type === 'pageview' || type === 'load' || type === 'init') {
    return {
      dotColor: 'bg-emerald-400 ring-emerald-300/80 shadow-[0_0_8px_rgba(52,211,153,0.7)]',
      textColor: 'text-emerald-400',
      category: 'PAGEVIEW',
      icon: Eye,
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    };
  }
  return {
    dotColor: 'bg-indigo-400 ring-indigo-300/80 shadow-[0_0_8px_rgba(129,140,248,0.7)]',
    textColor: 'text-indigo-400',
    category: 'CLICK',
    icon: MousePointer,
    badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
  };
}

export default function ReplayPlayer({
  events,
  timeline,
  width = 850,
  height = 480,
  seekTime,
  siteUrl,
  isMobile,
  onTimeUpdate
}: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);
  const scrubberTrackRef = useRef<HTMLDivElement>(null);

  // Playback control states
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [skipInactive, setSkipInactive] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Scrubber hover state
  const [hoveredMarker, setHoveredMarker] = useState<any | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; percent: number } | null>(null);

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

  // Process idle pauses
  const { compressedEvents, pausesCompressed, timeSavedMs, tabSwitches } = useMemo(() => {
    return compressIdlePauses(events);
  }, [events]);

  // Current active stream based on user's Skip Inactivity toggle
  const activeEvents = useMemo(() => {
    if (skipInactive) {
      return compressedEvents;
    }
    return events ? [...events].sort((a, b) => a.timestamp - b.timestamp) : [];
  }, [skipInactive, compressedEvents, events]);

  // Total duration in milliseconds
  const totalDuration = useMemo(() => {
    if (!activeEvents || activeEvents.length < 2) return 1000;
    const start = activeEvents[0].timestamp;
    const end = activeEvents[activeEvents.length - 1].timestamp;
    return Math.max(1000, end - start);
  }, [activeEvents]);

  // Normalized timeline markers
  const markers = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    return timeline.map(item => {
      let activeOffset = item.offset_ms;
      if (skipInactive) {
        activeOffset = mapOffsetToCompressed(item.offset_ms, events);
      }
      const percent = Math.min(100, Math.max(0, (activeOffset / totalDuration) * 100));
      return {
        ...item,
        activeOffset,
        percent,
        meta: getMarkerMeta(item.event_type, item.severity)
      };
    });
  }, [timeline, skipInactive, events, totalDuration]);

  // Initialize or reinitialize rrwebPlayer
  useEffect(() => {
    if (!containerRef.current || !activeEvents || activeEvents.length === 0) {
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
      const metaEv = activeEvents.find(e => e.type === 4 && e.data && e.data.href);
      if (metaEv && metaEv.data && metaEv.data.href) {
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
          events: activeEvents,
          width: activeWidth,
          height: activeHeight,
          autoPlay: true,
          showController: false, // We render our own high-fidelity Montserrat HUD!
          speed: playbackSpeed,
          speedOption: [0.5, 1, 1.5, 2, 4, 8],
          UNSAFE_replayCanvas: true,
        },
      });
      playerInstanceRef.current = player;
      setIsPlaying(true);

      // Listen for rrwebPlayer dispatches if supported
      try {
        (player as any).addEventListener?.('ui-update-current-time', (e: any) => {
          if (typeof e?.payload === 'number') {
            setCurrentTime(e.payload);
            if (onTimeUpdate) onTimeUpdate(e.payload);
          }
        });
        (player as any).addEventListener?.('ui-update-player-state', (e: any) => {
          if (e?.payload === 'playing') setIsPlaying(true);
          if (e?.payload === 'paused') setIsPlaying(false);
        });
      } catch (e) {}

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
  }, [activeEvents, activeWidth, activeHeight, siteUrl]);

  // High-precision ticker for smooth progress and playhead tracking
  useEffect(() => {
    const ticker = setInterval(() => {
      if (playerInstanceRef.current) {
        try {
          const replayer = playerInstanceRef.current.getReplayer?.();
          if (replayer) {
            const t = replayer.getCurrentTime?.();
            if (typeof t === 'number' && !isNaN(t)) {
              setCurrentTime(t);
              if (onTimeUpdate) onTimeUpdate(t);
            }
          }
        } catch (e) {}
      }
    }, 100);

    return () => clearInterval(ticker);
  }, [onTimeUpdate]);

  // Handle external seekTime prop (e.g. from right-pane timeline click)
  useEffect(() => {
    if (playerInstanceRef.current && typeof seekTime === 'number') {
      let targetSeek = seekTime;
      if (skipInactive) {
        targetSeek = mapOffsetToCompressed(seekTime, events);
      }
      handleSeek(targetSeek);
    }
  }, [seekTime, skipInactive, events]);

  // Seek handler
  const handleSeek = useCallback((timeMs: number) => {
    if (!playerInstanceRef.current) return;
    const clamped = Math.max(0, Math.min(timeMs, totalDuration));
    try {
      playerInstanceRef.current.goto(clamped, true);
      setCurrentTime(clamped);
      setIsPlaying(true);
    } catch (e) {
      console.warn('Could not seek player:', e);
    }
  }, [totalDuration]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!playerInstanceRef.current) return;
    try {
      if (isPlaying) {
        playerInstanceRef.current.pause();
        setIsPlaying(false);
      } else {
        playerInstanceRef.current.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('Playback toggle error:', e);
    }
  }, [isPlaying]);

  // Step backward / forward
  const handleStep = useCallback((deltaMs: number) => {
    handleSeek(currentTime + deltaMs);
  }, [currentTime, handleSeek]);

  // Playback speed change
  const handleSpeedChange = useCallback((newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (playerInstanceRef.current) {
      try {
        playerInstanceRef.current.setSpeed(newSpeed);
      } catch (e) {
        console.warn('Could not set player speed:', e);
      }
    }
  }, []);

  // Keyboard shortcut listener (Spacebar for play/pause, Left/Right for jump)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStep(-5000);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStep(5000);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setSkipInactive(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleStep]);

  // Scrubber track click
  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberTrackRef.current) return;
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    handleSeek(percent * totalDuration);
  };

  // Scrubber hover preview
  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberTrackRef.current) return;
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoverPosition({ x: hoverX, percent });
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!playerWrapperRef.current) return;
    if (!document.fullscreenElement) {
      playerWrapperRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!events || events.length === 0) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400 text-sm">
        No recorded events available for playback.
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));
  const timeSavedSec = Math.round(timeSavedMs / 1000);

  return (
    <div ref={playerWrapperRef} className="flex flex-col items-center w-full bg-[#0b101b] rounded-2xl p-2 select-none">
      
      {/* Top Smart Telemetry Header Bar */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 mb-2 bg-slate-900/90 border border-slate-800 rounded-xl text-[11px] text-slate-300">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <Zap className="w-3.5 h-3.5" />
            <span>High-Velocity Replayer</span>
          </span>
          {skipInactive && pausesCompressed > 0 ? (
            <span className="text-slate-400">
              &bull; <strong className="text-emerald-400">{pausesCompressed}</strong> dead pauses compacted (<strong className="text-emerald-400">{timeSavedSec}s</strong> idle time saved)
            </span>
          ) : (
            <span className="text-slate-400">
              &bull; 1:1 Authentic Visitor Real-Time Timing
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {tabSwitches.length > 0 && (
            <span className="flex items-center gap-1 text-amber-400 font-bold">
              <Eye className="w-3.5 h-3.5" />
              <span>{tabSwitches.length} Tab Switch{tabSwitches.length > 1 ? 'es' : ''}</span>
            </span>
          )}
          {markers.some(m => m.severity === 'error' || m.event_type === 'rage_click') && (
            <span className="flex items-center gap-1 text-rose-400 font-bold">
              <Flame className="w-3.5 h-3.5" />
              <span>Friction Detected</span>
            </span>
          )}
        </div>
      </div>

      {/* Video Canvas Container (Desktop Browser Window or Mobile Phone Frame) */}
      <div className={`flex justify-center items-center bg-slate-950 overflow-hidden shadow-2xl transition-all relative ${
        detectedMobile ? 'rounded-[32px] border-[5px] border-slate-700/80 p-1.5 ring-1 ring-slate-600/30' : 'rounded-2xl border border-slate-800/80 p-2'
      }`}>
        {/* Mobile Camera Notch */}
        {detectedMobile && (
          <div className="absolute top-2.5 w-16 h-1 rounded-full bg-slate-600/70 z-10 pointer-events-none" />
        )}

        {/* DOM Replay Viewport */}
        <div ref={containerRef} className="rrweb-wrapper flex justify-center items-center" />
      </div>

      {/* ===================== MASTER REPLAY CONTROLLER & SCRUBBER ===================== */}
      <div className="w-full mt-3 bg-slate-900/95 border border-slate-800 rounded-2xl p-3 shadow-lg">
        
        {/* 1. Full-Width Interactive Timeline Scrubber with Event Marker Pins */}
        <div className="relative w-full mb-3 group">
          {/* Scrubber Hover Time Indicator */}
          {hoverPosition && (
            <div
              className="absolute -top-7 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow pointer-events-none z-30 border border-slate-700"
              style={{ left: `${hoverPosition.percent * 100}%` }}
            >
              {formatTime(hoverPosition.percent * totalDuration)}
            </div>
          )}

          {/* Scrubber Clickable Track */}
          <div
            ref={scrubberTrackRef}
            onClick={handleScrubberClick}
            onMouseMove={handleScrubberMouseMove}
            onMouseLeave={() => setHoverPosition(null)}
            className="relative h-3 bg-slate-950/80 rounded-full cursor-pointer overflow-visible flex items-center border border-slate-800/80 hover:border-slate-700 transition-colors"
          >
            {/* Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400 rounded-full transition-all duration-75 relative pointer-events-none"
              style={{ width: `${progressPercent}%` }}
            >
              {/* Playhead thumb */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(244,63,94,0.8)] ring-2 ring-rose-500" />
            </div>

            {/* Event Markers Overlay */}
            {markers.map((marker) => {
              const MetaIcon = marker.meta.icon;
              return (
                <div
                  key={marker.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeek(marker.activeOffset);
                  }}
                  onMouseEnter={() => setHoveredMarker(marker)}
                  onMouseLeave={() => setHoveredMarker(null)}
                  style={{ left: `${marker.percent}%` }}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full ring-2 ring-slate-900 z-20 cursor-pointer transition-transform hover:scale-150 ${marker.meta.dotColor}`}
                  title={`${marker.offset_formatted} - ${marker.label}`}
                />
              );
            })}
          </div>

          {/* Floating Marker Tooltip on Hover */}
          {hoveredMarker && (
            <div
              className="absolute -top-16 -translate-x-1/2 bg-[#0d131f] border border-slate-700 rounded-xl p-2 shadow-2xl z-40 pointer-events-none flex flex-col gap-1 min-w-[180px] max-w-[260px]"
              style={{ left: `${hoveredMarker.percent}%` }}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className={`px-1.5 py-0.5 rounded font-mono font-bold border ${hoveredMarker.meta.badgeBg}`}>
                  {hoveredMarker.meta.category}
                </span>
                <span className="font-mono text-slate-400 font-bold">
                  {hoveredMarker.offset_formatted}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-200 line-clamp-2 leading-tight">
                {hoveredMarker.label}
              </p>
            </div>
          )}
        </div>

        {/* 2. Controls Toolbar: Play/Pause, Jump, Speed Pills, Skip Idle Toggle, and Fullscreen */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Left: Playback & Step Controls */}
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            {/* Jump -10s */}
            <button
              onClick={() => handleStep(-10000)}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Jump Back 10s (Left Arrow)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Jump +10s */}
            <button
              onClick={() => handleStep(10000)}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Jump Forward 10s (Right Arrow)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Restart to Beginning */}
            <button
              onClick={() => handleSeek(0)}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[10px] font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Restart session from 00:00"
            >
              Restart
            </button>

            {/* Timecode HUD */}
            <div className="ml-2 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs font-bold text-slate-300">
              <span className="text-white">{formatTime(currentTime)}</span>
              <span className="text-slate-600 mx-1">/</span>
              <span className="text-slate-400">{formatTime(totalDuration)}</span>
            </div>
          </div>

          {/* Center: Dynamic Skip Inactivity Toggle Switch */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSkipInactive(prev => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                skipInactive
                  ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/50 shadow-sm'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
              title="Toggle automatic compression of dead inactivity pauses (Hotkey: M)"
            >
              {skipInactive ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Skip Inactivity: ON</span>
                  {pausesCompressed > 0 && (
                    <span className="text-[10px] font-mono text-emerald-400/80 ml-1">
                      (-{timeSavedSec}s)
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Real-Time (1:1)</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Playback Speed Pills & Fullscreen */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 hidden sm:inline">Speed:</span>
            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
              {[0.5, 1, 1.5, 2, 4, 8].map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer ${
                    playbackSpeed === s
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
