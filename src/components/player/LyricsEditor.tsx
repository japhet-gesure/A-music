import React, { useState, useEffect, useRef } from "react";
import { X, Save, Play, Pause, CheckCircle2, Sparkles, Loader2, Plus, Trash2 } from "lucide-react";
import { LyricLine, usePlayerStore } from "../../store/usePlayerStore";
import { getTrack, saveTrack } from "../../lib/offlineStorage";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface LyricsEditorProps {
  onClose: () => void;
}

export function LyricsEditor({ onClose }: LyricsEditorProps) {
  const { currentSong, currentTime, isPlaying, togglePlay, updateSongLyrics, autoFetchLyrics } = usePlayerStore();
  const [isFetching, setIsFetching] = useState(false);
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [mode, setMode] = useState<"edit" | "sync">("edit");
  const [activeSyncIndex, setActiveSyncIndex] = useState(0);
  const [fetchStatus, setFetchStatus] = useState<"idle" | "success" | "not_found" | "error">("idle");

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentlyPlayingIndex = lines.reduce((acc, line, i) => {
    if (line.time > 0 && currentTime >= line.time) {
      return i;
    }
    return acc;
  }, -1);

  useEffect(() => {
    if (fetchStatus !== "idle") {
      const timer = setTimeout(() => setFetchStatus("idle"), 3000);
      return () => clearTimeout(timer);
    }
  }, [fetchStatus]);

  useEffect(() => {
    if (currentlyPlayingIndex !== -1 && scrollContainerRef.current) {
      const activeElement = scrollContainerRef.current.children[currentlyPlayingIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentlyPlayingIndex]);

  useEffect(() => {
    if (currentSong?.lyrics) {
      setLines(currentSong.lyrics);
    }
  }, [currentSong]);

  const updateLineText = (index: number, text: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], text };
    setLines(newLines);
  };

  const addLine = (index?: number) => {
    const newLines = [...lines];
    const insertAt = index !== undefined ? index + 1 : newLines.length;
    newLines.splice(insertAt, 0, { text: "", time: 0 });
    setLines(newLines);
  };

  const removeLine = (index: number) => {
    const newLines = lines.filter((_, i) => i !== index);
    setLines(newLines);
  };

  const syncCurrentLine = () => {
    if (activeSyncIndex >= lines.length) return;
    
    const newLines = [...lines];
    newLines[activeSyncIndex].time = currentTime;
    setLines(newLines);
    setActiveSyncIndex(activeSyncIndex + 1);
  };

  const handleSave = async () => {
    if (!currentSong) return;
    
    // Save to store
    updateSongLyrics(currentSong.id, lines);
    
    // Save to IndexedDB if it's a local track
    const offlineTrack = await getTrack(currentSong.id);
    if (offlineTrack) {
      offlineTrack.metadata.lyrics = lines;
      await saveTrack(offlineTrack);
    }
    
    onClose();
  };

  const handleAutoFetch = async () => {
    if (!currentSong) return;
    setIsFetching(true);
    setFetchStatus("idle");
    try {
      const { queue } = usePlayerStore.getState();
      const songBefore = queue.find(s => s.id === currentSong.id);
      const lyricsBefore = songBefore?.lyrics;
      
      await autoFetchLyrics(currentSong.id, currentSong.artist, currentSong.title);
      
      // Need to check if lyrics were actually updated in the store
      const { queue: updatedQueue } = usePlayerStore.getState();
      const songAfter = updatedQueue.find(s => s.id === currentSong.id);
      
      if (songAfter?.lyrics && songAfter.lyrics.length > 0 && songAfter.lyrics !== lyricsBefore) {
        setLines(songAfter.lyrics);
        setFetchStatus("success");
      } else {
        setFetchStatus("not_found");
      }
    } catch (err) {
      console.error(err);
      setFetchStatus("error");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0F0F12] border-l border-white/5 p-8 overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-black italic tracking-tighter uppercase">Lyrics Editor</h2>
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {isFetching && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-purple-400 font-mono"
              >
                <Loader2 size={12} className="animate-spin" />
                <span>Fetching from spectrum...</span>
              </motion.div>
            )}
            {!isFetching && fetchStatus !== "idle" && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                  fetchStatus === "success" && "text-green-400 border-green-500/20 bg-green-500/10",
                  fetchStatus === "not_found" && "text-yellow-400 border-yellow-500/20 bg-yellow-500/10",
                  fetchStatus === "error" && "text-red-400 border-red-500/20 bg-red-500/10"
                )}
              >
                {fetchStatus === "success" ? "Lyrics Found!" : fetchStatus === "not_found" ? "No Lyrics Found" : "Search Error"}
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={handleAutoFetch}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-full border border-purple-500/20 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
          >
            {isFetching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {isFetching ? "Searching..." : "Auto Fetch"}
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex bg-white/5 rounded-full p-1 mb-8">
        <button 
          onClick={() => setMode("edit")}
          className={cn(
            "flex-1 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all",
            mode === "edit" ? "bg-white text-black" : "text-white/40 hover:text-white"
          )}
        >
          Edit Text
        </button>
        <button 
          onClick={() => setMode("sync")}
          className={cn(
            "flex-1 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all",
            mode === "sync" ? "bg-white text-black" : "text-white/40 hover:text-white"
          )}
        >
          Sync Time
        </button>
      </div>

      {mode === "edit" ? (
        <div className="flex-1 overflow-y-auto mb-8 pr-2 scroll-hide flex flex-col gap-3">
          {lines.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl p-12">
              <p className="text-lg font-black italic mb-4">No Lyrics Yet</p>
              <button 
                onClick={() => addLine()}
                className="px-6 py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-full font-black uppercase tracking-widest transition-all"
              >
                Add Your First Line
              </button>
            </div>
          )}
          {lines.map((line, index) => (
            <motion.div 
              layout
              key={index} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 group"
            >
              <div className="text-[10px] font-mono text-white/10 w-6 text-right font-black italic">{index + 1}</div>
              <input 
                className="flex-1 bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/5 rounded-2xl px-4 py-3 text-lg font-medium focus:outline-none focus:border-dashed focus:border-purple-500/50 transition-all placeholder:text-white/10"
                value={line.text}
                onChange={(e) => updateLineText(index, e.target.value)}
                placeholder="Enter lyric line..."
              />
              <div className="flex items-center opacity-100 block transition-all">
                <button 
                  onClick={() => addLine(index)}
                  className="p-2 text-white/20 hover:text-purple-400 transition-all"
                  title="Insert Line Below"
                >
                  <Plus size={16} />
                </button>
                <button 
                  onClick={() => removeLine(index)}
                  className="p-2 text-white/20 hover:text-red-400 transition-all"
                  title="Remove Line"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
          {lines.length > 0 && (
            <button 
              onClick={() => addLine()}
              className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl text-white/10 hover:text-white/40 hover:border-white/10 transition-all font-black uppercase tracking-widest text-[10px]"
            >
              + Add Line
            </button>
          )}
        </div>
      ) : (
        <div ref={scrollContainerRef} className="flex-1 flex flex-col gap-4 overflow-y-auto mb-8 pr-2 scroll-hide scroll-smooth">
          {lines.map((line, index) => {
            const isPlaying = index === currentlyPlayingIndex;
            const isSyncing = index === activeSyncIndex;
            
            return (
              <motion.div 
                layout
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ 
                  opacity: 1, 
                  x: 0,
                  scale: isPlaying ? 1.02 : 1,
                  backgroundColor: isPlaying 
                    ? "rgba(168, 85, 247, 0.15)" 
                    : isSyncing 
                      ? "rgba(168, 85, 247, 0.1)" 
                      : "rgba(255, 255, 255, 0.02)"
                }}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden",
                  isPlaying ? "border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.1)]" : "border-white/5",
                  isSyncing && !isPlaying && "border-purple-500/50",
                  line.time > 0 && !isPlaying && !isSyncing && "border-green-500/20"
                )}
                onClick={() => setActiveSyncIndex(index)}
              >
                {isPlaying && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"
                  />
                )}
                <div className="flex items-center justify-between relative z-10">
                  <p className={cn(
                    "text-lg transition-colors", 
                    isPlaying ? "text-white font-black" : isSyncing ? "text-white/80 font-bold" : "text-white/60"
                  )}>
                    {line.text || "---"}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] font-mono",
                      isPlaying ? "text-purple-400 font-bold" : "text-white/20"
                    )}>
                      {line.time > 0 ? `${Math.floor(line.time / 60)}:${Math.floor(line.time % 60).toString().padStart(2, '0')}` : "--:--"}
                    </span>
                    {line.time > 0 && <CheckCircle2 size={14} className={cn(isPlaying ? "text-purple-400" : "text-green-500/50")} />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {mode === "sync" && (
          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
            </button>
            <button 
              onClick={syncCurrentLine}
              disabled={activeSyncIndex >= lines.length}
              className={cn(
                "px-8 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-full font-black uppercase italic tracking-tighter transition-all shadow-xl shadow-purple-500/20 active:scale-95",
                activeSyncIndex >= lines.length && "bg-zinc-800"
              )}
            >
              Tag Time
            </button>
            <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
               Line {activeSyncIndex + 1} of {lines.length}
            </div>
          </div>
        )}
        <button 
          onClick={handleSave}
          className="ml-auto px-10 py-4 bg-white text-black rounded-full font-black uppercase italic tracking-tighter hover:bg-zinc-200 transition-all flex items-center gap-3 shadow-2xl active:scale-95"
        >
          <Save size={20} />
          Save Lyrics
        </button>
      </div>
    </div>
  );
}
