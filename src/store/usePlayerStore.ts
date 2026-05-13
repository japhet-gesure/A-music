import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

import { fetchLyrics } from "../services/lyricsService";
import { getTrack, saveTrack, getAllTracks } from "../lib/offlineStorage";

export interface LyricLine {
  text: string;
  time: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  album?: string;
  source: "spotify" | "youtube" | "upload" | "local" | "cloud";
  sourceId: string;
  duration?: number;
  localUrl?: string; // Blob URL for local files
  lyrics?: LyricLine[];
  genre?: string;
  releaseDate?: string;
  description?: string;
}

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  queue: Song[];
  currentIndex: number;
  volume: number;
  currentTime: number;
  duration: number;
  lowDataMode: boolean;
  theme: "classic" | "midnight" | "ocean" | "sunset";
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  repeatMode: "off" | "all" | "one";
  shuffleMode: boolean;
  equalizerSettings: {
    60: number;
    230: number;
    910: number;
    4000: number;
    14000: number;
  };
  customPresets: Record<string, {
    60: number;
    230: number;
    910: number;
    4000: number;
    14000: number;
  }>;
  downloads: Record<string, {
    progress: number;
    status: "downloading" | "completed" | "failed" | "syncing";
    error?: string;
    song: Song;
  }>;
  recentlyPlayed: Song[];
  lastSeekTime: number | null;
  
  setSong: (song: Song, newQueue?: Song[]) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  addToQueue: (song: Song) => void;
  clearQueue: () => void;
  setVolume: (volume: number) => void;
  setProgress: (time: number, duration?: number) => void;
  seekTo: (time: number) => void;
  setLowDataMode: (enabled: boolean) => void;
  setTheme: (theme: "classic" | "midnight" | "ocean" | "sunset") => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (duration: number) => void;
  setRepeatMode: (mode: "off" | "all" | "one") => void;
  setShuffleMode: (enabled: boolean) => void;
  setEqualizerBand: (freq: number, value: number) => void;
  saveCustomPreset: (name: string, settings: PlayerState["equalizerSettings"]) => void;
  deleteCustomPreset: (name: string) => void;
  updateSongLyrics: (songId: string, lyrics: LyricLine[]) => void;
  autoFetchLyrics: (songId: string, artist: string, title: string) => Promise<void>;
  removeFromQueue: (songId: string) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  setQueue: (newQueue: Song[]) => void;
  shuffleQueue: () => void;
  setDownloadStatus: (songId: string, status: { progress: number; status: "downloading" | "completed" | "failed" | "syncing"; error?: string; song: Song }) => void;
  removeDownload: (songId: string) => void;
  rehydrateLocalUrls: () => Promise<void>;
  updateSongThumbnail: (songId: string, thumbnail: string) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      queue: [],
      currentIndex: -1,
      volume: 0.7,
      currentTime: 0,
      duration: 0,
      lowDataMode: false,
      theme: "classic",
      crossfadeEnabled: true,
      crossfadeDuration: 3,
      repeatMode: "off",
      shuffleMode: false,
      equalizerSettings: {
        60: 0,
        230: 0,
        910: 0,
        4000: 0,
        14000: 0,
      },
      customPresets: {}, // Will be loaded from storage by persist if needed, but we keep it here for initial
      downloads: {},
      recentlyPlayed: [],
      lastSeekTime: null,

      updateSongThumbnail: (songId, thumbnail) => set((state) => {
        const update = (s: Song) => s.id === songId ? { ...s, thumbnail } : s;
        return {
          queue: state.queue.map(update),
          currentSong: state.currentSong?.id === songId ? update(state.currentSong) : state.currentSong,
          recentlyPlayed: state.recentlyPlayed.map(update)
        };
      }),

      setSong: async (song, newQueue) => {
        const { queue, recentlyPlayed } = get();
        const updatedQueue = newQueue || queue;
        
        // Update recently played
        const newRecentlyPlayed = [song, ...recentlyPlayed.filter(s => s.id !== song.id)].slice(0, 10);
        
        // Check if song is already in the queue
        let index = updatedQueue.findIndex(s => s.id === song.id);
        
        // If not in queue, add it to the end
        if (index === -1) {
          updatedQueue.push(song);
          index = updatedQueue.length - 1;
        }

        set({ 
          currentSong: song, 
          isPlaying: true, 
          queue: updatedQueue, 
          currentIndex: index,
          currentTime: 0,
          recentlyPlayed: newRecentlyPlayed
        });
        
        // Log play to history for AI recommendations
        if (auth.currentUser) {
          try {
            await addDoc(collection(db, "users", auth.currentUser.uid, "history"), {
              songId: song.id,
              title: song.title,
              artist: song.artist,
              thumbnail: song.thumbnail,
              playedAt: serverTimestamp()
            });
          } catch (err) {
            console.warn("Failed to log history", err);
          }
        }
      },
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      
      next: () => {
        const { queue, currentIndex, repeatMode, shuffleMode } = get();
        if (queue.length === 0) return;

        let nextIndex = currentIndex;

        if (repeatMode === "one") {
          // Stay on same song, but trigger a progress reset
          set({ currentTime: 0, isPlaying: true });
          return;
        }

        if (shuffleMode) {
          nextIndex = Math.floor(Math.random() * queue.length);
          // Try to avoid playing the same song twice if queue > 1
          if (nextIndex === currentIndex && queue.length > 1) {
            nextIndex = (nextIndex + 1) % queue.length;
          }
        } else {
          if (currentIndex < queue.length - 1) {
            nextIndex = currentIndex + 1;
          } else if (repeatMode === "all") {
            nextIndex = 0;
          } else {
            // End of queue and no repeat
            set({ isPlaying: false });
            return;
          }
        }

        set({ currentIndex: nextIndex, currentSong: queue[nextIndex], isPlaying: true, currentTime: 0 });
      },

      previous: () => {
        const { queue, currentIndex, currentTime } = get();
        
        // If we've played more than 3 seconds, reset the current song instead of going back
        if (currentTime > 3) {
          set({ currentTime: 0 });
          return;
        }

        if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          set({ currentIndex: prevIndex, currentSong: queue[prevIndex], isPlaying: true, currentTime: 0 });
        } else if (queue.length > 0) {
          // Just reset the first song if we can't go back further
          set({ currentTime: 0 });
        }
      },

      addToQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),
      clearQueue: () => set({ queue: [], currentIndex: -1, currentSong: null, isPlaying: false }),
      setVolume: (volume) => set({ volume }),
      setProgress: (currentTime, duration) => set((state) => ({ 
        currentTime, 
        duration: duration !== undefined ? duration : state.duration 
      })),
      seekTo: (time) => set({ lastSeekTime: time }),
      setLowDataMode: (lowDataMode) => set({ lowDataMode }),
      setTheme: (theme) => set({ theme }),
      setCrossfadeEnabled: (crossfadeEnabled) => set({ crossfadeEnabled }),
      setCrossfadeDuration: (crossfadeDuration) => set({ crossfadeDuration }),
      setRepeatMode: (repeatMode) => set({ repeatMode }),
      setShuffleMode: (shuffleMode) => set({ shuffleMode }),
      setEqualizerBand: (freq, value) => set((state) => ({
        equalizerSettings: { ...state.equalizerSettings, [freq]: value }
      })),
      saveCustomPreset: (name, settings) => set((state) => ({
        customPresets: { ...state.customPresets, [name]: settings }
      })),
      deleteCustomPreset: (name) => set((state) => {
        const newPresets = { ...state.customPresets };
        delete newPresets[name];
        return { customPresets: newPresets };
      }),
      updateSongLyrics: (songId, lyrics) => set((state) => {
        const updatedQueue = state.queue.map(s => s.id === songId ? { ...s, lyrics } : s);
        const updatedCurrentSong = state.currentSong?.id === songId ? { ...state.currentSong, lyrics } : state.currentSong;
        return { queue: updatedQueue, currentSong: updatedCurrentSong };
      }),
      autoFetchLyrics: async (songId, artist, title) => {
        const song = get().queue.find(s => s.id === songId) || get().currentSong;
        const duration = song?.duration;
        const lyrics = await fetchLyrics(artist, title, duration);
        if (lyrics) {
          get().updateSongLyrics(songId, lyrics);
          
          // Persist if it's a local track
          const song = get().queue.find(s => s.id === songId);
          if (song?.source === "local") {
            try {
              const track = await getTrack(songId);
              if (track) {
                track.metadata.lyrics = lyrics;
                await saveTrack(track);
              }
            } catch (err) {
              console.warn("Failed to persist auto-fetched lyrics:", err);
            }
          }
        }
      },
      removeFromQueue: (songId) => set((state) => {
        const newQueue = state.queue.filter(s => s.id !== songId);
        let newIndex = state.currentIndex;
        
        // Adjust currentIndex if necessary
        const removedIndex = state.queue.findIndex(s => s.id === songId);
        if (removedIndex < state.currentIndex) {
          newIndex--;
        } else if (removedIndex === state.currentIndex) {
          // If the current song is removed, we might want to stop or play next
          // For now, let's just adjust index and let the UI handle if it needs to skip
          if (newQueue.length === 0) {
            return { queue: [], currentIndex: -1, currentSong: null, isPlaying: false };
          }
          newIndex = Math.min(newIndex, newQueue.length - 1);
        }
        
        return { 
          queue: newQueue, 
          currentIndex: newIndex,
          currentSong: newIndex >= 0 ? newQueue[newIndex] : null
        };
      }),
      reorderQueue: (startIndex, endIndex) => set((state) => {
        const newQueue = Array.from(state.queue);
        const [removed] = newQueue.splice(startIndex, 1);
        newQueue.splice(endIndex, 0, removed);
        
        // Find the new index of the current song
        const currentSongId = state.currentSong?.id;
        const newIndex = newQueue.findIndex(s => s.id === currentSongId);
        
        return { 
          queue: newQueue,
          currentIndex: newIndex
        };
      }),
      setQueue: (newQueue) => set((state) => {
        const currentSongId = state.currentSong?.id;
        const newIndex = newQueue.findIndex(s => s.id === currentSongId);
        return { 
          queue: newQueue,
          currentIndex: newIndex
        };
      }),
      shuffleQueue: () => set((state) => {
        if (state.queue.length <= 1) return state;
        
        // We shuffle the entire queue but we want to make sure the current song stays at its new position
        const newQueue = [...state.queue];
        
        // Fisher-Yates shuffle
        for (let i = newQueue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
        }
        
        // Find the new index of the current song to maintain playback
        const currentSongId = state.currentSong?.id;
        const newIndex = newQueue.findIndex(s => s.id === currentSongId);
        
        return { 
          queue: newQueue,
          currentIndex: newIndex
        };
      }),
      setDownloadStatus: (songId, status) => set((state) => ({
        downloads: { ...state.downloads, [songId]: status }
      })),
      removeDownload: (songId) => set((state) => {
        const newDownloads = { ...state.downloads };
        delete newDownloads[songId];
        return { downloads: newDownloads };
      }),
      rehydrateLocalUrls: async () => {
        const { queue, currentSong } = get();
        const hasLocal = queue.some(s => s.source === "local") || currentSong?.source === "local";
        if (!hasLocal) return;

        try {
          const offlineTracks = await getAllTracks();
          const trackMap = new Map(offlineTracks.map(t => [t.id, t]));

          const updateSong = (s: Song) => {
            if (s.source === "local") {
              const track = trackMap.get(s.id);
              if (track) {
                let thumbnail = s.thumbnail;
                if (track.metadata.thumbnailBlob) {
                  thumbnail = URL.createObjectURL(track.metadata.thumbnailBlob);
                }
                return { 
                  ...s, 
                  localUrl: URL.createObjectURL(track.blob),
                  thumbnail: thumbnail || s.thumbnail
                };
              }
            }
            return s;
          };

          const newQueue = queue.map(updateSong);
          const newCurrentSong = currentSong ? updateSong(currentSong) : null;

          set({ queue: newQueue, currentSong: newCurrentSong });
        } catch (err) {
          console.warn("Failed to rehydrate local URLs", err);
        }
      }
    }),
    {
      name: "player-session",
      partialize: (state) => {
        const pruneSong = (s: Song | null): any => {
          if (!s) return null;
          return {
            id: s.id,
            title: s.title,
            artist: s.artist,
            thumbnail: s.thumbnail,
            album: s.album,
            source: s.source,
            sourceId: s.sourceId,
            duration: s.duration,
            genre: s.genre,
            releaseDate: s.releaseDate
          };
        };
        return {
          currentSong: pruneSong(state.currentSong),
          queue: state.queue.slice(0, 50).map(s => pruneSong(s)),
          currentIndex: state.currentIndex > 49 ? -1 : state.currentIndex,
          volume: state.volume,
          currentTime: state.currentTime,
          repeatMode: state.repeatMode,
          shuffleMode: state.shuffleMode,
          recentlyPlayed: state.recentlyPlayed.slice(0, 20).map(s => pruneSong(s)),
          equalizerSettings: state.equalizerSettings,
          customPresets: state.customPresets,
          lowDataMode: state.lowDataMode,
          theme: state.theme,
          crossfadeEnabled: state.crossfadeEnabled,
          crossfadeDuration: state.crossfadeDuration,
        };
      },
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            return JSON.parse(str);
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            if (e instanceof DOMException && (
              e.name === 'QuotaExceededError' ||
              e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            )) {
              console.warn("LocalStorage quota exceeded, attempting to prune...");
              // If quota exceeded, try to save without queue and recently played
              if (value && typeof value === 'object' && (value as any).state) {
                const pruned = { ...value as any };
                pruned.state = { ...pruned.state, queue: [], recentlyPlayed: [] };
                try {
                  localStorage.setItem(name, JSON.stringify(pruned));
                } catch {
                  localStorage.removeItem(name);
                }
              }
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      onRehydrateStorage: (state) => {
        return (rehydratedState, error) => {
          if (!error && rehydratedState) {
            rehydratedState.rehydrateLocalUrls();
          }
        };
      },
    }
  )
);
