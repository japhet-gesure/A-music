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
      unsubscribe = onSnapshot(likesRef, async (snapshot) => {
        const songs = new Set<string>();
        const playlists = new Set<string>();
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === "song") songs.add(data.targetId);
          else if (data.type === "playlist") playlists.add(data.targetId);
        });

        set({ likedSongs: songs, likedPlaylists: playlists, initialized: true });

        // Async sync with usePlayerStore to cache/persist complete metadata
        try {
          const { usePlayerStore } = await import("./usePlayerStore");
          const playerState = usePlayerStore.getState();
          const currentPersistedLiked = playerState.likedSongs || [];

          // Remove any that are no longer liked according to Firestore list
          let updatedLiked = currentPersistedLiked.filter(s => songs.has(s.id));

          // Fetch full metadata for any new likes we don't have in memory yet
          const existingIds = new Set(updatedLiked.map(s => s.id));
          const newlyLikedIds = Array.from(songs).filter(id => !existingIds.has(id));

          if (newlyLikedIds.length > 0) {
            const { fetchSongMetadata } = await import("../services/musicService");
            const fetched = await Promise.all(
              newlyLikedIds.map(async (id) => {
                try {
                  return await fetchSongMetadata(id);
                } catch {
                  return null;
                }
              })
            );
            const valid = fetched.filter((s): s is any => !!s);
            updatedLiked = [...updatedLiked, ...valid];
          }

          usePlayerStore.setState({ likedSongs: updatedLiked });
        } catch (err) {
          console.warn("Failed to synchronize firestore likes snapshot to playerStore:", err);
        }
      }, (error) => {
        console.error("Likes listener error:", error);
      });

      return unsubscribe;
    }
  };
});
