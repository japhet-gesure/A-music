import React, { useState, useEffect, useCallback } from "react";
import { FolderOpen, FileMusic, Play, Trash2, Plus, Music, HardDrive, Heart, RefreshCw, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import * as mm from "music-metadata-browser";
import { Buffer } from "buffer";
import { getAllTracks, saveTrack, deleteTrack as removeFromOffline, OfflineTrack, isTrackOffline, getTrack } from "../lib/offlineStorage";
import { fetchLyrics } from "../services/lyricsService";

// Polyfill Buffer for music-metadata-browser
if (!window.Buffer) {
  window.Buffer = Buffer;
}

export default function LocalFiles() {
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [sortBy, setSortBy] = useState<"title" | "artist" | "genre" | "default">("default");
  const { setSong, currentSong, isPlaying, togglePlay, downloads } = usePlayerStore();

  // Load existing tracks from IndexedDB
  useEffect(() => {
    let urlsToRevoke: string[] = [];
    
    const loadOfflineTracks = async () => {
      try {
        const offlineTracks = await getAllTracks();
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
    };
    loadOfflineTracks();

    return () => {
      urlsToRevoke.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const processFile = async (file: File) => {
    const deterministicId = `local-${file.name}-${file.size}`;
    const placeholderSong: Song = {
      id: deterministicId,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Processing...",
      thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
      source: "local",
      sourceId: file.name,
    };

    usePlayerStore.getState().setDownloadStatus(deterministicId, {
      progress: 10,
      status: "syncing",
      song: placeholderSong
    });

    try {
      // Fast check: if file name already exists in our local list, skip it or check IDB
      const exists = await isTrackOffline(deterministicId);
      if (exists) {
        usePlayerStore.getState().removeDownload(deterministicId);
        return null;
      }

      const metadata = await mm.parseBlob(file);
      const title = metadata.common.title || file.name.replace(/\.[^/.]+$/, "");
      const artist = metadata.common.artist || "Unknown Artist";
      const album = metadata.common.album || "Unknown Album";
      const genre = metadata.common.genre && metadata.common.genre.length > 0 ? metadata.common.genre.join(", ") : "Unknown Genre";
      
      let thumbnail = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop";
      let thumbnailBlob: Blob | undefined;
      
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        thumbnailBlob = new Blob([pic.data], { type: pic.format });
        thumbnail = URL.createObjectURL(thumbnailBlob);
      }

      const duration = Math.round(metadata.format.duration || 0);

      usePlayerStore.getState().setDownloadStatus(deterministicId, {
        progress: 50,
        status: "syncing",
        song: { ...placeholderSong, title, artist, thumbnail, duration }
      });

      // Save to IndexedDB
      await saveTrack({
        id: deterministicId,
        blob: file,
        metadata: {
          title,
          artist,
          album,
          duration,
          thumbnail: !thumbnail.startsWith("blob:") ? thumbnail : undefined,
          thumbnailBlob,
          source: "local",
          lyrics: [],
          genre
        }
      });

      const finalSong: Song = {
        id: deterministicId,
        title,
        artist,
        thumbnail,
        source: "local",
        sourceId: file.name,
        duration,
        localUrl: URL.createObjectURL(file),
        lyrics: [],
        genre
      };

      usePlayerStore.getState().setDownloadStatus(deterministicId, {
        progress: 100,
        status: "completed",
        song: finalSong
      });

      // Remove from downloads after a short delay so user sees "completed"
      setTimeout(() => {
        usePlayerStore.getState().removeDownload(deterministicId);
      }, 3000);

      // Auto-fetch lyrics in background
      setTimeout(() => {
        handleFetchLyrics(finalSong);
      }, 1000);

      return finalSong;
    } catch (err) {
      console.error("Error parsing metadata for", file.name, err);
      usePlayerStore.getState().setDownloadStatus(deterministicId, {
        progress: 0,
        status: "failed",
        error: "Sync failed",
        song: placeholderSong
      });
      return null;
    }
  };

  const handleSyncFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert("Folder sync requires a modern browser with File System Access API support (e.g. Chrome, Edge).");
      return;
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      setIsScanning(true);
      setScanProgress({ current: 0, total: 0 });

      const newSongs: Song[] = [];
      
      async function* getFilesRecursively(entry: FileSystemHandle): AsyncGenerator<File> {
        if (entry.kind === 'file') {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|m4a|flac|ogg)$/i)) {
            yield file;
          }
        } else if (entry.kind === 'directory') {
          for await (const handle of (entry as any).values()) {
            yield* getFilesRecursively(handle);
          }
        }
      }

      for await (const file of getFilesRecursively(dirHandle)) {
        const song = await processFile(file);
        if (song) {
          newSongs.push(song);
          setLocalSongs(prev => [...prev, song]);
        }
        setScanProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      setIsScanning(false);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsScanning(false);
        return;
      }
      
      if (err.message?.includes('Cross origin sub frames')) {
        alert("SECURITY RESTRICTION: Browser security prevents opening a folder picker inside an iframe. \n\nPlease open this app in a NEW TAB (icon in top right) to use the Folder Sync feature.");
      } else {
        console.error("Sync failed:", err);
        alert(`Sync failed: ${err.message || "Unknown error"}`);
      }
      setIsScanning(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setIsScanning(true);
    setScanProgress({ current: 0, total: files.length });
    const newSongs: Song[] = [];

    for (let i = 0; i < files.length; i++) {
      const song = await processFile(files[i]);
      if (song) {
        newSongs.push(song);
        setLocalSongs(prev => [...prev, song]);
      }
      setScanProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setIsScanning(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|m4a|flac|ogg)$/i)
    );

    if (files.length === 0) return;

    setIsScanning(true);
    setScanProgress({ current: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const song = await processFile(files[i]);
      if (song) {
        setLocalSongs(prev => [...prev, song]);
      }
      setScanProgress(prev => ({ ...prev, current: i + 1 }));
    }
    
    setIsScanning(false);
  };

  const removeSong = async (id: string) => {
    try {
      await removeFromOffline(id);
      setLocalSongs(prev => {
        const song = prev.find(s => s.id === id);
        if (song?.localUrl) URL.revokeObjectURL(song.localUrl);
        if (song?.thumbnail?.startsWith("blob:")) URL.revokeObjectURL(song.thumbnail);
        return prev.filter(s => s.id !== id);
      });
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
      console.error("Failed to fetch lyrics:", err);
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
    <div 
      className="space-y-12 relative min-h-screen pb-32"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-purple-600/20 backdrop-blur-sm border-4 border-dashed border-purple-500/50 flex flex-col items-center justify-center p-12 pointer-events-none"
          >
            <div className="bg-zinc-900/90 p-12 rounded-[4rem] shadow-2xl flex flex-col items-center gap-6 border border-white/10">
              <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 animate-pulse">
                <Plus size={48} />
              </div>
              <div className="text-center">
                <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase">Drop to Import</h2>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-2">MP3, WAV, M4A, FLAC, OGG</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

          <label className="flex items-center gap-3 bg-white text-black hover:bg-zinc-200 px-8 py-3.5 rounded-full font-black text-sm transition-all cursor-pointer shadow-[0_0_40px_rgba(255,255,255,0.1)] active:scale-95 group">
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="tracking-tighter italic">IMPORT TRACKS</span>
            <input 
              type="file" 
              multiple 
              accept="audio/*,.mp3,.mpeg,.m4a,.wav,.flac,.ogg" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>
        </div>
      </header>

      {localSongs.length > 0 && (
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
      )}

      {localSongs.length === 0 && Object.keys(downloads).length === 0 ? (
        <div className="w-full min-h-[400px] rounded-[3.5rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-8 group hover:border-purple-500/40 transition-all duration-700 bg-white/[0.02] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          
          <div className="relative">
            <div className="w-24 h-24 rounded-[2rem] bg-white/5 flex items-center justify-center text-white/10 group-hover:scale-110 group-hover:bg-purple-500/10 group-hover:text-purple-400 transition-all duration-700">
               <FileMusic size={48} strokeWidth={1.5} />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-black text-[10px] animate-bounce">
               +
            </div>
          </div>

            <div className="text-center z-10">
            <h2 className="text-3xl font-black italic tracking-tighter text-white mb-3 uppercase">Drop Tracks or Open Browser</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">Import MP3, WAV, M4A, FLAC, or OGG to ignite the session</p>
          </div>

          <label className="relative z-10 text-xs font-black bg-white group-hover:bg-purple-500 text-black group-hover:text-white px-10 py-4 rounded-full tracking-widest transition-all cursor-pointer active:scale-95 shadow-2xl">
             OPEN DISK BROWSER
             <input type="file" multiple accept="audio/*,.mp3,.mpeg,.m4a,.wav,.flac,.ogg" className="hidden" onChange={handleFileChange} />
          </label>
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
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-2xl relative shrink-0">
                    <img src={song.thumbnail || undefined} alt={song.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className={cn(
                      "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity",
                      isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
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
                  <div className="flex-1 min-w-0 pr-10">
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
                         <div className="flex items-center gap-1.5 bg-zinc-500/10 px-2 py-0.5 rounded-full border border-zinc-500/20">
                           <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest truncate max-w-[80px]">{song.genre}</span>
                         </div>
                       )}
                       {song.lyrics && song.lyrics.length > 0 && (
                         <div className="flex items-center gap-1.5 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                           <Music size={8} className="text-purple-400" />
                           <span className="text-[8px] text-purple-400 font-black uppercase tracking-widest">Lyrics</span>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
                
                <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSong(song.id);
                    }}
                    className="p-2 rounded-full bg-black/20 text-white/20 hover:text-red-400 hover:bg-red-400/10 font-black italic"
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
                      "p-2 rounded-full bg-black/20 font-black italic transition-colors",
                      song.lyrics && song.lyrics.length > 0 ? "text-purple-400" : "text-white/20 hover:text-purple-400 hover:bg-purple-400/10",
                      fetchingLyrics[song.id] && "animate-pulse brightness-150"
                    )}
                    title={song.lyrics && song.lyrics.length > 0 ? "Refresh lyrics" : "Fetch lyrics"}
                  >
                    <RefreshCw size={16} className={cn(fetchingLyrics[song.id] && "animate-spin")} />
                  </button>
                  <Link 
                     to={`/song/${song.id}`}
                     onClick={(e) => e.stopPropagation()}
                     className="p-2 rounded-full bg-black/20 text-white/20 hover:text-white"
                     title="View Details"
                  >
                     <Info size={16} />
                  </Link>
                  <LikeButton targetId={song.id} type="song" size={16} className="p-2 rounded-full bg-black/20" />
                </div>
              </motion.div>
            )})}
          </AnimatePresence>
        </div>
      )}

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
    </div>
  );
}
