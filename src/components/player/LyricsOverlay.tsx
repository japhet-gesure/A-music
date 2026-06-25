import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { usePlayerStore } from "../../store/usePlayerStore";
import { fetchLyrics } from "../../services/lyricsService";
import { Maximize2, Minimize2, X, Move } from "lucide-react";
import { cn } from "../../lib/utils";

export function LyricsOverlay() {
  const { currentSong, isPlaying, currentTime, desktopLyrics, setDesktopLyrics, lyricsColor } = usePlayerStore();
  const [lyrics, setLyrics] = useState<{ text: string; time: number }[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync lyrics when song changes
  useEffect(() => {
    if (!currentSong || !desktopLyrics) return;
    
    // Use song lyrics if available, else try to fetch
    if (currentSong.lyrics && currentSong.lyrics.length > 0) {
      setLyrics(currentSong.lyrics);
    } else {
      fetchLyrics(currentSong.artist, currentSong.title, currentSong.duration).then((data) => {
        if (data) setLyrics(data);
        else setLyrics([]);
      });
    }
  }, [currentSong, desktopLyrics]);

  if (!desktopLyrics || !currentSong) return null;

  // Find current line
  const activeIndex = lyrics.findIndex((line, i) => {
    const nextLine = lyrics[i + 1];
    return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
  });

  const activeLineText = activeIndex >= 0 ? lyrics[activeIndex].text : currentSong.title;
  const nextLineText = activeIndex >= 0 && activeIndex + 1 < lyrics.length ? lyrics[activeIndex + 1].text : currentSong.artist;

  return (
    <AnimatePresence>
      <motion.div
        drag
        dragMomentum={false}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={cn(
          "fixed z-[9999] top-20 right-10 bg-black/80 p-4 rounded-3xl shadow-2xl backdrop-blur-xl border border-white/10 overflow-hidden text-white flex flex-col gap-3",
          isMinimized ? "w-64" : "w-80 min-h-32"
        )}
      >
        <div className="flex items-center justify-between cursor-grab active:cursor-grabbing pb-2 border-b border-white/5 handle">
          <div className="flex items-center gap-2 drag-handle opacity-50 hover:opacity-100 transition-opacity">
            <Move size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Lyrics</span>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <button onClick={() => setIsMinimized(!isMinimized)} className="text-white/50 hover:text-white transition-colors">
              {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>
            <button onClick={() => setDesktopLyrics(false)} className="text-white/50 hover:text-red-400 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 relative overflow-hidden flex-1 pointer-events-none">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeIndex + "active"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-lg font-black tracking-tight leading-tight"
              style={{ color: lyricsColor || '#fff' }}
            >
              {activeLineText || "..."}
            </motion.div>
          </AnimatePresence>
          
          {!isMinimized && (
            <AnimatePresence mode="popLayout">
              <motion.div
                key={activeIndex + "next"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                className="text-sm font-semibold tracking-tight leading-tight text-white/50 line-clamp-2"
              >
                {nextLineText || ""}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
