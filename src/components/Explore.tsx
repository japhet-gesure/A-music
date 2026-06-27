import { useState, useEffect } from "react";
import { Compass, Play, ListPlus, Loader2, TrendingUp, Music, Heart, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { cn } from "../lib/utils";
import axios from "axios";

export default function Explore() {
  const [trending, setTrending] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const { setSong, currentSong, isPlaying, togglePlay } = usePlayerStore();

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

  useEffect(() => {
    const fetchTrending = async () => {
      setLoading(true);
      try {
        const response = await axios.get("/api/explore");
        if (Array.isArray(response.data)) {
          setTrending(response.data);
        } else {
          setTrending([]);
        }
      } catch (error) {
        console.error("Failed to fetch trending songs:", error);
        setTrending([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, []);

  return (
    <div className="space-y-12">
      <AnimatePresence>
        {selectedSong && (
          <AddToPlaylistModal 
            song={selectedSong} 
            onClose={() => setSelectedSong(null)} 
          />
        )}
      </AnimatePresence>

      <header className="relative py-20 px-12 rounded-[32px] overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 opacity-80 group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=1200')] bg-cover bg-center mix-blend-overlay" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="w-48 h-48 rounded-full bg-white/10 backdrop-blur-3xl flex items-center justify-center border border-white/20 shadow-2xl animate-pulse">
            <Compass size={80} className="text-white drop-shadow-lg" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white leading-[0.8] mb-4">EXPLORE</h1>
            <p className="text-white/60 text-lg font-bold uppercase tracking-[.25em]">Trending Now on YouTube Music</p>
          </div>
        </div>
      </header>

      <section>
        <div className="flex items-center gap-4 mb-8">
           <div className="bg-purple-500 p-2 rounded-xl">
             <TrendingUp size={24} className="text-white" />
           </div>
           <h2 className="text-2xl font-black italic tracking-tighter">GLOBAL SIGNALS</h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={48} className="text-purple-500 animate-spin" />
            <p className="text-white/20 font-bold uppercase tracking-widest text-xs">Phasing results from the cloud...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {trending.map((song, index) => {
              const isActive = currentSong?.id === song.id;
              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex flex-col p-4 rounded-3xl transition-all duration-500 border group h-full",
                    isActive 
                      ? "bg-white/10 border-white/20 shadow-[0_0_50px_rgba(168,85,247,0.1)] scale-[1.02]" 
                      : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10"
                  )}
                >
                  <div 
                    className="relative aspect-square rounded-2xl overflow-hidden mb-4 shadow-xl cursor-pointer"
                    onClick={() => isActive ? togglePlay() : setSong(song, trending)}
                  >
                    <img 
                      src={song.thumbnail || undefined} 
                      alt={song.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                    <div className={cn(
                      "absolute inset-0 bg-black/60 flex items-center justify-center transition-all duration-300",
                      isActive ? "opacity-100" : "opacity-100 block"
                    )}>
                      {isActive && isPlaying ? (
                        <div className="flex items-end gap-1 h-12">
                          <motion.div animate={{ height: [12, 48, 16, 40, 12] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2 bg-white rounded-full shadow-[0_0_15px_white]" />
                          <motion.div animate={{ height: [32, 12, 48, 24, 32] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-2 bg-white rounded-full shadow-[0_0_15px_white]" />
                          <motion.div animate={{ height: [24, 40, 12, 48, 24] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-2 bg-white rounded-full shadow-[0_0_15px_white]" />
                        </div>
                      ) : (
                        <Play size={48} fill="white" className="text-white drop-shadow-2xl" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 pr-10 relative">
                    <h3 className={cn(
                      "text-lg font-black italic tracking-tighter leading-tight truncate px-1",
                      isActive ? "text-purple-400" : "text-white"
                    )}>
                      {song.title}
                    </h3>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1 px-1">{song.artist}</p>
                    
                    <div className="absolute top-0 right-0 flex items-center gap-1">
                      <Link 
                        to={`/song/${song.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-white/10 opacity-100 block transition-all font-black"
                        title="View Details"
                      >
                        <Info size={18} />
                      </Link>
                      <LikeButton targetId={song.id} type="song" size={18} className="p-2 opacity-100 block transition-all" />
                      <button 
                        onClick={() => setSelectedSong(song)}
                        className="p-2 rounded-full bg-white/5 text-white/20 hover:text-white hover:bg-white/10 opacity-100 block transition-all font-black"
                        title="Add to Playlist"
                      >
                        <ListPlus size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                       <div className="bg-red-600/20 text-red-500 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter flex items-center gap-1">
                         <Play size={8} fill="currentColor" /> YouTube
                       </div>
                       <span className="text-[10px] font-mono text-white/20">
                          {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : (/^[a-zA-Z0-9_-]{11}$/.test(song.sourceId || song.id) ? "TRACK" : "LIVE")}
                       </span>
                    </div>
                    <span className="text-[10px] font-bold text-white/10 italic">#TRENDING{index + 1}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Discover Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-zinc-900 to-black p-10 rounded-[40px] border border-white/5 group hover:border-purple-500/20 transition-all overflow-hidden relative">
           <div className="relative z-10">
              <h3 className="text-4xl font-black italic tracking-tighter text-white mb-2">LIVE RADIO</h3>
              <p className="text-white/30 text-sm font-medium uppercase tracking-[.25em] mb-8">Non-stop music curation</p>
              <button className="bg-white text-black font-black italic px-8 py-3 rounded-full flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                LISTEN NOW <Play size={16} fill="black" />
              </button>
           </div>
           <Music size={240} className="absolute -right-20 -bottom-20 text-white/5 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-700" />
        </div>

        <div className="bg-gradient-to-br from-zinc-900 to-black p-10 rounded-[40px] border border-white/5 group hover:border-blue-500/20 transition-all overflow-hidden relative">
           <div className="relative z-10">
              <h3 className="text-4xl font-black italic tracking-tighter text-white mb-2">GENRE VAULT</h3>
              <p className="text-white/30 text-sm font-medium uppercase tracking-[.25em] mb-8">Explore specific frequencies</p>
              <button className="bg-white/10 text-white border border-white/10 font-black italic px-8 py-3 rounded-full flex items-center gap-2 hover:bg-white/20 transition-all">
                OPEN VAULT
              </button>
           </div>
           <Compass size={240} className="absolute -right-20 -bottom-20 text-white/5 group-hover:-rotate-12 group-hover:scale-110 transition-transform duration-700" />
        </div>
      </section>
    </div>
  );
}
