import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Play, UserPlus, Trash2, Clock, MoreHorizontal, Users, Music, Heart, Info, ArrowUpDown, ListFilter, MoreVertical, X, Check, Shuffle } from "lucide-react";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { fetchSongMetadata } from "../services/musicService";
import { safeLocalStorage } from "../lib/safeStorage";
import { TrackOptionsMenu } from "./TrackOptionsMenu";
import { deleteTrack as removeFromOffline } from "../lib/offlineStorage";

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedSongs, setResolvedSongs] = useState<Record<string, Song>>({});
  const { setSong, currentSong, currentIndex, isPlaying, togglePlay, requireDeleteConfirmation, theme, queue, setQueue, addToQueue, clearQueue, shuffleMode, setShuffleMode } = usePlayerStore();
  const [trackToDelete, setTrackToDelete] = useState<string | null>(null);
  const [deviceDelete, setDeviceDelete] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showDeletePlaylist, setShowDeletePlaylist] = useState(false);
  const [showSortBy, setShowSortBy] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [activeMenuSong, setActiveMenuSong] = useState<Song | null>(null);

  useEffect(() => {
    if (!id) return;
    try {
      const saved = safeLocalStorage.getItem('music_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = parsed.find((p: any) => String(p.id) === String(id));
        if (found) {
          setPlaylist(found);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (playlist?.songIds) {
      const fetchAll = async () => {
        const newResolved: Record<string, Song> = { ...resolvedSongs };
        let changed = false;
        for (const sid of playlist.songIds) {
          if (!newResolved[sid]) {
            const meta = await fetchSongMetadata(sid);
            newResolved[sid] = meta;
            changed = true;
          }
        }
        if (changed) setResolvedSongs(newResolved);
      };
      fetchAll();
    }
  }, [playlist?.songIds]);

  const canEdit = true; // For local storage logic, just let them edit
  const isOwner = true;

  const updateLocalPlaylists = (updatedPlaylist: any) => {
    try {
      const saved = safeLocalStorage.getItem('music_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        const updatedList = parsed.map((p: any) => p.id === updatedPlaylist.id ? updatedPlaylist : p);
        safeLocalStorage.setItem('music_playlists', JSON.stringify(updatedList));
        setPlaylist(updatedPlaylist);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const executeRemoveSong = async () => {
    if (!canEdit || !id || !playlist || !trackToDelete) return;
    const newSongIds = (playlist.songIds || []).filter((s: string) => s !== trackToDelete);
    updateLocalPlaylists({ ...playlist, songIds: newSongIds });
    setTrackToDelete(null);
  };

  const executePermanentDeleteSong = async (songId: string) => {
    // Remove from current playlist if possible
    if (canEdit && id && playlist) {
      const newSongIds = (playlist.songIds || []).filter((s: string) => s !== songId);
      updateLocalPlaylists({ ...playlist, songIds: newSongIds });
    }
    // Delete from offline storage
    try {
      await removeFromOffline(songId);
    } catch (e) {
      console.error("Failed to delete track from offline storage in PlaylistDetail screen:", e);
    }
  };

  const renamePlaylist = () => {
    if (!newName.trim() || !id || !playlist) return;
    const updated = { ...playlist, name: newName.trim() };
    updateLocalPlaylists(updated);
    setIsRenaming(false);
    setShowMenu(false);
  };

  const attemptRemoveSong = (songId: string) => {
    if (requireDeleteConfirmation) {
      setTrackToDelete(songId);
    } else {
      if (!canEdit || !id || !playlist) return;
      const newSongIds = (playlist.songIds || []).filter((s: string) => s !== songId);
      updateLocalPlaylists({ ...playlist, songIds: newSongIds });
    }
  };

  const inviteUser = async () => {
    const userId = prompt("Enter the User ID or Email to invite:");
    if (userId && id && playlist) {
      const newMembers = [...(playlist.memberIds || []), userId.trim()];
      updateLocalPlaylists({ ...playlist, memberIds: newMembers, collaborative: true });
    }
  };

  const revokeAccess = async (userId: string) => {
    if (!isOwner || !id || !playlist) return;
    const newMembers = (playlist.memberIds || []).filter((m: string) => m !== userId);
    updateLocalPlaylists({ ...playlist, memberIds: newMembers });
  };

  const executeDeletePlaylist = () => {
    try {
      const saved = safeLocalStorage.getItem('music_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        const updatedList = parsed.filter((p: any) => p.id !== playlist.id);
        safeLocalStorage.setItem('music_playlists', JSON.stringify(updatedList));
      }
    } catch (e) {
      console.error(e);
    }
    navigate('/playlists');
  };

  const handleSortList = (type: 'name' | 'date') => {
    try {
      const saved = safeLocalStorage.getItem('music_playlists');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      const original = parsed.find((p: any) => String(p.id) === String(id));
      if (!original) return;
      
      let newSongIds = [...(original.songIds || [])];
      let newTracks = original.tracks ? [...original.tracks] : [];
      
      if (type === 'name') {
        newSongIds.sort((a, b) => {
          const trackA = newTracks.find((t: any) => t.id === a) || {};
          const trackB = newTracks.find((t: any) => t.id === b) || {};
          const titleA = trackA.title?.toLowerCase() || resolvedSongs[a]?.title?.toLowerCase() || '';
          const titleB = trackB.title?.toLowerCase() || resolvedSongs[b]?.title?.toLowerCase() || '';
          return titleA.localeCompare(titleB);
        });
        
        newTracks.sort((a, b) => {
           const titleA = a.title?.toLowerCase() || '';
           const titleB = b.title?.toLowerCase() || '';
           return titleA.localeCompare(titleB);
        });
      }
      
      const updated = { ...original, songIds: newSongIds, tracks: newTracks, sortOrder: type };
      updateLocalPlaylists(updated);
      setShowSortBy(false);
    } catch (e) {
      console.error("Sorting error:", e);
    }
  };

  const handleShuffleAll = () => {
    const sorted = Object.values(resolvedSongs);
    const shuffled = [...sorted].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
    if(shuffled.length > 0) setSong(shuffled[0], shuffled);
    setShowMenu(false);
  };

  const handlePlayNext = () => {
    // Only map valid songs according to the explicit playlist songIds order to maintain sequence
    const orderedSongs = (playlist.songIds || []).map((id: string) => resolvedSongs[id]).filter(Boolean);
    if(orderedSongs.length === 0) return;
    if (queue.length === 0) {
      setSong(orderedSongs[0], orderedSongs);
    } else {
      const newQueue = [
        ...queue.slice(0, currentIndex + 1),
        ...orderedSongs,
        ...queue.slice(currentIndex + 1)
      ];
      setQueue(newQueue);
    }
    setShowMenu(false);
  };

  const handleAddToQueue = () => {
    const orderedSongs = (playlist.songIds || []).map((id: string) => resolvedSongs[id]).filter(Boolean);
    if(orderedSongs.length === 0) return;
    if (queue.length === 0) {
      setSong(orderedSongs[0], orderedSongs);
    } else {
      setQueue([...queue, ...orderedSongs]);
    }
    setShowMenu(false);
  };

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

  if (loading) return <div className="animate-pulse flex items-center justify-center py-20">Loading...</div>;
  if (!playlist) return <div className="text-center py-20 font-black italic">PLAYLIST NOT FOUND</div>;

  return (
    <div className="space-y-10 relative">
      <div className="absolute top-4 right-4 z-30">
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/10"
        >
          <MoreVertical size={20} />
        </button>
        <AnimatePresence>
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-50 bg-transparent" 
                onClick={() => setShowMenu(false)} 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className={cn(
                  "absolute right-0 mt-2 z-50 min-w-[200px] p-2 text-white border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md", 
                  theme === "classic" ? "bg-[#0F0F12]/95" : "bg-zinc-900/95"
                )}
              >
                <div className="flex flex-col gap-1 w-full text-sm font-medium">
                  <button 
                    onClick={() => { setIsSelecting(!isSelecting); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Select
                  </button>
                  <button 
                    onClick={handleShuffleAll}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Shuffle all
                  </button>
                  <button 
                    onClick={handlePlayNext}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Play next
                  </button>
                  <button 
                    onClick={() => { setShowSortBy(!showSortBy); }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between"
                  >
                    <span>Sort by</span>
                    <span className="text-white/40 text-xs">Name</span>
                  </button>
                  {showSortBy && (
                    <div className="flex flex-col ml-4 border-l border-white/10 pl-2 mb-2 gap-1 text-xs">
                      <button className="text-left py-1 hover:text-purple-400">Name</button>
                      <button className="text-left py-1 hover:text-purple-400">Date Added</button>
                      <button className="text-left py-1 hover:text-purple-400">Duration</button>
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      setNewName(playlist.name || "");
                      setIsRenaming(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Rename playlist
                  </button>
                  <button 
                    onClick={handleAddToQueue}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Add to queue
                  </button>
                  <button 
                    onClick={() => setShowMenu(false)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Add to playlist
                  </button>
                  <button 
                    onClick={() => { 
                      if ('serviceWorker' in navigator && window.matchMedia('(display-mode: standalone)').matches === false) {
                        alert(`To add "${playlist.name}" to your home screen, tap the share icon or menu in your browser and select "Add to Home Screen". The app will open directly to your playlists.`);
                      } else {
                        alert(`"${playlist.name}" shortcut prepared. Use your browser's "Add to Home Screen" feature.`);
                      }
                      setShowMenu(false); 
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Add to home screen
                  </button>
                  <button 
                    onClick={() => { setShowDeletePlaylist(true); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors mt-1 border-t border-white/5 pt-3"
                  >
                    Delete playlist
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isRenaming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRenaming(false)}
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
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renamePlaylist();
                  } else if (e.key === 'Escape') {
                    setIsRenaming(false);
                  }
                }}
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors"
              />
              <div className="flex items-center justify-end gap-3 mt-6">
                <button 
                  onClick={() => setIsRenaming(false)}
                  className="text-xs font-bold tracking-wider text-white px-4 py-3 rounded-xl hover:bg-neutral-800/50 transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={renamePlaylist}
                  className="bg-white text-black text-xs font-bold tracking-wider px-6 py-3 rounded-full hover:bg-neutral-200 transition-colors"
                >
                  SAVE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeletePlaylist && (
          <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-6" onClick={() => setShowDeletePlaylist(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "backdrop-blur-md rounded-3xl p-6 w-full max-w-sm border border-neutral-800/40 text-white",
                theme === "classic" ? "bg-[#0F0F12]/95" : "bg-zinc-900/95"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4">Delete Playlist</h3>
              <p className="text-sm text-neutral-200 leading-relaxed mb-4">
                Are you sure to delete "{playlist.name}"?
              </p>
              
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer touch-manipulation relative z-50 py-2 inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeviceDelete(prev => !prev);
                }}
              >
                <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors", deviceDelete ? "border-[#ff5e52]" : "border-neutral-500")}>
                  {deviceDelete && <div className="w-3 h-3 rounded-full bg-[#ff5e52]" />}
                </div>
                <span className="text-sm text-neutral-400">Delete from device</span>
              </div>
              
              <div className="flex items-center justify-between gap-4 mt-6">
                <button 
                  onClick={() => setShowDeletePlaylist(false)}
                  className="flex-1 bg-neutral-800/40 text-neutral-300 font-medium py-3 rounded-full text-center hover:bg-neutral-800/70 transition-all uppercase text-xs tracking-wider border border-neutral-700/20"
                >
                  CANCEL
                </button>
                <button 
                  onClick={executeDeletePlaylist}
                  className="flex-1 bg-[#ff5e52] text-white font-semibold py-3 rounded-full text-center hover:opacity-90 transition-all uppercase text-xs tracking-wider"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col md:flex-row items-center md:items-end gap-8 pt-8">
        <div className="w-64 h-64 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center border border-white/5 group relative shrink-0">
          {playlist.artwork ? (
            <img src={playlist.artwork} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <Music size={80} className="text-white/10" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
             <button 
               onClick={() => {
                 if (playlist.songIds?.length > 0) {
                   const firstSong = resolvedSongs[playlist.songIds[0]];
                   const queue = playlist.songIds.map((sid: string) => resolvedSongs[sid]).filter(Boolean);
                   if (firstSong) setSong(firstSong, queue);
                 }
               }}
               className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl"
             >
                <Play size={32} fill="currentColor" className="ml-1" />
             </button>
          </div>
        </div>
        <div className="w-full px-4 flex flex-col items-center text-center gap-1 md:items-start md:text-left">
           <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{playlist.isPublic ? "Public" : "Private"} Playlist</span>
           <h1 className="text-4xl md:text-7xl font-black italic tracking-tighter leading-tight break-words max-w-full text-center md:text-left">{playlist.name}</h1>
           <p className="text-zinc-500 font-medium text-sm italic">{playlist.description || "No description provided."}</p>
           <div className="flex items-center gap-2 pt-2 justify-center md:justify-start flex-wrap">
             <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
             <span className="text-xs font-bold whitespace-nowrap">You</span>
             <span className="mx-2 opacity-20">•</span>
             <span className="text-xs font-medium text-zinc-400 whitespace-nowrap">{playlist.songIds?.length || 0} songs</span>
             {playlist.collaborative && (
               <span className="ml-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-500/20 whitespace-nowrap mt-2 md:mt-0">
                 <Users size={10} /> Collaborative
               </span>
             )}
           </div>
        </div>
      </header>

      {/* Actions */}
      <div className="flex items-center gap-6 justify-center md:justify-start pb-4">
         <button 
           onClick={() => {
             if (playlist.songIds?.length > 0) {
               const firstSong = resolvedSongs[playlist.songIds[0]];
               const queue = playlist.songIds.map((sid: string) => resolvedSongs[sid]).filter(Boolean);
               if (firstSong) setSong(firstSong, queue);
             }
           }}
           className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 transition-transform shrink-0"
         >
            <Play size={28} fill="currentColor" className="ml-1" />
         </button>
         <div className="relative">
           <button 
             onClick={() => setShowSortBy(!showSortBy)}
             className={cn("w-12 h-12 rounded-full border flex items-center justify-center transition-colors shrink-0", showSortBy ? "bg-white/10 border-white/20 text-white" : "border-white/10 text-white/60 hover:text-white bg-white/5")}
           >
              <ArrowUpDown size={20} />
           </button>
           <AnimatePresence>
             {showSortBy && (
               <>
                 <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowSortBy(false)} />
                 <motion.div
                   initial={{ opacity: 0, scale: 0.95, y: 10 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95, y: 10 }}
                   className={cn(
                     "absolute left-0 mt-2 z-50 w-48 p-2 text-white border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md", 
                     theme === "classic" ? "bg-[#0F0F12]/95" : "bg-zinc-900/95"
                   )}
                 >
                    <button 
                      onClick={() => handleSortList('date')}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-sm font-medium"
                    >
                      Sort by Date Added
                    </button>
                    <button 
                      onClick={() => handleSortList('name')}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-sm font-medium"
                    >
                      Sort by Name
                    </button>
                 </motion.div>
               </>
             )}
           </AnimatePresence>
         </div>
         <button 
           onClick={() => {
              setShuffleMode(!shuffleMode);
              if (!shuffleMode && playlist.songIds?.length > 0) {
                 handleShuffleAll();
              }
           }}
           className={cn("w-12 h-12 rounded-full border flex items-center justify-center transition-colors shrink-0 relative overflow-hidden", shuffleMode ? "bg-purple-600/20 border-purple-500/50 text-purple-400" : "border-white/10 text-white/60 hover:text-white bg-white/5")}
         >
            {shuffleMode && <div className="absolute inset-0 bg-purple-500/10 mix-blend-overlay" />}
            <Shuffle size={20} className={cn(shuffleMode && "drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]")} />
         </button>
      </div>

      {/* Collaborators List */}
      <AnimatePresence>
        {playlist.collaborative && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-white/5 rounded-3xl p-6 border border-white/5 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
               <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Active Members</h4>
               <button onClick={inviteUser} className="text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase underline underline-offset-4">Add Friend</button>
            </div>
            <div className="flex flex-wrap gap-4">
               <div className="flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-full border border-purple-500/20">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600" />
                  <span className="text-xs font-bold">Owner (You)</span>
               </div>
               {playlist.memberIds?.map((memberId: string) => (
                 <div key={memberId} className="flex items-center gap-2 bg-white/5 py-1.5 px-3 rounded-full border border-white/10 group">
                    <div className="w-6 h-6 rounded-full bg-zinc-800" />
                    <span className="text-xs font-medium text-white/60">{memberId}</span>
                    {isOwner && (
                      <button onClick={() => revokeAccess(memberId)} className="opacity-100 block text-red-500 transition-opacity">
                         <Trash2 size={12} />
                      </button>
                    )}
                 </div>
               ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Songs List */}
      <div className="space-y-1">
        <div className="flex items-center gap-4 px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-white/20 border-b border-white/5 mb-4">
           <span className="w-8 flex-shrink-0 text-center">#</span>
           <span className="flex-1 min-w-0">Title</span>
           <span className="hidden md:block w-1/4">Album / Source</span>
           <span className="flex-shrink-0 w-32 text-right"><Clock size={12} className="inline-block" /></span>
        </div>
        {playlist.songIds?.length === 0 ? (
           <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <p className="text-zinc-600 font-bold italic">RECORDS ARE EMPTY. ADD MUSIC TO BEGIN.</p>
           </div>
        ) : (
           (() => {
             const playableQueue = (playlist.songIds || []).map((sid: string) => {
                 const song = resolvedSongs[sid];
                 const trackMeta = playlist.tracks?.find((t: any) => t.id === sid) || {};
                 const displayTitle = trackMeta.title || song?.title || "Unknown Track";
                 const displayArtist = trackMeta.artist || song?.artist || "Unknown Artist";
                 const displayThumbnail = trackMeta.albumArt || song?.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop";

                 return {
                     ...(song || {}),
                     id: sid,
                     title: displayTitle,
                     artist: displayArtist,
                     thumbnail: displayThumbnail,
                     duration: trackMeta.duration || song?.duration || 180,
                     source: song?.source || (sid.includes("spotify-") ? "spotify" : "youtube"),
                     sourceId: song?.sourceId || sid.replace("spotify-", "")
                 };
             });

             return playlist.songIds?.map((songId: string, i: number) => {
               const song = resolvedSongs[songId];
               const playableSong = playableQueue[i];
               const isActive = currentSong?.id === songId;
               const trackMeta = playlist.tracks?.find((t: any) => t.id === songId) || {};
               
               const displayTitle = playableSong.title;
               const displayArtist = playableSong.artist;
               const displayThumbnail = playableSong.thumbnail;

               return (
               <div 
                 key={songId}
                 className={cn(
                   "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all group cursor-pointer border",
                   isActive ? "bg-white/10 border-white/10" : "hover:bg-white/5 border-transparent hover:border-white/5"
                 )}
                 onClick={() => {
                   if (isActive) togglePlay();
                   else setSong(playableSong, playableQueue.length > 0 ? playableQueue : [playableSong]);
                 }}
               >
                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                  {isActive && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-3">
                       <motion.div animate={{ height: [4, 12, 6, 10, 4] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-0.5 bg-purple-400" />
                       <motion.div animate={{ height: [8, 4, 10, 6, 8] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-0.5 bg-purple-400" />
                       <motion.div animate={{ height: [6, 10, 4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-0.5 bg-purple-400" />
                    </div>
                  ) : (
                    <>
                      <span className={cn("text-xs font-mono block", isActive ? "text-purple-400 group-hover:hidden" : "text-zinc-600 group-hover:hidden")}>
                        {i + 1}
                      </span>
                      <Play size={12} className={cn("hidden md:group-hover:block", isActive ? "text-purple-400" : "text-white/40")} />
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-4 flex-1 min-w-0">
                   <div className="w-10 h-10 rounded bg-white/10 flex-shrink-0 overflow-hidden shadow-lg relative">
                      <img src={displayThumbnail} className="w-full h-full object-cover" />
                      {isActive && <div className="absolute inset-0 bg-purple-500/20" />}
                   </div>
                   <div className="flex-grow flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
                      <p className={cn("text-sm font-bold truncate", isActive ? "text-purple-400" : "text-white")}>
                        {displayTitle}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate">{displayArtist}</p>
                   </div>
                </div>

                <div className={cn(
                  "hidden md:block w-1/4 text-[10px] font-bold uppercase tracking-wider truncate",
                  isActive ? "text-purple-400/60" : "text-zinc-500"
                )}>
                   {song?.album || "Sonic Vault"} • {playableSong.source?.toUpperCase() || "CLOUD"}
                </div>

                <div className="flex-shrink-0 flex items-center gap-3 ml-auto">
                   <span className={cn("text-[10px] font-mono shrink-0 w-10 text-right", isActive ? "text-purple-400" : "text-zinc-600")}>
                      {formatDuration(song?.duration)}
                   </span>

                   {canEdit && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); attemptRemoveSong(songId); }}
                       className="text-zinc-500 hover:text-red-500 transition-colors hidden md:block"
                     >
                       <Trash2 size={16} />
                     </button>
                   )}

                   <LikeButton targetId={songId} type="song" size={16} className="transition-all hidden md:flex" />
                   <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        const handleOpenTrackMenu = (track: any) => {
                          setActiveMenuSong(track);
                        };
                        handleOpenTrackMenu(playableSong);
                      }}
                      className="text-white/40 hover:text-white transition-all"
                      title="More options"
                   >
                      <MoreHorizontal size={16} />
                   </button>
                </div>
             </div>
           );
         });
         })()
        )}
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {trackToDelete && (
          <div 
            className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-6"
            onClick={() => setTrackToDelete(null)}
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
                Are you sure to delete "{resolvedSongs[trackToDelete]?.title || "this track"}"?
              </p>
              
              <div 
                className="flex items-center gap-3 mb-2 cursor-pointer touch-manipulation relative z-50 py-2 inline-flex"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeviceDelete(prev => !prev);
                }}
              >
                <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors", deviceDelete ? "border-[#ff5e52]" : "border-neutral-500")}>
                  {deviceDelete && <div className="w-3 h-3 rounded-full bg-[#ff5e52]" />}
                </div>
                <span className="text-sm text-neutral-400">Delete from device</span>
              </div>
              
              <div className="flex items-center justify-between gap-4 mt-6">
                <button 
                  onClick={() => setTrackToDelete(null)}
                  className="flex-1 bg-neutral-800/40 text-neutral-300 font-medium py-3 rounded-full text-center hover:bg-neutral-800/70 transition-all uppercase text-xs tracking-wider border border-neutral-700/20"
                >
                  CANCEL
                </button>
                <button 
                  onClick={executeRemoveSong}
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
        {isRenaming && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRenaming(false)}
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
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    renamePlaylist();
                  } else if (e.key === 'Escape') {
                    setIsRenaming(false);
                  }
                }}
                className="w-full bg-neutral-900 border border-neutral-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors"
              />
              <div className="flex items-center justify-end gap-3 mt-6">
                <button 
                  onClick={() => setIsRenaming(false)}
                  className="text-xs font-bold tracking-wider text-white px-4 py-3 rounded-xl hover:bg-neutral-800/50 transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={renamePlaylist}
                  className="bg-white text-black text-xs font-bold tracking-wider px-6 py-3 rounded-full hover:bg-neutral-200 transition-colors"
                >
                  SAVE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {activeMenuSong && (
          <TrackOptionsMenu 
            track={activeMenuSong}
            onClose={() => setActiveMenuSong(null)}
            playlistId={id}
            onRemove={() => attemptRemoveSong(activeMenuSong.id)}
            onDeleteTrack={executePermanentDeleteSong}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
