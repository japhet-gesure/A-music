import { Heart } from "lucide-react";
import { useLikeStore } from "../store/useLikeStore";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import React from "react";

interface LikeButtonProps {
  targetId: string;
  type: "song" | "playlist";
  size?: number;
  className?: string;
}

export function LikeButton({ targetId, type, size = 18, className }: LikeButtonProps) {
  const { likedSongs, likedPlaylists, toggleLike } = useLikeStore();
  const isLiked = type === "song" ? likedSongs.has(targetId) : likedPlaylists.has(targetId);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(targetId, type);
  };

  return (
    <button 
      onClick={handleClick}
      className={cn(
        "relative flex items-center justify-center transition-all hover:scale-110 active:scale-95",
        isLiked ? "text-purple-500" : "text-white/20 hover:text-white/60",
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
