import { useState, useEffect, useRef } from "react";
import { 
  SkipForward, 
  ListPlus, 
  PlusSquare, 
  Scissors, 
  Bell, 
  Image as ImageIcon, 
  Edit2, 
  Info, 
  MinusCircle, 
  Music,
  Share,
  Heart,
  X,
  Loader2,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { safeLocalStorage } from "../lib/safeStorage";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { LikeButton } from "./LikeButton";
import { downloadSong } from "../services/downloadService";

interface TrackOptionsMenuProps {
  track: any;
  onClose: () => void;
  playlistId?: string; // If provided, shows "Remove from Playlist"
  onRemove?: () => void; // Callback after remove
}

export function TrackOptionsMenu({ track, onClose, playlistId, onRemove }: TrackOptionsMenuProps) {
  const { currentSong, queue, setQueue, addToQueue, updateSongThumbnail, likedSongs, toggleLikeSong, downloads } = usePlayerStore();
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const [activeArtworkMenu, setActiveArtworkMenu] = useState(false);
  const [artworkMenuLocked, setArtworkMenuLocked] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showInternetPicker, setShowInternetPicker] = useState(false);
  const [internetImages, setInternetImages] = useState<string[]>([]);
  const [isFetchingImages, setIsFetchingImages] = useState(false);

  const handleTrackArtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      updateSongThumbnail(track.id, base64);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const fetchInternetArtworks = async () => {
    setIsFetchingImages(true);
    setShowInternetPicker(true);
    try {
      const query = encodeURIComponent(`${track.artist} ${track.title}`);
      const res = await fetch(`/api/artwork?q=${query}`);
      const data = await res.json();
      setInternetImages(data.images || []);
    } catch (err) {
      console.error("Failed to fetch artwork", err);
    } finally {
      setIsFetchingImages(false);
    }
  };

  const handleResetArtwork = () => {
    updateSongThumbnail(track.id, "");
    onClose();
  };

  const handlePlayNext = () => {
    if (queue.length === 0) {
      setQueue([track]);
    } else {
      const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
      if (currentIndex !== -1) {
        const newQueue = [...queue];
        newQueue.splice(currentIndex + 1, 0, track);
        setQueue(newQueue);
      } else {
        setQueue([track, ...queue]);
      }
    }
    onClose();
  };

  const handleAddToQueue = () => {
    addToQueue(track);
    onClose();
  };

  const handleRemoveFromPlaylist = () => {
    if (playlistId && onRemove) {
      onRemove();
    }
    onClose();
  };

  const isLiked = likedSongs.some((s: any) => s.id === track?.id);
  const downloadState = downloads[track?.id];
  const isDownloaded = downloadState?.status === "completed";
  const isDownloading = downloadState?.status === "downloading" || downloadState?.status === "syncing";

  const handleToggleLike = () => {
    toggleLikeSong(track);
    onClose();
  };

  const handleDownload = async () => {
    if (isDownloaded || isDownloading) return;
    try {
      await downloadSong(track);
    } catch (err) {
      console.error("Download failed:", err);
    }
    onClose();
  };

  const menuItems: Array<{
    label: string;
    icon: any;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
  }> = [
    { label: 'Play next', icon: <SkipForward size={20} />, onClick: handlePlayNext },
    { label: 'Add to queue', icon: <ListPlus size={20} />, onClick: handleAddToQueue },
    { label: 'Add to playlist', icon: <PlusSquare size={20} />, onClick: () => setShowAddToPlaylist(true) },
    { 
      label: isLiked ? 'Remove from Liked' : 'Like song', 
      icon: <Heart size={20} className={isLiked ? "fill-purple-500 text-purple-500 animate-pulse" : ""} />, 
      onClick: handleToggleLike 
    },
    { 
      label: isDownloaded ? 'Downloaded' : isDownloading ? 'Downloading...' : 'Download track', 
      icon: <Download size={20} className={isDownloaded ? "text-purple-400" : isDownloading ? "animate-bounce text-purple-400" : ""} />, 
      onClick: handleDownload,
      disabled: isDownloaded || isDownloading
    },
    { label: 'Trim', icon: <Scissors size={20} />, onClick: () => { alert("Trim feature not implemented"); onClose(); } },
    { label: 'Set as ringtone', icon: <Bell size={20} />, onClick: () => { alert("Device configuration opened"); onClose(); } },
    { label: 'Artwork', icon: <ImageIcon size={20} />, onClick: () => { alert("Artwork selector opened"); onClose(); } },
    { label: 'Edit tags', icon: <Edit2 size={20} />, onClick: () => { alert("ID3 Edit tags overlay opened"); onClose(); } },
    { label: 'Details', icon: <Info size={20} />, onClick: () => { alert(`File Details:\nPath: cloud/stream/${track.id}\nFormat: MP3/WebM`); onClose(); } },
  ];

  if (playlistId) {
    menuItems.push({
      label: 'Remove from Playlist',
      icon: <MinusCircle size={20} className="text-[#ff5e52]" />,
      onClick: handleRemoveFromPlaylist,
      disabled: false
    });
  }

  const containerClasses = "fixed top-20 bottom-0 left-0 right-0 w-full z-50 bg-[#18181b] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:relative md:top-auto md:bottom-auto md:left-auto md:right-auto md:w-[400px] md:bg-neutral-900 md:rounded-3xl md:shadow-2xl md:overflow-visible";

  const wrapperClasses = "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center md:p-6";

  return (
    <>
      <div className={wrapperClasses} onClick={(e) => {
         if(e.target === e.currentTarget) onClose();
      }}>
        <motion.div
          initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
          animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
          exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={containerClasses}
        >
          <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 shrink-0 md:hidden" />

          {/* HEADER BAR */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/5 overflow-hidden">
                {track?.thumbnail ? (
                  <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <Music size={24} className="text-white/40" />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="text-base font-bold text-white truncate leading-tight">
                  {track?.title || 'Unknown Track'}
                </h3>
                <p className="text-xs text-white/60 truncate mt-0.5">
                  {track?.artist || 'Unknown Artist'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <button className="text-white/60 hover:text-white transition-colors" onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: track?.title, text: `Check out ${track?.title} by ${track?.artist}` });
                } else {
                  alert("Share not supported");
                }
              }}>
                <Share size={22} />
              </button>
              <LikeButton targetId={track?.id} type="song" size={22} />
            </div>
          </div>

          {/* ORDERED ACTION ITEMS LIST */}
          <div className="flex-1 h-full overflow-y-auto md:overflow-visible px-2 py-2 pb-12">
            {menuItems.map((item, idx) => {
              if (item.label === 'Artwork') {
                return (
                  <div 
                    key={idx} 
                    className="relative"
                    onMouseEnter={() => !isMobile && setActiveArtworkMenu(true)}
                    onMouseLeave={() => !isMobile && !artworkMenuLocked && setActiveArtworkMenu(false)}
                  >
                    <button
                      onClick={() => {
                        if (isMobile) {
                          setArtworkMenuLocked(!artworkMenuLocked);
                          setActiveArtworkMenu(!activeArtworkMenu);
                        } else {
                          setArtworkMenuLocked(!artworkMenuLocked);
                          setActiveArtworkMenu(true);
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors hover:bg-white/10 active:bg-white/20 text-left text-white"
                      )}
                    >
                      <div className="opacity-70 text-white/70">
                        {item.icon}
                      </div>
                      <span className="text-[15px] font-medium tracking-wide flex-1">{item.label}</span>
                    </button>

                    {(activeArtworkMenu || artworkMenuLocked) && (
                      <div className="md:absolute md:left-full md:top-0 md:ml-2 md:w-48 bg-[#1c1c1e] md:border md:border-neutral-800 rounded-xl md:shadow-2xl p-1.5 z-50 ml-12 md:ml-2 mb-2 md:mb-0 mt-1 md:mt-0">
                        <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors" onClick={() => fileInputRef.current?.click()}>
                          Pick from gallery
                        </button>
                        <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors" onClick={fetchInternetArtworks}>
                          Pick from internet
                        </button>
                        <div className="h-px bg-neutral-800 my-1 mx-2" />
                        <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors" onClick={handleResetArtwork}>
                          Reset
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={idx}
                  onClick={item.onClick}
                  disabled={(item as any).disabled}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors hover:bg-white/10 active:bg-white/20 text-left disabled:opacity-50 disabled:cursor-not-allowed",
                    item.label === 'Remove from Playlist' ? "text-[#ff5e52]" : "text-white"
                  )}
                >
                  <div className={cn(
                    "opacity-70",
                    item.label === 'Remove from Playlist' ? "text-[#ff5e52]" : "text-white/70"
                  )}>
                    {item.icon}
                  </div>
                  <span className="text-[15px] font-medium tracking-wide flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
          
          {/* Bottom padding for mobile safe area */}
          <div className="h-6 shrink-0 md:hidden" />
        </motion.div>
      </div>

      <AnimatePresence>
        {showAddToPlaylist && (
          <AddToPlaylistModal 
            song={track} 
            onClose={() => {
              setShowAddToPlaylist(false);
              onClose();
            }} 
          />
        )}

        {showInternetPicker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInternetPicker(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-neutral-900 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Pick Artwork</h3>
                <button onClick={() => setShowInternetPicker(false)} className="text-white/60 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {isFetchingImages ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <Loader2 size={32} className="text-white animate-spin" />
                </div>
              ) : internetImages.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pr-2 pb-2">
                  {internetImages.map((img, i) => (
                    <button
                      key={i}
                      className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/50 transition-colors focus:outline-none"
                      onClick={() => {
                        updateSongThumbnail(track.id, img);
                        setShowInternetPicker(false);
                        onClose();
                      }}
                    >
                      <img src={img} alt="Artwork option" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-white/50">
                  <ImageIcon size={48} className="mb-4 opacity-20" />
                  <p>No artwork found for this track.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <input type="file" id="track-art-upload" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleTrackArtChange} />
    </>
  );
}
