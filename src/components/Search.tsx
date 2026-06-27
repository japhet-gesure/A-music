import { useState, useEffect, useRef } from "react";
import {
  Search as SearchIcon,
  X,
  Play,
  Music,
  ListPlus,
  Loader2,
  MoreHorizontal,
  User,
  Download,
  CheckCircle2,
  Info,
} from "lucide-react";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { Link, useSearchParams } from "react-router-dom";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { cn } from "../lib/utils";
import axios from "axios";
import { getAllTracks } from "../lib/offlineStorage";
import { downloadSong } from "../services/downloadService";
import { searchSpotifyTrack } from "../services/spotifyService";
import { safeLocalStorage } from "../lib/safeStorage";

const localStorage = safeLocalStorage;

function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
    }
  }
  return tmp[a.length][b.length];
}

const POPULAR_SEARCH_TARGETS = [
  "metallica",
  "daft punk",
  "the beatles",
  "michael jackson",
  "queen",
  "pink floyd",
  "taylor swift",
  "eminem",
  "coldplay",
  "billie eilish",
  "drake",
  "ed sheeran",
  "the weeknd",
  "bruno mars",
  "yesterday",
  "bohemian rhapsody",
  "hotel california",
  "stairway to heaven",
  "smells like teen spirit",
  "blinding lights",
  "shape of you",
  "ac/dc",
  "nirvana",
  "led zeppelin",
  "linkin park",
  "radiohead",
  "red hot chili peppers",
  "adele",
  "rihanna",
  "justin bieber",
  "beyonce",
  "katy perry",
  "shakira",
  "dualipa",
  "post malone",
  "kanye west",
  "travis scott",
  "kendrick lamar",
  "imagine dragons",
  "one direction",
  "maroon 5",
];

const formatSearchResultDuration = (duration?: number | string | null): string => {
  if (duration === undefined || duration === null) return "3:45";
  const num = typeof duration === "string" ? parseFloat(duration) : duration;
  if (isNaN(num)) return "3:45";
  const totalSeconds = Math.round(num);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") || "";
  const isOfflineMode = searchParams.get("offline") === "true";

  const [query, setQuery] = useState(isOfflineMode ? "" : qParam);
  const [inputValue, setInputValue] = useState(isOfflineMode ? "" : qParam);
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [offlineIds, setOfflineIds] = useState<Set<string>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const {
    setSong,
    currentSong,
    isPlaying,
    togglePlay,
    downloads,
    queueAfterSearch,
  } = usePlayerStore();

  const [showingSimilar, setShowingSimilar] = useState(false);
  const [similarQuery, setSimilarQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [watchedIds, setWatchedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("watched_song_ids");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to parse watched song IDs", e);
    }
    return new Set<string>();
  });

  const [offlineCatalog, setOfflineCatalog] = useState<Song[]>([]);
  const lastSearchedRef = useRef("");
  const lastSetParamQRef = useRef(isOfflineMode ? "" : qParam);

  // Load offline catalog from IDB
  useEffect(() => {
    let urlsToRevoke: string[] = [];
    const loadOffline = async () => {
      try {
        const tracks = await getAllTracks();
        setOfflineIds(new Set(tracks.map((t) => t.id)));

        const mappedSongs: Song[] = tracks.map((ot) => {
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
            thumbnail:
              thumbUrl ||
              "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
            source: "local" as const,
            sourceId: ot.id,
            duration: ot.metadata.duration,
            localUrl: trackUrl,
            lyrics: ot.metadata.lyrics,
            genre: ot.metadata.genre || "Unknown Genre",
          };
        });
        setOfflineCatalog(mappedSongs);
      } catch (err) {
        console.error("Failed to load offline tracks for search:", err);
      }
    };
    loadOffline();
    return () => {
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [downloads]);

  const [spotifyEnrichments, setSpotifyEnrichments] = useState<
    Record<
      string,
      { title: string; artist: string; thumbnail: string; duration?: number }
    >
  >({});
  const queriedSpotifyIds = useRef<Set<string>>(new Set());

  const activeSearchQuery = isOfflineMode ? qParam : query;
  const displayResults = isOfflineMode ? offlineCatalog : results;

  const ytRegex =
    /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const isDirectYtLink = !isOfflineMode && ytRegex.test(activeSearchQuery);

  const directYtSong: Song | null = (() => {
    if (!isDirectYtLink) return null;
    const match = activeSearchQuery.match(ytRegex);
    const videoId = match ? match[1] : null;
    if (!videoId) return null;
    return {
      id: videoId,
      title: "YouTube Link Track",
      artist: "Loaded from URL",
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      source: "youtube" as const,
      sourceId: videoId,
      duration: 180,
    };
  })();

  const initialBaseResults = isOfflineMode
    ? offlineCatalog.filter((song) => {
        // Query filtering purely for offline: case-insensitive match on track title, artist name, and video description
        const searchVal = activeSearchQuery.trim().toLowerCase();
        if (!searchVal) return true;

        const titleMatch = (song.title || "").toLowerCase().includes(searchVal);
        const artistMatch = (song.artist || "")
          .toLowerCase()
          .includes(searchVal);
        const descMatch = (song.description || song.album || "local")
          .toLowerCase()
          .includes(searchVal);

        return titleMatch || artistMatch || descMatch;
      })
    : isDirectYtLink
      ? results.length > 0
        ? results
        : directYtSong
          ? [directYtSong]
          : []
      : results;

  const filteredResults = initialBaseResults
    .filter((song) => {
      // Apply tag filters dynamically
      const duration = song.duration !== undefined ? song.duration : 180;
      const lowerTitle = (song.title || "").toLowerCase();

      if (activeFilter === "Spotify") {
        return song.source === "spotify";
      }

      if (activeFilter === "Songs") {
        // Return true if AI specifically marked it as a song
        if (song.isAiSong === false) return false;

        // Fallback heuristics if the AI classification didn't happen for some reason
        return (
          duration <= 1200 &&
          !lowerTitle.includes("full album") &&
          !lowerTitle.includes("podcast")
        );
      }

      if (activeFilter === "Videos") {
        return (
          duration >= 60 ||
          lowerTitle.includes("video") ||
          lowerTitle.includes("official")
        );
      }

      if (activeFilter === "Recently uploaded") {
        return (
          lowerTitle.includes("new") ||
          lowerTitle.includes("202") ||
          lowerTitle.includes("latest") ||
          (song.duration && song.duration > 200) ||
          song.releaseDate !== undefined
        );
      }

      // Default "All" doesn't filter out any items from initial results
      return true;
    })
    .map((song) =>
      spotifyEnrichments[song.id]
        ? { ...song, ...spotifyEnrichments[song.id] }
        : song,
    );

  useEffect(() => {
    filteredResults.forEach((song) => {
      if (!queriedSpotifyIds.current.has(song.id)) {
        queriedSpotifyIds.current.add(song.id);
        if (
          !song.thumbnail?.includes("spotify.com") &&
          !song.thumbnail?.includes("scdn.co")
        ) {
          searchSpotifyTrack(song.title, song.artist).then((metadata) => {
            if (metadata) {
              setSpotifyEnrichments((prev) => ({
                ...prev,
                [song.id]: {
                  title: metadata.title,
                  artist: metadata.artist,
                  thumbnail: metadata.albumArt,
                  duration: metadata.duration_ms / 1000,
                },
              }));
            }
          });
        }
      }
    });
  }, [filteredResults]);

  useEffect(() => {
    const saved = localStorage.getItem("recent_searches");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecentSearches(parsed);
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }
  }, []);

  const addToRecentSearches = (q: string) => {
    if (!q.trim()) return;
    const cleanQ = q.trim();
    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (item) => item.toLowerCase() !== cleanQ.toLowerCase(),
      );
      const updated = [cleanQ, ...filtered].slice(0, 5);
      localStorage.setItem("recent_searches", JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const loadOffline = async () => {
      const tracks = await getAllTracks();
      setOfflineIds(new Set(tracks.map((t) => t.id)));
    };
    loadOffline();
  }, []);

  const handleDownload = async (song: Song) => {
    setDownloadingIds((prev) => new Set(prev).add(song.id));
    usePlayerStore.getState().setDownloadStatus(song.id, {
      progress: 0,
      status: "downloading",
      song,
    });

    try {
      await downloadSong(song);
      usePlayerStore.getState().setDownloadStatus(song.id, {
        progress: 100,
        status: "completed",
        song,
      });
      setOfflineIds((prev) => new Set(prev).add(song.id));
    } catch (error) {
      usePlayerStore.getState().setDownloadStatus(song.id, {
        progress: 0,
        status: "failed",
        error: "Download failed",
        song,
      });
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
    }
  };

  const handleClear = () => {
    setInputValue("");
    setQuery("");
    setResults([]);
    lastSearchedRef.current = "";
    lastSetParamQRef.current = "";
  };

  const renderStatus = (song: Song) => {
    const download = downloads[song.id];
    const isOffline = offlineIds.has(song.id);

    if (download?.status === "downloading" || downloadingIds.has(song.id)) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[7px] text-indigo-400 font-bold uppercase tracking-widest shrink-0">
            Syncing...
          </span>
        </div>
      );
    }

    if (download?.status === "syncing") {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[7px] text-purple-400 font-bold uppercase tracking-widest shrink-0">
            Vaulting...
          </span>
        </div>
      );
    }

    if (download?.status === "failed") {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span className="text-[7px] text-rose-500 font-bold uppercase tracking-widest shrink-0">
            Sync Failed
          </span>
        </div>
      );
    }

    if (isOffline) {
      return (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[7px] text-green-500 font-bold uppercase tracking-widest shrink-0">
            Available Offline
          </span>
        </div>
      );
    }

    if (song.source === "spotify") {
      return (
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm bg-green-500/20 border border-green-500/30">
          <span className="text-[7px] text-green-400 font-black uppercase tracking-widest shrink-0">
            SPOTIFY
          </span>
        </div>
      );
    }

    return null;
  };

  const handleGenreClick = (genreName: string) => {
    setInputValue(genreName);
    setQuery(genreName);
    lastSetParamQRef.current = genreName;
    setSearchParams({ q: genreName, autoplay: "true" }, { replace: true });
  };

  // Sync page load / external qParam changes to local/global states
  useEffect(() => {
    // If the change in qParam matches the last search param we locally set,
    // we return immediately to prevent the state feedback loops that overwrite typing deletions/updates.
    if (qParam === lastSetParamQRef.current) {
      return;
    }

    if (isOfflineMode) {
      setQuery("");
      setInputValue("");
      setResults([]);
      lastSearchedRef.current = "";
      lastSetParamQRef.current = "";
      return;
    }

    if (qParam) {
      setInputValue(qParam);
      setQuery(qParam);
      lastSetParamQRef.current = qParam;
    } else {
      setInputValue("");
      setQuery("");
      setResults([]);
      lastSearchedRef.current = "";
      lastSetParamQRef.current = "";
    }
  }, [qParam, isOfflineMode]);

  // Debounced search logic when the local input value updates (300ms)
  useEffect(() => {
    // 1. If the input is empty/blank, clear states immediately
    if (!inputValue.trim()) {
      if (query !== "") {
        setQuery("");
      }
      setResults([]);
      lastSearchedRef.current = "";
      lastSetParamQRef.current = "";
      if (searchParams.get("q")) {
        setSearchParams(isOfflineMode ? { offline: "true" } : {}, {
          replace: true,
        });
      }
      return;
    }

    // 2. Avoid double searching if matching
    if (inputValue === query) {
      return;
    }

    // 3. YouTube link detection bypasses standard debounce
    const ytRegex =
      /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    if (ytRegex.test(inputValue)) {
      setQuery(inputValue);
      lastSetParamQRef.current = inputValue;
      setSearchParams(
        isOfflineMode ? { q: inputValue, offline: "true" } : { q: inputValue },
        { replace: true },
      );
      return;
    }

    // 4. Block search fetch functions from execution if starting of a URL
    const isLikelyUrl = /^(https?:\/\/|www\.)/i.test(inputValue);
    if (isLikelyUrl) {
      return;
    }

    // 5. Setup the 300ms debounce timer for heavy filtering/fetching functions
    const timerId = setTimeout(() => {
      setQuery(inputValue);
      lastSetParamQRef.current = inputValue;
      if (!isOfflineMode) {
        setSearchParams({ q: inputValue }, { replace: true });
      } else {
        setSearchParams({ q: inputValue, offline: "true" }, { replace: true });
      }
    }, 300);

    return () => clearTimeout(timerId);
  }, [inputValue, isOfflineMode]);

  // Handles actual search fetching, with AbortController to discard older async requests
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    // 1. Rigorous validation and sanitization
    let sanitizedQuery = query.replace(/<[^>]*>?/gm, ""); // strip out HTML tags
    sanitizedQuery = sanitizedQuery.replace(/[<>{}\[\]=]/g, ""); // strip unsafe punctuation
    sanitizedQuery = sanitizedQuery.trim();

    if (sanitizedQuery.length > 100) {
      sanitizedQuery = sanitizedQuery.substring(0, 100);
    }

    if (!sanitizedQuery) {
      setResults([]);
      setLoading(false);
      lastSearchedRef.current = "";
      setShowingSimilar(false);
      setSimilarQuery("");
      return;
    }

    const fetchSearch = async () => {
      const ytRegex =
        /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11,})/;
      if (ytRegex.test(sanitizedQuery)) {
        const match = sanitizedQuery.match(ytRegex);
        const videoId = match ? match[1] : null;

        if (videoId && active) {
          const urlSong: Song = {
            id: videoId,
            title: "YouTube Link Track",
            artist: "Loaded from URL",
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            source: "youtube",
            sourceId: videoId,
            duration: 180,
          };
          setSong(urlSong, [urlSong]);
          setResults([urlSong]);
          lastSearchedRef.current = sanitizedQuery;
          setLoading(false);
          setShowingSimilar(false);
          setSimilarQuery("");
        }
        return;
      }

      // Block standard keyword search if starting of a URL
      const isLikelyUrl = /^(https?:\/\/|www\.)/i.test(sanitizedQuery);
      if (isLikelyUrl) {
        return;
      }

      setLoading(true);
      try {
        let ytResults: Song[] = [];
        let spotifyResults: Song[] = [];

        if (activeFilter === "Spotify") {
          const spotifyResponse = await axios.get("/api/spotify/search", {
            params: { q: sanitizedQuery },
            signal: controller.signal,
          });
          if (spotifyResponse.data?.items) {
            spotifyResults = spotifyResponse.data.items.map((item: any) => ({
              id: `spotify-${item.id || Math.random().toString(36).slice(2, 11)}`,
              title: item.title,
              artist: item.artist,
              thumbnail: item.albumArt,
              source: "spotify" as const,
              sourceId: item.id || "",
              duration: item.duration_ms ? item.duration_ms / 1000 : 180,
            }));
          }
        } else {
          const ytResponse = await axios.get("/api/search", {
            params: { q: sanitizedQuery },
            signal: controller.signal,
          });
          if (Array.isArray(ytResponse.data) && ytResponse.data.length > 0) {
            ytResults = ytResponse.data;
          }
        }

        const merged: Song[] = activeFilter === "Spotify" ? spotifyResults : ytResults;

        if (active) {
          if (merged.length > 0) {
            setResults(merged);
            setShowingSimilar(false);
            setSimilarQuery("");
            addToRecentSearches(sanitizedQuery);
            const autoplay = searchParams.get("autoplay") === "true";
            if (autoplay) {
              const queueToLoad =
                queueAfterSearch === "All songs" ? merged : [merged[0]];
              setSong(merged[0], queueToLoad);
              setSearchParams(
                (params) => {
                  params.delete("autoplay");
                  return params;
                },
                { replace: true },
              );
            }
          } else {
            // No results! Implement secondary YouTube search or Levenshtein client-side distance matching
            console.log(
              "No exact matches found for:",
              sanitizedQuery,
              ". Activating fuzzy/split fallback search...",
            );

            let corrected = "";
            let minDistance = 999;
            const words = sanitizedQuery.toLowerCase().trim().split(/\s+/);

            const allTargets = Array.from(
              new Set([
                ...POPULAR_SEARCH_TARGETS,
                ...recentSearches.map((s) => s.toLowerCase()),
                ...offlineCatalog.map((s) => s.title.toLowerCase()),
                ...offlineCatalog.map((s) => s.artist.toLowerCase()),
              ]),
            );

            for (const word of words) {
              if (word.length < 3) continue;
              for (const target of allTargets) {
                const targetWords = target.split(/\s+/);
                for (const tWord of targetWords) {
                  if (tWord.length < 3) continue;
                  const dist = getLevenshteinDistance(word, tWord);
                  if (dist < minDistance && dist <= 2) {
                    minDistance = dist;
                    corrected = sanitizedQuery
                      .toLowerCase()
                      .replace(word, target);
                  }
                }
              }
            }

            let fallbackQuery = corrected || words.join(" ");

            if (!corrected && words.length > 1) {
              const cleanWords = words
                .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
                .filter(Boolean);
              if (cleanWords.length > 0) {
                fallbackQuery = cleanWords.join(" ");
              }
            }

            if (
              fallbackQuery &&
              fallbackQuery.trim().toLowerCase() !==
                sanitizedQuery.toLowerCase().trim()
            ) {
              console.log(
                "Triggering secondary fuzzy search for corrected/split term:",
                fallbackQuery,
              );
              try {
                const secondaryResponse = await axios.get("/api/search", {
                  params: { q: fallbackQuery },
                  signal: controller.signal,
                });
                if (active) {
                  if (
                    Array.isArray(secondaryResponse.data) &&
                    secondaryResponse.data.length > 0
                  ) {
                    setResults(secondaryResponse.data);
                    setShowingSimilar(true);
                    setSimilarQuery(fallbackQuery);
                    return;
                  }
                }
              } catch (secErr) {
                console.error("Secondary search fallback failed:", secErr);
              }
            }

            // Word-level split fallback
            if (active && words.length > 0) {
              const longestWord = words.reduce(
                (prev, curr) => (curr.length > prev.length ? curr : prev),
                "",
              );
              if (
                longestWord &&
                longestWord.length >= 3 &&
                longestWord !== sanitizedQuery.trim().toLowerCase()
              ) {
                console.log(
                  "Triggering longest word fallback search:",
                  longestWord,
                );
                try {
                  const wordResponse = await axios.get("/api/search", {
                    params: { q: longestWord },
                    signal: controller.signal,
                  });
                  if (
                    active &&
                    Array.isArray(wordResponse.data) &&
                    wordResponse.data.length > 0
                  ) {
                    setResults(wordResponse.data);
                    setShowingSimilar(true);
                    setSimilarQuery(longestWord);
                    return;
                  }
                } catch (wordErr) {
                  console.error("Word fallback search failed:", wordErr);
                }
              }
            }

            // Ultimate fallback to high-utility evergreen trending content so the user is never left hanging
            if (active) {
              setResults([
                {
                  id: "dQw4w9WgXcQ",
                  title: "Never Gonna Give You Up",
                  artist: "Rick Astley",
                  thumbnail:
                    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
                  source: "youtube",
                  sourceId: "dQw4w9WgXcQ",
                  duration: 215,
                  description: "Fuzzy matching backup stream.",
                },
                {
                  id: "L_LUpnjgPso",
                  title: "Bohemian Rhapsody",
                  artist: "Queen",
                  thumbnail:
                    "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop",
                  source: "youtube",
                  sourceId: "L_LUpnjgPso",
                  duration: 355,
                  description: "Fuzzy matching backup stream.",
                },
                {
                  id: "hT_nvWreIhg",
                  title: "Counting Stars",
                  artist: "OneRepublic",
                  thumbnail:
                    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
                  source: "youtube",
                  sourceId: "hT_nvWreIhg",
                  duration: 257,
                  description: "Fuzzy matching backup stream.",
                },
              ]);
              setShowingSimilar(true);
              setSimilarQuery("Popular Stream Classics");
            }
          }
        }
      } catch (err: any) {
        if (axios.isCancel(err)) {
          console.log(
            "Search request cancelled/aborted for query:",
            sanitizedQuery,
          );
          return;
        }
        console.error(
          "Search failed, using ultimate high-utility classics fallback:",
          err,
        );
        if (active) {
          setResults([
            {
              id: "dQw4w9WgXcQ",
              title: "Never Gonna Give You Up",
              artist: "Rick Astley",
              thumbnail:
                "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
              source: "youtube",
              sourceId: "dQw4w9WgXcQ",
              duration: 215,
              description: "Primary search error recovery stream.",
            },
          ]);
          setShowingSimilar(true);
          setSimilarQuery("System Backup tracks");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchSearch();

    return () => {
      active = false;
      controller.abort();
    };
  }, [query, isOfflineMode, activeFilter]);

  return (
    <div className="space-y-12">
      <AnimatePresence>
        {selectedSong && (
          <AddToPlaylistModal
            song={selectedSong}
            onClose={() => setSelectedSong(null)}
          />
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black italic tracking-tighter text-gradient leading-tight">
            SEARCH CATALOG
          </h1>
          <p className="text-white/40 text-sm font-medium uppercase tracking-widest mt-2 animate-pulse">
            {isOfflineMode
              ? "⚡ OFFLINE VAULT ENGINE ACTIVATED"
              : "Discover 100M+ cloud livestream tracks across the web"}
          </p>
        </div>

        {/* Engine switcher tabs */}
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/10 shrink-0">
          <button
            onClick={() => {
              setSearchParams({ q: query }, { replace: true });
            }}
            className={cn(
              "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
              !isOfflineMode
                ? "bg-white text-black font-black shadow-lg"
                : "text-zinc-500 hover:text-white",
            )}
          >
            LIVE WEB RESULTS
          </button>
          <button
            onClick={() => {
              const currentQ = searchParams.get("q") || query;
              setSearchParams(
                { q: currentQ, offline: "true" },
                { replace: true },
              );
            }}
            className={cn(
              "px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
              isOfflineMode
                ? "bg-purple-600 text-white font-black shadow-lg shadow-purple-600/30"
                : "text-zinc-500 hover:text-white",
            )}
          >
            OFFLINE VAULT
          </button>
        </div>
      </header>

      {/* OFFLINE SEARCH ENGINE CARD */}
      {isOfflineMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-gradient-to-br from-purple-950/20 to-zinc-950 rounded-3xl border border-purple-500/20 shadow-xl space-y-3"
          id="offline-engine-banner"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
            </span>
            <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">
              Offline Vault Engine Activated
            </p>
          </div>
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tight">
            Filtering Saved Tracks matching "{activeSearchQuery || "All Saved"}"
          </h2>
          <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
            Typing in the top navigation search bar filters only your device's
            cached files. Want to explore online music instead? Use the central
            live search input below!
          </p>
        </motion.div>
      )}

      <div className="relative max-w-2xl group">
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
          <SearchIcon
            className={cn(
              "transition-colors",
              isOfflineMode
                ? "text-white/10"
                : "text-white/25 group-focus-within:text-purple-500",
            )}
            size={20}
          />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            const nextVal = e.target.value;
            setInputValue(nextVal);
          }}
          placeholder="Search songs, artists, or albums..."
          className="w-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-full py-5 pl-16 pr-20 text-xl font-bold focus:outline-none focus:border-dashed focus:border-purple-500/50 focus:bg-white/[0.07] transition-all outline-none shadow-2xl placeholder:text-white/20"
        />
        <div className="absolute inset-y-0 right-6 flex items-center">
          {inputValue && (
            <button
              onClick={handleClear}
              className="text-white/20 hover:text-white transition-colors"
              title="Clear Search"
            >
              <X size={24} />
            </button>
          )}
        </div>
      </div>

      {/* HORIZONTAL SCROLLABLE ROW OF FILTER TAGS */}
      <div
        className="flex items-center overflow-x-auto whitespace-nowrap gap-2 py-1.5 max-w-2xl scrollbar-none [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        id="search-filter-tags-container"
      >
        {[
          "All",
          "Spotify",
          "Songs",
          "Videos",
          "Recently uploaded",
        ].map((tag) => {
          const isActive = tag === activeFilter;
          return (
            <button
              key={tag}
              id={`filter-tag-${tag.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setActiveFilter(tag)}
              className={cn(
                "px-4 py-1.5 text-xs font-semibold rounded-lg transition-all inline-block whitespace-nowrap cursor-pointer select-none",
                isActive
                  ? "bg-white text-black font-bold shadow-md"
                  : "bg-[#212121] hover:bg-[#303030] text-white",
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {showingSimilar && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-bold text-purple-400 mt-2 flex items-center gap-2"
        >
          <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
          <span>
            Showing results for similar searches:{" "}
            <span className="italic text-white">"{similarQuery}"</span>
          </span>
        </motion.div>
      )}

      {!inputValue && recentSearches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              Recent Searches
            </h2>
            <button
              onClick={() => {
                setRecentSearches([]);
                localStorage.removeItem("recent_searches");
              }}
              className="text-[10px] font-bold text-rose-500/50 hover:text-rose-500 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, i) => (
              <button
                key={i}
                onClick={() => handleGenreClick(search)}
                className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 hover:border-white/10 transition-all"
              >
                {search}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {!isOfflineMode && !inputValue ? (
        <section className="space-y-12 mt-12">
          <div>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black italic tracking-tighter border-l-4 border-purple-500 pl-4 uppercase">
                BROWSE GENRES
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {[
                { name: "Pop", color: "from-pink-500 to-purple-600" },
                { name: "Rock", color: "from-orange-500 to-red-600" },
                { name: "Hip-Hop", color: "from-blue-500 to-indigo-600" },
                { name: "Electronic", color: "from-emerald-500 to-teal-600" },
                { name: "Jazz", color: "from-amber-500 to-orange-600" },
                { name: "Classical", color: "from-zinc-500 to-slate-600" },
              ].map((genre) => (
                <motion.div
                  key={genre.name}
                  whileHover={{ scale: 1.05, rotate: -2 }}
                  onClick={() => handleGenreClick(genre.name)}
                  className={cn(
                    "aspect-square bg-gradient-to-br rounded-3xl p-6 cursor-pointer relative overflow-hidden group shadow-xl",
                    genre.color,
                  )}
                >
                  <span className="text-2xl font-black italic text-white tracking-tighter leading-tight drop-shadow-md z-10 relative">
                    {genre.name}
                  </span>
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-black/20 rounded-full blur-2xl group-hover:bg-white/10 transition-all" />
                  <Music
                    size={120}
                    className="absolute -bottom-10 -right-10 opacity-10 group-hover:rotate-12 transition-transform"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-1">
          <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
            <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isOfflineMode
                    ? "bg-purple-500 animate-pulse"
                    : "bg-red-500 animate-pulse",
                )}
              />
              {loading
                ? "Searching Global Catalogs..."
                : isOfflineMode
                  ? "Local Offline Results"
                  : "Live Streaming results"}
            </h2>
            {loading && (
              <Loader2 size={16} className="animate-spin text-purple-500" />
            )}
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredResults.length > 0
                ? filteredResults.map((song, index) => {
                    const isActive = currentSong?.id === song.id;
                    return (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.03 }}
                        whileHover={{
                          y: -4,
                          scale: 1.01,
                          boxShadow:
                            "0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.4)",
                        }}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 p-4 rounded-2xl transition-all group cursor-pointer border",
                          isActive
                            ? "bg-white/10 border-white/10"
                            : "bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10",
                        )}
                        onClick={() => {
                          if (isActive) {
                            togglePlay();
                          } else {
                            const queueToLoad =
                              queueAfterSearch === "All songs"
                                ? filteredResults
                                : [song];
                            setSong(song, queueToLoad);
                            setWatchedIds((prev) => {
                              const next = new Set(prev);
                              next.add(song.id);
                              localStorage.setItem(
                                "watched_song_ids",
                                JSON.stringify(Array.from(next)),
                              );
                              return next;
                            });
                          }
                        }}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden relative shadow-lg shrink-0 bg-zinc-800">
                            <img
                              src={song.thumbnail || undefined}
                              alt={song.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div
                              className={cn(
                                "absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity",
                                isActive
                                  ? "opacity-100"
                                  : "opacity-100 block",
                              )}
                            >
                              {isActive && isPlaying ? (
                                <div className="flex items-end gap-0.5 h-3">
                                  <motion.div
                                    animate={{ height: [4, 12, 6, 10, 4] }}
                                    transition={{
                                      repeat: Infinity,
                                      duration: 0.8,
                                    }}
                                    className="w-0.5 bg-white"
                                  />
                                  <motion.div
                                    animate={{ height: [8, 4, 10, 6, 8] }}
                                    transition={{
                                      repeat: Infinity,
                                      duration: 0.8,
                                      delay: 0.2,
                                    }}
                                    className="w-0.5 bg-white"
                                  />
                                  <motion.div
                                    animate={{ height: [6, 10, 4, 12, 6] }}
                                    transition={{
                                      repeat: Infinity,
                                      duration: 0.8,
                                      delay: 0.4,
                                    }}
                                    className="w-0.5 bg-white"
                                  />
                                </div>
                              ) : (
                                <Play
                                  size={16}
                                  fill="white"
                                  className="text-white"
                                />
                              )}
                            </div>
                          </div>
                          <div className="flex-grow flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-2 w-full min-w-0">
                              <h3
                                className={cn(
                                  "font-bold text-sm tracking-tight truncate flex-1 min-w-0",
                                  isActive && "text-purple-400",
                                )}
                                dangerouslySetInnerHTML={{ __html: song.title }}
                              />
                               {isActive && (
                                <div className="flex items-center justify-center shrink-0 w-4 h-4 bg-purple-500/20 rounded-full">
                                  {isPlaying ? (
                                     <div className="flex items-end gap-0.5 h-2">
                                        <motion.div animate={{ height: [2, 6, 3, 5, 2] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-0.5 bg-purple-400" />
                                        <motion.div animate={{ height: [4, 2, 5, 3, 4] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-0.5 bg-purple-400" />
                                        <motion.div animate={{ height: [3, 5, 2, 6, 3] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-0.5 bg-purple-400" />
                                     </div>
                                  ) : (
                                     <Play size={8} className="text-purple-400 ml-0.5" fill="currentColor" />
                                  )}
                                </div>
                               )}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate">
                                  {song.artist}
                                </p>
                                {renderStatus(song)}
                              </div>
                              {song.album && (
                                <p className="text-[10px] text-zinc-650 truncate mt-0.5">
                                  <span className="font-bold text-zinc-700">
                                    ALBUM:
                                  </span>{" "}
                                  {song.album}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-3 ml-auto">
                          <div
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider hidden md:block",
                              song.source === "youtube"
                                ? "bg-[#FF0000] text-white"
                                : song.source === "spotify"
                                  ? "bg-[#1DB954] text-white"
                                  : "bg-white/5 text-white/20",
                            )}
                          >
                            {song.source}
                          </div>

                          <span className="text-[10px] text-zinc-600 font-mono shrink-0 w-10 text-right pr-2">
                            {formatSearchResultDuration(song.duration)}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                !offlineIds.has(song.id) &&
                                !downloadingIds.has(song.id)
                              )
                                handleDownload(song);
                            }}
                            className={cn(
                              "transition-all flex items-center justify-center hidden md:flex",
                              offlineIds.has(song.id)
                                ? "text-indigo-400"
                                : "text-white/40 hover:text-white",
                            )}
                            disabled={
                              offlineIds.has(song.id) ||
                              downloadingIds.has(song.id)
                            }
                            title={
                              offlineIds.has(song.id)
                                ? "Downloaded"
                                : "Add to Offline"
                            }
                          >
                            {downloadingIds.has(song.id) ? (
                              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full" />
                            ) : offlineIds.has(song.id) ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <Download size={16} />
                            )}
                          </button>

                          <LikeButton
                            targetId={song.id}
                            type="song"
                            size={16}
                            className="transition-all hidden md:flex"
                          />

                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(
                                  activeMenuId === song.id ? null : song.id,
                                );
                              }}
                              className="text-white/40 hover:text-white transition-all"
                              title="More options"
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            <AnimatePresence>
                              {activeMenuId === song.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => setActiveMenuId(null)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    className="absolute right-0 bottom-full mb-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30"
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSong(song);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                      <ListPlus size={14} />
                                      Add to Playlist
                                    </button>
                                    <Link
                                      to={`/song/${song.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all border-t border-white/5"
                                    >
                                      <Info size={14} />
                                      View Track Insights
                                    </Link>
                                    {!offlineIds.has(song.id) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownload(song);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all border-t border-white/5"
                                      >
                                        <Download size={14} />
                                        Add to Offline
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all border-t border-white/5"
                                    >
                                      <User size={14} />
                                      View Artist
                                    </button>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                : !loading && (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem] p-8 max-w-lg mx-auto">
                      {isOfflineMode && activeSearchQuery.trim() !== "" ? (
                        <div className="space-y-6">
                          <div className="flex justify-center">
                            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400">
                              <SearchIcon
                                size={22}
                                className="opacity-80 animate-pulse"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-white font-bold text-lg tracking-tight">
                              Song not found in your offline vault
                            </p>
                            <p className="text-zinc-500 text-xs leading-relaxed max-w-sm mx-auto">
                              We couldn't locate "{activeSearchQuery}" within
                              your local storage cache.
                            </p>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setInputValue(activeSearchQuery);
                              setQuery(activeSearchQuery);
                              lastSetParamQRef.current = activeSearchQuery;
                              setSearchParams(
                                { q: activeSearchQuery },
                                { replace: true },
                              );
                            }}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-widest rounded-full transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2 mx-auto"
                          >
                            <SearchIcon size={12} />
                            Search Online instead
                          </motion.button>
                        </div>
                      ) : (
                        <>
                          <p className="text-zinc-500 font-bold italic uppercase tracking-wider text-sm">
                            {isOfflineMode
                              ? "No Saved tracks found in your offline vault"
                              : "No streaming results found."}
                          </p>
                          {isOfflineMode && (
                            <p className="text-[10px] text-zinc-650 font-sans uppercase font-medium tracking-widest mt-3 max-w-md mx-auto leading-relaxed">
                              Type in the central search bar above to query and
                              fetch 100M+ tracks from the online catalog, then
                              click download to save them offline.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
}
