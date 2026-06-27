import { useState, useEffect } from "react";
import { X, Plus, Music, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { safeLocalStorage } from "../lib/safeStorage";

interface AddToPlaylistModalProps {
  song: any;
  onClose: () => void;
}

export function AddToPlaylistModal({ song, onClose }: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlaylists() {
      try {
        const saved = safeLocalStorage.getItem('music_playlists');
        if (saved) {
          setPlaylists(JSON.parse(saved));
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    fetchPlaylists();
  }, []);

  const handleAdd = async (playlistId: string) => {
    setAddingId(playlistId);
    try {
      const saved = safeLocalStorage.getItem('music_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        const updatedList = parsed.map((p: any) => {
          if (p.id === playlistId) {
            const trackPayload = {
              id: song.id,
              title: song.title,
              artist: song.artist,
              albumArt: song.thumbnail || song.albumArt || "",
              duration: song.duration || 0
            };
            
            // Optionally, avoid duplicates
            const currentTracks = p.tracks || [];
            if (!currentTracks.some((t: any) => t.id === trackPayload.id)) {
              currentTracks.push(trackPayload);
            }

            return {
              ...p,
              songIds: Array.from(new Set([...(p.songIds || []), song.id])),
              tracks: currentTracks
            };
          }
          return p;
        });
        safeLocalStorage.setItem('music_playlists', JSON.stringify(updatedList));
        setPlaylists(updatedList);
      }
      setSuccessId(playlistId);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0F0F12] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-black italic tracking-tighter">ADD TO PLAYLIST</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 max-h-[60vh] space-y-2">
          {loading ? (
            <div className="py-10 text-center text-xs font-bold text-white/20 animate-pulse uppercase tracking-widest">Accessing Collections...</div>
          ) : playlists.length === 0 ? (
            <div className="py-10 text-center">
               <p className="text-zinc-500 font-bold italic mb-4 text-sm">NO PLAYLISTS FOUND</p>
               <button className="text-xs font-black text-purple-400 hover:text-purple-300 uppercase underline underline-offset-4">Create New</button>
            </div>
          ) : (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => handleAdd(playlist.id)}
                disabled={addingId !== null}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-2xl transition-all group border border-transparent",
                  successId === playlist.id ? "bg-green-500/10 border-green-500/20" : "hover:bg-white/5 hover:border-white/5"
                )}
              >
                <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <Music size={20} className="text-white/20 group-hover:text-purple-400 transition-colors" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-bold truncate">{playlist.name}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{playlist.songIds?.length || 0} Songs</p>
                </div>
                <div className="shrink-0">
                  {addingId === playlist.id ? (
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  ) : successId === playlist.id ? (
                    <Check size={20} className="text-green-500" />
                  ) : (
                    <Plus size={20} className="text-white/20 group-hover:text-white transition-opacity" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-6 bg-white/5 border-t border-white/5">
           <p className="text-[10px] text-center text-white/20 font-bold uppercase tracking-[0.2em]">Select a destination for your sonic signature</p>
        </div>
      </motion.div>
    </div>
  );
}
