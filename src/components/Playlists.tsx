import { useState, useEffect, useRef } from "react";
import { Plus, Music, ListMusic, Search, Globe, Lock, Users, Trash2, ArrowRight, X, MoreHorizontal, Play as LucidePlay, SkipForward, ListPlus, Edit2, Image as ImageIcon, Smartphone, Share, Upload, RotateCcw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { usePlayerStore } from "../store/usePlayerStore";
import { safeLocalStorage } from "../lib/safeStorage";

export default function Playlists() {
  const [playlists, setPlaylists] = useState<any[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('music_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [deviceDelete, setDeviceDelete] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuView, setMenuView] = useState<"main" | "artwork">("main");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showInternetSearch, setShowInternetSearch] = useState(false);
  const [internetResults, setInternetResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activePlaylistForSearch, setActivePlaylistForSearch] = useState<any>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
        setMenuView("main");
      }
    };
    if (activeMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuId]);

  useEffect(() => {
    if (!activeMenuId) setMenuView("main");
  }, [activeMenuId]);
  const { theme, setSong, setQueue, queue, currentIndex } = usePlayerStore();

  const getPlayableSongs = (playlist: any): import("../store/usePlayerStore").Song[] => {
    if (playlist.tracks && playlist.tracks.length > 0) {
      return playlist.tracks.map((t: any) => ({
        id: t.id,
        title: t.title || "Unknown",
        artist: t.artist || "Unknown",
        thumbnail: t.albumArt || t.thumbnail || "",
        duration: t.duration || 0,
        source: (t.id || "").includes("spotify-") ? "spotify" : "youtube",
        sourceId: (t.id || "").replace("spotify-", "")
      }));
    } else if (playlist.songIds && playlist.songIds.length > 0) {
      return playlist.songIds.map((sid: string) => ({
        id: sid,
        title: "Unknown Track",
        artist: "Unknown Artist",
        thumbnail: "",
        duration: 180,
        source: sid.includes("spotify-") ? "spotify" : "youtube",
        sourceId: sid.replace("spotify-", "")
      }));
    }
    return [];
  };

  useEffect(() => {
    // Read from local storage to keep it up to date when the component mounts
    try {
      const saved = safeLocalStorage.getItem('music_playlists');
      if (saved) {
        setPlaylists(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const placeholderTitle = 'Playlist ' + (playlists.length + 1);
    const finalName = newPlaylistName.trim() || placeholderTitle;
    
    // Create the exact object format expected by the rendering cards
    const newPlaylist = {
      id: Date.now().toString(),
      name: finalName,
      description: newPlaylistDescription,
      songIds: [], // mapped to tracks
      tracks: [], // Keep tracks as requested
      memberIds: [],
      isPublic: true,
      collaborative: false
    };

    const newPlaylists = [newPlaylist, ...playlists];
    setPlaylists(newPlaylists);
    safeLocalStorage.setItem('music_playlists', JSON.stringify(newPlaylists));
    
    setIsCreating(false);
    setNewPlaylistName("");
    setNewPlaylistDescription("");
  };

  const [playlistToDelete, setPlaylistToDelete] = useState<any | null>(null);
  const [playlistToRename, setPlaylistToRename] = useState<any | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const handleDeleteClick = (e: React.MouseEvent, playlist: any) => {
    e.preventDefault();
    e.stopPropagation();
    // A playlist is an entire collection, so we ALWAYS confirm before deleting
    setPlaylistToDelete(playlist);
  };

  const executeDelete = () => {
    if (!playlistToDelete) return;
    const remaining = playlists.filter(p => p.id !== playlistToDelete.id);
    setPlaylists(remaining);
    safeLocalStorage.setItem('music_playlists', JSON.stringify(remaining));
    setPlaylistToDelete(null);
  };

  const executeRename = () => {
    if (!playlistToRename) return;
    if (renameInput && renameInput.trim()) {
      const updated = playlists.map(p => p.id === playlistToRename.id ? {...p, name: renameInput.trim()} : p);
      setPlaylists(updated);
      safeLocalStorage.setItem('music_playlists', JSON.stringify(updated));
    }
    setPlaylistToRename(null);
    setRenameInput("");
  };

  const handleNavigation = (playlistId: string) => {
    if (!playlistId) return;
    navigate(`/playlist/${String(playlistId)}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, playlist: any) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        updatePlaylistArtwork(playlist.id, base64String);
        setActiveMenuId(null);
        setMenuView("main");
      };
      reader.readAsDataURL(file);
    }
  };

  const updatePlaylistArtwork = (playlistId: string, artworkUrl: string) => {
    const updated = playlists.map(p => p.id === playlistId ? { ...p, artwork: artworkUrl } : p);
    setPlaylists(updated);
    safeLocalStorage.setItem('music_playlists', JSON.stringify(updated));
  };

  const resetArtwork = (playlistId: string) => {
    const updated = playlists.map(p => {
      if (p.id === playlistId) {
        const { artwork, ...rest } = p;
        return rest;
      }
      return p;
    });
    setPlaylists(updated);
    safeLocalStorage.setItem('music_playlists', JSON.stringify(updated));
    setActiveMenuId(null);
    setMenuView("main");
  };

  const searchInternetArtwork = async (playlist: any) => {
    setActivePlaylistForSearch(playlist);
    setMenuView("main");
    setActiveMenuId(null);
    setIsSearching(true);
    setShowInternetSearch(true);
    
    // Attempt to use proxy server for artwork search
    const query = playlist.name;
    try {
      const response = await fetch(`/api/artwork?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Network error");
      const data = await response.json();
      if (data.images) {
        setInternetResults(data.images);
      }
    } catch (e) {
      console.error("Failed to fetch artwork", e);
    }
    setIsSearching(false);
  };

  const filteredPlaylists = playlists.filter(p => 
    (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12 overflow-y-auto h-full max-h-screen pb-40 scrollbar-thin scrollbar-thumb-neutral-800">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-6xl font-black italic tracking-tighter text-gradient leading-tight">YOUR COLLECTIONS</h1>
          <p className="text-white/40 text-sm font-medium uppercase tracking-widest mt-2">Manage your musical universe</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 w-fit hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5"
        >
          <Plus size={16} />
          Create New Playlist
        </button>
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
          <button onClick={() => setIsCreating(true)} className="flex items-center gap-3 text-purple-400 hover:text-purple-300 font-black uppercase tracking-[0.2em] text-[10px] transition-all group">
            Initialise Playlist <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-6">
          <AnimatePresence mode="popLayout">
            {filteredPlaylists.map((playlist) => (
              <motion.div
                key={playlist.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn("group relative", activeMenuId === playlist.id ? "z-[9999] md:z-40" : "z-0")}
              >
                <div 
                  onClick={() => handleNavigation(playlist.id)}
                  className="block h-full cursor-pointer bg-white/[0.02] border border-white/5 rounded-2xl p-2.5 sm:p-3 hover:bg-white/[0.05] hover:border-white/10 transition-all shadow-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-1 relative"
                >
                  {/* Absolute title in the top-left corner */}
                  <div className="absolute top-4 left-4 sm:top-4.5 sm:left-4.5 z-20 max-w-[65%] pointer-events-none">
                    <span className="font-bold text-base sm:text-lg text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate block" title={playlist.name}>
                      {playlist.name}
                    </span>
                  </div>

                  {/* Absolute options menu in the top-right corner */}
                  <div className={cn("absolute top-4 right-4 sm:top-4.5 sm:right-4.5", activeMenuId === playlist.id ? "z-[9999] md:z-40" : "z-20")}>
                    <div className="relative">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === playlist.id ? null : playlist.id);
                        }}
                        className="text-neutral-300 hover:text-white p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-colors cursor-pointer flex items-center justify-center border border-white/5 shadow-md text-xl"
                        title="Playlist options"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      
                      <AnimatePresence>
                        {activeMenuId === playlist.id && (
                          <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="fixed top-20 bottom-0 left-0 right-0 w-full rounded-t-3xl md:absolute md:top-full md:right-0 md:bottom-auto md:w-56 md:rounded-lg md:shadow-xl md:border md:border-neutral-800 z-[9999] md:z-40 bg-[#18181b] md:bg-neutral-950 border-t border-neutral-800 flex flex-col overflow-hidden"
                          >
                            
                            {/* Header */}
                            <div className="p-4 border-b border-neutral-800 flex items-center justify-between shrink-0">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center border border-white/5 shadow-inner">
                                  <Music size={16} className="text-white/50" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-sm text-white truncate max-w-[120px]">{playlist.name}</h3>
                                  <p className="text-[10px] text-neutral-400 font-medium mt-0.5">{playlist.songIds?.length || 0} Tracks</p>
                                </div>
                              </div>
                              <button className="p-1.5 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors">
                                <Share size={16} />
                              </button>
                            </div>
                            
                            {/* Actions */}
                            <div className="py-1 flex flex-col h-full overflow-y-auto scrollbar-thin overscroll-contain pb-12 md:pb-1 md:h-auto md:max-h-60">
                               {menuView === "main" ? (
                                <>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const songs = getPlayableSongs(playlist);
                                      if (songs.length > 0) {
                                        setSong(songs[0], songs);
                                      }
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <LucidePlay size={16} className="text-white/70" /> Play
                                  </button>
                                  
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation();
                                      const songs = getPlayableSongs(playlist);
                                      if (songs.length > 0) {
                                        if (queue.length === 0) {
                                          setSong(songs[0], songs);
                                        } else {
                                          const newQueue = [
                                            ...queue.slice(0, currentIndex + 1),
                                            ...songs,
                                            ...queue.slice(currentIndex + 1)
                                          ];
                                          setQueue(newQueue);
                                        }
                                      }
                                      setActiveMenuId(null); 
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <SkipForward size={16} className="text-white/70" /> Play next
                                  </button>
                                  
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation();
                                      const songs = getPlayableSongs(playlist);
                                      if (songs.length > 0) {
                                        if (queue.length === 0) {
                                          setSong(songs[0], songs);
                                        } else {
                                          setQueue([...queue, ...songs]);
                                        }
                                      }
                                      setActiveMenuId(null); 
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <ListPlus size={16} className="text-white/70" /> Add to queue
                                  </button>

                                  <div className="h-px bg-white/5 my-1 mx-2" />

                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPlaylistToRename(playlist);
                                      setRenameInput(playlist.name);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <Edit2 size={16} className="text-white/70" /> Rename playlist
                                  </button>

                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setMenuView("artwork"); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <ImageIcon size={16} className="text-white/70" /> Artwork
                                  </button>

                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if ('serviceWorker' in navigator && window.matchMedia('(display-mode: standalone)').matches === false) {
                                        alert(`To add "${playlist.name}" to your home screen, tap the share icon or menu in your browser and select "Add to Home Screen". The app will open directly to your playlists.`);
                                      } else {
                                        alert(`"${playlist.name}" shortcut prepared. Use your browser's "Add to Home Screen" feature.`);
                                      }
                                      setActiveMenuId(null); 
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <Smartphone size={16} className="text-white/70" /> Add to home screen
                                  </button>

                                  <div className="h-px bg-white/5 my-1 mx-2" />

                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                      handleDeleteClick(e, playlist);
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-white/5 transition-colors flex items-center gap-3 mb-safe md:mb-0 rounded-none"
                                  >
                                    <Trash2 size={16} />
                                    Delete playlist
                                  </button>
                                </>
                               ) : (
                                <>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fileInputRef.current?.click();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <Upload size={16} className="text-white/70" /> Pick from gallery
                                  </button>
                                  
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      searchInternetArtwork(playlist);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <Globe size={16} className="text-white/70" /> Pick from internet
                                  </button>
                                  
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      resetArtwork(playlist.id);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/5 transition-colors rounded-none"
                                  >
                                    <RotateCcw size={16} className="text-white/70" /> Reset
                                  </button>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={(e) => handleFileUpload(e, playlist)} 
                                  />
                                </>
                               )}
                              </div>
                            </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Compact artwork container */}
                  <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 mb-2 flex items-center justify-center relative overflow-hidden shadow-inner">
                    {playlist.artwork ? (
                      <img src={playlist.artwork} alt={playlist.name} className="w-full h-full object-cover" />
                    ) : playlist.songIds?.length > 0 ? (
                      <div className="absolute inset-0 grid grid-cols-2 gap-1 p-1 opacity-20">
                          <div className="bg-purple-600 rounded-tl-xl animate-pulse" />
                          <div className="bg-blue-600 rounded-tr-xl" />
                          <div className="bg-emerald-600 rounded-bl-xl" />
                          <div className="bg-rose-600 rounded-br-xl animate-pulse" />
                      </div>
                    ) : null}
                    {!playlist.artwork && <Music size={24} className="text-white/10 relative z-10" />}
                    
                    <div className={cn("absolute inset-0 bg-black/60 flex items-center justify-center z-10 transition-opacity", activeMenuId === playlist.id ? "opacity-0" : "opacity-0 group-hover:opacity-100 backdrop-blur-[2px]")}>
                      <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-black shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                         <Play fill="black" size={16} className="ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 px-1 pb-1">
                    <div className="flex items-center justify-between w-full mt-1">
                      <span className="text-[10px] font-medium tracking-wider text-neutral-400 uppercase">
                        {playlist.songIds?.length || 0} Tracks
                      </span>
                    </div>

                    {playlist.collaborative && (
                      <div className="flex items-center justify-between pt-1 border-t border-white/5">
                        <div className="flex items-center gap-1">
                          <div className="flex items-center gap-1 text-[7px] sm:text-[8px] font-black uppercase tracking-[0.15em] text-blue-400 bg-blue-400/5 py-0.5 px-1.5 rounded-full border border-blue-400/10">
                            <Users size={8} />
                            Collab
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative"
          >
            <button 
              onClick={() => setIsCreating(false)}
              className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-2xl font-black italic tracking-tighter text-white mb-6 uppercase">Create New Playlist</h2>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Playlist Name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 transition-colors font-medium"
                  autoFocus
                />
              </div>

              <div>
                <textarea
                  placeholder="Description (Optional)"
                  value={newPlaylistDescription}
                  onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 transition-colors resize-none font-medium h-32"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-white text-black rounded-xl py-4 font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Create Playlist
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AnimatePresence>
        {playlistToDelete && (
          <div 
            className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-6"
            onClick={() => setPlaylistToDelete(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "backdrop-blur-md rounded-3xl p-6 w-full max-w-sm border border-neutral-800/40 text-white",
                theme === "classic" ? "bg-[#0F0F12]/95" : "bg-zinc-900/95"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">Delete</h3>
              <p className="text-sm text-neutral-200 leading-relaxed mb-4">
                Are you sure to delete "{playlistToDelete.name}"?
              </p>
              
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer touch-manipulation relative z-50 py-2 inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeviceDelete(!deviceDelete);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setDeviceDelete(!deviceDelete);
                }}
              >
                <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors", deviceDelete ? "border-[#ff5e52]" : "border-neutral-500")}>
                  {deviceDelete && <div className="w-3 h-3 rounded-full bg-[#ff5e52]" />}
                </div>
                <span className="text-sm text-neutral-400">Delete from device</span>
              </div>
              
              <div className="flex items-center justify-between gap-4 mt-6">
                <button 
                  onClick={() => setPlaylistToDelete(null)}
                  className="flex-1 bg-neutral-800/40 text-neutral-300 font-medium py-3 rounded-full text-center hover:bg-neutral-800/70 transition-all uppercase text-xs tracking-wider border border-neutral-700/20"
                >
                  CANCEL
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 bg-[#ff5e52] text-white font-semibold py-3 rounded-full text-center hover:opacity-90 transition-all uppercase text-xs tracking-wider"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {playlistToRename && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlaylistToRename(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#18181b] border border-neutral-800 rounded-2xl p-6 w-[90%] max-w-sm mx-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-4">Rename Playlist</h3>
              <input 
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    executeRename();
                  } else if (e.key === 'Escape') {
                    setPlaylistToRename(null);
                  }
                }}
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors"
              />
              <div className="flex items-center justify-end gap-3 mt-6">
                <button 
                  onClick={() => setPlaylistToRename(null)}
                  className="text-xs font-bold tracking-wider text-white px-4 py-3 rounded-xl hover:bg-neutral-800/50 transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={executeRename}
                  className="bg-white text-black text-xs font-bold tracking-wider px-6 py-3 rounded-full hover:bg-neutral-200 transition-colors"
                >
                  SAVE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Internet Artwork Search Modal */}
      <AnimatePresence>
        {showInternetSearch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInternetSearch(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Pick from internet</h3>
                <button 
                  onClick={() => setShowInternetSearch(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {isSearching ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin mb-4" />
                  <p className="text-sm text-neutral-400">Searching artwork...</p>
                </div>
              ) : internetResults.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 overflow-y-auto scrollbar-thin pb-4">
                  {internetResults.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        updatePlaylistArtwork(activePlaylistForSearch.id, url);
                        setShowInternetSearch(false);
                      }}
                      className="aspect-square rounded-lg overflow-hidden border border-white/5 hover:border-white/50 hover:scale-105 transition-all group relative"
                    >
                      <img src={url} alt={`Result ${i}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ImageIcon size={20} className="text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                  <ImageIcon size={32} className="text-white/20 mb-3" />
                  <p className="text-sm text-neutral-400">No artwork found for "{activePlaylistForSearch?.name}"</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
