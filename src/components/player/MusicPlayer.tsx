import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, Mic2, LayoutList, X, SlidersHorizontal, Trash2, ChevronUp, ChevronDown, Info, GripVertical } from "lucide-react";
import { usePlayerStore, Song } from "../../store/usePlayerStore";
import { motion, AnimatePresence, Reorder } from "motion/react";
import React, { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player";
import { cn } from "../../lib/utils";
import { EqualizerControls } from "./EqualizerControls";
import { LyricsEditor } from "./LyricsEditor";
import { LikeButton } from "../LikeButton";
import { ArtistDetails } from "../ArtistDetails";

function FadingAudio({ src, volume, startTime }: { src?: string; volume: number; startTime: number }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  useEffect(() => {
    if (ref.current && startTime > 0) {
      ref.current.currentTime = startTime;
    }
  }, []);

  return <audio ref={ref} src={src} autoPlay crossOrigin="anonymous" />;
}

export function MusicPlayer() {
  const Player = ReactPlayer as any;
  const { 
    currentSong, isPlaying, volume, togglePlay, next, previous, 
    setVolume, equalizerSettings, lowDataMode, 
    currentTime, duration, setProgress, currentIndex, queue,
    shuffleMode, repeatMode, setShuffleMode, setRepeatMode,
    removeFromQueue, reorderQueue, setQueue, setSong, lastSeekTime,
    autoFetchLyrics, shuffleQueue,
    crossfadeEnabled, crossfadeDuration
  } = usePlayerStore();
  
  const hasNext = currentIndex < queue.length - 1;
  const hasPrev = currentIndex > 0;
  const [showLyrics, setShowLyrics] = useState(false);
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showArtistInfo, setShowArtistInfo] = useState(false);
  const [nowPlayingTab, setNowPlayingTab] = useState<"playing" | "queue">("playing");
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const filtersRef = useRef<Record<number, BiquadFilterNode>>({});
  
  const [fadingOutSong, setFadingOutSong] = useState<Song | null>(null);
  const [fadeOutVolume, setFadeOutVolume] = useState(1);
  const [fadeInVolume, setFadeInVolume] = useState(1); 
  const [fadeStartTime, setFadeStartTime] = useState(0);
  const lastSongRef = useRef<Song | null>(null);
  const crossfadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const startCrossfade = () => {
    if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
    
    setFadeInVolume(0);
    setFadeOutVolume(1);
    
    const duration = crossfadeDuration * 1000;
    const steps = 30;
    const interval = duration / steps;
    let currentStep = 0;

    crossfadeTimerRef.current = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // Use ease-in-out for smoother transition
      const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      
      setFadeOutVolume(1 - easeProgress);
      setFadeInVolume(easeProgress);

      if (currentStep >= steps) {
        if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
        setFadingOutSong(null);
        setFadeInVolume(1);
      }
    }, interval);
  };

  // Triggered when currentSong changes
  useEffect(() => {
    if (currentSong && lastSongRef.current && lastSongRef.current.id !== currentSong.id && isPlaying) {
      if (crossfadeEnabled) {
        const prev = lastSongRef.current;
        setFadingOutSong(prev);
        setFadeStartTime(currentTime);
        setFadeInVolume(0);
        setFadeOutVolume(1);
      } else {
        // Just clear any fading song if disabled
        setFadingOutSong(null);
        setFadeInVolume(1);
      }
    }
    lastSongRef.current = currentSong;
  }, [currentSong?.id, crossfadeEnabled]);

  // Cleanup crossfade timer on unmount
  useEffect(() => {
    return () => {
      if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
    };
  }, []);

  // Near end trigger for crossfade
  useEffect(() => {
    if (isPlaying && duration > 0 && crossfadeEnabled && currentTime >= duration - crossfadeDuration && !fadingOutSong) {
      const { repeatMode, currentIndex, queue } = usePlayerStore.getState();
      if (currentIndex < queue.length - 1 || repeatMode === "all") {
        next();
      }
    }
  }, [currentTime, duration, isPlaying, fadingOutSong, crossfadeEnabled, crossfadeDuration]);

  // Handle global seek requests from lastSeekTime
  const lastProcessedSeekRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastSeekTime !== null && lastSeekTime !== lastProcessedSeekRef.current) {
      if (currentSong?.source === "local" && audioRef.current) {
        audioRef.current.currentTime = lastSeekTime;
      }
      if (currentSong?.source === "youtube" && playerRef.current) {
        playerRef.current?.seekTo?.(lastSeekTime, 'seconds');
      }
      setProgress(lastSeekTime);
      lastProcessedSeekRef.current = lastSeekTime;
    }
  }, [lastSeekTime, currentSong?.id]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedPercentage = x / rect.width;
    const newTime = clickedPercentage * (duration || 1);
    
    // Use the store's central seek mechanism to ensure visibility
    usePlayerStore.getState().seekTo(newTime);
  };

  const playerRef = useRef<any>(null);
  const lastSongIdRef = useRef<string | null>(null);

  // Reset progress when song changes and fetch lyrics
  useEffect(() => {
    if (currentSong) {
      // Only reset progress if it's a NEW song being selected, not just rehydrated
      if (lastSongIdRef.current !== null && lastSongIdRef.current !== currentSong.id) {
        setProgress(0, currentSong.duration || 215);
      }
      
      lastSongIdRef.current = currentSong.id;
    }
  }, [currentSong?.id]);

  // Handle Seek for ReactPlayer
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function' && currentSong?.source === "youtube") {
      // If the difference is large (manual seek), sync the player
      const playerTime = typeof playerRef.current.getCurrentTime === 'function' ? playerRef.current.getCurrentTime() : 0;
      if (Math.abs(playerTime - currentTime) > 2) {
        playerRef.current.seekTo(currentTime, 'seconds');
      }
    }
  }, [currentTime, currentSong?.source]);

  // Handle local audio playback
  useEffect(() => {
    let mounted = true;
    if (currentSong?.source === "local" && audioRef.current) {
      audioRef.current.volume = volume * fadeInVolume;
      if (isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (!mounted) return;
            // Auto-play might be blocked or interrupted (e.g., by pause() or removal from DOM)
            const isBenign = 
              error.name === "AbortError" || 
              error.name === "NotAllowedError" || 
              error.message?.includes("interrupted");
            
            if (!isBenign) {
              console.warn("Playback failed:", error);
            }
          });
        }
      } else {
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    } else if (audioRef.current) {
      // If we're not on a local source, make sure the native audio is totally stopped
      if (!audioRef.current.paused) {
        audioRef.current.pause();
      }
      // Re-setting src to undefined in the component render will already handle clearing,
      // but explicitly pausing here ensures no race conditions.
    }
    return () => { mounted = false; };
  }, [isPlaying, currentSong?.id, currentSong?.source, volume, fadeInVolume]);

  // Initialize Web Audio API
  useEffect(() => {
    if (currentSong?.source === "local" && audioRef.current) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioCtx = audioContextRef.current;
      
      // Only create source node once per audio element
      if (!sourceRef.current && audioRef.current) {
        try {
          sourceRef.current = audioCtx.createMediaElementSource(audioRef.current);
        } catch (err) {
          console.warn("Web Audio source creation failed:", err);
        }
      }

      if (sourceRef.current) {
        try {
          // Disconnect existing nodes if any
          sourceRef.current.disconnect();
          
          // Create or Update filter chain
          const freqs = [60, 230, 910, 4000, 14000];
          let lastNode: AudioNode = sourceRef.current;

          freqs.forEach((freq) => {
            // Re-use or create filters
            let filter = filtersRef.current[freq];
            if (!filter) {
              filter = audioCtx.createBiquadFilter();
              filter.type = "peaking";
              filter.frequency.value = freq;
              filter.Q.value = 1;
              filtersRef.current[freq] = filter;
            }
            filter.gain.value = equalizerSettings[freq as keyof typeof equalizerSettings];
            
            lastNode.connect(filter);
            lastNode = filter;
          });

          // Analyser setup
          if (!analyserRef.current) {
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.85;
            analyserRef.current = analyser;
          }
          
          lastNode.connect(analyserRef.current);
          analyserRef.current.connect(audioCtx.destination);
        } catch (err) {
          console.warn("Web Audio connection update failed:", err);
        }
      }
    }
  }, [currentSong?.id, currentSong?.source]); 

  // Update filter gains when settings change
  useEffect(() => {
    Object.entries(equalizerSettings).forEach(([freq, gain]) => {
      const filter = filtersRef.current[parseInt(freq)];
      if (filter) {
        filter.gain.setTargetAtTime(gain, audioContextRef.current?.currentTime || 0, 0.1);
      }
    });
  }, [equalizerSettings]);

  return (
    <div id="player-outer" className="h-full relative flex flex-col justify-center px-8">
      {/* Background Player Elements - Always mounted when song exists to avoid removal errors */}
      {currentSong && (currentSong.source === "youtube" || currentSong.source === "cloud" || currentSong.source === "spotify") && (
        <div className="absolute left-0 top-0 opacity-0 pointer-events-none -z-50 w-[64px] h-[64px] overflow-hidden">
           <Player
             ref={playerRef}
             url={currentSong.source === "youtube" 
               ? `https://www.youtube.com/watch?v=${currentSong.sourceId}`
               : (currentSong.localUrl || `https://www.youtube.com/watch?v=${currentSong.sourceId}`)
             }
             playing={isPlaying}
             volume={volume * fadeInVolume}
             muted={false}
             playsinline={true}
             onProgress={(state: any) => {
               setProgress(state.playedSeconds);
               if (duration === 0 && playerRef.current) {
                 const d = playerRef.current.getDuration();
                 if (d) setProgress(state.playedSeconds, d);
               }
             }}
             onReady={(player: any) => {
               const d = player.getDuration();
               if (d) setProgress(currentTime, d);
               // Start crossfade when new song is ready
               if (fadingOutSong) {
                 startCrossfade();
               }
             }}
             onError={(e: any) => {
               console.error("YouTube Player Error:", e);
               if (isPlaying) {
                 setTimeout(next, 2000);
               }
             }}
             onEnded={next}
             config={{
               youtube: {
                 playerVars: { 
                   autoplay: 1,
                   modestbranding: 1,
                   controls: 0,
                   rel: 0,
                   showinfo: 0,
                   iv_load_policy: 3,
                   origin: typeof window !== 'undefined' ? window.location.origin : '',
                   vq: lowDataMode ? 'tiny' : 'hd720'
                 }
               }
             } as any}
           />
        </div>
      )}

      {/* Native Audio Player (Persistent to prevent removal errors) */}
      <audio
        src={currentSong?.source === "local" ? (currentSong.localUrl || undefined) : undefined}
        ref={audioRef}
        onTimeUpdate={(e) => {
          if (currentSong?.source === "local") {
            setProgress(e.currentTarget.currentTime);
          }
        }}
        onLoadedMetadata={(e) => {
          if (currentSong?.source === "local") {
            setProgress(e.currentTarget.currentTime, e.currentTarget.duration);
            // Start crossfade for local files
            if (fadingOutSong) {
              startCrossfade();
            }
          }
        }}
        onEnded={next}
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Fading Out Player */}
      <AnimatePresence>
        {fadingOutSong && (
          <div key={`fade-out-${fadingOutSong.id}`} className="absolute left-0 top-0 opacity-0 pointer-events-none -z-50 w-0 h-0 overflow-hidden">
            {(fadingOutSong.source === "youtube" || fadingOutSong.source === "cloud" || fadingOutSong.source === "spotify") ? (
              <Player
                url={fadingOutSong.source === "youtube" 
                  ? `https://www.youtube.com/watch?v=${fadingOutSong.sourceId}`
                  : (fadingOutSong.localUrl || `https://www.youtube.com/watch?v=${fadingOutSong.sourceId}`)
                }
                playing={true}
                volume={volume * fadeOutVolume}
                muted={false}
                playsinline={true}
                onReady={(p: any) => {
                  p.seekTo(fadeStartTime);
                }}
                config={{
                  youtube: {
                    playerVars: { autoplay: 1, controls: 0 }
                  }
                } as any}
              />
            ) : fadingOutSong.source === "local" ? (
              <FadingAudio 
                src={fadingOutSong.localUrl || undefined} 
                volume={volume * fadeOutVolume} 
                startTime={fadeStartTime} 
              />
            ) : null}
          </div>
        )}
      </AnimatePresence>

      {!currentSong ? (
        <div id="player-empty" className="h-full flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-xs italic">
          Select a sonic signature to begin
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
          {/* Song Info */}
          <div className="flex items-center gap-5 w-1/4">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 shadow-2xl overflow-hidden shrink-0 border border-white/10 relative group/thumb">
              <img 
                src={(lowDataMode && currentSong.thumbnail) ? currentSong.thumbnail.replace('h=300', 'h=50') : (currentSong.thumbnail || undefined)} 
                alt={currentSong.title} 
                className={cn("w-full h-full object-cover transition-all duration-500 group-hover/thumb:scale-110", lowDataMode && "opacity-50")} 
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                <ChevronUp size={20} className="text-white drop-shadow-md" />
              </div>
              {lowDataMode && (
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-black italic tracking-tighter text-purple-400">LDM</div>
                </div>
              )}
            </div>
            <div className="overflow-hidden space-y-1">
              <div className="flex items-center gap-3">
                <h5 className="text-[16px] font-black tracking-tight truncate leading-tight">{currentSong.title}</h5>
                <div className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded shrink-0">
                  <span className="text-[8px] font-black text-purple-400 uppercase tracking-tighter">{currentSong.source}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowArtistInfo(true)}
                  className="text-[13px] text-white/40 font-bold truncate uppercase tracking-wider hover:text-purple-400 transition-colors flex items-center gap-1.5 group/art"
                >
                  {currentSong.artist}
                  <Info size={11} className="opacity-0 group-hover/art:opacity-100 transition-opacity" />
                </button>
                <LikeButton targetId={currentSong.id} type="song" size={18} className="shrink-0" />
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 flex-1 pt-2">
            {/* Progress row - Now on top */}
            <div className="flex items-center gap-4 text-[10px] font-mono font-black text-white/20 w-full max-w-[500px] px-4">
              <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
              <div className="relative flex-1 h-1.5 flex items-center group cursor-pointer">
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 1} 
                  step="0.1"
                  value={currentTime} 
                  onChange={(e) => {
                    const newTime = parseFloat(e.target.value);
                    if (currentSong?.source === "local" && audioRef.current) {
                      audioRef.current.currentTime = newTime;
                    }
                    if (currentSong?.source === "youtube" && playerRef.current) {
                      playerRef.current?.seekTo?.(newTime, 'seconds');
                    }
                    setProgress(newTime);
                  }}
                  className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <div className="w-full h-full bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-600 to-purple-400 relative transition-all duration-150 group-hover:from-purple-500 group-hover:to-pink-500" 
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                </div>
                <motion.div 
                  className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.6)] opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-30 border-2 border-purple-500"
                  style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 7px)` }}
                />
              </div>
              <span className="w-10 tabular-nums">{formatTime(duration)}</span>
            </div>

            {/* Controls row - Now below */}
            <div className="flex items-center gap-6">
              <motion.button 
                whileHover={{ scale: 1.2, rotate: -15, filter: "brightness(1.5)" }}
                whileTap={{ scale: 0.85 }}
                onClick={() => setShuffleMode(!shuffleMode)}
                className={cn(
                  "transition-all p-2 rounded-xl border", 
                  shuffleMode 
                    ? "text-purple-400 bg-purple-500/10 border-purple-500/30 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)] shadow-[inset_0_0_20px_rgba(168,85,247,0.2)]" 
                    : "text-white/20 border-transparent hover:text-white/40 hover:bg-white/5"
                )}
                title="Shuffle"
              >
                <Shuffle size={16} className={cn(shuffleMode && "drop-shadow-[0_0_8px_currentColor]")} />
              </motion.button>
              
              <div className="flex items-center gap-5 bg-white/[0.03] rounded-[1.5rem] px-6 py-2 border border-white/10 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative group/controls">
                {/* Dynamic Aura */}
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/10 to-indigo-600/10 rounded-[1.5rem] blur-xl opacity-0 group-hover/controls:opacity-100 transition-opacity duration-700" />
                
                <motion.button 
                  whileHover={hasPrev ? { scale: 1.25, x: -3, rotate: -5 } : {}}
                  whileTap={hasPrev ? { scale: 0.9 } : {}}
                  onClick={previous} 
                  disabled={!hasPrev}
                  className={cn(
                    "transition-all p-2 rounded-full relative z-10", 
                    hasPrev 
                      ? "text-white/70 hover:text-white hover:bg-white/10" 
                      : "text-white/5 cursor-not-allowed"
                  )}
                  title="Previous"
                >
                  <SkipBack size={20} fill="currentColor" />
                </motion.button>
                
                <motion.button 
                  whileHover={{ scale: 1.1, boxShadow: "0 0 50px rgba(168,85,247,0.4)" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={async () => {
                    if (audioContextRef.current?.state === "suspended") {
                      await audioContextRef.current.resume();
                    }
                    togglePlay();
                  }}
                  className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center transition-all relative overflow-hidden group/play border-[4px] z-10",
                      isPlaying 
                        ? "bg-gradient-to-br from-white to-zinc-400 text-black shadow-[0_20px_50px_rgba(255,255,255,0.2)] border-white/30" 
                        : "bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-[0_20px_50px_rgba(168,85,247,0.4)] border-indigo-500/40"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover/play:opacity-100 transition-opacity" />
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={isPlaying ? "pause" : "play"}
                      initial={{ opacity: 0, scale: 0.3, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.3, y: -10 }}
                      transition={{ type: "spring", stiffness: 600, damping: 15 }}
                      className="flex items-center justify-center h-full w-full relative z-10"
                    >
                      {isPlaying ? (
                          <Pause size={28} fill="currentColor" className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]" />
                      ) : (
                          <Play size={28} fill="currentColor" className="ml-1.5 drop-shadow-[0_2px_15px_rgba(0,0,0,0.3)]" />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.button>
                
                <motion.button 
                  whileHover={(hasNext || repeatMode === "all") ? { scale: 1.25, x: 3, rotate: 5 } : {}}
                  whileTap={(hasNext || repeatMode === "all") ? { scale: 0.9 } : {}}
                  onClick={next} 
                  disabled={!hasNext && repeatMode !== "all"}
                  className={cn(
                    "transition-all p-2 rounded-full relative z-10", 
                    (hasNext || repeatMode === "all") 
                      ? "text-white/70 hover:text-white hover:bg-white/10" 
                      : "text-white/5 cursor-not-allowed"
                  )}
                  title="Next"
                >
                  <SkipForward size={20} fill="currentColor" />
                </motion.button>
              </div>
              
              <motion.button 
                whileHover={{ scale: 1.2, rotate: 15, filter: "brightness(1.5)" }}
                whileTap={{ scale: 0.85 }}
                onClick={() => {
                  const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
                  const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
                  setRepeatMode(nextMode);
                }}
                className={cn(
                  "transition-all p-2 rounded-xl border relative", 
                  repeatMode !== "off" 
                    ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/30 drop-shadow-[0_0_15px_rgba(99,102,241,0.4)] shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]" 
                    : "text-white/20 border-transparent hover:text-white/40 hover:bg-white/5"
                )}
                title={`Repeat: ${repeatMode}`}
              >
                <Repeat size={16} className={cn(repeatMode !== "off" && "drop-shadow-[0_0_10px_currentColor]")} />
                {repeatMode === "one" && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 text-[9px] font-black bg-indigo-500 text-white w-5 h-5 rounded-full flex items-center justify-center shadow-2xl border-2 border-indigo-400 z-20"
                  >
                    1
                  </motion.span>
                )}
              </motion.button>
            </div>
          </div>

          {/* System & Output Controls */}
          <div className="flex items-center gap-6 w-1/4 justify-end">
            <div className="flex items-center p-1.5 bg-white/[0.03] rounded-2xl border border-white/10 backdrop-blur-3xl shadow-xl">
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <button 
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setShowEQ(!showEQ)}
                    className={cn(
                      "p-2.5 rounded-xl transition-all", 
                      showEQ 
                        ? "bg-purple-500 text-white shadow-[0_0_25px_rgba(168,85,247,0.6)] scale-110" 
                        : "text-white/30 hover:text-white hover:bg-white/10"
                    )}
                    title="Equalizer"
                  >
                    <SlidersHorizontal size={16} className={cn(showEQ && "drop-shadow-[0_0_8px_currentColor]")} />
                  </button>
                  <AnimatePresence>
                    {showEQ && <EqualizerControls analyser={analyserRef.current} onClose={() => setShowEQ(false)} />}
                  </AnimatePresence>
                </div>
                <button 
                  onClick={() => {
                    if (!showLyrics && currentSong && (!currentSong.lyrics || currentSong.lyrics.length === 0)) {
                      autoFetchLyrics(currentSong.id, currentSong.artist, currentSong.title);
                    }
                    setShowLyrics(!showLyrics);
                  }}
                  className={cn(
                    "p-2.5 rounded-xl transition-all", 
                    showLyrics 
                      ? "bg-pink-500 text-white shadow-[0_0_25px_rgba(236,72,153,0.6)] scale-110" 
                      : "text-white/30 hover:text-white hover:bg-white/10"
                  )}
                  title="Lyrics"
                >
                  <Mic2 size={16} className={cn(showLyrics && "drop-shadow-[0_0_8px_currentColor]")} />
                </button>
                <button 
                  onClick={() => setShowNowPlaying(!showNowPlaying)}
                  className={cn(
                    "p-2.5 rounded-xl transition-all", 
                    showNowPlaying 
                      ? "bg-blue-600 text-white shadow-[0_0_25px_rgba(37,99,235,0.6)] scale-110" 
                      : "text-white/30 hover:text-white hover:bg-white/10"
                  )}
                  title="Fullscreen View"
                >
                  <LayoutList size={20} className={cn(showNowPlaying && "drop-shadow-[0_0_8px_currentColor]")} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 group px-4 py-3 bg-white/[0.02] rounded-2xl border border-transparent hover:border-white/10 transition-all shadow-lg hover:bg-white/[0.04]">
              <Volume2 size={18} className="text-white/30 group-hover:text-white transition-all group-hover:drop-shadow-[0_0_10px_white]" />
              <div className="w-28 h-2 bg-white/5 rounded-full relative cursor-pointer overflow-hidden border border-white/5">
                <input 
                  type="range" 
                  min="0" max="1" step="0.01" 
                  value={volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/40 to-white group-hover:from-purple-600 group-hover:to-blue-400 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
                  style={{ width: `${volume * 100}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

      {/* Now Playing Prominent View */}
      <AnimatePresence>
        {showNowPlaying && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-[450px] bg-[#0F0F12] border-l border-white/5 z-50 shadow-2xl p-8 flex flex-col pt-24"
          >
             <button 
                onClick={() => setShowNowPlaying(false)}
                className="absolute top-8 left-8 text-white/30 hover:text-white transition-colors"
             >
                <X size={24} />
             </button>

             <div className="flex bg-white/5 rounded-full p-1 mb-12">
               <button 
                 onClick={() => setNowPlayingTab("playing")}
                 className={cn(
                   "flex-1 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                   nowPlayingTab === "playing" ? "bg-white text-black" : "text-white/40 hover:text-white"
                 )}
               >
                 Now Playing
               </button>
               <button 
                 onClick={() => setNowPlayingTab("queue")}
                 className={cn(
                   "flex-1 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                   nowPlayingTab === "queue" ? "bg-white text-black" : "text-white/40 hover:text-white"
                 )}
               >
                 Queue ({queue.length})
               </button>
             </div>

             <AnimatePresence mode="wait">
               {nowPlayingTab === "playing" ? (
                 <motion.div 
                   key="playing"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   className="flex-1 flex flex-col justify-center gap-12"
                 >
                    <div className="relative aspect-square w-full rounded-[2.5rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 ring-1 ring-white/10">
                       <img 
                         src={currentSong.thumbnail || undefined} 
                         alt={currentSong.title} 
                         className="w-full h-full object-cover"
                         onError={(e) => {
                           (e.target as any).src = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop";
                         }}
                       />
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-4">
                          <h2 className="text-4xl font-black italic tracking-tighter text-white leading-tight">{currentSong.title}</h2>
                          <button 
                            onClick={() => setShowArtistInfo(true)}
                            className="text-xl text-purple-400 font-bold uppercase tracking-widest hover:text-white transition-colors"
                          >
                            {currentSong.artist}
                          </button>
                       </div>
                       
                       <div className="space-y-3">
                          <div className="flex items-center justify-between text-[10px] font-mono font-black text-white/40 tracking-[0.2em]">
                             <span>{formatTime(currentTime)}</span>
                             <span>{formatTime(duration)}</span>
                          </div>
                          <div className="relative w-full h-2 flex items-center group cursor-pointer">
                            <input 
                              type="range" 
                              min="0" 
                              max={duration || 1} 
                              step="0.1"
                              value={currentTime} 
                              onChange={(e) => {
                                const newTime = parseFloat(e.target.value);
                                if (currentSong?.source === "local" && audioRef.current) {
                                  audioRef.current.currentTime = newTime;
                                }
                                if (currentSong?.source === "youtube" && playerRef.current) {
                                  playerRef.current?.seekTo?.(newTime, 'seconds');
                                }
                                setProgress(newTime);
                              }}
                              className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                              <div 
                                className="h-full bg-purple-500 relative transition-all duration-100 group-hover:bg-purple-400" 
                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                              />
                            </div>
                            <div 
                              className="absolute w-4 h-4 bg-white rounded-full shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border-4 border-purple-500"
                              style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)` }}
                            />
                          </div>
                       </div>

                       <div className="flex items-center gap-2">
                          <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">{currentSong.source} SIGNAL</span>
                          </div>
                          {currentSong.duration && (
                            <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                               <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                                 {formatTime(currentSong.duration)}
                               </span>
                            </div>
                          )}
                       </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 mt-auto">
                       <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-4">Acoustic fingerprint</p>
                       <div className="flex items-end gap-1 h-12">
                          {[...Array(24)].map((_, i) => (
                            <motion.div 
                              key={i}
                              animate={{ height: isPlaying ? [10, 48, 15, 30, 10] : 10 }}
                              transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.05 }}
                              className="flex-1 bg-purple-500/30 rounded-t-full"
                            />
                          ))}
                       </div>
                    </div>
                 </motion.div>
               ) : (
                 <motion.div 
                   key="queue"
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   className="flex-1 flex flex-col overflow-hidden"
                 >
                   <div className="mb-6 flex items-center justify-between px-1">
                     <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Up Next</p>
                     <button 
                       onClick={shuffleQueue}
                       className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95 group/shuffle"
                       title="Shuffle Queue"
                     >
                        <Shuffle size={12} className="group-hover/shuffle:rotate-12 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Shuffle</span>
                     </button>
                   </div>
                   <Reorder.Group 
                     axis="y" 
                     values={queue} 
                     onReorder={setQueue}
                     className="flex-1 overflow-y-auto space-y-2 pr-2 scroll-hide"
                   >
                     {queue.map((song, index) => (
                       <Reorder.Item 
                         value={song}
                         key={song.id}
                          className={cn(
                            "group flex items-center gap-4 p-3 rounded-2xl border transition-all relative cursor-grab active:cursor-grabbing",
                            index === currentIndex ? "bg-white/5 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.1)]" : 
                            index === currentIndex + 1 ? "bg-white/5 border-blue-500/20" : 
                            "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
                          )}
                       >
                         <div className="flex items-center gap-1 shrink-0">
                           <div className="text-white/10 group-hover:text-white/30 transition-colors">
                             <GripVertical size={16} />
                           </div>
                           <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden">
                             <img src={song.thumbnail || undefined} className="w-full h-full object-cover" />
                             {index === currentIndex && (
                               <div className="absolute inset-0 bg-purple-600/40 flex items-center justify-center">
                                 <div className="flex items-baseline gap-0.5">
                                   {[1,2,3].map(i => (
                                     <motion.div 
                                       key={i}
                                       animate={{ height: [4, 12, 4] }}
                                       transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                                       className="w-1 bg-white rounded-full"
                                     />
                                   ))}
                                 </div>
                               </div>
                             )}
                           </div>
                         </div>

                          <div className="flex-1 min-w-0 pr-2">
                             <div className="flex items-center gap-2 mb-0.5">
                                <h4 className={cn(
                                  "text-sm font-bold truncate", 
                                  index === currentIndex ? "text-purple-400" : index === currentIndex + 1 ? "text-blue-400" : "text-white"
                                )}>
                                  {song.title}
                                </h4>
                                {index === currentIndex && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-500 text-[6px] font-black uppercase text-white tracking-[0.2em] shrink-0">Current</span>
                                )}
                                {index === currentIndex + 1 && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[6px] font-black uppercase text-blue-400 border border-blue-500/30 tracking-[0.2em] shrink-0">Next Up</span>
                                )}
                             </div>
                             <p className="text-[10px] text-white/40 uppercase font-medium tracking-wider truncate">{song.artist}</p>
                          </div>

                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 relative">
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               removeFromQueue(song.id);
                             }}
                             className="p-2 text-zinc-600 hover:text-red-500 transition-colors pointer-events-auto"
                             title="Remove"
                           >
                             <Trash2 size={16} />
                           </button>
                         </div>
                         
                          {index !== currentIndex && (
                            <button 
                              onClick={() => setSong(song)}
                              className="absolute inset-0 z-0 pr-12"
                            />
                          )}
                       </Reorder.Item>
                     ))}
                   </Reorder.Group>
                 </motion.div>
               )}
             </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lyrics Overlay */}
      <AnimatePresence>
        {showLyrics && (
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 bottom-24 bg-[#0A0A0C] z-40 p-12 lg:p-24 flex flex-col items-center overflow-y-auto"
          >
             {/* Background Atmosphere */}
             <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />
             
              <button 
                onClick={() => setShowLyrics(false)}
                className="absolute top-8 right-8 w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all z-50 overflow-hidden"
             >
                <X size={24} />
             </button>

             {!showLyricsEditor && (
               <button 
                 onClick={() => setShowLyricsEditor(true)}
                 className="absolute top-8 right-28 px-6 h-14 rounded-full bg-white/5 border border-white/10 flex items-center gap-3 hover:bg-white/10 transition-all z-50 text-[10px] font-black uppercase tracking-widest italic"
               >
                 <Mic2 size={16} />
                 Edit Lyrics
               </button>
             )}

             <motion.div 
               animate={{ x: showLyricsEditor ? "-100%" : 0 }}
               className="max-w-4xl w-full pt-10 space-y-16 pb-40 z-10 h-full overflow-y-auto scroll-hide"
             >
                <div className="flex flex-col md:flex-row items-center gap-12 text-center md:text-left">
                   <motion.img 
                     initial={{ rotate: -5, scale: 0.9 }}
                     animate={{ rotate: 0, scale: 1 }}
                     src={currentSong.thumbnail || undefined} 
                     className="w-48 h-48 rounded-3xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] border border-white/10" 
                   />
                   <div>
                      <h1 className="text-4xl font-black mb-4 tracking-tighter italic">{currentSong.title}</h1>
                      <p className="text-xl text-purple-400 font-bold uppercase tracking-widest">{currentSong.artist}</p>
                   </div>
                </div>
                
                <div className="space-y-10 text-5xl font-black italic tracking-tighter text-white/5">
                   {currentSong.lyrics && currentSong.lyrics.length > 0 ? (
                     currentSong.lyrics.map((line, i) => {
                       const isActive = line.time > 0 && currentTime >= line.time && (i === currentSong.lyrics!.length - 1 || currentTime < currentSong.lyrics![i+1].time);
                       return (
                         <motion.p 
                           key={i} 
                           animate={{ 
                             color: isActive ? "#ffffff" : "rgba(255,255,255,0.05)",
                             scale: isActive ? 1.05 : 1,
                             x: isActive ? 16 : 0
                           }}
                           className={cn(
                             "transition-all duration-500 cursor-pointer origin-left",
                             isActive ? "drop-shadow-[0_0_30px_rgba(168,85,247,0.3)]" : "hover:text-white/20"
                           )}
                           onClick={() => {
                             if (line.time > 0) {
                               if (currentSong?.source === "local" && audioRef.current) audioRef.current.currentTime = line.time;
                               setProgress(line.time);
                             }
                           }}
                         >
                           {line.text}
                         </motion.p>
                       );
                     })
                   ) : (
                     <div className="py-20 flex flex-col items-center">
                        <p className="text-zinc-800 mb-12 text-7xl uppercase opacity-20 select-none">No Lyrics Found</p>
                        <button 
                           onClick={() => setShowLyricsEditor(true)}
                           className="px-12 py-5 bg-white text-black rounded-full font-black uppercase italic tracking-tighter hover:bg-zinc-200 transition-all flex items-center gap-4 text-sm"
                        >
                           <Mic2 size={20} />
                           Synthesize Lyrics
                        </button>
                     </div>
                   )}
                </div>
             </motion.div>

             <AnimatePresence>
               {showLyricsEditor && (
                 <motion.div 
                   initial={{ x: "100%" }}
                   animate={{ x: 0 }}
                   exit={{ x: "100%" }}
                   className="fixed inset-y-0 right-0 w-full lg:w-1/2 z-[60]"
                 >
                   <LyricsEditor onClose={() => setShowLyricsEditor(false)} />
                 </motion.div>
               )}
             </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <ArtistDetails artistName={currentSong.artist} isOpen={showArtistInfo} onClose={() => setShowArtistInfo(false)} />
        </>
      )}
    </div>
  );
}
