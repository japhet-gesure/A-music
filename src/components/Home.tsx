import { useState, useEffect } from "react";
import { Play, ListPlus, Download, CheckCircle2, Info, MoreHorizontal } from "lucide-react";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { Link } from "react-router-dom";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { TrackOptionsMenu } from "./TrackOptionsMenu";
import { TrackRow } from "./player/TrackRow";
import { getAllTracks, deleteTrack as removeFromOffline } from "../lib/offlineStorage";
import { downloadSong, getOfflineStatus } from "../services/downloadService";
import AIPicks from "./AIPicks";

const MOCK_SONGS: Song[] = [
  { id: "1", title: "Midnight City", artist: "M83", thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop", source: "youtube", sourceId: "dX3k_HiQ5fE" },
  { id: "2", title: "Starboy", artist: "The Weeknd", thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop", source: "youtube", sourceId: "37xVbaXidIs" },
  { id: "3", title: "Blinding Lights", artist: "The Weeknd", thumbnail: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop", source: "youtube", sourceId: "4NRXx6U8ABQ" },
  { id: "4", title: "Levitating", artist: "Dua Lipa", thumbnail: "https://images.unsplash.com/photo-1514525253361-bee8718a300a?w=300&h=300&fit=crop", source: "youtube", sourceId: "TUVcZfQe-Kw" },
];

export default function Home() {
  const { setSong, currentSong, isPlaying, togglePlay, recentlyPlayed, downloads } = usePlayerStore();
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [activeMenuSong, setActiveMenuSong] = useState<Song | null>(null);
  const [offlineSongs, setOfflineSongs] = useState<Song[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadOffline = async () => {
      const tracks = await getAllTracks();
      const songs: Song[] = tracks.map(t => ({
        id: t.id,
        title: t.metadata.title,
        artist: t.metadata.artist,
        thumbnail: t.metadata.thumbnail || "",
        source: t.metadata.source as any || "local",
        sourceId: t.id,
        duration: t.metadata.duration,
        localUrl: t.blob.size > 1000 ? URL.createObjectURL(t.blob) : undefined,
        lyrics: t.metadata.lyrics
      }));
      setOfflineSongs(songs);
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
      // Refresh offline list
      const tracks = await getAllTracks();
      const songs: Song[] = tracks.map(t => ({
        id: t.id,
        title: t.metadata.title,
        artist: t.metadata.artist,
        thumbnail: t.metadata.thumbnail || "",
        source: t.metadata.source as any || "local",
        sourceId: t.id,
        duration: t.metadata.duration,
        localUrl: t.blob.size > 1000 ? URL.createObjectURL(t.blob) : undefined,
        lyrics: t.metadata.lyrics
      }));
      setOfflineSongs(songs);
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

  const renderStatus = (songId: string) => {
    const download = downloads[songId];
    const isOffline = offlineSongs.some(s => s.id === songId);
    
    if (download?.status === "downloading") {
      return (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[7px] text-indigo-400 font-black uppercase tracking-widest">Syncing</span>
        </div>
      );
    }

    if (download?.status === "syncing") {
      return (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[7px] text-purple-400 font-black uppercase tracking-widest">Vaulting</span>
        </div>
      );
    }
    
    if (download?.status === "failed") {
      return (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span className="text-[7px] text-rose-500 font-black uppercase tracking-widest">Failed</span>
        </div>
      );
    }

    if (isOffline) {
      return (
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[7px] text-green-500 font-black uppercase tracking-widest">Synced</span>
        </div>
      );
    }

    return null;
  };
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

      {/* Featured Hero */}
      <section className="relative h-64 rounded-3xl overflow-hidden group shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent z-10" />
        <img 
          src="https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=2070&auto=format&fit=crop" 
          alt="Featured" 
          className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700" 
        />
        <div className="absolute inset-0 flex flex-col justify-center px-12 z-20">
          <span className="text-[10px] font-bold text-purple-400 mb-2 tracking-widest uppercase">Featured Curation</span>
          <h2 className="text-5xl font-black mb-4 tracking-tighter italic">Hyper-Pop Essentials</h2>
          <p className="text-white/60 text-sm max-w-md mb-6 italic font-medium">The definitive collection of future-facing electronic pop from across the web.</p>
          <div className="flex gap-4">
            <button 
               onClick={() => setSong(MOCK_SONGS[0], MOCK_SONGS)}
               className="btn-primary"
            >
               Play Now
            </button>
            <button className="btn-secondary">Save Library</button>
          </div>
        </div>
        <div className="absolute right-0 top-0 h-full w-[60%] bg-indigo-600 opacity-20 blur-3xl" />
      </section>

      {/* Offline Vault Highlights */}
      {offlineSongs.length > 0 && (
        <section className="space-y-6">
           <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold tracking-tight border-l-4 border-indigo-500 pl-4 uppercase">From Your Vault</h4>
              <button className="text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-widest">View All</button>
           </div>
           <div className="flex gap-6 overflow-x-auto pb-4 scroll-hide">
               {offlineSongs.slice(0, 8).map((song, i) => (
                <div 
                  key={`${song.id}-${i}`} 
                  onClick={() => setSong(song, offlineSongs.slice(0, 8))}
                  className="min-w-[120px] group cursor-pointer"
                >
                   <div className="w-24 h-24 rounded-2xl overflow-hidden relative mb-2 shadow-xl border border-white/5">
                      <img src={song.thumbnail || undefined} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 block transition-opacity">
                        <Play size={24} fill="white" className="text-white" />
                      </div>
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 rounded-lg bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
                           <CheckCircle2 size={10} className="text-green-500" />
                        </div>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold truncate tracking-tight text-white/90">{song.title}</p>
                   <p className="text-[8px] text-white/40 uppercase font-black truncate mt-0.5">{song.artist}</p>
                   {renderStatus(song.id)}
                </div>
              ))}
           </div>
        </section>
      )}

      {/* Grid Layout for Recently Played & Lyrics Peek */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
         {/* Recently Played */}
         <section className="space-y-6">
            <div className="flex items-center justify-between">
               <h4 className="text-sm font-bold tracking-tight border-l-4 border-purple-500 pl-4 uppercase">Recently Played</h4>
               {recentlyPlayed.length > 0 && (
                  <button 
                     className="text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-widest transition-colors"
                     onClick={() => usePlayerStore.setState({ recentlyPlayed: [] })}
                  >
                     Clear History
                  </button>
               )}
            </div>
            
            {recentlyPlayed.length === 0 ? (
               <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-3xl p-12 text-center group hover:border-purple-500/40 transition-all duration-700">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                     <Play size={20} className="text-white/20" />
                  </div>
                  <p className="text-sm font-bold text-white/40 tracking-tight">Your recent history will appear here.</p>
                  <p className="text-[10px] text-white/20 font-medium uppercase tracking-widest mt-2 font-black italic">Start playing to build your story</p>
               </div>
            ) : (
               <div className="space-y-1">
                  {recentlyPlayed.map((song, i) => {
                     const isActive = currentSong?.id === song.id;
                     const isDownloaded = offlineSongs.some(os => os.id === song.id);
                     const isDownloading = downloadingIds.has(song.id);

                     return (
                        <TrackRow 
                           key={`${song.id}-${i}`}
                           song={song}
                           isActive={isActive}
                           isDownloaded={isDownloaded}
                           isDownloading={isDownloading}
                           handleDownload={handleDownload}
                           setSelectedSong={setSelectedSong}
                           setSong={setSong}
                           togglePlay={togglePlay}
                           recentlyPlayed={recentlyPlayed}
                           onOptionsMenu={setActiveMenuSong}
                         />
                     );
                  })}
               </div>
            )}
         </section>

         {/* Live Lyrics Peek */}
         <section className="space-y-6">
             <h4 className="text-sm font-bold tracking-tight border-l-4 border-pink-500 pl-4 uppercase">Live Lyrics</h4>
             <div className="bg-white/5 rounded-3xl p-8 h-full min-h-[300px] overflow-hidden relative border border-white/5 group">
                <div className="space-y-4">
                   <p className="text-white/20 text-2xl font-bold italic tracking-tighter transition-all group-hover:text-white/30">When the city lights go down...</p>
                   <p className="text-white font-black text-3xl italic tracking-tighter drop-shadow-2xl">I find myself looking for you in the crowd.</p>
                   <p className="text-white/20 text-2xl font-bold italic tracking-tighter transition-all group-hover:text-white/30">Every shadow looks like your silhouette...</p>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#121218] to-transparent pointer-events-none" />
             </div>
         </section>
      </div>

      {/* AI Recommendations */}
      <AIPicks />

      <AnimatePresence>
        {activeMenuSong && (
          <TrackOptionsMenu 
            track={activeMenuSong}
            onClose={() => setActiveMenuSong(null)}
            onDeleteTrack={async (trackId) => {
              try {
                await removeFromOffline(trackId);
                setOfflineSongs(prev => prev.filter(s => s.id !== trackId));
              } catch (e) {
                console.error("Failed to delete track from offline storage in Home screen:", e);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Recommended Section */}
      <section>
         <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black italic tracking-tighter underline decoration-purple-500 decoration-4 underline-offset-8">Mixed for you</h2>
            <button className="text-xs font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest">Show all</button>
         </div>
         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {MOCK_SONGS.concat(MOCK_SONGS).slice(0, 6).map((song, i) => {
               const isActive = currentSong?.id === song.id;
               return (
               <motion.div 
                  key={`${song.id}-${i}`}
                  whileHover={{ y: -8 }}
                  className={cn(
                    "p-4 rounded-2xl transition-all duration-300 group cursor-pointer border",
                    isActive ? "bg-white/10 border-white/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]" : "bg-white/5 hover:bg-white/10 border-white/5"
                  )}
                  onClick={() => {
                    const displayedSongs = MOCK_SONGS.concat(MOCK_SONGS).slice(0, 6);
                    if (isActive) {
                      togglePlay();
                    } else {
                      setSong(song, displayedSongs);
                    }
                  }}
               >
                  <div className="relative aspect-square mb-4 shadow-2xl rounded-xl overflow-hidden">
                     <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                     <div className={cn(
                       "absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent transition-opacity",
                       isActive ? "opacity-100" : "opacity-100 block"
                     )} />
                     <div className="absolute top-3 left-3 flex gap-2">
                        <LikeButton targetId={song.id} type="song" size={12} className="bg-black/60 rounded-full p-1.5 opacity-100 block shadow-2xl transition-all duration-300" />
                        <Link 
                           to={`/song/${song.id}`}
                           onClick={(e) => e.stopPropagation()}
                           className="bg-black/60 rounded-full p-1.5 opacity-100 block shadow-2xl transition-all duration-300 hover:scale-110 text-white"
                           title="View Details"
                        >
                           <Info size={12} />
                        </Link>
                     </div>
                     <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedSong(song); }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-100 block shadow-2xl transition-all duration-300 hover:scale-110 font-black italic"
                        title="Add to Playlist"
                     >
                        <ListPlus size={16} />
                     </button>
                     <button className={cn(
                       "absolute bottom-3 right-3 w-12 h-12 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-110 border border-white/20",
                       isActive 
                        ? "bg-white text-black opacity-100 translate-y-0" 
                        : "bg-purple-600 text-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 shadow-[0_10px_30px_rgba(168,85,247,0.4)]"
                     )}>
                        {isActive && isPlaying ? (
                           <div className="flex items-end gap-1 h-5">
                              <motion.div animate={{ height: [6, 20, 8, 16, 6] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-black" />
                              <motion.div animate={{ height: [14, 6, 20, 10, 14] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-black" />
                              <motion.div animate={{ height: [10, 16, 6, 20, 10] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-black" />
                           </div>
                        ) : (
                           <Play fill="currentColor" size={20} className={cn(!isActive && "ml-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]")} />
                        )}
                     </button>
                  </div>
                  <h3 className={cn("text-sm font-bold truncate transition-colors", isActive ? "text-purple-400" : "text-white")}>{song.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{song.artist}</p>
                    {song.genre && (
                      <span className="text-[7px] font-black tracking-widest text-purple-400/40 uppercase">
                        {song.genre}
                      </span>
                    )}
                  </div>
                </motion.div>
            )})}
         </div>
      </section>
    </div>
  );
}
