import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Play, UserPlus, Trash2, Clock, MoreHorizontal, Users, Music, Heart, Info } from "lucide-react";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { fetchSongMetadata } from "../services/musicService";

export default function PlaylistDetail() {
  const { id } = useParams();
  const [playlist, setPlaylist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedSongs, setResolvedSongs] = useState<Record<string, Song>>({});
  const { setSong, currentSong, isPlaying, togglePlay } = usePlayerStore();

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "playlists", id), (doc) => {
      if (doc.exists()) {
        setPlaylist({ id: doc.id, ...doc.data() });
      }
      setLoading(false);
    });
    return () => unsub();
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

  const canEdit = playlist && (
    playlist.ownerId === auth.currentUser?.uid || 
    playlist.collaborative || 
    (playlist.memberIds && playlist.memberIds.includes(auth.currentUser?.uid))
  );

  const isOwner = playlist?.ownerId === auth.currentUser?.uid;

  const removeSong = async (songId: string) => {
    if (!canEdit || !id) return;
    try {
      await updateDoc(doc(db, "playlists", id), {
        songIds: arrayRemove(songId),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Collision error or permission denied", e);
    }
  };

  const inviteUser = async () => {
    const userId = prompt("Enter the User ID or Email to invite:");
    if (userId && id) {
      await updateDoc(doc(db, "playlists", id), {
        memberIds: arrayUnion(userId.trim()),
        collaborative: true,
        updatedAt: serverTimestamp()
      });
    }
  };

  const revokeAccess = async (userId: string) => {
    if (!isOwner || !id) return;
    await updateDoc(doc(db, "playlists", id), {
      memberIds: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });
  };

  if (loading) return <div className="animate-pulse flex items-center justify-center py-20">Loading...</div>;
  if (!playlist) return <div className="text-center py-20 font-black italic">PLAYLIST NOT FOUND</div>;

  return (
    <div className="space-y-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-end gap-8">
        <div className="w-64 h-64 bg-gradient-to-br from-zinc-800 to-zinc-950 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center border border-white/5 group relative">
          <Music size={80} className="text-white/10" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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
        <div className="flex-1 space-y-4">
           <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{playlist.isPublic ? "Public" : "Private"} Playlist</span>
           <h1 className="text-7xl font-black italic tracking-tighter leading-tight">{playlist.name}</h1>
           <p className="text-zinc-500 font-medium text-sm italic">{playlist.description || "No description provided."}</p>
           <div className="flex items-center gap-2 pt-2">
             <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500" />
             <span className="text-xs font-bold">{playlist.ownerId === auth.currentUser?.uid ? "You" : "Owner"}</span>
             <span className="mx-2 opacity-20">•</span>
             <span className="text-xs font-medium text-zinc-400">{playlist.songIds?.length || 0} songs</span>
             {playlist.collaborative && (
               <span className="ml-3 flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-wider border border-purple-500/20">
                 <Users size={10} /> Collaborative
               </span>
             )}
           </div>
        </div>
      </header>

      {/* Actions */}
      <div className="flex items-center gap-6">
         <button 
           onClick={() => {
             if (playlist.songIds?.length > 0) {
               const firstSong = resolvedSongs[playlist.songIds[0]];
               const queue = playlist.songIds.map((sid: string) => resolvedSongs[sid]).filter(Boolean);
               if (firstSong) setSong(firstSong, queue);
             }
           }}
           className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
         >
            <Play size={28} fill="currentColor" className="ml-1" />
         </button>
         <LikeButton targetId={playlist.id} type="playlist" size={28} className="w-12 h-12 rounded-full border border-white/10" />
         {playlist.ownerId === auth.currentUser?.uid && (
            <button 
              onClick={inviteUser}
              className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
              title="Add Collaborator"
            >
               <UserPlus size={20} />
            </button>
         )}
         <button className="text-zinc-500 hover:text-white transition-all">
            <MoreHorizontal size={24} />
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
                      <button onClick={() => revokeAccess(memberId)} className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity">
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
        <div className="grid grid-cols-[32px_1fr_1fr_48px] px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-white/20 border-b border-white/5 mb-4">
           <span>#</span>
           <span>Title</span>
           <span className="hidden md:block">Album / Source</span>
           <span className="flex justify-end"><Clock size={12} /></span>
        </div>
        
        {playlist.songIds?.length === 0 ? (
           <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <p className="text-zinc-600 font-bold italic">RECORDS ARE EMPTY. ADD MUSIC TO BEGIN.</p>
           </div>
        ) : (
           playlist.songIds?.map((songId: string, i: number) => {
             const song = resolvedSongs[songId];
             const queue = playlist.songIds.map((sid: string) => resolvedSongs[sid]).filter(Boolean);
             const isActive = currentSong?.id === song?.id;

             return (
             <div 
               key={songId}
               className={cn(
                 "grid grid-cols-[32px_1fr_1fr_48px] items-center gap-4 px-4 py-3 rounded-xl transition-all group cursor-pointer border",
                 isActive ? "bg-white/10 border-white/10" : "hover:bg-white/5 border-transparent hover:border-white/5"
               )}
               onClick={() => {
                 if (!song) return;
                 if (isActive) togglePlay();
                 else setSong(song, queue);
               }}
             >
                <div className="flex items-center justify-center">
                  {isActive && isPlaying ? (
                    <div className="flex items-end gap-0.5 h-3">
                       <motion.div animate={{ height: [4, 12, 6, 10, 4] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-0.5 bg-purple-400" />
                       <motion.div animate={{ height: [8, 4, 10, 6, 8] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-0.5 bg-purple-400" />
                       <motion.div animate={{ height: [6, 10, 4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-0.5 bg-purple-400" />
                    </div>
                  ) : (
                    <>
                      <span className={cn("text-xs font-mono group-hover:hidden", isActive ? "text-purple-400" : "text-zinc-600")}>
                        {i + 1}
                      </span>
                      <Play size={12} className={cn("hidden group-hover:block", isActive ? "text-purple-400" : "text-white/40")} />
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-4 overflow-hidden">
                   <div className="w-10 h-10 rounded bg-white/10 shrink-0 overflow-hidden shadow-lg relative">
                      <img src={song?.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop"} className="w-full h-full object-cover" />
                      {isActive && <div className="absolute inset-0 bg-purple-500/20" />}
                   </div>
                   <div className="overflow-hidden">
                      <p className={cn("text-sm font-bold truncate", isActive ? "text-purple-400" : "text-white")}>
                        {song?.title || "Resolving Metadata..."}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate">{song?.artist || "..."}</p>
                   </div>
                </div>

                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-wider truncate hidden md:block",
                  isActive ? "text-purple-400/60" : "text-zinc-500"
                )}>
                   {song?.album || "Sonic Vault"} • {song?.source?.toUpperCase() || "CLOUD"}
                </div>

                <div className="flex justify-end items-center gap-4">
                   <div className="hidden group-hover:flex items-center gap-2">
                     <Link 
                        to={`/song/${songId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-full text-white/20 hover:text-white hover:bg-white/10 transition-all"
                        title="View Details"
                     >
                        <Info size={14} />
                     </Link>
                     <LikeButton targetId={songId} type="song" size={14} />
                   </div>
                   <span className={cn("text-[10px] font-mono group-hover:hidden", isActive ? "text-purple-400" : "text-zinc-600")}>
                      {song?.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : "0:00"}
                   </span>
                   {canEdit && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); removeSong(songId); }}
                       className="hidden group-hover:flex text-zinc-500 hover:text-red-500 transition-colors"
                     >
                       <Trash2 size={16} />
                     </button>
                   )}
                </div>
             </div>
           )})
        )}
      </div>
    </div>
  );
}
