import { useState, useEffect } from "react";
import { Heart, Play, ListPlus, Loader2, Music, Trash2, Info, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { useLikeStore } from "../store/useLikeStore";
import { motion, AnimatePresence } from "motion/react";
import { db, auth } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { fetchSongMetadata } from "../services/musicService";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { cn } from "../lib/utils";
import { LikeButton } from "./LikeButton";
// import { getTrack } from "../lib/offlineStorage";

export default function Liked() {
  const { likedSongs: persistedSongs, setSong, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const { likedPlaylists, toggleLike } = useLikeStore();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  useEffect(() => {
    const fetchLikedPlaylists = async () => {
      setLoadingPlaylists(true);
      try {
        // Fetch playlists
        const playlistPromises = Array.from(likedPlaylists).map(async (id) => {
          try {
            const d = await getDoc(doc(db, "playlists", id));
            return d.exists() ? { id: d.id, ...d.data() } : null;
          } catch (err: any) {
            const isPermissionError = err && (err.code === "permission-denied" || String(err).includes("permissions") || String(err).includes("permission") || String(err).includes("denied"));
            if (isPermissionError) {
              const errInfo = {
                error: err instanceof Error ? err.message : String(err),
                authInfo: {
                  userId: auth.currentUser?.uid || null,
                  email: auth.currentUser?.email || null,
                  emailVerified: auth.currentUser?.emailVerified || null,
                  isAnonymous: auth.currentUser?.isAnonymous || null,
                  tenantId: auth.currentUser?.tenantId || null,
                  providerInfo: auth.currentUser?.providerData?.map(provider => ({
                    providerId: provider.providerId,
                    email: provider.email,
                  })) || []
                },
                operationType: "get",
                path: `playlists/${id}`
              };
              console.error('Firestore Error: ', JSON.stringify(errInfo));
            } else {
              console.error(`Error fetching playlist ${id}:`, err);
            }
            return null; // Gracefully continue loading other liked playlists to avoid complete failure
          }
        });
        const resolvedPlaylists = (await Promise.all(playlistPromises)).filter(Boolean);
        setPlaylists(resolvedPlaylists);
      } catch (err) {
        console.error("Failed to fetch liked playlists:", err);
      } finally {
        setLoadingPlaylists(false);
      }
    };

    if (likedPlaylists.size >= 0) {
      fetchLikedPlaylists();
    }
  }, [likedPlaylists]);

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

      <header className="relative py-20 px-12 rounded-[40px] overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-600 via-purple-600 to-indigo-700 opacity-80 group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1459749411177-042180ce673c?w=1200')] bg-cover bg-center mix-blend-overlay" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
          <div className="w-48 h-48 rounded-3xl bg-white/20 backdrop-blur-3xl flex items-center justify-center border border-white/20 shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
            <Heart size={80} fill="white" className="text-white drop-shadow-lg" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white leading-[0.8] mb-4 uppercase">Liked</h1>
            <p className="text-white/60 text-lg font-bold uppercase tracking-[.25em]">Your private selection of signals</p>
          </div>
        </div>
      </header>

      {/* Liked Playlists Grid */}
      {playlists.length > 0 && (
        <section>
          <div className="flex items-center gap-4 mb-8">
             <div className="bg-purple-500 p-2 rounded-xl">
               <Music size={24} className="text-white" />
             </div>
             <h2 className="text-2xl font-black italic tracking-tighter uppercase">Liked Playlists</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {playlists.map((playlist) => (
              <motion.div
                key={playlist.id}
                whileHover={{ y: -8 }}
                className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group cursor-pointer"
              >
                <div className="relative aspect-square mb-4 rounded-xl overflow-hidden shadow-xl">
                   <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                     <Music size={48} className="text-white/10" />
                   </div>
                   <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent p-4 flex items-end justify-between">
                     <LikeButton targetId={playlist.id} type="playlist" size={20} />
                     <button className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center opacity-100 block shadow-2xl transition-all hover:scale-110">
                        <Play fill="black" size={20} />
                     </button>
                   </div>
                </div>
                <h3 className="text-sm font-bold truncate text-white">{playlist.name}</h3>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Playlist • {playlist.songIds?.length || 0} songs</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Liked Songs List */}
      <section>
        <div className="flex items-center gap-4 mb-8">
           <div className="bg-pink-500 p-2 rounded-xl">
             <Heart size={24} className="text-white" fill="white" />
           </div>
           <h2 className="text-2xl font-black italic tracking-tighter uppercase">Liked Songs</h2>
        </div>

        {persistedSongs.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/2">
             <p className="text-zinc-600 font-bold italic uppercase text-lg">Your heart is quiet. Like a song to fill it.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {persistedSongs.map((song, index) => {
              const isActive = currentSong?.id === song.id;
              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ 
                    y: -4, 
                    scale: 1.01,
                    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.4)"
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 p-4 rounded-2xl transition-all group cursor-pointer border",
                    isActive ? "bg-white/10 border-white/10 shadow-lg" : "bg-white/5 hover:bg-white/10 border-transparent"
                  )}
                  onClick={() => isActive ? togglePlay() : setSong(song, persistedSongs)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden relative shadow-lg shrink-0 bg-zinc-800">
                      <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" />
                      {isActive && <div className="absolute inset-0 bg-purple-500/20" />}
                    </div>
                    <div className="flex-grow flex-1 min-w-0">
                      <h3 className={cn("font-bold text-sm tracking-tight truncate", isActive ? "text-purple-400" : "text-white")}>{song.title}</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-3 ml-auto">
                    <span className="text-[10px] text-white/20 font-mono shrink-0 w-10 text-right">
                      {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : "03:45"}
                    </span>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedSong(song); }}
                      className="text-white/40 hover:text-white transition-all"
                      title="Add to Playlist"
                    >
                      <ListPlus size={16} />
                    </button>
                    <LikeButton targetId={song.id} type="song" song={song} size={16} className="transition-all flex" />
                    <Link 
                      to={`/song/${song.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-white/40 hover:text-white transition-all"
                      title="View Details"
                    >
                      <MoreHorizontal size={16} />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
