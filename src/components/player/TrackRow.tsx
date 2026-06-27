import { Link } from "react-router-dom";
import { Play, MoreHorizontal, Download, CheckCircle2, ListPlus } from "lucide-react";
import { LikeButton } from "../LikeButton";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { usePlayerStore, Song } from "../../store/usePlayerStore";

export function TrackRow({ 
  song, 
  isActive, 
  isDownloaded, 
  isDownloading, 
  handleDownload, 
  setSelectedSong, 
  setSong,
  togglePlay,
  recentlyPlayed,
  onOptionsMenu
}: {
  song: Song,
  isActive: boolean,
  isDownloaded: boolean,
  isDownloading: boolean,
  handleDownload: (song: Song) => void,
  setSelectedSong: (song: Song) => void,
  setSong: (song: Song, songs: Song[]) => void,
  togglePlay: () => void,
  recentlyPlayed: Song[],
  onOptionsMenu: (song: Song) => void
}) {
  const { likedSongs } = usePlayerStore();
  const isTrackLiked = likedSongs.some(item => item.id === song.id);

  const formatDuration = (d: any) => {
    if (!d) return "0:00";
    if (typeof d === 'string') {
      d = parseFloat(d.split('.')[0]);
    }
    const totalSeconds = Math.floor(Number(d) || 0);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      layout
      onClick={() => isActive ? togglePlay() : setSong(song, recentlyPlayed)}
      className={cn(
        "w-full h-16 flex items-center justify-between gap-3 px-3 rounded-xl transition-all group cursor-pointer border",
        isActive ? "bg-white/10 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]" : "bg-white/5 hover:bg-white/10 border-transparent hover:border-white/5"
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-12 h-12 rounded bg-white/10 overflow-hidden shadow-lg shrink-0 relative">
          <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          {isActive && <div className="absolute inset-0 bg-purple-500/20" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-bold truncate transition-colors", isActive ? "text-purple-400" : "text-white")}>{song.title}</p>
          <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider truncate shrink-0">{song.artist} • {song.source}</p>
        </div>
      </div>
      
      <div className="flex-shrink-0 flex items-center gap-3 ml-auto">
        <span className="text-[10px] text-zinc-500 font-mono shrink-0 w-10 text-right">
          {formatDuration(song.duration)}
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); onOptionsMenu(song); }}
          className="p-2 rounded-xl text-white/20 hover:text-white hover:bg-white/10 opacity-100 block transition-all"
        >
          <MoreHorizontal size={16} />
        </button>
        
        <div className="hidden md:flex items-center gap-3">
          <LikeButton targetId={song.id} type="song" song={song} size={16} className="opacity-100 transition-all" />
          
          <button 
            onClick={(e) => { e.stopPropagation(); if (!isDownloaded && !isDownloading) handleDownload(song); }}
            className={cn(
              "p-2 rounded-xl transition-all hidden md:block",
              isDownloaded ? "text-emerald-400 bg-emerald-500/5 shadow-[0_0_15px_rgba(52,211,153,0.1)]" : "text-white/20 hover:text-white hover:bg-white/10 opacity-100"
            )}
            disabled={isDownloaded || isDownloading}
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full" />
            ) : isDownloaded ? (
              <CheckCircle2 size={16} className="drop-shadow-[0_0_8px_currentColor]" />
            ) : (
              <Download size={16} className="drop-shadow-[0_0_8px_currentColor]" />
            )}
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setSelectedSong(song); }}
            className="p-2 rounded-xl bg-white/5 text-white/20 hover:text-white hover:bg-white/10 opacity-100 block transition-all font-black italic hidden md:block"
          >
            <ListPlus size={16} className="drop-shadow-[0_0_8px_currentColor]" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
