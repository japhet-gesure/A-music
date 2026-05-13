import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Play, Pause, ListPlus, Download, CheckCircle2, ChevronLeft, Calendar, Music, Info, Share2, RefreshCw, AlertCircle } from "lucide-react";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { fetchSongMetadata } from "../services/musicService";
import { downloadSong } from "../services/downloadService";
import { getAllTracks } from "../lib/offlineStorage";
import { LikeButton } from "./LikeButton";
import { cn } from "../lib/utils";

export default function SongDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [song, setSongData] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const { 
    setSong: playSong, 
    currentSong, 
    isPlaying, 
    togglePlay, 
    downloads,
    currentTime,
    duration,
    seekTo
  } = usePlayerStore();

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const loadSong = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await fetchSongMetadata(id);
        setSongData(data);
        
        const offlineTracks = await getAllTracks();
        setIsOffline(offlineTracks.some(t => t.id === id));
      } catch (err) {
        console.error("Failed to load song details", err);
      } finally {
        setLoading(false);
      }
    };
    loadSong();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Analyzing Soundwaves...</p>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-black italic text-rose-500 uppercase">Track Not Found</h2>
        <button 
          onClick={() => navigate(-1)}
          className="mt-6 text-xs font-bold text-white/40 hover:text-white uppercase tracking-widest"
        >
          Back to exploration
        </button>
      </div>
    );
  }

  const isActive = currentSong?.id === song.id;

  const handlePlay = () => {
    if (isActive) {
      togglePlay();
    } else {
      playSong(song);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 group"
      >
        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs font-black uppercase tracking-widest">Back</span>
      </button>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-start">
        {/* Cover Art - More Prominent */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative group w-full lg:w-[450px] shrink-0 sticky top-24"
        >
          <div className="aspect-square rounded-[4rem] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6)] bg-zinc-900 border border-white/10 relative p-1">
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 via-transparent to-indigo-500/10 z-10 pointer-events-none" />
            <img 
              src={song.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=1000&h=1000&fit=crop"} 
              alt={song.title} 
              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
            />
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/20 opacity-30 group-hover:opacity-10 transition-opacity" />
          </div>
          
          {/* Enhanced Decorative Glows */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-purple-500/30 rounded-full blur-[100px] -z-10 group-hover:bg-purple-500/40 transition-colors" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/20 rounded-full blur-[120px] -z-10 group-hover:bg-indigo-500/30 transition-colors" />
          
          {/* Technical Badge */}
          <div className="absolute -bottom-4 left-12 px-6 py-3 bg-white/10 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl z-20 flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">Hi-Res Audio Signal</span>
          </div>
        </motion.div>

        {/* Info Area */}
        <div className="flex-1 space-y-10">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-6 flex-wrap">
               <div className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full shadow-lg shadow-purple-500/5">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                   {song.source} Origin
                 </span>
               </div>
               {song.genre && (
                 <div className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                     Core {song.genre}
                   </span>
                 </div>
               )}
               {(() => {
                 const download = downloads[song.id];
                 if (download?.status === "downloading" || download?.status === "syncing") {
                   return (
                     <div className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center gap-2 animate-pulse">
                       <RefreshCw size={12} className="text-indigo-400 animate-spin" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Archiving</span>
                     </div>
                   );
                 }
                 if (download?.status === "failed") {
                   return (
                     <div className="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center gap-2">
                       <AlertCircle size={12} className="text-rose-500" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Failed</span>
                     </div>
                   );
                 }
                 if (isOffline || download?.status === "completed") {
                   return (
                     <div className="px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2">
                       <CheckCircle2 size={12} className="text-green-500" />
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500">Vaulted</span>
                     </div>
                   );
                 }
                 return null;
               })()}
            </div>

            <div className="flex items-baseline gap-6 flex-wrap mb-4">
              <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-gradient leading-[0.9] uppercase" dangerouslySetInnerHTML={{ __html: song.title }} />
              {(() => {
                 const download = downloads[song.id];
                 if (download?.status === "downloading" || download?.status === "syncing") {
                    return <RefreshCw size={32} className="text-indigo-500/40 animate-spin mb-2" />;
                 }
                 if (download?.status === "failed") {
                    return <AlertCircle size={32} className="text-rose-500/40 mb-2" />;
                 }
                 if (isOffline || download?.status === "completed") {
                    return <CheckCircle2 size={32} className="text-green-500/40 mb-2" />;
                 }
                 return null;
              })()}
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-[2px] bg-purple-500/40" />
              <p className="text-2xl md:text-3xl font-bold text-white/50 uppercase tracking-tight italic">{song.artist}</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-4"
          >
            <button 
              onClick={handlePlay}
              className="px-10 py-5 bg-white text-black rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.15)] group"
            >
              <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                {isActive && isPlaying ? <Pause size={14} fill={isActive && isPlaying ? "white" : "black"} className={isActive && isPlaying ? "text-white" : "text-black"} /> : <Play size={14} fill="black" className="ml-0.5" />}
              </div>
              {isActive && isPlaying ? "Suspend Signal" : "Initiate Sequence"}
            </button>
            
            <div className="flex items-center gap-3">
              <LikeButton targetId={song.id} type="song" size={24} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all border border-white/5" />
              <button className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white border border-white/5">
                <Share2 size={20} />
              </button>
            </div>
          </motion.div>

          {/* Progress Container */}
          {isActive && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-4 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden backdrop-blur-xl shadow-2xl"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
              
              <div className="flex items-center justify-between text-[11px] font-black font-mono text-purple-400 uppercase tracking-widest mb-1">
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", isPlaying ? "bg-purple-500 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.5)]" : "bg-white/20")} />
                  <span className="tabular-nums">{formatTime(currentTime)}</span>
                </div>
                <span className="tabular-nums opacity-60">{formatTime(duration)}</span>
              </div>

              <div 
                className="relative h-3 w-full bg-white/5 rounded-full cursor-pointer group shadow-inner overflow-hidden"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seekTo(percent * duration);
                }}
              >
                {/* Visual Segments */}
                <div className="absolute inset-0 opacity-10 flex gap-1 px-1">
                  {[...Array(20)].map((_, i) => <div key={i} className="flex-1 h-full border-r border-white/20" />)}
                </div>

                {/* Active progress */}
                <motion.div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-400 rounded-full shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 30 }}
                >
                   {/* Handle / Glow Point */}
                   <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/80 blur-[2px]" />
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Metadata Section - Redesigned */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 border-l-2 border-purple-500 pl-4">Acoustic DNA Analysis</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-3xl p-6 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 text-white/30 group-hover:text-purple-400 transition-colors">
                    <Music size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Source Volume</span>
                  </div>
                  <Info size={14} className="text-white/10" />
                </div>
                <p className="text-xl font-black text-white/90 italic tracking-tight">{song.album || "Non-Album Track"}</p>
                <div className="mt-4 h-1 w-12 bg-purple-500/20 group-hover:w-full transition-all duration-700" />
              </div>

              <div className="group bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-3xl p-6 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 text-white/30 group-hover:text-indigo-400 transition-colors">
                    <Calendar size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Temporal Entry</span>
                  </div>
                  <Info size={14} className="text-white/10" />
                </div>
                <p className="text-xl font-black text-white/90 italic tracking-tight">{song.releaseDate || "Current Era"}</p>
                <div className="mt-4 h-1 w-12 bg-indigo-500/20 group-hover:w-full transition-all duration-700" />
              </div>

              <div className="group bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-3xl p-6 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 text-white/30 group-hover:text-purple-400 transition-colors">
                    <Info size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Frequency Class</span>
                  </div>
                  <div className="px-2 py-1 bg-purple-500/10 rounded text-[8px] font-mono text-purple-400 uppercase tracking-tighter">Verified</div>
                </div>
                <p className="text-xl font-black text-white/90 italic tracking-tight">{song.genre || "Universal / Atmos"}</p>
                <div className="mt-4 h-1 w-12 bg-purple-500/20 group-hover:w-full transition-all duration-700" />
              </div>

              <div className="group bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-3xl p-6 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3 text-white/30 group-hover:text-indigo-400 transition-colors">
                    <Music size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Signal Length</span>
                  </div>
                  <div className="px-2 py-1 bg-indigo-500/10 rounded text-[8px] font-mono text-indigo-400 uppercase tracking-tighter">Precision</div>
                </div>
                <p className="text-xl font-black text-white/90 italic tracking-tight">
                  {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : "03:45"}
                </p>
                <div className="mt-4 h-1 w-12 bg-indigo-500/20 group-hover:w-full transition-all duration-700" />
              </div>
            </div>
          </motion.div>

          {song.description && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white/2 border border-white/5 rounded-3xl p-8"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-4 text-center">ANALYTICAL BREAKDOWN</h3>
              <p className="text-white/60 text-sm leading-relaxed text-center font-medium italic">
                "{song.description}"
              </p>
            </motion.div>
          )}

          <div className="flex flex-col gap-3">
             <button
               onClick={() => usePlayerStore.getState().addToQueue(song)}
               className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all flex items-center justify-center gap-2"
             >
               <ListPlus size={14} />
               Queue Next
             </button>
             
             {(() => {
               const download = downloads[song.id];
               if (isOffline || download?.status === "completed") return null;
               
               const isProcessing = download?.status === "downloading" || download?.status === "syncing";
               return (
                 <button
                   onClick={() => !isProcessing && downloadSong(song)}
                   disabled={isProcessing}
                   className="w-full py-4 relative bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2 overflow-hidden disabled:opacity-50"
                 >
                   {isProcessing && (
                     <motion.div 
                        className="absolute inset-0 bg-purple-500/10 origin-left"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: (download?.progress || 0) / 100 }}
                     />
                   )}
                   {isProcessing ? (
                     <RefreshCw size={14} className="animate-spin relative z-10" />
                   ) : download?.status === "failed" ? (
                     <AlertCircle size={14} className="relative z-10" />
                   ) : (
                     <Download size={14} className="relative z-10" />
                   )}
                   <span className="relative z-10">
                     {isProcessing ? `Archiving (${download?.progress || 0}%)` : 
                      download?.status === "failed" ? "Retry Archive" : "Archive to Vault"}
                   </span>
                 </button>
               );
             })()}
          </div>
        </div>
      </div>
    </div>
  );
}
