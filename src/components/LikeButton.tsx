import { Heart } from "lucide-react";
import { useLikeStore } from "../store/useLikeStore";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import React from "react";

interface LikeButtonProps {
  targetId: string;
  type: "song" | "playlist";
  song?: Song;
  size?: number;
  className?: string;
}

export function LikeButton({ targetId, type, song: propSong, size = 18, className }: LikeButtonProps) {
  const { likedSongs, toggleLikeSong } = usePlayerStore();
  const { likedPlaylists, toggleLike } = useLikeStore();

  const isTrackLiked = likedSongs.some(item => item.id === targetId);
  const isLiked = type === "song" ? isTrackLiked : likedPlaylists.has(targetId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (type === "song") {
      const playerStore = usePlayerStore.getState();
      const song = propSong || 
                   playerStore.queue.find(s => s.id === targetId) || 
                   playerStore.recentlyPlayed.find(s => s.id === targetId) || 
                   (playerStore.currentSong?.id === targetId ? playerStore.currentSong : null) ||
                   playerStore.likedSongs.find(s => s.id === targetId);

      const finalSong = song || {
        id: targetId,
        title: "Unknown Track",
        artist: "Unknown Artist",
        thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop",
        source: "cloud",
        sourceId: targetId
      };

      playerStore.toggleLikeSong(finalSong);
      toggleLike(targetId, "song");
    } else {
      toggleLike(targetId, "playlist");
    }
  };

  return (
    <button 
      onClick={handleClick}
      className={cn(
        "relative flex items-center justify-center transition-all hover:scale-110 active:scale-95",
        isLiked ? "text-purple-500 fill-current" : "text-white/20 hover:text-white/60",
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        {isLiked ? (
          <motion.div
            key="liked"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Heart size={size} fill="currentColor" />
          </motion.div>
        ) : (
          <motion.div
            key="unliked"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
          >
            <Heart size={size} />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
