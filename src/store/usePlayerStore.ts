import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "../lib/safeStorage";

const localStorage = safeLocalStorage;
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
  isAiSong?: boolean;
  releaseDate?: string;
  description?: string;
}

export function extractYoutubeVideoIdFromString(str: string): string {
  if (!str) return "";
  // Check if it's already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  // Try parsing YouTube URL patterns (watch?v=, embed/, etc.)
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = str.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  return str;
}

export function cleanSongForYoutube(song: Song): Song {
  const isYT = song.source === "youtube" || song.source === "cloud" || song.source === "spotify";
  if (isYT) {
    const cleanId = extractYoutubeVideoIdFromString(song.sourceId || song.id);
    if (cleanId) {
      return {
        ...song,
        id: cleanId,
        sourceId: cleanId
      };
    }
  }
  return song;
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
  playerLayoutMode: "audio-only" | "video-mode";
  youtubeMinimized: boolean;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  normalizationEnabled: boolean;
  repeatMode: "off" | "all" | "one";
  shuffleMode: boolean;
  isShuffle: boolean;
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
  likedSongs: Song[];
  
  toggleLikeSong: (song: Song) => void;
  setSong: (song: Song, newQueue?: Song[], skipHistoryUpdate?: boolean) => void;
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
  setPlayerLayoutMode: (mode: "audio-only" | "video-mode") => void;
  setYoutubeMinimized: (minimized: boolean) => void;
  setCrossfadeEnabled: (enabled: boolean) => void;
  setCrossfadeDuration: (duration: number) => void;
  setNormalizationEnabled: (enabled: boolean) => void;
  setRepeatMode: (mode: "off" | "all" | "one") => void;
  setShuffleMode: (enabled: boolean) => void;
  setIsShuffle: (enabled: boolean) => void;
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
  updateSongMetadata: (songId: string, metadata: { title?: string; artist?: string; thumbnail?: string; duration?: number; album?: string }) => void;

  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  showDirectories: boolean;
  setShowDirectories: (enabled: boolean) => void;
  nightMode: boolean;
  setNightMode: (enabled: boolean) => void;
  autoRotate: boolean;
  setAutoRotate: (enabled: boolean) => void;
  forwardBackward: boolean;
  setForwardBackward: (enabled: boolean) => void;
  fastForwardTime: string;
  setFastForwardTime: (time: string) => void;
  queueAfterSearch: string;
  setQueueAfterSearch: (queueMode: string) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  pageEffects: string;
  setPageEffects: (effect: string) => void;

  desktopLyrics: boolean;
  setDesktopLyrics: (enabled: boolean) => void;
  carBluetoothLyrics: boolean;
  setCarBluetoothLyrics: (enabled: boolean) => void;
  statusBarLyrics: boolean;
  setStatusBarLyrics: (enabled: boolean) => void;

  shakeToPlay: boolean;
  setShakeToPlay: (enabled: boolean) => void;
  swipeToChange: boolean;
  setSwipeToChange: (enabled: boolean) => void;
  allowOthersPlaying: boolean;
  setAllowOthersPlaying: (enabled: boolean) => void;
  playPauseFade: boolean;
  setPlayPauseFade: (enabled: boolean) => void;
  gaplessPlayback: boolean;
  setGaplessPlayback: (enabled: boolean) => void;
  crossfadeNew: boolean;
  setCrossfadeNew: (enabled: boolean) => void;
  requireDeleteConfirmation: boolean;
  setRequireDeleteConfirmation: (enabled: boolean) => void;
  
  lyricsFontSizeMult: number;
  setLyricsFontSizeMult: (mult: number) => void;
  lyricsColor: string;
  setLyricsColor: (color: string) => void;
  lyricsAlign: "left" | "center" | "right";
  setLyricsAlign: (align: "left" | "center" | "right") => void;
  lyricsIsItalic: boolean;
  setLyricsIsItalic: (enabled: boolean) => void;
  lyricsFontWeight: "font-medium" | "font-bold" | "font-black";
  setLyricsFontWeight: (weight: "font-medium" | "font-bold" | "font-black") => void;
  lyricsSyncOffset: number;
  setLyricsSyncOffset: (offset: number) => void;
  lyricsBackdropEnabled: boolean;
  setLyricsBackdropEnabled: (enabled: boolean) => void;
  lyricsBackdropBlur: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  setLyricsBackdropBlur: (blur: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl") => void;
  lyricsTextStyle: "normal" | "bold_fraktur" | "bold_script" | "zalgo" | "fullwidth";
  setLyricsTextStyle: (style: "normal" | "bold_fraktur" | "bold_script" | "zalgo" | "fullwidth") => void;

  resetSettings: () => void;
}

// Helper for debouncing local storage to fix UI stuttering
const setItemDebounceMap = new Map<string, any>();

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      queue: [],
      currentIndex: -1,
      volume: 0.7,
      currentTime: typeof window !== "undefined" ? parseFloat(localStorage.getItem("player_current_time") || "0") : 0,
      duration: 0,
      lowDataMode: false,
      theme: "classic",
      playerLayoutMode: "video-mode",
      youtubeMinimized: false,
      crossfadeEnabled: true,
      crossfadeDuration: 3,
      normalizationEnabled: false,
      repeatMode: "off",
      shuffleMode: false,
      isShuffle: false,
      showDirectories: false,
      nightMode: true,
      autoRotate: true,
      forwardBackward: true,
      fastForwardTime: "15s",
      queueAfterSearch: "All songs",
      accentColor: "Purple",
      pageEffects: "Slide",
      desktopLyrics: typeof window !== "undefined" ? localStorage.getItem("lyric_desktop_lyrics") === "true" : false,
      carBluetoothLyrics: typeof window !== "undefined" ? localStorage.getItem("lyric_car_bluetooth_lyrics") === "true" : false,
      statusBarLyrics: typeof window !== "undefined" ? localStorage.getItem("lyric_status_bar_lyrics") === "true" : false,
      shakeToPlay: false,
      swipeToChange: true,
      allowOthersPlaying: false,
      playPauseFade: false,
      gaplessPlayback: false,
      crossfadeNew: false,
      requireDeleteConfirmation: true,
      
      isMobileSidebarOpen: false,
      setIsMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),

      lyricsFontSizeMult: typeof window !== "undefined" ? parseFloat(localStorage.getItem("lyric_font_size") || "1") : 1,
      setLyricsFontSizeMult: (mult) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_font_size", mult.toString());
        }
        set({ lyricsFontSizeMult: mult });
      },
      lyricsColor: typeof window !== "undefined" ? localStorage.getItem("lyric_color") || "#ffffff" : "#ffffff",
      setLyricsColor: (color) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_color", color);
        }
        set({ lyricsColor: color });
      },
      lyricsAlign: typeof window !== "undefined" ? (localStorage.getItem("lyric_align") as any || "left") : "left",
      setLyricsAlign: (align) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_align", align);
        }
        set({ lyricsAlign: align });
      },
      lyricsIsItalic: typeof window !== "undefined" ? localStorage.getItem("lyric_is_italic") !== "false" : true,
      setLyricsIsItalic: (enabled) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_is_italic", enabled.toString());
        }
        set({ lyricsIsItalic: enabled });
      },
      lyricsFontWeight: typeof window !== "undefined" ? (localStorage.getItem("lyric_font_weight") as any || "font-black") : "font-black",
      setLyricsFontWeight: (weight) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_font_weight", weight);
        }
        set({ lyricsFontWeight: weight });
      },
      lyricsSyncOffset: typeof window !== "undefined" ? parseFloat(localStorage.getItem("lyric_sync_offset") || "0") : 0,
      setLyricsSyncOffset: (offset) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_sync_offset", offset.toString());
        }
        set({ lyricsSyncOffset: offset });
      },
      lyricsBackdropEnabled: typeof window !== "undefined" ? localStorage.getItem("lyric_backdrop_enabled") !== "false" : true,
      setLyricsBackdropEnabled: (enabled) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_backdrop_enabled", enabled.toString());
        }
        set({ lyricsBackdropEnabled: enabled });
      },
      lyricsBackdropBlur: typeof window !== "undefined" ? (localStorage.getItem("lyric_backdrop_blur") as any || "xl") : "xl",
      setLyricsBackdropBlur: (blur) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_backdrop_blur", blur);
        }
        set({ lyricsBackdropBlur: blur });
      },
      lyricsTextStyle: typeof window !== "undefined" ? (localStorage.getItem("lyric_text_style") as any || "normal") : "normal",
      setLyricsTextStyle: (style) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_text_style", style);
        }
        set({ lyricsTextStyle: style });
      },

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
      likedSongs: [],

      toggleLikeSong: (song) => set((state) => {
        const cleaned = cleanSongForYoutube(song);
        const exists = state.likedSongs.some(s => s.id === cleaned.id);
        const newLiked = exists 
          ? state.likedSongs.filter(s => s.id !== cleaned.id)
          : [...state.likedSongs, cleaned];
        return { likedSongs: newLiked };
      }),

      updateSongThumbnail: (songId, thumbnail) => set((state) => {
        const update = (s: Song) => s.id === songId ? { ...s, thumbnail } : s;

        // Sync with local storage playlists
        try {
          const playlistsStr = window.localStorage.getItem('music_playlists') || safeLocalStorage.getItem('music_playlists');
          if (playlistsStr) {
            let playlists = JSON.parse(playlistsStr);
            let changed = false;
            playlists = playlists.map((p: any) => {
              let pChanged = false;
              const newSongs = p.songs?.map((s: any) => {
                if (s.id === songId) {
                  pChanged = true;
                  return { ...s, thumbnail };
                }
                return s;
              }) || [];
              if (pChanged) changed = true;
              return { ...p, songs: newSongs };
            });
            if (changed) {
              safeLocalStorage.setItem('music_playlists', JSON.stringify(playlists));
              window.dispatchEvent(new Event('storage')); // Trigger re-render if needed
            }
          }
        } catch (e) {
          console.error("Failed to sync artwork to playlists", e);
        }

        return {
          queue: state.queue.map(update),
          currentSong: state.currentSong?.id === songId ? update(state.currentSong) : state.currentSong,
          recentlyPlayed: state.recentlyPlayed.map(update),
          likedSongs: state.likedSongs.map(update)
        };
      }),

      updateSongMetadata: (songId, metadata) => set((state) => {
        const update = (s: Song) => s.id === songId ? { ...s, ...metadata } : s;
        return {
          queue: state.queue.map(update),
          currentSong: state.currentSong?.id === songId ? update(state.currentSong) : state.currentSong,
          recentlyPlayed: state.recentlyPlayed.map(update)
        };
      }),

      setSong: async (song, newQueue, skipHistoryUpdate = false) => {
        const cleanedSong = cleanSongForYoutube(song);
        const { queue, recentlyPlayed } = get();
        
        // Clean all tracks in the queue
        const baseQueue = newQueue || queue;
        const updatedQueue = baseQueue.map(s => cleanSongForYoutube(s));
        
        // Update recently played
        let newRecentlyPlayed;
        if (skipHistoryUpdate) {
          newRecentlyPlayed = recentlyPlayed;
        } else {
          const cleanedRecentlyPlayed = recentlyPlayed.map(s => cleanSongForYoutube(s));
          newRecentlyPlayed = [cleanedSong, ...cleanedRecentlyPlayed.filter(s => s.id !== cleanedSong.id)].slice(0, 10);
        }
        
        // Check if song is already in the queue
        let index = updatedQueue.findIndex(s => s.id === cleanedSong.id);
        
        // If not in queue, add it to the end
        if (index === -1) {
          updatedQueue.push(cleanedSong);
          index = updatedQueue.length - 1;
        }

        set({ 
          currentSong: cleanedSong, 
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
              songId: cleanedSong.id,
              title: cleanedSong.title,
              artist: cleanedSong.artist,
              thumbnail: cleanedSong.thumbnail,
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

      addToQueue: (song) => set((state) => ({ queue: [...state.queue, cleanSongForYoutube(song)] })),
      clearQueue: () => set({ queue: [], currentIndex: -1, currentSong: null, isPlaying: false }),
      setVolume: (volume) => set({ volume }),
      setProgress: (currentTime, duration) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("player_current_time", currentTime.toString());
        }
        set((state) => ({ 
          currentTime, 
          duration: duration !== undefined ? duration : state.duration 
        }));
      },
      seekTo: (time) => set({ lastSeekTime: time }),
      setLowDataMode: (lowDataMode) => set({ lowDataMode }),
      setTheme: (theme) => set({ theme }),
      setPlayerLayoutMode: (playerLayoutMode) => set({ playerLayoutMode }),
      setYoutubeMinimized: (youtubeMinimized) => set({ youtubeMinimized }),
      setCrossfadeEnabled: (crossfadeEnabled) => set({ crossfadeEnabled }),
      setCrossfadeDuration: (crossfadeDuration) => set({ crossfadeDuration }),
      setShowDirectories: (showDirectories) => set({ showDirectories }),
      setNightMode: (nightMode) => set({ nightMode }),
      setAutoRotate: (autoRotate) => set({ autoRotate }),
      setForwardBackward: (forwardBackward) => set({ forwardBackward }),
      setFastForwardTime: (fastForwardTime) => set({ fastForwardTime }),
      setQueueAfterSearch: (queueAfterSearch) => set({ queueAfterSearch }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setPageEffects: (pageEffects) => set({ pageEffects }),
       setDesktopLyrics: (desktopLyrics) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_desktop_lyrics", desktopLyrics.toString());
        }
        set({ desktopLyrics });
      },
      setCarBluetoothLyrics: (carBluetoothLyrics) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_car_bluetooth_lyrics", carBluetoothLyrics.toString());
        }
        set({ carBluetoothLyrics });
      },
      setStatusBarLyrics: (statusBarLyrics) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("lyric_status_bar_lyrics", statusBarLyrics.toString());
        }
        set({ statusBarLyrics });
      },
      setShakeToPlay: (shakeToPlay) => set({ shakeToPlay }),
      setSwipeToChange: (swipeToChange) => set({ swipeToChange }),
      setAllowOthersPlaying: (allowOthersPlaying) => set({ allowOthersPlaying }),
      setPlayPauseFade: (playPauseFade) => set({ playPauseFade }),
      setGaplessPlayback: (gaplessPlayback) => set({ gaplessPlayback }),
      setCrossfadeNew: (crossfadeNew) => set({ crossfadeNew }),
      setRequireDeleteConfirmation: (requireDeleteConfirmation) => set({ requireDeleteConfirmation }),
      resetSettings: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("lyric_font_size");
          localStorage.removeItem("lyric_color");
          localStorage.removeItem("lyric_align");
          localStorage.removeItem("lyric_is_italic");
          localStorage.removeItem("lyric_font_weight");
          localStorage.removeItem("lyric_sync_offset");
          localStorage.removeItem("lyric_desktop_lyrics");
          localStorage.removeItem("lyric_car_bluetooth_lyrics");
          localStorage.removeItem("lyric_status_bar_lyrics");
          localStorage.removeItem("lyric_backdrop_enabled");
          localStorage.removeItem("lyric_backdrop_blur");
          localStorage.removeItem("lyric_text_style");
        }
        set({
          lowDataMode: false,
          theme: "classic",
          playerLayoutMode: "video-mode",
          youtubeMinimized: false,
          crossfadeEnabled: true,
          crossfadeDuration: 3,
          normalizationEnabled: false,
          showDirectories: false,
          nightMode: true,
          autoRotate: true,
          forwardBackward: true,
          fastForwardTime: "15s",
          queueAfterSearch: "All songs",
          accentColor: "Purple",
          pageEffects: "Slide",
          desktopLyrics: false,
          carBluetoothLyrics: false,
          statusBarLyrics: false,
          shakeToPlay: false,
          swipeToChange: true,
          allowOthersPlaying: false,
          playPauseFade: false,
          gaplessPlayback: false,
          crossfadeNew: false,
          lyricsFontSizeMult: 1,
          lyricsColor: "#ffffff",
          lyricsAlign: "left",
          lyricsIsItalic: true,
          lyricsFontWeight: "font-black",
          lyricsSyncOffset: 0,
          lyricsBackdropEnabled: true,
          lyricsBackdropBlur: "xl",
          lyricsTextStyle: "normal",
          equalizerSettings: {
            60: 0,
            230: 0,
            910: 0,
            4000: 0,
            14000: 0,
          }
        });
      },
      setNormalizationEnabled: (normalizationEnabled) => set({ normalizationEnabled }),
      setRepeatMode: (repeatMode) => set({ repeatMode }),
      setShuffleMode: (shuffleMode) => set({ shuffleMode, isShuffle: shuffleMode }),
      setIsShuffle: (isShuffle) => set({ shuffleMode: isShuffle, isShuffle }),
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
          repeatMode: state.repeatMode,
          shuffleMode: state.shuffleMode,
          isShuffle: state.isShuffle,
          recentlyPlayed: state.recentlyPlayed.slice(0, 20).map(s => pruneSong(s)),
          equalizerSettings: state.equalizerSettings,
          customPresets: state.customPresets,
          lowDataMode: state.lowDataMode,
          theme: state.theme,
          playerLayoutMode: state.playerLayoutMode,
          youtubeMinimized: state.youtubeMinimized,
          crossfadeEnabled: state.crossfadeEnabled,
          crossfadeDuration: state.crossfadeDuration,
          normalizationEnabled: state.normalizationEnabled,
          likedSongs: (state.likedSongs || []).map(s => pruneSong(s)),
          showDirectories: state.showDirectories,
          nightMode: state.nightMode,
          autoRotate: state.autoRotate,
          forwardBackward: state.forwardBackward,
          fastForwardTime: state.fastForwardTime,
          queueAfterSearch: state.queueAfterSearch,
          accentColor: state.accentColor,
          pageEffects: state.pageEffects,
        };
      },
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          console.log("[usePlayerStore] getItem CALLED for key:", name, "found content:", !!str);
          if (!str) return null;
          try {
            const parsed = JSON.parse(str);
            console.log("[usePlayerStore] getItem PARSED state:", parsed?.state ? Object.keys(parsed.state) : null);
            if (parsed?.state) {
              console.log("[usePlayerStore] getItem lyric values:", {
                lyricsFontSizeMult: parsed.state.lyricsFontSizeMult,
                lyricsColor: parsed.state.lyricsColor,
                lyricsAlign: parsed.state.lyricsAlign,
                lyricsIsItalic: parsed.state.lyricsIsItalic,
                lyricsFontWeight: parsed.state.lyricsFontWeight,
                lyricsSyncOffset: parsed.state.lyricsSyncOffset,
              });
            }
            return parsed;
          } catch (err) {
            console.error("[usePlayerStore] Error parsing storage item", err);
            return null;
          }
        },
        setItem: (name, value) => {
          console.log("[usePlayerStore] setItem CALLED for key:", name, "synchronously. Keys:", Object.keys((value as any)?.state || {}));
          try {
            console.log("[usePlayerStore] setItem WRITING to localStorage. Keys saved:", Object.keys((value as any)?.state || {}));
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            if (e instanceof DOMException && (
              e.name === 'QuotaExceededError' ||
              e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            )) {
              console.warn("LocalStorage quota exceeded, attempting to prune...");
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
