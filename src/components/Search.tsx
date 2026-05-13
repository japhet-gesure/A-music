import { useState, useEffect } from "react";
import { Search as SearchIcon, X, Play, Music, ListPlus, Loader2, MoreHorizontal, User, Download, CheckCircle2, Info } from "lucide-react";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { Link } from "react-router-dom";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { cn } from "../lib/utils";
import axios from "axios";
import { getAllTracks } from "../lib/offlineStorage";
import { downloadSong } from "../services/downloadService";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [offlineIds, setOfflineIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { setSong, currentSong, isPlaying, togglePlay, downloads } = usePlayerStore();

  useEffect(() => {
    const saved = localStorage.getItem("recent_searches");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecentSearches(parsed);
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }
  }, []);

  const addToRecentSearches = (q: string) => {
    if (!q.trim()) return;
    const cleanQ = q.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== cleanQ.toLowerCase());
      const updated = [cleanQ, ...filtered].slice(0, 5);
      localStorage.setItem("recent_searches", JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const loadOffline = async () => {
      const tracks = await getAllTracks();
      setOfflineIds(new Set(tracks.map(t => t.id)));
    };
    loadOffline();
  }, []);

  const handleDownload = async (song: Song) => {
    setDownloadingIds(prev => new Set(prev).add(song.id));
    usePlayerStore.getState().setDownloadStatus(song.id, { 
      progress: 0, 
      status: "downloading", 
      song 
    });
    
    try {
      await downloadSong(song);
      usePlayerStore.getState().setDownloadStatus(song.id, { 
        progress: 100, 
        status: "completed", 
        song 
      });
      setOfflineIds(prev => new Set(prev).add(song.id));
    } catch (error) {
      usePlayerStore.getState().setDownloadStatus(song.id, { 
        progress: 0, 
        status: "failed", 
        error: "Download failed",
        song 
      });
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
  };

  const renderStatus = (songId: string) => {
    const download = downloads[songId];
    const isOffline = offlineIds.has(songId);
    
    if (download?.status === "downloading" || downloadingIds.has(songId)) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[7px] text-indigo-400 font-bold uppercase tracking-widest shrink-0">Syncing...</span>
        </div>
      );
    }
    
    if (download?.status === "syncing") {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[7px] text-purple-400 font-bold uppercase tracking-widest shrink-0">Vaulting...</span>
        </div>
      );
    }
    
    if (download?.status === "failed") {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span className="text-[7px] text-rose-500 font-bold uppercase tracking-widest shrink-0">Sync Failed</span>
        </div>
      );
    }

    if (isOffline) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[7px] text-green-500 font-bold uppercase tracking-widest shrink-0">Available Offline</span>
        </div>
      );
    }

    return null;
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim()) {
        setLoading(true);
        try {
          const response = await axios.get("/api/search", { params: { q: query } });
          if (Array.isArray(response.data)) {
            setResults(response.data);
            if (response.data.length > 0) {
              addToRecentSearches(query);
            }
          } else {
            setResults([]);
          }
        } catch (error) {
          console.error("Search failed:", error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="space-y-12">
      <AnimatePresence>
        {selectedSongId && (
          <AddToPlaylistModal 
            songId={selectedSongId} 
            onClose={() => setSelectedSongId(null)} 
          />
        )}
      </AnimatePresence>

      <header>
        <h1 className="text-5xl font-black italic tracking-tighter text-gradient leading-tight">SEARCH CATALOG</h1>
        <p className="text-white/40 text-sm font-medium uppercase tracking-widest mt-2">Discover 100M+ tracks from across the web</p>
      </header>

      <div className="relative max-w-2xl group">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
          <SearchIcon className="text-white/20 group-focus-within:text-purple-500 transition-colors" size={20} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists, or albums..."
          className="w-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-full py-5 pl-16 pr-16 text-xl font-bold focus:outline-none focus:border-dashed focus:border-purple-500/50 focus:bg-white/[0.07] transition-all outline-none shadow-2xl placeholder:text-white/20"
        />
        {query && (
          <button 
            onClick={handleClear}
            className="absolute inset-y-0 right-6 flex items-center text-white/20 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        )}
      </div>

      {!query && recentSearches.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Recent Searches</h2>
            <button 
              onClick={() => {
                setRecentSearches([]);
                localStorage.removeItem("recent_searches");
              }}
              className="text-[10px] font-bold text-rose-500/50 hover:text-rose-500 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, i) => (
              <button
                key={i}
                onClick={() => setQuery(search)}
                className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all"
              >
                {search}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {!query ? (
        <section className="space-y-12 mt-12">
          <div>
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-xl font-black italic tracking-tighter border-l-4 border-purple-500 pl-4 uppercase">BROWSE GENRES</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {[
               { name: "Pop", color: "from-pink-500 to-purple-600" },
               { name: "Rock", color: "from-orange-500 to-red-600" },
               { name: "Hip-Hop", color: "from-blue-500 to-indigo-600" },
               { name: "Electronic", color: "from-emerald-500 to-teal-600" },
               { name: "Jazz", color: "from-amber-500 to-orange-600" },
               { name: "Classical", color: "from-zinc-500 to-slate-600" }
            ].map((genre) => (
              <motion.div 
                key={genre.name}
                whileHover={{ scale: 1.05, rotate: -2 }}
                className={`aspect-square bg-gradient-to-br ${genre.color} rounded-3xl p-6 cursor-pointer relative overflow-hidden group shadow-xl`}
              >
                <span className="text-2xl font-black italic text-white tracking-tighter leading-tight drop-shadow-md z-10 relative">{genre.name}</span>
                <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-black/20 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
                <Music size={120} className="absolute -bottom-10 -right-10 opacity-10 group-hover:rotate-12 transition-transform" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      ) : (
        <section className="space-y-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest">
              {loading ? "Searching..." : "Top Results"}
            </h2>
            {loading && <Loader2 size={16} className="animate-spin text-purple-500" />}
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {results.length > 0 ? (
                results.map((song, index) => {
                  const isActive = currentSong?.id === song.id;
                  return (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl transition-all group cursor-pointer border",
                      isActive ? "bg-white/10 border-white/10" : "bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10"
                    )}
                    onClick={() => isActive ? togglePlay() : setSong(song, results)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden relative shadow-lg shrink-0 bg-zinc-800">
                        <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" />
                        <div className={cn(
                          "absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity",
                          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}>
                          {isActive && isPlaying ? (
                            <div className="flex items-end gap-0.5 h-3">
                              <motion.div animate={{ height: [4, 12, 6, 10, 4] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-0.5 bg-white" />
                              <motion.div animate={{ height: [8, 4, 10, 6, 8] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-0.5 bg-white" />
                              <motion.div animate={{ height: [6, 10, 4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-0.5 bg-white" />
                            </div>
                          ) : (
                            <Play size={16} fill="white" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={cn("font-bold text-sm tracking-tight truncate pr-4", isActive && "text-purple-400")} dangerouslySetInnerHTML={{ __html: song.title }} />
                        <div className="flex flex-col overflow-hidden">
                          <div className="flex items-center gap-2">
                             <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">{song.artist}</p>
                             {renderStatus(song.id)}
                          </div>
                          {song.album && (
                            <p className="text-[10px] text-zinc-600 truncate mt-0.5">
                              <span className="font-bold text-zinc-700">ALBUM:</span> {song.album}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                       <Link 
                          to={`/song/${song.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-full text-white/20 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="View Details"
                       >
                         <Info size={16} />
                       </Link>

                       <LikeButton targetId={song.id} type="song" size={16} className="opacity-0 group-hover:opacity-100 transition-all" />
                       
                       <button 
                          onClick={(e) => { 
                             e.stopPropagation(); 
                             if (!offlineIds.has(song.id) && !downloadingIds.has(song.id)) handleDownload(song);
                          }}
                          className={cn(
                            "p-1.5 rounded-full transition-all flex items-center justify-center",
                            offlineIds.has(song.id) ? "text-indigo-400" : "text-white/20 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100"
                          )}
                          disabled={offlineIds.has(song.id) || downloadingIds.has(song.id)}
                          title={offlineIds.has(song.id) ? "Downloaded" : "Add to Offline"}
                        >
                           {downloadingIds.has(song.id) ? (
                             <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full" />
                           ) : offlineIds.has(song.id) ? (
                             <CheckCircle2 size={16} />
                           ) : (
                             <Download size={16} />
                           )}
                        </button>

                       <div className="relative">
                         <button 
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             setActiveMenuId(activeMenuId === song.id ? null : song.id); 
                           }}
                           className="p-2 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                           title="More options"
                         >
                           <MoreHorizontal size={16} />
                         </button>

                         <AnimatePresence>
                           {activeMenuId === song.id && (
                             <>
                               <div className="fixed inset-0 z-20" onClick={() => setActiveMenuId(null)} />
                               <motion.div 
                                 initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                 animate={{ opacity: 1, scale: 1, y: 0 }}
                                 exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                 className="absolute right-0 bottom-full mb-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30"
                               >
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); setSelectedSongId(song.id); setActiveMenuId(null); }}
                                   className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                                 >
                                   <ListPlus size={14} />
                                   Add to Playlist
                                 </button>
                                 <Link 
                                   to={`/song/${song.id}`}
                                   onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                                   className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all border-t border-white/5"
                                 >
                                   <Info size={14} />
                                   View Track Insights
                                 </Link>
                                 {!offlineIds.has(song.id) && (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); handleDownload(song); setActiveMenuId(null); }}
                                     className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all border-t border-white/5"
                                   >
                                     <Download size={14} />
                                     Add to Offline
                                   </button>
                                 )}
                                 <button 
                                   onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }}
                                   className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all border-t border-white/5"
                                 >
                                   <User size={14} />
                                   View Artist
                                 </button>
                               </motion.div>
                             </>
                           )}
                         </AnimatePresence>
                       </div>

                       <span className="text-[10px] text-zinc-600 font-mono hidden md:block">
                         {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : "3:45"}
                       </span>
                       <div className={cn(
                         "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tighter hidden md:block",
                         song.source === "youtube" ? "bg-red-600/20 text-red-500" : "bg-white/5 text-white/20"
                       )}>
                          {song.source}
                       </div>
                    </div>
                  </motion.div>
                )})
              ) : !loading && (
                <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                   <p className="text-zinc-600 font-bold italic uppercase">No signals found in the cloud.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
}
