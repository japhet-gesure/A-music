import { useState, useEffect } from "react";
import { Plus, Music, ListMusic, Search, Globe, Lock, Users, Trash2, ArrowRight } from "lucide-react";
import { collection, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export default function Playlists() {
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "playlists"),
      where("ownerId", "==", auth.currentUser.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlaylists(p);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this playlist? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "playlists", id));
      } catch (err) {
        console.error("Failed to delete playlist", err);
      }
    }
  };

  const filteredPlaylists = playlists.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black italic tracking-tighter text-gradient leading-tight">YOUR COLLECTIONS</h1>
          <p className="text-white/40 text-sm font-medium uppercase tracking-widest mt-2">Manage your musical universe</p>
        </div>
        <Link 
          to="/create-playlist"
          className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 w-fit hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5"
        >
          <Plus size={16} />
          Create New Session
        </Link>
      </header>

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
        <input 
          type="text"
          placeholder="Filter your playlists..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-5 pl-12 pr-6 text-sm focus:outline-none focus:border-purple-500/50 transition-all font-medium"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-40">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(i => (
              <motion.div
                key={i}
                animate={{ height: [12, 40, 12] }}
                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                className="w-2 bg-purple-500 rounded-full"
              />
            ))}
          </div>
        </div>
      ) : filteredPlaylists.length === 0 ? (
        <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/5 rounded-[40px] flex flex-col items-center">
          <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 rotate-3">
            <ListMusic size={40} className="text-white/10" />
          </div>
          <h2 className="text-2xl font-black text-white/40 italic uppercase tracking-tight">The vault is empty</h2>
          <p className="text-sm text-white/20 mt-2 mb-10 max-w-xs mx-auto leading-relaxed">Start your legacy by curating your first collaborative or personal music session.</p>
          <Link to="/create-playlist" className="flex items-center gap-3 text-purple-400 hover:text-purple-300 font-black uppercase tracking-[0.2em] text-[10px] transition-all group">
            Initialise Playlist <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredPlaylists.map((playlist) => (
              <motion.div
                key={playlist.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative"
              >
                <Link 
                  to={`/playlist/${playlist.id}`}
                  className="block h-full bg-white/[0.02] border border-white/5 rounded-[32px] p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all shadow-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-1"
                >
                  <div className="aspect-square rounded-[24px] bg-gradient-to-br from-zinc-800 to-zinc-900 mb-6 flex items-center justify-center relative overflow-hidden shadow-inner">
                    {playlist.songIds?.length > 0 ? (
                      <div className="absolute inset-0 grid grid-cols-2 gap-1 p-1 opacity-20">
                         <div className="bg-purple-600 rounded-tl-xl animate-pulse" />
                         <div className="bg-blue-600 rounded-tr-xl" />
                         <div className="bg-emerald-600 rounded-bl-xl" />
                         <div className="bg-rose-600 rounded-br-xl animate-pulse" />
                      </div>
                    ) : null}
                    <Music size={40} className="text-white/10 relative z-10" />
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 backdrop-blur-[2px]">
                      <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-black shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                         <Play fill="black" size={24} className="ml-1" />
                      </div>
                    </div>

                    <div className="absolute top-4 left-4 z-10">
                      <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-white/90 bg-black/40 backdrop-blur-md py-1.5 px-3 rounded-full border border-white/10">
                        {playlist.isPublic ? <Globe size={8} /> : <Lock size={8} />}
                        {playlist.isPublic ? "Public" : "Private"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-black text-xl italic uppercase tracking-tight truncate text-white">{playlist.name}</h3>
                        <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest mt-0.5">Session ID: {playlist.id.slice(0, 8)}</p>
                      </div>
                      <button 
                        onClick={(e) => handleDelete(e, playlist.id)}
                        className="p-2 text-white/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 bg-white/5 rounded-full"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <p className="text-xs text-white/30 line-clamp-2 h-8 leading-relaxed font-medium">
                      {playlist.description || "Experimental sonic composition."}
                    </p>

                    <div className="flex items-center justify-between pt-5 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        {playlist.collaborative && (
                          <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-blue-400 bg-blue-400/5 py-1 px-3 rounded-full border border-blue-400/10">
                            <Users size={8} />
                            Collaborative
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">
                        {playlist.songIds?.length || 0} Tracks
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Helper for the play icon
function Play({ size = 24, fill = "none", className = "" }: { size?: number, fill?: string, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill={fill} 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
