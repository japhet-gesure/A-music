import { useState, useEffect } from "react";
import { Heart, Play, ListPlus, Loader2, Music, Trash2, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { useLikeStore } from "../store/useLikeStore";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { fetchSongMetadata } from "../services/musicService";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { cn } from "../lib/utils";
import { LikeButton } from "./LikeButton";
// import { getTrack } from "../lib/offlineStorage";

export default function Liked() {
  const { likedSongs, likedPlaylists, toggleLike } = useLikeStore();
  const { setSong, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLikedContent = async () => {
      setLoading(true);
      try {
        // Fetch songs
        const songPromises = Array.from(likedSongs).map(id => fetchSongMetadata(id));
        const resolvedSongs = (await Promise.all(songPromises)).filter(Boolean) as Song[];
        setSongs(resolvedSongs);

        // Fetch playlists
        const playlistPromises = Array.from(likedPlaylists).map(async (id) => {
          const d = await getDoc(doc(db, "playlists", id));
          return d.exists() ? { id: d.id, ...d.data() } : null;
        });
        const resolvedPlaylists = (await Promise.all(playlistPromises)).filter(Boolean);
        setPlaylists(resolvedPlaylists);
      } catch (err) {
        console.error("Failed to fetch liked content:", err);
      } finally {
        setLoading(false);
      }
    };

    if (likedSongs.size >= 0 || likedPlaylists.size >= 0) {
      fetchLikedContent();
    }
  }, [likedSongs, likedPlaylists]);

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
                     <button className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-2xl transition-all hover:scale-110">
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

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={48} className="text-purple-500 animate-spin" />
          </div>
        ) : songs.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[40px] bg-white/2">
             <p className="text-zinc-600 font-bold italic uppercase text-lg">Your heart is quiet. Like a song to fill it.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {songs.map((song, index) => {
              const isActive = currentSong?.id === song.id;
              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl transition-all group cursor-pointer border",
                    isActive ? "bg-white/10 border-white/10 shadow-lg" : "bg-white/5 hover:bg-white/10 border-transparent"
                  )}
                  onClick={() => isActive ? togglePlay() : setSong(song, songs)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden relative shadow-lg shrink-0 bg-zinc-800">
                      <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover" />
                      {isActive && <div className="absolute inset-0 bg-purple-500/20" />}
                    </div>
                    <div className="min-w-0 pr-4">
                      <h3 className={cn("font-bold text-sm tracking-tight truncate", isActive ? "text-purple-400" : "text-white")}>{song.title}</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">{song.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden group-hover:flex items-center gap-2">
                      <Link 
                        to={`/song/${song.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-full bg-white/5 text-white/40 hover:text-white"
                        title="View Details"
                      >
                        <Info size={18} />
                      </Link>
                      <LikeButton targetId={song.id} type="song" size={18} />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedSongId(song.id); }}
                        className="p-2 rounded-full bg-white/5 text-white/40 hover:text-white"
                      >
                        <ListPlus size={18} />
                      </button>
                    </div>
                    <span className="text-[10px] text-white/20 font-mono hidden md:block">03:45</span>
                    <Play size={18} className={cn("transition-all", isActive ? "text-purple-400 opacity-100" : "opacity-0 group-hover:opacity-100 text-purple-400")} />
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
