import { create } from "zustand";
import { onSnapshot, collection } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { toggleLike as toggleLikeApi } from "../services/likeService";

interface LikeState {
  likedSongs: Set<string>;
  likedPlaylists: Set<string>;
  initialized: boolean;
  
  toggleLike: (targetId: string, type: "song" | "playlist") => Promise<void>;
  init: () => () => void;
}

export const useLikeStore = create<LikeState>((set, get) => {
  let unsubscribe: (() => void) | null = null;

  return {
    likedSongs: new Set(),
    likedPlaylists: new Set(),
    initialized: false,

    toggleLike: async (targetId: string, type: "song" | "playlist") => {
      const { likedSongs, likedPlaylists } = get();
      const isLiked = type === "song" ? likedSongs.has(targetId) : likedPlaylists.has(targetId);
      
      // Optimistic update
      if (type === "song") {
        const next = new Set(likedSongs);
        if (isLiked) next.delete(targetId);
        else next.add(targetId);
        set({ likedSongs: next });
      } else {
        const next = new Set(likedPlaylists);
        if (isLiked) next.delete(targetId);
        else next.add(targetId);
        set({ likedPlaylists: next });
      }

      try {
        await toggleLikeApi(targetId, type, isLiked);
      } catch (err) {
        console.error("Failed to toggle like", err);
        // Rollback on error? For now just log. 
        // Real-time listener will correct it anyway.
      }
    },

    init: () => {
      if (unsubscribe) unsubscribe();

      const user = auth.currentUser;
      if (!user) {
         set({ likedSongs: new Set(), likedPlaylists: new Set(), initialized: false });
         return () => {};
      }

      const likesRef = collection(db, "users", user.uid, "likes");
      unsubscribe = onSnapshot(likesRef, (snapshot) => {
        const songs = new Set<string>();
        const playlists = new Set<string>();
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === "song") songs.add(data.targetId);
          else if (data.type === "playlist") playlists.add(data.targetId);
        });

        set({ likedSongs: songs, likedPlaylists: playlists, initialized: true });
      }, (error) => {
        console.error("Likes listener error:", error);
      });

      return unsubscribe;
    }
  };
});
