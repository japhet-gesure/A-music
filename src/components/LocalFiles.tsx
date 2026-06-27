import React, { useState, useEffect, useCallback } from "react";
import { FolderOpen, FileMusic, Play, Trash2, Plus, Music, HardDrive, Heart, RefreshCw, Info, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { TrackOptionsMenu } from "./TrackOptionsMenu";
import { getAllTracks, saveTrack, deleteTrack as removeFromOffline, OfflineTrack, isTrackOffline, getTrack } from "../lib/offlineStorage";
import { fetchLyrics } from "../services/lyricsService";
import { searchSpotifyTrack } from "../services/spotifyService";

import { scanDeviceDirectory } from "../services/localDeviceScanner";
import { seedNativeMediaStore } from "../services/nativeStorageService";
import { safeLocalStorage } from "../lib/safeStorage";

const localStorage = safeLocalStorage;

export default function LocalFiles() {
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [trackToDelete, setTrackToDelete] = useState<Song | null>(null);
  const [activeMenuSong, setActiveMenuSong] = useState<Song | null>(null);
  const [deviceDelete, setDeviceDelete] = useState(false);
  const [showScanComplete, setShowScanComplete] = useState(false);
  const [sortBy, setSortBy] = useState<"title" | "artist" | "genre" | "default">("default");
  
  useEffect(() => {
    if (isScanning) {
      setShowScanComplete(false);
    } else if (!isScanning && scanProgress.total > 0 && scanProgress.current === scanProgress.total) {
      setShowScanComplete(true);
      const timer = setTimeout(() => setShowScanComplete(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [isScanning, scanProgress]);
  const { setSong, currentSong, isPlaying, togglePlay, downloads, requireDeleteConfirmation, theme } = usePlayerStore();

  const [hasStoragePermission, setHasStoragePermission] = useState<boolean | null>(() => {
    return localStorage.getItem("mock_storage_permission") === "granted";
  });
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  // Load existing tracks from IndexedDB or Auto-seed Mock Store if permission granted
  const loadOfflineTracks = useCallback(async () => {
    let urlsToRevoke: string[] = [];
    try {
      let offlineTracks = await getAllTracks();
      
      // Auto-seed mock native store if repository is completely empty
      if (offlineTracks.length === 0) {
        setIsScanning(true);
        setScanProgress({ current: 0, total: 5 }); // 5 mock tracks
        const seeded = await seedNativeMediaStore();
        if (seeded) {
           offlineTracks = await getAllTracks();
        }
        setIsScanning(false);
      }

      const loadedSongs: Song[] = offlineTracks.map(ot => {
        const trackUrl = URL.createObjectURL(ot.blob);
        urlsToRevoke.push(trackUrl);

        
        let thumbUrl = ot.metadata.thumbnail;
        if (ot.metadata.thumbnailBlob) {
          thumbUrl = URL.createObjectURL(ot.metadata.thumbnailBlob);
          urlsToRevoke.push(thumbUrl);
        }

        return {
          id: ot.id,
          title: ot.metadata.title,
          artist: ot.metadata.artist,
          thumbnail: thumbUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
          source: "local",
          sourceId: ot.id,
          duration: ot.metadata.duration,
          localUrl: trackUrl,
          lyrics: ot.metadata.lyrics,
          genre: ot.metadata.genre || "Unknown Genre"
        };
      });
      setLocalSongs(loadedSongs);
    } catch (err) {
      console.error("Failed to load offline tracks:", err);
    }
  }, []);

  useEffect(() => {
    if (hasStoragePermission) {
       loadOfflineTracks();
    } else if (localStorage.getItem("mock_storage_permission") === null) {
       setShowPermissionDialog(true);
    }
  }, [hasStoragePermission, loadOfflineTracks]);

  // Refresh offline list when a download completes
  useEffect(() => {
    if (Object.values(downloads).some(d => d.status === "completed")) {
      loadOfflineTracks();
    }
  }, [downloads, loadOfflineTracks]);

  const handleGrantPermission = () => {
    localStorage.setItem("mock_storage_permission", "granted");
    setHasStoragePermission(true);
    setShowPermissionDialog(false);
  };

  const handleDenyPermission = () => {
    localStorage.setItem("mock_storage_permission", "denied");
    setHasStoragePermission(false);
    setShowPermissionDialog(false);
  };

  const handleSyncFolder = async () => {
    try {
      setIsScanning(true);
      setScanProgress({ current: 0, total: 0 });

      const newSongs = await scanDeviceDirectory((current, total) => {
         setScanProgress({ current, total: total || current });
      });

      if (newSongs.length > 0) {
        // Add only the ones not already there, sort of? Or just refresh the whole list.
        // The service already skips or re-fetches existing, so we can just re-load all offline tracks:
        const rawTracks = await getAllTracks();
        const loadedSongs = rawTracks.map(t => ({
          id: t.id,
          title: t.metadata.title,
          artist: t.metadata.artist,
          thumbnail: t.metadata.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
          source: "local" as const,
          sourceId: t.id,
          duration: t.metadata.duration,
          localUrl: URL.createObjectURL(t.blob),
          lyrics: t.metadata.lyrics,
          genre: t.metadata.genre || "Unknown Genre"
        }));
        setLocalSongs(loadedSongs);

        // Fetch official Spotify metadata in the background for new songs
        Promise.allSettled(
          newSongs.map(async (song) => {
            const md = await searchSpotifyTrack(song.title, song.artist);
            if (md) {
              const track = await getTrack(song.id);
              if (track) {
                track.metadata.title = md.title;
                track.metadata.artist = md.artist;
                track.metadata.thumbnail = md.albumArt;
                const durationSeconds = md.duration_ms / 1000;
                // Only update duration if the local one isn't highly accurate
                if (!track.metadata.duration && durationSeconds) {
                  track.metadata.duration = durationSeconds;
                }
                await saveTrack(track);

                // Update UI state
                setLocalSongs(prev => prev.map(s => 
                  s.id === song.id 
                    ? { ...s, title: md.title, artist: md.artist, thumbnail: md.albumArt, duration: track.metadata.duration || durationSeconds } 
                    : s
                ));
              }
            }
          })
        );
      }

      setIsScanning(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsScanning(false);
        return;
      }
      
      if (err.message?.includes('SECURITY RESTRICTION')) {
        alert(err.message);
      } else {
        console.error("Sync failed:", err);
        alert(`Sync failed: ${err.message || "Unknown error"}`);
      }
      setIsScanning(false);
    }
  };

  const attemptRemoveSong = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    if (requireDeleteConfirmation) {
      setTrackToDelete(song);
    } else {
      executeRemoveSong(song.id);
    }
  };

  const executeRemoveSong = async (id: string) => {
    try {
      await removeFromOffline(id);
      setLocalSongs(prev => {
        const song = prev.find(s => s.id === id);
        if (song?.localUrl) URL.revokeObjectURL(song.localUrl);
        if (song?.thumbnail?.startsWith("blob:")) URL.revokeObjectURL(song.thumbnail);
        return prev.filter(s => s.id !== id);
      });
      setTrackToDelete(null);
    } catch (err) {
      console.error("Failed to delete track:", err);
    }
  };

  const downloadEntries = Object.values(downloads);
  const syncingCount = downloadEntries.filter(d => d.status === "syncing" || d.status === "downloading").length;
  const failedCount = downloadEntries.filter(d => d.status === "failed").length;

  const getSyncStatusIndicator = () => {
    if (syncingCount > 0) {
      return (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full shadow-[0_0_20px_rgba(168,85,247,0.1)]"
        >
          <RefreshCw size={12} className="text-purple-400 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
            {syncingCount} {syncingCount === 1 ? 'TRACK' : 'TRACKS'} SYNCING
          </span>
        </motion.div>
      );
    }
    if (failedCount > 0) {
      return (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.1)]"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
            {failedCount} SYNC FAILED
          </span>
        </motion.div>
      );
    }
    if (localSongs.length > 0) {
      return (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.1)]"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-green-500">
            ALL SYNCED
          </span>
        </motion.div>
      );
    }
    return null;
  };

  const [fetchingLyrics, setFetchingLyrics] = useState<Record<string, boolean>>({});
  const [bulkFetchProgress, setBulkFetchProgress] = useState<{ current: number, total: number } | null>(null);

  const missingLyricsCount = localSongs.filter(s => !s.lyrics || s.lyrics.length === 0).length;

  const handleBulkFetchLyrics = async () => {
    const missing = localSongs.filter(s => !s.lyrics || s.lyrics.length === 0);
    if (missing.length === 0) return;

    setBulkFetchProgress({ current: 0, total: missing.length });

    for (let i = 0; i < missing.length; i++) {
        const song = missing[i];
        await handleFetchLyrics(song);
        setBulkFetchProgress(prev => prev ? { ...prev, current: i + 1 } : null);
        // Small delay to be polite to the API
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    setBulkFetchProgress(null);
  };

  const sortedSongs = React.useMemo(() => {
    if (sortBy === "default") return localSongs;
    return [...localSongs].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "artist") return a.artist.localeCompare(b.artist);
      if (sortBy === "genre") return (a.genre || "").localeCompare(b.genre || "");
      return 0;
    });
  }, [localSongs, sortBy]);

  const handleFetchLyrics = async (song: Song) => {
    if (fetchingLyrics[song.id]) return;
    
    setFetchingLyrics(prev => ({ ...prev, [song.id]: true }));
    try {
      const lyrics = await fetchLyrics(song.artist, song.title);
      if (lyrics) {
        // Save to IndexedDB
        const track = await getTrack(song.id);
        if (track) {
          track.metadata.lyrics = lyrics;
          await saveTrack(track);
        }

        // Update local state
        setLocalSongs(prev => prev.map(s => s.id === song.id ? { ...s, lyrics } : s));
        
        // Update store if this is the current song
        if (usePlayerStore.getState().currentSong?.id === song.id) {
          usePlayerStore.getState().updateSongLyrics(song.id, lyrics);
        }
      }
    } catch (err) {
      console.warn("[LocalFiles] Failed to fetch lyrics:", err);
    } finally {
      setFetchingLyrics(prev => ({ ...prev, [song.id]: false }));
    }
  };

  const renderStatus = (songId: string) => {
    const download = downloads[songId];
    const isOffline = localSongs.some(s => s.id === songId);
    
    if (download?.status === "downloading") {
      return (
        <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
          <RefreshCw size={10} className="text-indigo-400 animate-spin" />
          <span className="text-[8px] text-indigo-400 font-black uppercase tracking-widest">Syncing</span>
        </div>
      );
    }

    if (download?.status === "syncing") {
      return (
        <div className="flex items-center gap-1.5 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
          <HardDrive size={10} className="text-purple-400 animate-pulse" />
          <span className="text-[8px] text-purple-400 font-black uppercase tracking-widest">Vaulting</span>
        </div>
      );
    }
    
    if (download?.status === "failed") {
      return (
        <div className="flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
          <div className="w-1 h-1 rounded-full bg-rose-500" />
          <span className="text-[8px] text-rose-500 font-black uppercase tracking-widest">Failed</span>
        </div>
      );
    }

    if (isOffline) {
      return (
        <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
          <div className="w-1 h-1 rounded-full bg-green-500" />
          <span className="text-[8px] text-green-500 font-black uppercase tracking-widest">Synced</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-12 relative min-h-screen pb-32">
      <AnimatePresence>
        {showPermissionDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#1A1A21] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                <HardDrive size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Allow access to device music?</h3>
                <p className="text-sm text-zinc-400">
                  Allow the app to scan your device folders and media store to instantly sync your audio files for offline playback.
                </p>
              </div>
              <div className="w-full flex gap-3">
                <button
                  onClick={handleDenyPermission}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-white/5 text-white hover:bg-white/10 transition-colors"
                >
                  Deny
                </button>
                <button
                  onClick={handleGrantPermission}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-purple-600 text-white hover:bg-purple-500 transition-colors"
                >
                  Allow Access
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {(isScanning || showScanComplete) && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="w-full relative -mt-4 mb-8"
        >
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden relative">
            <motion.div 
              className={cn(
                "absolute top-0 bottom-0 left-0 transition-all duration-300 ease-out",
                showScanComplete ? "bg-green-500" : "bg-purple-500"
              )}
              style={{ width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%` }}
            />
            {isScanning && (
               <motion.div 
                 className="absolute top-0 bottom-0 left-0 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full"
                 animate={{ translateX: ['-100%', '200%'] }}
                 transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
               />
            )}
          </div>
          <AnimatePresence>
             {showScanComplete && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-0 mt-2 flex items-center justify-center"
                >
                   <div className="absolute w-12 h-12 bg-green-500/20 rounded-full animate-ping" />
                   <div className="px-3 py-1 bg-green-500/10 text-green-400 font-bold tracking-widest text-[10px] rounded-full border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)] flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                     DEVICE SYNC COMPLETE
                   </div>
                </motion.div>
             )}
          </AnimatePresence>
        </motion.div>
      )}

      <header className="flex items-center justify-between">
        <div>
           <h1 className="text-5xl font-black italic tracking-tighter text-gradient leading-tight uppercase">Offline Vault</h1>
           <div className="flex items-center gap-4 mt-2">
             <p className="text-white/40 text-sm font-medium uppercase tracking-widest flex items-center gap-2">
               <HardDrive size={14} />
               Local storage cache for zero-latency sessions
             </p>
             {getSyncStatusIndicator()}
           </div>
        </div>

        <div className="flex items-center gap-4">
          {missingLyricsCount > 0 && !bulkFetchProgress && (
            <button 
              onClick={handleBulkFetchLyrics}
              className="flex items-center gap-3 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 px-6 py-3.5 rounded-full font-black text-sm transition-all cursor-pointer shadow-xl active:scale-95 group border border-purple-500/20"
            >
              <Music size={20} className="group-hover:scale-110 transition-transform" />
              <span className="tracking-tighter italic uppercase">Fetch {missingLyricsCount} Missing Lyrics</span>
            </button>
          )}

          {bulkFetchProgress && (
            <div className="flex items-center gap-4 bg-purple-900/20 px-6 py-3.5 rounded-full border border-purple-500/30">
               <div className="flex items-center gap-2">
                 <RefreshCw size={16} className="text-purple-400 animate-spin" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                    Syncing Lyrics ({bulkFetchProgress.current}/{bulkFetchProgress.total})
                 </span>
               </div>
               <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-500" 
                    style={{ width: `${(bulkFetchProgress.current / bulkFetchProgress.total) * 100}%` }}
                  />
               </div>
            </div>
          )}

          <button 
            onClick={handleSyncFolder}
            className="flex items-center gap-3 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 px-6 py-3.5 rounded-full font-black text-sm transition-all cursor-pointer shadow-xl active:scale-95 group border border-indigo-500/20"
          >
            <RefreshCw size={20} className={cn("transition-transform duration-700", isScanning && "animate-spin")} />
            <span className="tracking-tighter italic">SYNC FOLDER</span>
          </button>
        </div>
      </header>

      {localSongs.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 border-b border-white/5 pb-6">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">Sort Sequences</p>
             <div className="flex items-center gap-2">
               {[
                 { id: "default", label: "Recently Added" },
                 { id: "title", label: "Title" },
                 { id: "artist", label: "Artist" },
                 { id: "genre", label: "Genre" }
               ].map((option) => (
                 <button
                   key={option.id}
                   onClick={() => setSortBy(option.id as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                     sortBy === option.id 
                      ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]" 
                      : "bg-white/5 border-white/5 text-zinc-500 hover:text-white hover:bg-white/10"
                   )}
                 >
                   {option.label}
                 </button>
               ))}
             </div>
          </div>
        </div>
      )}

      {localSongs.length === 0 && Object.keys(downloads).length === 0 ? (
        <div className="w-full min-h-[400px] rounded-[3.5rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-8 group hover:border-purple-500/40 transition-all duration-700 bg-white/[0.02] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-100 block transition-opacity duration-1000" />
          
          <div className="relative">
            <div className={cn(
               "w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center text-white/10 transition-all duration-700",
               isScanning ? "animate-pulse border border-purple-500/30 text-purple-400" : "group-hover:scale-110 group-hover:bg-purple-500/10 group-hover:text-purple-400"
            )}>
               {isScanning ? <RefreshCw size={48} strokeWidth={1.5} className="animate-spin" /> : <FileMusic size={48} strokeWidth={1.5} />}
            </div>
            {!isScanning && (
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-black text-[10px] animate-bounce">
                 +
              </div>
            )}
          </div>

          <div className="text-center z-10">
            <h2 className="text-3xl font-black italic tracking-tighter text-white mb-3 uppercase">
              {isScanning ? "Scanning Storage" : "Sync Device Folders"}
            </h2>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">
              {isScanning ? "Ingesting background media store..." : "Automatically scan and import supported audio files"}
            </p>
          </div>

          {!isScanning && (
            <button 
              onClick={handleSyncFolder}
              className="relative z-10 text-xs font-black bg-white group-hover:bg-purple-500 text-black group-hover:text-white px-10 py-4 rounded-full tracking-widest transition-all cursor-pointer active:scale-95 shadow-2xl"
            >
               OPEN DISK BROWSER
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {/* Active Downloads */}
            {Object.entries(downloads).map(([id, download]) => (
              <motion.div
                key={`download-${id}`}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative border rounded-3xl p-4 bg-white/5 border-purple-500/30 overflow-hidden"
              >
                {/* Progress Background */}
                <motion.div 
                   className="absolute inset-0 bg-purple-500/10 pointer-events-none origin-left"
                   style={{ scaleX: download.progress / 100 }}
                />
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl relative shrink-0">
                    <img src={download.song.thumbnail || undefined} className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <RefreshCw size={24} className="text-purple-400 animate-spin" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base tracking-tight truncate text-white/80">{download.song.title}</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">{download.song.artist}</p>
                    <div className="mt-2 space-y-2">
                       <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-purple-400">
                          <span>
                            {download.status === 'failed' ? 'FAILED' : 
                             download.status === 'syncing' ? 'VAULTING...' : 
                             download.status === 'completed' ? 'SYNCED' : 'UPLOADING...'}
                          </span>
                          <span>{download.progress}%</span>
                       </div>
                       <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-purple-500" 
                            initial={{ width: 0 }}
                            animate={{ width: `${download.progress}%` }}
                          />
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Offline Tracks */}
            {sortedSongs.map((song) => {
              const isActive = currentSong?.id === song.id;
              return (
               <motion.div
                key={song.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "group relative border rounded-3xl p-4 transition-all duration-300 cursor-pointer",
                  isActive ? "bg-white/10 border-white/20 shadow-[0_0_30px_rgba(168,85,247,0.15)]" : "bg-white/5 border-white/5 hover:bg-white/10"
                )}
                onClick={() => isActive ? togglePlay() : setSong(song, localSongs)}
              >
                 <div className="w-full flex items-center justify-between gap-3">
                   <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl relative shrink-0">
                     <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                     <div className={cn(
                       "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity",
                       isActive ? "opacity-100" : "opacity-100 block"
                     )}>
                        {isActive && isPlaying ? (
                           <div className="flex items-end gap-1 h-4">
                              <motion.div animate={{ height: [6, 16, 8, 14, 6] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-white" />
                              <motion.div animate={{ height: [12, 6, 16, 8, 12] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-white" />
                              <motion.div animate={{ height: [8, 14, 6, 16, 8] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-white" />
                           </div>
                        ) : (
                           <Play size={24} fill="white" className="text-white" />
                        )}
                     </div>
                   </div>
                   <div className="flex-grow flex-1 min-w-0">
                     <h3 className={cn("font-bold text-base tracking-tight truncate", isActive && "text-purple-400")}>{song.title}</h3>
                     <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">{song.artist}</p>
                     <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center bg-white/10 px-2 py-0.5 rounded font-mono text-white/40 shrink-0 gap-1.5">
                          <span className="text-[9px]">
                            {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : "0:00"}
                          </span>
                        </div>
                        {renderStatus(song.id)}
                        {song.genre && (
                          <div className="flex items-center gap-1.5 bg-zinc-500/10 px-2 py-0.5 rounded-full border border-zinc-500/20 hidden md:flex">
                            <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest truncate max-w-[80px]">{song.genre}</span>
                          </div>
                        )}
                        {song.lyrics && song.lyrics.length > 0 && (
                          <div className="flex items-center gap-1.5 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 hidden md:flex">
                            <Music size={8} className="text-purple-400" />
                            <span className="text-[8px] text-purple-400 font-black uppercase tracking-widest">Lyrics</span>
                          </div>
                        )}
                     </div>
                   </div>
                   
                   <div className="flex-shrink-0 flex items-center gap-3 ml-auto">
                     <span className="text-[10px] text-zinc-500 font-mono shrink-0 w-10 text-right">
                       {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : "0:00"}
                     </span>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         attemptRemoveSong(e, song);
                       }}
                       className="text-white/40 hover:text-red-400 transition-colors hidden md:block"
                       title="Remove from vault"
                     >
                       <Trash2 size={16} />
                     </button>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         handleFetchLyrics(song);
                       }}
                       className={cn(
                         "transition-colors hidden md:block",
                         song.lyrics && song.lyrics.length > 0 ? "text-purple-400" : "text-white/40 hover:text-purple-400",
                         fetchingLyrics[song.id] && "animate-pulse brightness-150"
                       )}
                       title={song.lyrics && song.lyrics.length > 0 ? "Refresh lyrics" : "Fetch lyrics"}
                     >
                       <RefreshCw size={16} className={cn(fetchingLyrics[song.id] && "animate-spin")} />
                     </button>
                     <LikeButton targetId={song.id} type="song" size={16} className="transition-all hidden md:flex" />
                     <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuSong(song);
                        }}
                        className="text-white/40 hover:text-white transition-colors"
                        title="View Details"
                     >
                        <MoreHorizontal size={16} />
                     </button>
                   </div>
                 </div>
              </motion.div>
            )})}
          </AnimatePresence>
        </div>
      )}

      {/* Track Options Menu */}
      <AnimatePresence>
        {activeMenuSong && (
          <TrackOptionsMenu 
            track={activeMenuSong}
            onClose={() => setActiveMenuSong(null)}
            onDeleteTrack={(trackId) => {
              const song = localSongs.find(s => s.id === trackId);
              if (song) {
                if (requireDeleteConfirmation) {
                  setTrackToDelete(song);
                } else {
                  executeRemoveSong(song.id);
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      {isScanning && (
        <div className="fixed bottom-32 right-8 bg-[#0F0F12] border border-white/10 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 z-[110]">
           <div className="relative">
             <div className="w-10 h-10 rounded-full border-2 border-purple-500/20" />
             <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[8px] font-black italic text-purple-400">
                  {scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : "..."}%
                </span>
             </div>
           </div>
           <div>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Syncing Vault</p>
              <p className="text-[10px] text-zinc-500 font-bold">
                {scanProgress.total > 0 ? `PROCESSED ${scanProgress.current} OF ${scanProgress.total} TRACKS` : "PREPARING SCAN..."}
              </p>
           </div>
        </div>
      )}

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
                Are you sure to delete "{trackToDelete.title}"?
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
                  onClick={() => setTrackToDelete(null)}
                  className="flex-1 bg-neutral-800/40 text-neutral-300 font-medium py-3 rounded-full text-center hover:bg-neutral-800/70 transition-all uppercase text-xs tracking-wider border border-neutral-700/20"
                >
                  CANCEL
                </button>
                <button 
                  onClick={() => executeRemoveSong(trackToDelete.id)}
                  className="flex-1 bg-[#ff5e52] text-white font-semibold py-3 rounded-full text-center hover:opacity-90 transition-all uppercase text-xs tracking-wider"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
