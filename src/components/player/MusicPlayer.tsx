import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Repeat,
  Shuffle,
  Mic2,
  ListMusic,
  LayoutList,
  Music,
  X,
  SlidersHorizontal,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  GripVertical,
  Waves,
  RotateCcw,
  RotateCw,
  Minus,
  Maximize2,
  Settings,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Italic,
  Type,
  Monitor,
  Check,
  Plus,
  Layers,
  Search,
  HardDrive,
  RefreshCw,
} from "lucide-react";
import {
  usePlayerStore,
  Song,
  LyricLine,
  extractYoutubeVideoIdFromString,
} from "../../store/usePlayerStore";
import {
  motion,
  AnimatePresence,
  Reorder,
  useDragControls,
  useMotionValue,
  animate,
} from "motion/react";
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import { LyricsEditor } from "./LyricsEditor";
import { useLocation } from "react-router-dom";
import { LikeButton } from "../LikeButton";
import { ArtistDetails } from "../ArtistDetails";
import { EqualizerControls } from "./EqualizerControls";
import { scanDeviceDirectory } from "../../services/localDeviceScanner";
import bgImage1 from "../../assets/images/mood_background_1_1781293598236.jpg";
import bgImage2 from "../../assets/images/mood_background_2_1781293613405.jpg";
import bgImage3 from "../../assets/images/mood_background_3_1781293625913.jpg";
import bgImage4 from "../../assets/images/mood_background_4_1781293637906.jpg";
import { searchSpotifyTrack } from "../../services/spotifyService";
import axios from "axios";

function FadingAudio({
  src,
  volume,
  startTime,
  playing,
}: {
  src?: string;
  volume: number;
  startTime: number;
  playing: boolean;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  useEffect(() => {
    let mounted = true;
    const currentAudio = ref.current;
    if (!currentAudio) return;

    if (src && playing) {
      if (startTime > 0 && currentAudio.currentTime === 0) {
        currentAudio.currentTime = startTime;
      }

      const playPromise = currentAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          if (!mounted) return;
          // Ignore interruption errors
          if (error.name !== "AbortError" && error.name !== "NotAllowedError") {
            console.warn("FadingAudio playback failed:", error);
          }
        });
      }
    } else {
      if (!currentAudio.paused) {
        currentAudio.pause();
      }
    }

    return () => {
      mounted = false;
    };
  }, [src, playing]);

  // Handle actual unmount
  useEffect(() => {
    const currentAudio = ref.current;
    return () => {
      if (currentAudio) {
        try {
          currentAudio.pause();
          currentAudio.src = "";
          currentAudio.load();
        } catch (e) {}
      }
    };
  }, []);

  return <audio ref={ref} src={src} crossOrigin="anonymous" />;
}

const MarqueeTitle = ({ text, className, widthClass }: { text: string; className?: string; widthClass?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div 
      ref={containerRef} 
      className={`overflow-hidden whitespace-nowrap relative group ${widthClass || 'w-full'}`}
    >
      <div 
        className={`inline-flex items-center ${isOverflowing ? 'animate-marquee-scroll' : ''}`}
      >
        <span ref={textRef} className={`inline-block ${isOverflowing ? 'pr-12' : ''} ${className || ''}`}>{text}</span>
        {isOverflowing && (
          <span className={`inline-block pr-12 ${className || ''}`}>{text}</span>
        )}
      </div>
    </div>
  );
};

const decodeHtmlEntities = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'");
};

const MOBILE_BANDS = [
  { freq: 60, label: "Bass" },
  { freq: 230, label: "Low-Mid" },
  { freq: 910, label: "Mid" },
  { freq: 4000, label: "High-Mid" },
  { freq: 14000, label: "Treble" },
];

function transformLyricsText(text: string, style: string): string {
  if (!style || style === "normal") return text;

  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);

      if (style === "bold_fraktur") {
        if (code >= 65 && code <= 90) {
          // A-Z
          return String.fromCodePoint(code - 65 + 0x1d5d4);
        }
        if (code >= 97 && code <= 122) {
          // a-z
          return String.fromCodePoint(code - 97 + 0x1d5ee);
        }
      } else if (style === "bold_script") {
        if (code >= 65 && code <= 90) {
          // A-Z
          return String.fromCodePoint(code - 65 + 0x1d4d0);
        }
        if (code >= 97 && code <= 122) {
          // a-z
          return String.fromCodePoint(code - 97 + 0x1d4ea);
        }
      } else if (style === "zalgo") {
        if (char.trim() === "") return char;
        const combineChars = ["\u0337", "\u0338", "\u0335", "\u0336", "\u0334"];
        const combineUpper = [
          "\u030d",
          "\u0304",
          "\u0305",
          "\u030a",
          "\u0301",
          "\u0303",
        ];
        const combineLower = [
          "\u0316",
          "\u0317",
          "\u031e",
          "\u031f",
          "\u0323",
          "\u0324",
        ];
        return (
          char +
          combineChars[code % combineChars.length] +
          combineUpper[(code + 1) % combineUpper.length] +
          combineLower[(code + 2) % combineLower.length]
        );
      } else if (style === "fullwidth") {
        if (code === 32) return "\u3000"; // Fullwidth space
        if (code >= 33 && code <= 126) {
          return String.fromCharCode(code + 65248);
        }
      }
      return char;
    })
    .join("");
}

export function MusicPlayer({
  isSidebar = false,
}: { isSidebar?: boolean } = {}) {
  const {
    currentSong,
    isPlaying,
    volume,
    togglePlay,
    next,
    previous,
    setVolume,
    equalizerSettings,
    setEqualizerBand,
    lowDataMode,
    duration,
    setProgress,
    currentIndex,
    queue,
    shuffleMode,
    isShuffle,
    repeatMode,
    setShuffleMode,
    setIsShuffle,
    setRepeatMode,
    removeFromQueue,
    reorderQueue,
    setQueue,
    setSong,
    lastSeekTime,
    autoFetchLyrics,
    shuffleQueue,
    crossfadeEnabled,
    crossfadeDuration,
    setCrossfadeEnabled,
    setCrossfadeDuration,
    normalizationEnabled,
    setNormalizationEnabled,
    playerLayoutMode,
    youtubeMinimized,
    setYoutubeMinimized,
    forwardBackward,
    fastForwardTime,
    seekTo,
    autoRotate,
    accentColor,
    updateSongMetadata,
    isMobileSidebarOpen,
  } = usePlayerStore();

  const showForwardBackward = forwardBackward;

  const location = useLocation();
  const isSongDetailPage = location.pathname.startsWith("/song/");
  const isSettingsPage = location.pathname === "/settings";

  const jumpBackward = () => {
    const jumpSecs = parseInt(fastForwardTime) || 15;
    const newTime = Math.max(0, currentTime - jumpSecs);
    seekTo(newTime);
  };

  const jumpForward = () => {
    const jumpSecs = parseInt(fastForwardTime) || 15;
    const newTime = Math.min(duration || 9999, currentTime + jumpSecs);
    seekTo(newTime);
  };

  // Synchronize a throttledTime state precisely once every 100ms to decouple from high-frequency store updates
  const [throttledTime, setThrottledTime] = useState(
    () => usePlayerStore.getState().currentTime,
  );

  useEffect(() => {
    setThrottledTime(usePlayerStore.getState().currentTime);
  }, [currentSong?.id, isPlaying]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setThrottledTime(usePlayerStore.getState().currentTime);
      }, 100);
    } else {
      setThrottledTime(usePlayerStore.getState().currentTime);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying]);

  const currentTime = throttledTime;

  const hasNext = currentIndex < queue.length - 1;
  const hasPrev = currentIndex > 0;

  const [showLyrics, setShowLyrics] = useState(false);
  const [isMobilePlayerHidden, setIsMobilePlayerHidden] = useState(false);

  // Swipe gesture tracking for the mobile player bar
  const barTouchStartYRef = useRef<number | null>(null);
  const barTouchCurrentYRef = useRef<number | null>(null);

  const handleMobileBarTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") || 
      target.closest("input") || 
      (target.closest(".relative.w-full.h-2.flex.items-center.group") && !isMobilePlayerHidden)
    ) {
      return;
    }
    
    if (e.touches.length === 1) {
      barTouchStartYRef.current = e.touches[0].clientY;
      barTouchCurrentYRef.current = e.touches[0].clientY;
    }
  };

  const handleMobileBarTouchMove = (e: React.TouchEvent) => {
    if (barTouchStartYRef.current !== null && e.touches.length === 1) {
      barTouchCurrentYRef.current = e.touches[0].clientY;
    }
  };

  const handleMobileBarTouchEnd = () => {
    if (barTouchStartYRef.current !== null && barTouchCurrentYRef.current !== null) {
      const deltaY = barTouchCurrentYRef.current - barTouchStartYRef.current;
      const swipeDistance = 30;
      
      if (deltaY < -swipeDistance) {
        setIsMobilePlayerHidden(false);
      } else if (deltaY > swipeDistance) {
        setIsMobilePlayerHidden(true);
      }
    }
    barTouchStartYRef.current = null;
    barTouchCurrentYRef.current = null;
  };

  // Auto-reveal the mobile player heavily on new tracks
  useEffect(() => {
     setIsMobilePlayerHidden(false);
  }, [currentSong?.id]);

  const [isLyricsMaximized, setIsLyricsMaximized] = useState(false);
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const [showEQ, setShowEQ] = useState(false);
  const [showDesktopCrossfade, setShowDesktopCrossfade] = useState(false);
  const [isLyricsSettingsOpen, setIsLyricsSettingsOpen] = useState(false);
  const [isScanningDevice, setIsScanningDevice] = useState(false);
  const [scanningProgress, setScanningProgress] = useState({
    current: 0,
    total: 0,
  });
  const [lyricsSearchQuery, setLyricsSearchQuery] = useState("");
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);

  const matchedLyricsIndices = useMemo(() => {
    if (!lyricsSearchQuery.trim() || !currentSong?.lyrics) return [];
    const query = lyricsSearchQuery.toLowerCase();
    return currentSong.lyrics
      .map((line, index) =>
        line.text.toLowerCase().includes(query) ? index : -1,
      )
      .filter((index) => index !== -1);
  }, [lyricsSearchQuery, currentSong?.lyrics]);

  useEffect(() => {
    setLyricsSearchQuery("");
    setActiveSearchMatchIndex(0);
  }, [currentSong?.id]);
  const [showDesktopNormalization, setShowDesktopNormalization] =
    useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showArtistInfo, setShowArtistInfo] = useState(false);
  const [nowPlayingTab, setNowPlayingTab] = useState<"playing" | "queue">(
    "playing",
  );
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [showMobileAudioSettings, setShowMobileAudioSettings] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showPlayer, setShowPlayer] = useState(true);

  // Guarantee that when the application first loads or refreshes, the YouTube player window initializes in its floating state
  useEffect(() => {
    if (!isSidebar) {
      setYoutubeMinimized(false);
    }
  }, [isSidebar]);

  const fullScreenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (!showDesktopCrossfade && !showDesktopNormalization) return;

      const target = e.target as HTMLElement;
      // If the user clicks inside any menu or trigger button, don't close it
      if (
        target.closest(".desktop-settings-menu") ||
        target.closest(".desktop-settings-trigger")
      ) {
        return;
      }

      setShowDesktopCrossfade(false);
      setShowDesktopNormalization(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showDesktopCrossfade, showDesktopNormalization]);

  const [fallbackAudioUrl, setFallbackAudioUrl] = useState<string | null>(null);
  const [isFetchingFallback, setIsFetchingFallback] = useState<boolean>(false);

  const isOfflineTrack = !!(
    currentSong &&
    (currentSong.source === "local" ||
      currentSong.localUrl ||
      currentSong.id.startsWith("local-"))
  );
  const isYTSource =
    (currentSong?.source === "youtube" ||
      currentSong?.source === "cloud" ||
      currentSong?.source === "spotify") &&
    !isOfflineTrack && !fallbackAudioUrl;
  const [iframeStartVal, setIframeStartVal] = useState(0);

  useEffect(() => {
    if (isFullScreen) {
      setIframeStartVal(Math.floor(usePlayerStore.getState().currentTime));
    }
  }, [isPlaying, lastSeekTime, isFullScreen, currentSong?.id]);

  const [hasFetchedRelated, setHasFetchedRelated] = useState(false);

  useEffect(() => {
    setHasFetchedRelated(false);
  }, [currentSong?.id]);

  useEffect(() => {
    if (isFullScreen && isYTSource && !hasFetchedRelated && currentSong) {
      setHasFetchedRelated(true);
      const videoId = currentSong.sourceId || currentSong.id;
      
      const fetchRelated = async () => {
        try {
          const res = await axios.get(`/api/related?videoId=${videoId}`);
          const data = res.data;
          
          if (data && data.length > 0) {
            const currentQueue = usePlayerStore.getState().queue;
            const currentLocIdx = currentQueue.findIndex(s => s.id === currentSong.id);
            
            if (currentLocIdx !== -1) {
              const existingIds = new Set(currentQueue.map(s => s.id));
              const newItems = data
                .filter((item: any) => !existingIds.has(item.id))
                .map((item: any) => ({
                  ...item,
                  id: `related-${Math.random().toString(36).substr(2, 9)}`,
                }));
              
              if (newItems.length > 0) {
                const newQueue = [...currentQueue];
                newQueue.splice(currentLocIdx + 1, 0, ...newItems);
                setQueue(newQueue);
              }
            }
          }
        } catch (err: any) {
          console.warn("Couldn't retrieve related tracks:", err.message || err);
        }
      };
      
      fetchRelated();
    }
  }, [isFullScreen, isYTSource, currentSong, hasFetchedRelated, setQueue]);

  const toggleFullScreen = () => {
    setIsFullScreen((prev) => !prev);
  };

  const handleScanDevice = async () => {
    try {
      if (!("showDirectoryPicker" in window)) {
        alert(
          "Folder sync requires a modern browser with File System Access API support.",
        );
        return;
      }
      setIsScanningDevice(true);
      setScanningProgress({ current: 0, total: 0 });

      const newSongs = await scanDeviceDirectory((current, total) => {
        setScanningProgress({ current, total: total || current });
      });

      setIsScanningDevice(false);

      if (newSongs.length > 0) {
        usePlayerStore.getState().setSong(newSongs[0], newSongs);
      }
    } catch (err: any) {
      if (
        !err.message?.includes("SECURITY RESTRICTION") &&
        err.name !== "AbortError"
      ) {
        console.error(err);
      } else {
        alert(err.message);
      }
      setIsScanningDevice(false);
    }
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const filtersRef = useRef<Record<number, BiquadFilterNode>>({});
  const normalizationGainNodeRef = useRef<GainNode | null>(null);

  const [fadingOutSong, setFadingOutSong] = useState<Song | null>(null);
  const [fadeOutVolume, setFadeOutVolume] = useState(1);
  const [fadeInVolume, setFadeInVolume] = useState(1);
  const [fadeStartTime, setFadeStartTime] = useState(0);
  const lastSongRef = useRef<Song | null>(null);
  const crossfadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isMobileScreen, setIsMobileScreen] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Global Keyboard Shortcuts
  const prevVolumeRef = useRef<number>(0.7);
  useEffect(() => {
    if (isSidebar) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering when user is interacting with text inputs
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInteractiveInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        target.getAttribute("contenteditable") === "true";

      if (isInteractiveInput) {
        return;
      }

      switch (e.key) {
        case "Escape": {
          if (isFullScreen) {
            e.preventDefault();
            setIsFullScreen(false);
          }
          break;
        }
        case " ": {
          e.preventDefault();
          togglePlay();
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (hasNext || repeatMode === "all") {
            next();
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (hasPrev) {
            previous();
          }
          break;
        }
        case "m":
        case "M": {
          e.preventDefault();
          if (volume > 0) {
            prevVolumeRef.current = volume;
            setVolume(0);
          } else {
            setVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.7);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    volume,
    setVolume,
    togglePlay,
    next,
    previous,
    hasNext,
    hasPrev,
    repeatMode,
    isSidebar,
    isFullScreen,
    setIsFullScreen,
  ]);

  const [slideX, setSlideX] = useState<string>("0%");
  const [slideTransition, setSlideTransition] = useState<string>("none");

  const performSwipeTransition = async (direction: "next" | "prev") => {
    setSlideTransition("transform 0.3s ease-out");
    setSlideX(direction === "next" ? "-100%" : "100%");

    await new Promise((resolve) => setTimeout(resolve, 300));

    if (direction === "next") {
      if (hasNext || repeatMode === "all") {
        next();
      }
    } else {
      if (hasPrev) {
        previous();
      }
    }

    setSlideTransition("none");
    setSlideX(direction === "next" ? "100%" : "-100%");

    setTimeout(() => {
      setSlideTransition("transform 0.3s ease-out");
      setSlideX("0%");
    }, 50);
  };

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("a") ||
        target.closest("[role='button']")
      ) {
        return;
      }
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null)
      return;

    if (e.changedTouches.length === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartXRef.current;
      const deltaY = touchEndY - touchStartYRef.current;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX < 0) {
          if (hasNext || repeatMode === "all") {
            performSwipeTransition("next");
          }
        } else {
          if (hasPrev) {
            performSwipeTransition("prev");
          }
        }
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const activeSlot = isFullScreen
    ? "fullscreen"
    : isMobileExpanded
      ? "mobile-expanded"
      : isMobileScreen
        ? "mobile-mini"
        : "desktop";

  const [ytReady, setYtReady] = useState(false);
  const ytPlayerRef = useRef<any>(null);
  const ytPlayerReadyRef = useRef<boolean>(false);
  const pendingSongRef = useRef<Song | null>(null);
  const resolvedYoutubeIdRef = useRef<string | null>(null);
  const [resolvedYoutubeId, setResolvedYoutubeId] = useState<string | null>(
    null,
  );
  const ytPlayerContainerId = "youtube-iframe-player-instance";

  const [ytPlaybackError, setYtPlaybackError] = useState<boolean>(false);
  const [ytPlaybackErrorCode, setYtPlaybackErrorCode] = useState<number | null>(
    null,
  );

  const fetchFallbackAudioStream = async (videoId: string) => {
    setIsFetchingFallback(true);
    setFallbackAudioUrl(null);

    // Public instances endpoints for redundancy
    const endpoints = [
      `https://pipedapi.kavin.rocks/streams/${videoId}`,
      `https://pipedapi.tokhmi.xyz/streams/${videoId}`,
      `https://pipedapi.river.rocks/streams/${videoId}`,
    ];

    for (const url of endpoints) {
      try {
        console.log(`[Fallback Stream] Trying to resolve audio from: ${url}`);
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.audioStreams && data.audioStreams.length > 0) {
            const audioStreams = [...data.audioStreams].sort(
              (a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0),
            );
            const bestStream = audioStreams[0].url;
            if (bestStream) {
              console.log(
                `[Fallback Stream] Successfully resolved stream from ${url}`,
              );
              setFallbackAudioUrl(bestStream);
              setIsFetchingFallback(false);
              return bestStream;
            }
          }
        }
      } catch (err) {
        console.warn(`[Fallback Stream] Failed resolving from ${url}:`, err);
      }
    }

    // If Piped fails, try standard Invidious API
    const invidiousInstances = [
      `https://vid.priv.au/api/v1/videos/${videoId}`,
      `https://invidious.flokinet.to/api/v1/videos/${videoId}`,
      `https://inv.tux.im/api/v1/videos/${videoId}`,
    ];

    for (const url of invidiousInstances) {
      try {
        console.log(`[Fallback Stream] Trying Invidious fallback: ${url}`);
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
            const audioFormats = data.adaptiveFormats.filter(
              (f: any) =>
                f.type?.includes("audio") || (!f.videoCodec && f.audioCodec),
            );
            if (audioFormats.length > 0) {
              const bestStream = audioFormats[0].url;
              if (bestStream) {
                console.log(
                  `[Fallback Stream] Successfully resolved from Invidious: ${url}`,
                );
                setFallbackAudioUrl(bestStream);
                setIsFetchingFallback(false);
                return bestStream;
              }
            }
          }
        }
      } catch (err) {
        console.warn(
          `[Fallback Stream] Failed resolving from Invidious ${url}:`,
          err,
        );
      }
    }

    setIsFetchingFallback(false);
    return null;
  };

  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const ytWrapperRef = useRef<HTMLDivElement>(null);

  // Custom high-performance touch and mouse drag state and listeners
  const dragStart = useRef({ clientX: 0, clientY: 0, startX: 0, startY: 0 });
  const isDraggingRef = useRef(false);

  // References to handle drag events dynamically without stale closures
  const globalMouseMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  const globalTouchMoveRef = useRef<(e: TouchEvent) => void>(() => {});
  const globalMouseUpRef = useRef<() => void>(() => {});
  const globalTouchEndRef = useRef<() => void>(() => {});

  // Stable event listener targets
  const globalMouseMove = useCallback((e: MouseEvent) => {
    globalMouseMoveRef.current(e);
  }, []);
  const globalTouchMove = useCallback((e: TouchEvent) => {
    globalTouchMoveRef.current(e);
  }, []);
  const globalMouseUp = useCallback(() => {
    globalMouseUpRef.current();
  }, []);
  const globalTouchEnd = useCallback(() => {
    globalTouchEndRef.current();
  }, []);

  // Sync refs to closures accessing dynamic state/values
  useEffect(() => {
    globalMouseMoveRef.current = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const deltaX = e.clientX - dragStart.current.clientX;
      const deltaY = e.clientY - dragStart.current.clientY;
      const newX = dragStart.current.startX + deltaX;
      const newY = dragStart.current.startY + deltaY;
      dragX.set(newX);
      dragY.set(newY);
      handleDrag(null, null);
    };

    globalTouchMoveRef.current = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const touch = e.touches[0];
      if (touch) {
        // e.preventDefault() inside touchmove to prevent mobile screen scrolling / bouncing
        e.preventDefault();
        const deltaX = touch.clientX - dragStart.current.clientX;
        const deltaY = touch.clientY - dragStart.current.clientY;
        const newX = dragStart.current.startX + deltaX;
        const newY = dragStart.current.startY + deltaY;
        dragX.set(newX);
        dragY.set(newY);
        handleDrag(null, null);
      }
    };

    globalMouseUpRef.current = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      handleDragEnd(null, null);
      window.removeEventListener("mousemove", globalMouseMove);
      window.removeEventListener("mouseup", globalMouseUp);
      window.removeEventListener("touchmove", globalTouchMove, {
        passive: false,
      } as any);
      window.removeEventListener("touchend", globalTouchEnd);
      window.removeEventListener("touchcancel", globalTouchEnd);
    };

    globalTouchEndRef.current = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      handleDragEnd(null, null);
      window.removeEventListener("mousemove", globalMouseMove);
      window.removeEventListener("mouseup", globalMouseUp);
      window.removeEventListener("touchmove", globalTouchMove, {
        passive: false,
      } as any);
      window.removeEventListener("touchend", globalTouchEnd);
      window.removeEventListener("touchcancel", globalTouchEnd);
    };
  });

  // Clean elements on unmount in case drag is still in progress
  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", globalMouseMove);
      window.removeEventListener("mouseup", globalMouseUp);
      window.removeEventListener("touchmove", globalTouchMove, {
        passive: false,
      } as any);
      window.removeEventListener("touchend", globalTouchEnd);
      window.removeEventListener("touchcancel", globalTouchEnd);
    };
  }, [globalMouseMove, globalTouchMove, globalMouseUp, globalTouchEnd]);

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (youtubeMinimized) return; // Completely disable dragging when minimized!
    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;
    dragStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: dragX.get(),
      startY: dragY.get(),
    };

    window.addEventListener("mousemove", globalMouseMove, { passive: false });
    window.addEventListener("mouseup", globalMouseUp);
    window.addEventListener("touchmove", globalTouchMove, { passive: false });
    window.addEventListener("touchend", globalTouchEnd);
    window.addEventListener("touchcancel", globalTouchEnd);
  };

  const handleHeaderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (youtubeMinimized) return; // Completely disable dragging when minimized!
    const touch = e.touches[0];
    if (touch) {
      setIsDragging(true);
      isDraggingRef.current = true;
      dragStart.current = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        startX: dragX.get(),
        startY: dragY.get(),
      };

      window.addEventListener("mousemove", globalMouseMove, { passive: false });
      window.addEventListener("mouseup", globalMouseUp);
      window.addEventListener("touchmove", globalTouchMove, { passive: false });
      window.addEventListener("touchend", globalTouchEnd);
      window.addEventListener("touchcancel", globalTouchEnd);
    }
  };

  // Clear coordinates when layout changes or becomes hidden
  useEffect(() => {
    if (playerLayoutMode !== "video-mode") {
      dragX.set(0);
      dragY.set(0);
    }
  }, [playerLayoutMode, dragX, dragY]);

  const handleDrag = (_event: any, _info: any) => {
    // Snapping logic has been completely disabled and terminated
  };

  const handleDragEnd = (_event: any, _info: any) => {
    setIsDragging(false);
    const rect = ytWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;

    const W = window.innerWidth;
    const H = window.innerHeight;

    const curX = dragX.get();
    const curY = dragY.get();
    const origLeft = rect.left - curX;
    const origTop = rect.top - curY;

    // View boundaries prevent window from escaping viewport entirely
    const padFreeX = 12;
    const padFreeYTop = 12;
    const padFreeYBottom = W < 768 ? 144 : 112;

    let finalLeft = rect.left;
    let finalTop = rect.top;

    if (finalLeft < padFreeX) finalLeft = padFreeX;
    if (finalLeft > W - rect.width - padFreeX)
      finalLeft = W - rect.width - padFreeX;

    if (finalTop < padFreeYTop) finalTop = padFreeYTop;
    if (finalTop > H - rect.height - padFreeYBottom)
      finalTop = H - rect.height - padFreeYBottom;

    const finalX = finalLeft - origLeft;
    const finalY = finalTop - origTop;

    animate(dragX, finalX, { type: "spring", stiffness: 240, damping: 24 });
    animate(dragY, finalY, { type: "spring", stiffness: 240, damping: 24 });
  };

  // Load YouTube IFrame API script dynamically if not available
  useEffect(() => {
    if (isSidebar) return;
    if ((window as any).YT && (window as any).YT.Player) {
      setYtReady(true);
      return;
    }

    // Keep existing callback if present
    const prevCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      setYtReady(true);
    };

    // Inject tag if not present
    const scripts = document.getElementsByTagName("script");
    let scriptExists = false;
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].src === "https://www.youtube.com/iframe_api") {
        scriptExists = true;
        break;
      }
    }

    if (!scriptExists) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize YouTube player ONCE and persist it in the DOM
  useEffect(() => {
    if (isSidebar) return;
    if (!ytReady) return;

    const container = document.getElementById(ytPlayerContainerId);
    if (!container || ytPlayerRef.current) return;

    try {
      ytPlayerRef.current = new (window as any).YT.Player(ytPlayerContainerId, {
        height: "100%",
        width: "100%",
        playerVars: {
          controls: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          origin: window.location.origin,
          autoplay: 0,
        },
        events: {
          onReady: (event: any) => {
            const player = event.target;
            ytPlayerReadyRef.current = true;
            try {
              player.unMute();
              player.setVolume(volume * fadeInVolume * 100);
            } catch (e) {}

            if (pendingSongRef.current) {
              const videoId = extractYoutubeVideoIdFromString(
                pendingSongRef.current.sourceId || pendingSongRef.current.id,
              );
              if (videoId) {
                if (isPlaying) {
                  player.loadVideoById(videoId);
                } else {
                  player.cueVideoById(videoId);
                }
                setTimeout(() => {
                  try {
                    const dur = player.getDuration();
                    if (dur > 0) {
                      setProgress(player.getCurrentTime() || 0, dur);
                    }
                  } catch (e) {}
                }, 800);
              }
              pendingSongRef.current = null;
            }
          },
          onStateChange: (event: any) => {
            const state = event.data;
            const player = event.target;
            try {
              player.unMute();
              player.setVolume(volume * fadeInVolume * 100);
            } catch (e) {}

            try {
              if (typeof player.getDuration === "function") {
                const dur = player.getDuration();
                if (dur > 0) {
                  setProgress(player.getCurrentTime() || 0, dur);
                }
              }
            } catch (e) {}

            const store = usePlayerStore.getState();

            if (state === (window as any).YT.PlayerState.ENDED) {
              store.pause();
              store.next();
            } else if (state === (window as any).YT.PlayerState.PLAYING) {
              if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause();
              }
              if (!store.isPlaying) {
                store.play();
              }
            } else if (state === (window as any).YT.PlayerState.PAUSED) {
              if (store.isPlaying) {
                store.pause();
              }
            }
          },
          onError: (event: any) => {
            const errorCode = event.data;
            console.error("YouTube Player Error:", errorCode);
            setYtPlaybackError(true);
            setYtPlaybackErrorCode(errorCode);

            // Fallback to playing the official audio-only stream
            const latestSong = usePlayerStore.getState().currentSong;
            if (latestSong) {
              const videoId =
                resolvedYoutubeIdRef.current ||
                extractYoutubeVideoIdFromString(
                  latestSong.sourceId || latestSong.id,
                );
              if (videoId) {
                console.log(
                  `[Playback Fallback] Triggering audio stream fallback for video: ${videoId}`,
                );
                fetchFallbackAudioStream(videoId);
              }
            }
          },
        },
      });
    } catch (e) {
      console.warn("Failed to instantiate persistent YT Player:", e);
    }
  }, [ytReady]);

  // Intercept normal playback with OPFS local storage sandbox if available
  useEffect(() => {
    if (isSidebar || !currentSong) return;

    // Check if it already acts as a local track
    if (currentSong.source !== "local" && !currentSong.localUrl) {
      let isSubscribed = true;
      (async () => {
        try {
          const { getTrack } = await import("../../lib/offlineStorage");
          const track = await getTrack(currentSong.id);
          if (track && track.blob && isSubscribed) {
            console.log(`[MusicPlayer] Offline cached track found for ${currentSong.id}`);
            setFallbackAudioUrl(URL.createObjectURL(track.blob));
            if (ytPlayerRef.current && ytPlayerReadyRef.current && typeof ytPlayerRef.current.pauseVideo === "function") {
              try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
            }
          }
        } catch (err) {
          // ignore
        }
      })();
      return () => {
        isSubscribed = false;
      };
    }
  }, [currentSong?.id, isSidebar]);

  // Handle song load request
  useEffect(() => {
    if (isSidebar) return;

    // Reset all playback error and fallback states on song switch
    setYtPlaybackError(false);
    setYtPlaybackErrorCode(null);
    setFallbackAudioUrl(null);
    setIsFetchingFallback(false);

    if (!currentSong) return;

    const isOfflineTrackLocal =
      currentSong.source === "local" ||
      !!currentSong.localUrl ||
      currentSong.id.startsWith("local-");
    const isYTSource =
      (currentSong.source === "youtube" ||
        currentSong.source === "cloud" ||
        currentSong.source === "spotify") &&
      !isOfflineTrackLocal && !fallbackAudioUrl;
    if (!isYTSource) {
      // Pause YT player if we switch to non-YT source
      if (
        ytPlayerRef.current &&
        ytPlayerReadyRef.current &&
        typeof ytPlayerRef.current.pauseVideo === "function"
      ) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {}
      }
      return;
    }

    const resolveVideoId = async () => {
      let resolvedId = extractYoutubeVideoIdFromString(
        currentSong.sourceId || currentSong.id,
      );

      // If the track is from Spotify search, it doesn't have a valid YouTube ID yet
      if (
        currentSong.source === "spotify" ||
        (resolvedId && resolvedId.length > 15)
      ) {
        try {
          const res = await axios.get("/api/search", {
            params: { q: `${currentSong.title} ${currentSong.artist}` },
          });
          const items = res.data;
          if (Array.isArray(items) && items.length > 0) {
            resolvedId = extractYoutubeVideoIdFromString(
              items[0].id || items[0].sourceId,
            );
          }
        } catch (e) {
          console.error("Failed to resolve Spotify track to YouTube:", e);
        }
      }
      return resolvedId;
    };

    resolveVideoId().then((videoId) => {
      if (!videoId) return;
      setResolvedYoutubeId(videoId);
      resolvedYoutubeIdRef.current = videoId;

      if (ytPlayerRef.current && ytPlayerReadyRef.current) {
        try {
          if (isPlaying) {
            ytPlayerRef.current.loadVideoById(videoId);
          } else {
            ytPlayerRef.current.cueVideoById(videoId);
          }
          if (volume > 0) {
            ytPlayerRef.current.unMute();
          } else {
            ytPlayerRef.current.mute();
          }
          ytPlayerRef.current.setVolume(volume * fadeInVolume * 100);

          // Query duration after cue/load to initialize progress bar
          setTimeout(() => {
            try {
              if (
                ytPlayerRef.current &&
                typeof ytPlayerRef.current.getDuration === "function"
              ) {
                const dur = ytPlayerRef.current.getDuration();
                if (dur > 0) {
                  setProgress(0, dur);
                }
              }
            } catch (e) {}
          }, 800);
        } catch (err) {
          console.warn("Failed to set video ID:", err);
        }
      } else {
        pendingSongRef.current = currentSong; // Also need to pass resolvedId if we can but re-rendering will catch it
      }
    });
  }, [currentSong?.id, currentSong?.source]);

  // Handle play / pause action sync separately to avoid re-triggering full video loads
  useEffect(() => {
    if (isSidebar) return;
    if (
      ytPlayerRef.current &&
      ytPlayerReadyRef.current &&
      typeof ytPlayerRef.current.getPlayerState === "function"
    ) {
      try {
        const state = ytPlayerRef.current.getPlayerState();
        const isOfflineTrackLocal = !!(
          currentSong &&
          (currentSong.source === "local" ||
            currentSong.localUrl ||
            currentSong.id.startsWith("local-"))
        );
        const isYTSource =
          (currentSong?.source === "youtube" ||
            currentSong?.source === "cloud" ||
            currentSong?.source === "spotify") &&
          !isOfflineTrackLocal && !fallbackAudioUrl;
        if (isYTSource) {
          if (isPlaying && state !== (window as any).YT.PlayerState.PLAYING) {
            ytPlayerRef.current.playVideo();
          } else if (
            !isPlaying &&
            state === (window as any).YT.PlayerState.PLAYING
          ) {
            ytPlayerRef.current.pauseVideo();
          }
        }
      } catch (e) {}
    }
  }, [isPlaying, currentSong?.id, currentSong?.source, currentSong?.localUrl]);

  // Handle volume change sync
  useEffect(() => {
    if (isSidebar) return;
    if (
      ytPlayerRef.current &&
      ytPlayerReadyRef.current &&
      typeof ytPlayerRef.current.setVolume === "function"
    ) {
      try {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(volume * fadeInVolume * 100);
      } catch (e) {}
    }
  }, [volume, fadeInVolume]);

  // Poll current playback progress from active YouTube stream
  useEffect(() => {
    if (isSidebar) return;
    let timer: any;
    const updateProgress = () => {
      if (
        ytPlayerRef.current &&
        ytPlayerReadyRef.current &&
        typeof ytPlayerRef.current.getCurrentTime === "function" &&
        typeof ytPlayerRef.current.getDuration === "function"
      ) {
        try {
          const isOfflineTrackLocal = !!(
            currentSong &&
            (currentSong.source === "local" ||
              currentSong.localUrl ||
              currentSong.id.startsWith("local-"))
          );
          const isYTSource =
            (currentSong?.source === "youtube" ||
              currentSong?.source === "cloud" ||
              currentSong?.source === "spotify") &&
            !isOfflineTrackLocal && !fallbackAudioUrl;
          if (isYTSource) {
            const current = ytPlayerRef.current.getCurrentTime();
            const dur = ytPlayerRef.current.getDuration();
            if (dur > 0 && current >= 0) {
              setProgress(current, dur);
            }
          }
        } catch (e) {}
      }
    };

    // Run once immediately to capture initial metadata
    updateProgress();

    // Set interval to poll every 100ms to sync timeline progress and lyrics in real-time
    timer = setInterval(updateProgress, 100);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    isPlaying,
    currentSong?.id,
    currentSong?.source,
    currentSong?.localUrl,
    setProgress,
  ]);

  const formatTime = (time: number | string | undefined | null) => {
    if (time === undefined || time === null) return "0:00";
    const num = typeof time === "string" ? parseFloat(time) : time;
    if (isNaN(num)) return "0:00";
    const totalSeconds = Math.round(num);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const startCrossfade = () => {
    if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);

    setFadeInVolume(0);
    setFadeOutVolume(1);

    const duration = crossfadeDuration * 1000;
    const steps = 30;
    const interval = duration / steps;
    let currentStep = 0;

    crossfadeTimerRef.current = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      // Use ease-in-out for smoother transition
      const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;

      setFadeOutVolume(1 - easeProgress);
      setFadeInVolume(easeProgress);

      if (currentStep >= steps) {
        if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
        setFadingOutSong(null);
        setFadeInVolume(1);
      }
    }, interval);
  };

  // Triggered when currentSong changes
  useEffect(() => {
    if (isSidebar) return;
    if (
      currentSong &&
      lastSongRef.current &&
      lastSongRef.current.id !== currentSong.id &&
      isPlaying
    ) {
      if (crossfadeEnabled) {
        const prev = lastSongRef.current;
        setFadingOutSong(prev);
        setFadeStartTime(currentTime);
        setFadeInVolume(0);
        setFadeOutVolume(1);
      } else {
        // Just clear any fading song if disabled
        setFadingOutSong(null);
        setFadeInVolume(1);
      }
    }
    lastSongRef.current = currentSong;
  }, [currentSong?.id, crossfadeEnabled]);

  // Cleanup crossfade timer on unmount
  useEffect(() => {
    return () => {
      if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
    };
  }, []);

  // Near end trigger for crossfade
  useEffect(() => {
    if (isSidebar) return;
    if (
      isPlaying &&
      duration > 0 &&
      crossfadeEnabled &&
      currentTime >= duration - crossfadeDuration &&
      !fadingOutSong
    ) {
      const { repeatMode, currentIndex, queue } = usePlayerStore.getState();
      if (currentIndex < queue.length - 1 || repeatMode === "all") {
        next();
      }
    }
  }, [
    currentTime,
    duration,
    isPlaying,
    fadingOutSong,
    crossfadeEnabled,
    crossfadeDuration,
  ]);

  // Web Media Session API integration for background play controls
  useEffect(() => {
    if (isSidebar) return;
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (currentSong) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: decodeHtmlEntities(currentSong.title),
          artist: decodeHtmlEntities(currentSong.artist || "Unknown Artist"),
          album: decodeHtmlEntities(currentSong.album || "Unknown Album"),
          artwork: [
            {
              src: currentSong.thumbnail || "/logo.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        });
      } catch (err) {
        console.warn("Failed to set MediaSession metadata:", err);
      }
    }
  }, [currentSong, isSidebar]);

  useEffect(() => {
    if (isSidebar) return;
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch (err) {
      console.warn("Failed to set MediaSession playbackState:", err);
    }
  }, [isPlaying, isSidebar]);

  useEffect(() => {
    if (isSidebar) return;
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    if (currentSong && duration > 0) {
      try {
        const validatedTime = Math.max(0, Math.min(currentTime, duration));
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1,
          position: validatedTime,
        });
      } catch (err) {
        console.debug("Failed to set MediaSession positionState:", err);
      }
    }
  }, [currentTime, duration, currentSong, isSidebar]);

  useEffect(() => {
    if (isSidebar) return;
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        if (!usePlayerStore.getState().isPlaying) {
          togglePlay();
        }
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (usePlayerStore.getState().isPlaying) {
          togglePlay();
        }
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        previous();
      });
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        next();
      });

      try {
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (details.seekTime !== undefined) {
            usePlayerStore.getState().seekTo(details.seekTime);
          }
        });
      } catch (_) {}

      try {
        navigator.mediaSession.setActionHandler("seekbackward", () => {
          const currTime = usePlayerStore.getState().currentTime;
          usePlayerStore.getState().seekTo(Math.max(0, currTime - 10));
        });
        navigator.mediaSession.setActionHandler("seekforward", () => {
          const currTime = usePlayerStore.getState().currentTime;
          const totalDur = usePlayerStore.getState().duration || 215;
          usePlayerStore.getState().seekTo(Math.min(totalDur, currTime + 10));
        });
      } catch (_) {}
    } catch (err) {
      console.warn("Failed to set MediaSession action handlers:", err);
    }

    return () => {
      if (typeof window === "undefined" || !("mediaSession" in navigator))
        return;
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("seekto", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
      } catch (_) {}
    };
  }, [togglePlay, next, previous, isSidebar]);

  // Handle global seek requests from lastSeekTime
  const lastProcessedSeekRef = useRef<number | null>(null);
  useEffect(() => {
    if (isSidebar) return;
    if (
      lastSeekTime !== null &&
      lastSeekTime !== lastProcessedSeekRef.current
    ) {
      if ((isOfflineTrack || !!fallbackAudioUrl) && audioRef.current) {
        audioRef.current.currentTime = lastSeekTime;
      }
      if (
        isYTSource &&
        ytPlayerRef.current &&
        typeof ytPlayerRef.current.seekTo === "function" &&
        !fallbackAudioUrl
      ) {
        ytPlayerRef.current.seekTo(lastSeekTime, true);
      }
      setProgress(lastSeekTime);
      lastProcessedSeekRef.current = lastSeekTime;
    }
  }, [
    lastSeekTime,
    currentSong?.id,
    isOfflineTrack,
    isYTSource,
    fallbackAudioUrl,
  ]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedPercentage = x / rect.width;
    const newTime = clickedPercentage * (duration || 1);

    // Use the store's central seek mechanism to ensure visibility
    usePlayerStore.getState().seekTo(newTime);
  };

  const handleTouchSeek = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    if (!touch) return;
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * (duration || 1);

    usePlayerStore.getState().seekTo(newTime);
  };

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    handleTouchSeek(e);
  };

  const handleProgressTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.cancelable) e.preventDefault();
    handleTouchSeek(e);
  };

  const handleProgressTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    handleTouchSeek(e);
  };

  const lastSongIdRef = useRef<string | null>(null);
  const lastAudioUpdateRef = useRef<number>(0);

  // Reset progress when song changes and fetch lyrics
  useEffect(() => {
    if (isSidebar) return;
    if (currentSong) {
      const isNewSong =
        lastSongIdRef.current !== null &&
        lastSongIdRef.current !== currentSong.id;

      // Only reset progress if it's a NEW song being selected, not just rehydrated
      if (isNewSong) {
        setProgress(0, currentSong.duration || 215);
      }

      // Automatically auto fetch lyrics for the active song if none exists
      if (!currentSong.lyrics || currentSong.lyrics.length === 0) {
        autoFetchLyrics(currentSong.id, currentSong.artist, currentSong.title);
      }

      // Fetch official Spotify metadata in the background
      // Only do this once per song to avoid API spam
      if (
        isNewSong ||
        (!currentSong.thumbnail?.includes("spotify.com") &&
          !currentSong.thumbnail?.includes("scdn.co") &&
          !currentSong.duration)
      ) {
        searchSpotifyTrack(currentSong.title, currentSong.artist).then(
          (metadata) => {
            if (metadata) {
              updateSongMetadata(currentSong.id, {
                title: metadata.title,
                artist: metadata.artist,
                thumbnail: metadata.albumArt,
                duration: metadata.duration_ms / 1000,
              });
            }
          },
        );
      }

      lastSongIdRef.current = currentSong.id;
    }
  }, [currentSong?.id]);

  // Handle local or fallback audio playback
  useEffect(() => {
    if (isSidebar) return;
    let mounted = true;
    const audio = audioRef.current;
    if (!audio) return;

    if (isOfflineTrack || !!fallbackAudioUrl) {
      audio.volume = volume * fadeInVolume;
      if (isPlaying) {
        // Use a slight delay or check to ensure we don't spam play()
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            if (!mounted) return;
            // Ignore interruption errors (AbortError)
            if (
              error.name !== "AbortError" &&
              error.name !== "NotAllowedError"
            ) {
              console.warn("Playback failed:", error);
            }
          });
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    } else {
      // If we're not on a local or fallback source, make sure the native audio is totally stopped
      if (!audio.paused) {
        audio.pause();
      }
    }
    return () => {
      mounted = false;
      if (audio) {
        try {
          audio.pause();
        } catch (e) {}
      }
    };
  }, [
    isPlaying,
    currentSong?.id,
    isOfflineTrack,
    fallbackAudioUrl,
    volume,
    fadeInVolume,
  ]);

  // Initialize Web Audio API
  useEffect(() => {
    if (isSidebar) return;
    const isUsingLocalSelector = isOfflineTrack || !!fallbackAudioUrl;
    if (isUsingLocalSelector && audioRef.current) {
      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
      }

      const audioCtx = audioContextRef.current;

      // Only create source node once per audio element
      if (!sourceRef.current && audioRef.current) {
        try {
          sourceRef.current = audioCtx.createMediaElementSource(
            audioRef.current,
          );
        } catch (err) {
          console.warn("Web Audio source creation failed:", err);
        }
      }

      if (sourceRef.current) {
        try {
          // Disconnect existing nodes if any
          sourceRef.current.disconnect();

          // Create or Update filter chain
          const freqs = [60, 230, 910, 4000, 14000];
          let lastNode: AudioNode = sourceRef.current;

          freqs.forEach((freq) => {
            // Re-use or create filters
            let filter = filtersRef.current[freq];
            if (!filter) {
              filter = audioCtx.createBiquadFilter();
              filter.type = "peaking";
              filter.frequency.value = freq;
              filter.Q.value = 1;
              filtersRef.current[freq] = filter;
            }
            filter.gain.value = showEQ
              ? equalizerSettings[freq as keyof typeof equalizerSettings] || 0
              : 0;

            lastNode.connect(filter);
            lastNode = filter;
          });

          // Analyser setup
          if (!analyserRef.current) {
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.85;
            analyserRef.current = analyser;
          }

          // Normalization Gain setup
          if (!normalizationGainNodeRef.current) {
            normalizationGainNodeRef.current = audioCtx.createGain();
            normalizationGainNodeRef.current.gain.setValueAtTime(
              1.0,
              audioCtx.currentTime,
            );
          }

          lastNode.connect(analyserRef.current);
          analyserRef.current.connect(normalizationGainNodeRef.current);
          normalizationGainNodeRef.current.connect(audioCtx.destination);
        } catch (err) {
          console.warn("Web Audio connection update failed:", err);
        }
      }
    }
  }, [currentSong?.id, isOfflineTrack, showEQ]);

  // Update filter gains when settings change or showEQ state toggles (controlling EQ on/off)
  useEffect(() => {
    if (isSidebar) return;
    Object.entries(equalizerSettings).forEach(([freq, gain]) => {
      const filter = filtersRef.current[parseInt(freq)];
      if (filter) {
        const targetGain = showEQ ? gain : 0;
        filter.gain.setTargetAtTime(
          targetGain,
          audioContextRef.current?.currentTime || 0,
          0.1,
        );
      }
    });
  }, [equalizerSettings, showEQ]);

  // Dynamic Real-Time Volume Normalization using Web Audio API RMS Tracking
  useEffect(() => {
    if (isSidebar) return;
    if (!normalizationEnabled) {
      if (normalizationGainNodeRef.current) {
        normalizationGainNodeRef.current.gain.setTargetAtTime(
          1.0,
          audioContextRef.current?.currentTime || 0,
          0.15,
        );
      }
      return;
    }

    if (!isPlaying || !analyserRef.current || !normalizationGainNodeRef.current)
      return;

    const analyser = analyserRef.current;
    const gainNode = normalizationGainNodeRef.current;
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    let intervalId: NodeJS.Timeout;

    const runNormalizationGainController = () => {
      if (audioCtx.state === "suspended") return;

      // Retrieve time domain audio waveform
      analyser.getFloatTimeDomainData(dataArray);

      // Calculate Root Mean Square (RMS) amplitude
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / bufferLength);

      // Target RMS for standard audio is around 0.15 for consistent loudness
      const targetRMS = 0.15;

      // Safeguard: if there is complete silence or very quiet transition, do not boost background noise
      if (rms < 0.015) {
        gainNode.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.25);
        return;
      }

      // Compute required level correction factor: target / currentRMS
      const rawFactor = targetRMS / rms;

      // Safe bounds (0.45x to 2.2x) to prevent extreme jumps or damage to auditory dynamic range
      const finalFactor = Math.max(0.45, Math.min(rawFactor, 2.2));

      // Smoothly update the Gain node to avoid artifacts or crackling
      gainNode.gain.setTargetAtTime(finalFactor, audioCtx.currentTime, 0.25);
    };

    // Run dynamic average loudness checks every 120ms
    intervalId = setInterval(runNormalizationGainController, 120);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPlaying, normalizationEnabled, currentSong?.id]);

  if (!isSidebar && !currentSong) {
    const defaultArtworkUrl = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop";
    return (
      <div id="player-outer" className="h-full relative flex flex-col justify-center px-8 select-none">
        <div className="hidden md:flex items-center justify-between h-full select-none gap-2 lg:gap-4 opacity-50 pointer-events-none">
          {/* Song Info */}
          <div className="flex-1 flex items-center gap-3 lg:gap-5 min-w-0 pr-4 md:pr-6">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 overflow-hidden shrink-0 border border-white/10 relative">
              <img
                src={defaultArtworkUrl}
                alt="Not Playing"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="overflow-hidden space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-3 w-full">
                <span className="text-[16px] font-black tracking-tight leading-tight w-full flex-grow text-white">Not Playing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-white/40 font-bold truncate uppercase tracking-wider">Unknown Artist</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center justify-center max-w-[45%] w-full">
            <div className="flex items-center justify-center gap-4 lg:gap-6 mb-2">
              <SkipBack size={24} className="text-white/30" fill="currentColor" />
              <div className="w-12 h-12 lg:w-14 lg:h-14 bg-white/20 text-white/50 rounded-full flex items-center justify-center">
                <Play size={24} fill="currentColor" className="ml-1" />
              </div>
              <SkipForward size={24} className="text-white/30" fill="currentColor" />
            </div>
            <div className="flex items-center justify-between w-full gap-2 lg:gap-3 text-[10px] lg:text-xs font-mono font-medium text-white/30">
              <span>0:00</span>
              <div className="relative h-1 lg:h-[5px] flex items-center w-full">
                <div className="w-full h-full bg-white/10 rounded-full" />
              </div>
              <span>0:00</span>
            </div>
          </div>

          {/* Right Tools */}
          <div className="flex-1 flex items-center justify-end gap-2 lg:gap-4">
            <Volume2 size={18} className="text-white/40" />
            <div className="w-24 h-1 bg-white/10 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (isSidebar) {
    return (
      <div id="player-outer" className="relative flex flex-col gap-4 mt-2">
        {!currentSong ? (
          <div
            id="player-empty"
            className="flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-[9px] italic px-4 py-8 text-center border border-white/5 bg-white/[0.01] rounded-2xl"
          >
            Select a song to start
          </div>
        ) : (
          <>
            {/* Sidebar Compact Player UI */}
            <div className="flex flex-col gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-4 shadow-xl">
              {/* 1. Volume Controller (Top of our sidebar player card) */}
              <div className="flex flex-col gap-1 px-1">
                <span className="text-[9px] uppercase tracking-[0.15em] text-white/20 font-black mb-1">
                  Volume Level
                </span>
                <div className="flex items-center gap-2 group px-3 py-2 bg-black/20 rounded-xl border border-white/5">
                  <Volume2
                    size={13}
                    className="text-white/30 group-hover:text-white transition-colors"
                  />
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full relative cursor-pointer overflow-hidden">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                      style={{ width: `${volume * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono font-black text-white/30 w-6 text-right select-none">
                    {Math.round(volume * 100)}
                  </span>
                </div>
              </div>

              {/* Equalizer Controller */}
              <div
                className="flex flex-col gap-1 px-1"
                id="sidebar-equalizer-section"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-[0.15em] text-white/20 font-black">
                    Equalizer Engine
                  </span>
                  <button
                    onClick={() => {
                      const bands = [60, 230, 910, 4000, 14000];
                      bands.forEach((freq) => setEqualizerBand(freq, 0));
                    }}
                    title="Reset All Bands to 0dB"
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/30 hover:text-purple-400 bg-white/5 hover:bg-white/10 rounded-md border border-white/5 hover:border-purple-500/30 transition-all select-none cursor-pointer"
                  >
                    <RotateCcw
                      size={8}
                      className="transition-transform duration-300 hover:rotate-[-45deg]"
                    />
                    <span>Reset</span>
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-black/20 rounded-xl border border-white/5 relative">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal
                      size={13}
                      className={cn(
                        "transition-all duration-300",
                        showEQ ? "text-purple-400" : "text-white/30",
                        isPlaying &&
                          "animate-[pulse_1.8s_infinite] text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]",
                      )}
                    />
                    <span className="text-[10px] font-black uppercase text-white/60 tracking-wider">
                      Studio Mastering
                    </span>
                    {/* Small sidebar equalizer bars pulsing when isPlaying */}
                    <div className="flex items-end gap-[2px] h-2.5 ml-1 select-none">
                      {[0, 1, 2, 3].map((barIndex) => {
                        const heights = [
                          [4, 10, 6, 8, 4],
                          [6, 4, 10, 5, 6],
                          [8, 5, 4, 10, 8],
                          [5, 8, 7, 4, 5],
                        ];
                        return (
                          <motion.div
                            key={barIndex}
                            animate={
                              isPlaying
                                ? { height: heights[barIndex] }
                                : { height: 3 }
                            }
                            transition={{
                              repeat: Infinity,
                              duration: 0.8 + barIndex * 0.15,
                              ease: "easeInOut",
                            }}
                            className={cn(
                              "w-[2px] rounded-full transition-colors duration-300",
                              isPlaying ? "bg-purple-500" : "bg-white/10",
                            )}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEQ(!showEQ)}
                    className={cn(
                      "px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg border transition-all",
                      showEQ
                        ? "bg-purple-500 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                        : "bg-white/5 text-white/40 border-white/10 hover:text-white/70 hover:bg-white/10",
                    )}
                  >
                    {showEQ ? "Active" : "Tune EQ"}
                  </button>
                </div>
              </div>

              {/* 2. Album Artwork (YouTube player is handled and housed solely by the primary player at the bottom) */}
              <div
                id="sidebar-artwork-container"
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest("button") ||
                    target.closest("a") ||
                    target.closest("input")
                  ) {
                    return;
                  }
                  if (youtubeMinimized) {
                    setYoutubeMinimized(false);
                  } else {
                    toggleFullScreen();
                  }
                }}
                className="w-full aspect-square rounded-2xl bg-zinc-900 overflow-hidden relative group/sidebar-thumb cursor-pointer border border-white/10 shadow-2xl animate-[pulse_6s_infinite]"
                title={
                  youtubeMinimized
                    ? "Click to restore YouTube live feed video"
                    : "Click to expand to full screen visualizer"
                }
              >
                {/* No embedded video in sidebar thumbnail, handled by primary player */}

                <img
                  src={
                    lowDataMode && currentSong.thumbnail
                      ? currentSong.thumbnail.replace("h=300", "h=50")
                      : currentSong.thumbnail || undefined
                  }
                  alt={currentSong.title}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-500 group-hover/sidebar-thumb:scale-105",
                    lowDataMode && "opacity-50",
                  )}
                />

                {/* Overlays */}
                {!youtubeMinimized ? (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/sidebar-thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10 h-full w-full">
                    <ChevronUp
                      size={24}
                      className="text-white drop-shadow-md"
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/sidebar-thumb:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-1.5 z-10 h-full w-full">
                    <Maximize2
                      size={24}
                      className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] animate-pulse"
                    />
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/95">
                      Expand Video
                    </span>
                  </div>
                )}

                {lowDataMode && (
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center z-10",
                      youtubeMinimized &&
                        "opacity-0 pointer-events-none hidden",
                    )}
                  >
                    <div className="px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-black italic tracking-tighter text-purple-400">
                      LDM
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Title & Artist details */}
              <div className="px-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="overflow-hidden flex-1">
                    <h5 className="text-sm font-black tracking-tight truncate leading-tight text-white">
                      {currentSong.title || 'Loading...'}
                    </h5>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <button
                        onClick={() => setShowArtistInfo(true)}
                        className="text-[11px] text-white/40 font-bold hover:text-purple-400 transition-colors truncate uppercase tracking-wider"
                      >
                        {currentSong.artist || 'Loading...'}
                      </button>
                    </div>
                  </div>
                  <LikeButton
                    targetId={currentSong.id}
                    type="song"
                    size={16}
                    className="shrink-0 mt-0.5"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[8px] font-black text-purple-400 uppercase tracking-widest leading-none shrink-0">
                    {currentSong.source}
                  </span>
                  <button
                    onClick={() => setShowArtistInfo(true)}
                    className="text-[9px] text-white/30 font-black uppercase tracking-wider hover:text-purple-400 transition-colors shrink-0"
                  >
                    View Info
                  </button>
                </div>
              </div>

              {/* 4. Progress and Seek bar & Time display */}
              <div className="space-y-1.5 px-0.5">
                <div
                  className="relative flex items-center group touch-none select-none w-full"
                  style={{ padding: "12px 0", pointerEvents: "auto" }}
                  onTouchStart={handleProgressTouchStart}
                  onTouchMove={handleProgressTouchMove}
                  onTouchEnd={handleProgressTouchEnd}
                  onClick={handleSeek}
                >
                  <div className="relative w-full h-2 flex items-center">
                    <input
                      type="range"
                      min="0"
                      max={duration || 1}
                      step="0.1"
                      value={currentTime}
                      onChange={(e) => {
                        const newTime = parseFloat(e.target.value);
                        usePlayerStore.getState().seekTo(newTime);
                      }}
                      className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10 pointer-events-auto"
                      style={{ pointerEvents: "auto" }}
                    />
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative border border-white/5">
                      <div
                        className={cn(
                          "h-full bg-gradient-to-r from-purple-500 to-indigo-500 group-hover:from-purple-400 group-hover:to-pink-500 transition-all duration-150",
                          isPlaying && "playing-progress-bg",
                        )}
                        style={{
                          width: `${(currentTime / (duration || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <div
                      className={cn(
                        "absolute w-2.5 h-2.5 bg-white rounded-full shadow-md transition-all pointer-events-none z-20 border border-purple-500",
                        isPlaying
                          ? "opacity-100 playing-progress-handle"
                          : "opacity-100 block",
                      )}
                      style={{
                        left: `calc(${(currentTime / (duration || 1)) * 100}% - 5px)`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-[9px] font-mono font-bold text-white/30 uppercase tracking-wider">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* 5. Core Controls row */}
              <div className="flex flex-col gap-3 pt-1">
                {/* Previous, Play/Pause, Next */}
                <div className="flex items-center justify-center gap-4 py-1.5 bg-white/[0.03] rounded-2xl border border-white/5 relative">
                  <motion.button
                    whileHover={hasPrev ? { scale: 1.15, x: -2 } : {}}
                    whileTap={hasPrev ? { scale: 0.95 } : {}}
                    onClick={previous}
                    disabled={!hasPrev}
                    className={cn(
                      "transition-all p-1.5 rounded-full",
                      hasPrev
                        ? "text-white/70 hover:text-white"
                        : "text-white/5 cursor-not-allowed",
                    )}
                    title="Previous"
                  >
                    <SkipBack size={15} fill="currentColor" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (audioContextRef.current?.state === "suspended") {
                        audioContextRef.current.resume();
                      }
                      togglePlay();
                    }}
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all border-[3px]",
                      isPlaying
                        ? "bg-white text-black border-white/20 shadow-[0_4px_15px_rgba(255,255,255,0.1)]"
                        : "bg-purple-600 text-white border-purple-500/30 shadow-[0_4px_15px_rgba(168,85,247,0.3)]",
                    )}
                  >
                    {isPlaying ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    )}
                  </motion.button>

                  <motion.button
                    whileHover={
                      hasNext || repeatMode === "all"
                        ? { scale: 1.15, x: 2 }
                        : {}
                    }
                    whileTap={
                      hasNext || repeatMode === "all" ? { scale: 0.95 } : {}
                    }
                    onClick={next}
                    disabled={!hasNext && repeatMode !== "all"}
                    className={cn(
                      "transition-all p-1.5 rounded-full",
                      hasNext || repeatMode === "all"
                        ? "text-white/70 hover:text-white"
                        : "text-white/5 cursor-not-allowed",
                    )}
                    title="Next"
                  >
                    <SkipForward size={15} fill="currentColor" />
                  </motion.button>
                </div>

                {/* Sub controls (Repeat, Shuffle, Lyrics, Expand) */}
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setIsShuffle(!isShuffle)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      isShuffle
                        ? "text-purple-400 bg-purple-500/10 border border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                        : "text-white/20 hover:text-white/50",
                    )}
                    id="sidebar-shuffle"
                    title="Shuffle"
                  >
                    <Shuffle size={13} />
                  </button>

                  <button
                    onClick={() => {
                      const modes: ("off" | "all" | "one")[] = [
                        "off",
                        "all",
                        "one",
                      ];
                      setRepeatMode(
                        modes[(modes.indexOf(repeatMode) + 1) % modes.length],
                      );
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-all relative",
                      repeatMode !== "off"
                        ? "text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                        : "text-white/20 hover:text-white/50",
                    )}
                    id="sidebar-repeat"
                    title={`Repeat: ${repeatMode}`}
                  >
                    <Repeat size={13} />
                    {repeatMode === "one" && (
                      <span className="absolute -top-1 -right-1 text-[7px] font-black bg-indigo-500 text-white w-3 h-3 rounded-full flex items-center justify-center border border-indigo-400">
                        1
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      if (
                        !showLyrics &&
                        currentSong &&
                        (!currentSong.lyrics || currentSong.lyrics.length === 0)
                      ) {
                        autoFetchLyrics(
                          currentSong.id,
                          currentSong.artist,
                          currentSong.title,
                        );
                      }
                      setShowLyrics(!showLyrics);
                    }}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      showLyrics
                        ? "text-pink-400 bg-pink-500/10 border border-pink-500/20"
                        : "text-white/20 hover:text-white/50",
                    )}
                    title="Lyrics"
                  >
                    <Mic2 size={13} />
                  </button>

                  <button
                    onClick={() => setShowNowPlaying(!showNowPlaying)}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      showNowPlaying
                        ? "text-blue-400 bg-blue-500/10 border border-blue-500/20"
                        : "text-white/20 hover:text-white/50",
                    )}
                    title="Queue/Fullscreen"
                  >
                    <LayoutList size={13} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Full Screen Immersive Mode */}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {isFullScreen && (
                <motion.div
                  ref={fullScreenRef}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    zIndex: 100,
                    background: "#000",
                  }}
                  className={cn(
                    "fixed top-0 left-0 right-0 bottom-0 md:bottom-24 z-[100] bg-[#060608] flex flex-col items-center justify-start lg:justify-center px-4 py-4 lg:p-16 overflow-y-auto overflow-x-hidden select-none scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10",
                    isFullScreen ? "fullscreen-active" : "",
                  )}
                >
                  <div className="absolute inset-0 z-0 scale-110 fixed pointer-events-none">
                    <img
                      src={currentSong?.thumbnail || undefined}
                      className="w-full h-full object-cover opacity-30 blur-[120px]"
                      alt=""
                    />
                  </div>

                  <button
                    onClick={toggleFullScreen}
                    className="fixed top-4 right-4 md:top-10 md:right-10 w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all z-50 group backdrop-blur-2xl"
                  >
                    <X className="text-white w-5 h-5 md:w-7 md:h-7 group-hover:scale-110 transition-transform" />
                  </button>

                  <div
                    onDoubleClick={toggleFullScreen}
                    className="relative z-10 w-full min-h-[min-content] lg:min-h-full flex flex-col justify-between px-0 sm:px-6 overflow-visible pt-16 pb-2 lg:py-6"
                  >
                    <div
                      style={{
                        transform: `translateX(${slideX})`,
                        transition: slideTransition,
                      }}
                      className="w-full min-h-full flex flex-col justify-between gap-8 lg:gap-0 items-center text-center py-2"
                    >
                      <motion.div
                        layoutId="full-art"
                        whileHover={{ scale: 1.02 }}
                        style={
                          isYTSource
                            ? {
                                borderRadius: "50%",
                              }
                            : undefined
                        }
                        className={cn(
                          "overflow-hidden shadow-[0_30px_60px_-10px_rgba(0,0,0,0.8)] border border-white/10 ring-1 ring-white/20 transition-all duration-700 shrink-0 flex items-center justify-center bg-black relative",
                          isYTSource
                            ? "w-full max-w-[280px] h-[280px] md:max-w-[340px] md:h-[340px] lg:max-w-[300px] lg:h-[300px] aspect-square rounded-full border-4 border-purple-500/20"
                            : "w-full max-w-[280px] h-[280px] md:max-w-[340px] md:h-[340px] lg:max-w-[300px] lg:h-[300px] aspect-square rounded-[2rem]",
                        )}
                      >
                        {isYTSource && currentSong ? (
                          <div className="w-full h-full relative select-none rounded-full overflow-hidden">
                            {/* Rotating Vinyl Wrapper */}
                            <div
                              className="rotating-vinyl-wrapper absolute inset-0 w-full h-full rounded-full overflow-hidden"
                              style={{
                                animation: "spin-gpu 20s linear infinite",
                                animationPlayState: !autoRotate
                                  ? "paused"
                                  : isPlaying
                                    ? "running"
                                    : "paused",
                                willChange: "transform",
                                transform: "translate3d(0, 0, 0)",
                              }}
                            >
                              <iframe
                                key={extractYoutubeVideoIdFromString(
                                  currentSong.sourceId || currentSong.id,
                                )}
                                src={`https://www.youtube.com/embed/${extractYoutubeVideoIdFromString(currentSong.sourceId || currentSong.id)}?autoplay=${isPlaying ? 1 : 0}&controls=0&mute=${volume > 0 ? 0 : 1}&playsinline=1&enablejsapi=1&start=${iframeStartVal}&rel=0&showinfo=0&modestbranding=1`}
                                className="absolute inset-[0] w-full h-full border-0 rounded-full pointer-events-none"
                                style={{
                                  scale: "1.35",
                                  willChange: "transform",
                                  transform: "translate3d(0, 0, 0)",
                                }}
                                allow="autoplay; encrypted-media"
                              />
                            </div>
                            {/* Hardware accelerated overlay */}
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                borderRadius: "50%",
                                pointerEvents: "none",
                                zIndex: 10,
                                background:
                                  "conic-gradient(from 0deg, rgba(255,255,255,0.1) 0%, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%, rgba(255,255,255,0.1) 100%)",
                                boxShadow:
                                  "inset 0 0 30px rgba(0,0,0,0.4), inset 0 0 100px rgba(0,0,0,0.2)",
                                animation: "spin-gpu 20s linear infinite",
                                animationPlayState: !autoRotate
                                  ? "paused"
                                  : isPlaying
                                    ? "running"
                                    : "paused",
                                willChange: "transform",
                                transform: "translate3d(0, 0, 0)",
                              }}
                              className="border border-white/10 ring-1 ring-white/5"
                            />
                            {/* Centered Spindle core */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                              <div className="w-[15%] h-[15%] rounded-full bg-black border-2 border-white/20 shadow-inner flex items-center justify-center">
                                <div className="w-[30%] h-[30%] rounded-full bg-zinc-900" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={currentSong?.thumbnail || undefined}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </motion.div>

                      <div className="flex-1 w-full max-w-xl flex flex-col justify-end text-center space-y-3 md:space-y-4 h-auto max-h-none overflow-visible mb-2">
                        <div>
                          <h2 className="text-3xl md:text-5xl font-bold text-center tracking-tight text-white leading-tight">
                            {currentSong
                              ? decodeHtmlEntities(currentSong.title)
                              : ""}
                          </h2>
                          <p className="text-lg sm:text-2xl text-purple-400 font-bold uppercase tracking-widest mt-2">
                            {currentSong?.artist}
                          </p>
                        </div>

                        {/* Player controls view - hidden on desktop immersive view to avoid duplicate controls with the persistent player bar */}
                        <div className="w-full flex-1 flex md:hidden flex-col justify-between text-center space-y-3 sm:space-y-4 min-h-0">
                          <div className="space-y-4">
                            <div
                              className="relative flex items-center group touch-none select-none w-full"
                              style={{
                                padding: "12px 0",
                                pointerEvents: "auto",
                              }}
                              onTouchStart={handleProgressTouchStart}
                              onTouchMove={handleProgressTouchMove}
                              onTouchEnd={handleProgressTouchEnd}
                              onClick={handleSeek}
                            >
                              <div className="relative w-full h-6 flex items-center">
                                <input
                                  type="range"
                                  min="0"
                                  max={duration || 1}
                                  step="0.1"
                                  value={currentTime}
                                  onChange={(e) =>
                                    usePlayerStore
                                      .getState()
                                      .seekTo(parseFloat(e.target.value))
                                  }
                                  className="absolute inset-x-0 w-full h-full opacity-0 z-10 cursor-pointer pointer-events-auto"
                                  style={{ pointerEvents: "auto" }}
                                />
                                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                                  <div
                                    className={cn(
                                      "h-full bg-purple-500",
                                      isPlaying && "playing-progress-bg",
                                    )}
                                    style={{
                                      width: `${(currentTime / (duration || 1)) * 100}%`,
                                    }}
                                  />
                                </div>
                                <div
                                  className={cn(
                                    "absolute w-5 h-5 bg-white rounded-full shadow-2xl border-[5px] border-purple-500 z-20 pointer-events-none transition-all",
                                    isPlaying && "playing-progress-handle",
                                  )}
                                  style={{
                                    left: `calc(${(currentTime / (duration || 1)) * 100}% - 10px)`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono font-black text-white/30 uppercase tracking-widest">
                              <span>{formatTime(currentTime)}</span>
                              <span>{formatTime(duration)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-center lg:justify-start gap-6">
                            <motion.button
                              onClick={previous}
                              disabled={!hasPrev}
                              className={cn(
                                "text-white transition-all p-3 bg-white/5 rounded-full border border-white/5",
                                !hasPrev && "opacity-20",
                              )}
                            >
                              <SkipBack size={20} fill="currentColor" />
                            </motion.button>
                            {forwardBackward && (
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={jumpBackward}
                                className="text-white transition-all p-3 bg-white/5 rounded-full border border-white/5"
                                title={`Jump backward ${fastForwardTime}`}
                              >
                                <RotateCcw size={20} />
                              </motion.button>
                            )}
                            <motion.button
                              onClick={togglePlay}
                              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl"
                            >
                              {isPlaying ? (
                                <Pause size={24} fill="currentColor" />
                              ) : (
                                <Play
                                  size={24}
                                  fill="currentColor"
                                  className="ml-1"
                                />
                              )}
                            </motion.button>
                            {forwardBackward && (
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={jumpForward}
                                className="text-white transition-all p-3 bg-white/5 rounded-full border border-white/5"
                                title={`Jump forward ${fastForwardTime}`}
                              >
                                <RotateCw size={20} />
                              </motion.button>
                            )}
                            <motion.button
                              onClick={next}
                              disabled={!hasNext && repeatMode !== "all"}
                              className={cn(
                                "text-white transition-all p-3 bg-white/5 rounded-full border border-white/5",
                                !hasNext &&
                                  repeatMode !== "all" &&
                                  "opacity-20",
                              )}
                            >
                              <SkipForward size={20} fill="currentColor" />
                            </motion.button>
                          </div>

                          <div className="w-full space-y-4 flex flex-col items-center relative px-0 sm:px-2 mb-2">
                            {/* Row 1: Volume Controller Slider */}
                            <div className="flex items-center justify-between w-full group px-4 py-3 bg-white/[0.02] rounded-2xl border border-transparent hover:border-white/10 transition-all shadow-lg hover:bg-white/[0.04]">
                              <Volume2
                                size={19}
                                className="text-white/30 group-hover:text-white transition-all group-hover:drop-shadow-[0_0_8px_white]"
                              />
                              <div className="flex-1 mx-4 h-1.5 bg-white/5 rounded-full relative cursor-pointer overflow-hidden border border-white/5">
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.01"
                                  value={volume}
                                  onChange={(e) =>
                                    setVolume(parseFloat(e.target.value))
                                  }
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div
                                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 via-pink-500 to-white group-hover:from-purple-600 group-hover:to-blue-400 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                  style={{ width: `${volume * 100}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono font-black text-white/30 w-6 text-right select-none">
                                {Math.round(volume * 100)}
                              </span>
                            </div>

                            {/* Row 2: Secondary Utility Modules */}
                            <div className="flex items-center justify-between w-full p-2 bg-white/[0.03] rounded-2xl border border-white/10 shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
                              <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => setShowEQ(!showEQ)}
                                className={cn(
                                  "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                  showEQ
                                    ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-105"
                                    : "text-white/30 hover:text-white hover:bg-white/5",
                                )}
                                title="Equalizer"
                              >
                                <SlidersHorizontal
                                  size={20}
                                  className={cn(
                                    showEQ &&
                                      "drop-shadow-[0_0_5px_currentColor]",
                                  )}
                                />
                              </button>

                              <button
                                onClick={() => {
                                  setShowDesktopCrossfade(
                                    !showDesktopCrossfade,
                                  );
                                  setShowDesktopNormalization(false);
                                }}
                                className={cn(
                                  "desktop-settings-trigger p-3 flex-1 flex items-center justify-center rounded-xl transition-all relative",
                                  crossfadeEnabled
                                    ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                                    : "text-white/30 hover:text-white hover:bg-white/5",
                                )}
                                title="Crossfade Engine"
                              >
                                <Waves
                                  size={20}
                                  className={cn(
                                    crossfadeEnabled &&
                                      "drop-shadow-[0_0_5px_currentColor]",
                                  )}
                                />
                              </button>

                              <button
                                onClick={() => {
                                  setNormalizationEnabled(
                                    !normalizationEnabled,
                                  );
                                }}
                                className={cn(
                                  "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                  normalizationEnabled
                                    ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                                    : "text-white/30 hover:text-white hover:bg-white/5",
                                )}
                                title="Volume Normalization"
                              >
                                <Volume2
                                  size={20}
                                  className={cn(
                                    normalizationEnabled &&
                                      "drop-shadow-[0_0_5px_currentColor]",
                                  )}
                                />
                              </button>

                              <button
                                onClick={() => {
                                  if (
                                    !showLyrics &&
                                    currentSong &&
                                    (!currentSong.lyrics ||
                                      currentSong.lyrics.length === 0)
                                  ) {
                                    autoFetchLyrics(
                                      currentSong.id,
                                      currentSong.artist,
                                      currentSong.title,
                                    );
                                  }
                                  setShowLyrics(!showLyrics);
                                }}
                                className={cn(
                                  "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                  showLyrics
                                    ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)] scale-105"
                                    : "text-white/30 hover:text-white hover:bg-white/5",
                                )}
                                title="Lyrics"
                              >
                                <Mic2
                                  size={20}
                                  className={cn(
                                    showLyrics &&
                                      "drop-shadow-[0_0_5px_currentColor]",
                                  )}
                                />
                              </button>

                              <button
                                onClick={() =>
                                  setShowNowPlaying(!showNowPlaying)
                                }
                                className={cn(
                                  "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                  showNowPlaying
                                    ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105"
                                    : "text-white/30 hover:text-white hover:bg-white/5",
                                )}
                                title="Fullscreen View"
                              >
                                <LayoutList
                                  size={20}
                                  className={cn(
                                    showNowPlaying &&
                                      "drop-shadow-[0_0_5px_currentColor]",
                                  )}
                                />
                              </button>
                            </div>
                            <AnimatePresence>
                              {showDesktopCrossfade && (
                                <motion.div
                                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                  className="desktop-settings-menu absolute bottom-[100px] left-0 right-0 mx-4 bg-[#0F0F12]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 shadow-2xl z-[200] space-y-4 text-left"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-white">
                                      Crossfade
                                    </span>
                                    <button
                                      onClick={() =>
                                        setCrossfadeEnabled(!crossfadeEnabled)
                                      }
                                      className={cn(
                                        "w-10 h-6 rounded-full border transition-all p-0.5 flex items-center",
                                        crossfadeEnabled
                                          ? "bg-indigo-500 border-indigo-400"
                                          : "bg-white/5 border-white/10",
                                      )}
                                    >
                                      <motion.div
                                        animate={{
                                          x: crossfadeEnabled ? 16 : 0,
                                        }}
                                        transition={{
                                          type: "spring",
                                          stiffness: 500,
                                          damping: 30,
                                        }}
                                        className="w-4 h-4 rounded-full bg-white shadow-md"
                                      />
                                    </button>
                                  </div>
                                  {crossfadeEnabled && (
                                    <div className="space-y-3 pt-3 border-t border-white/5">
                                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-white/40">
                                        <span>Overlap</span>
                                        <span className="text-indigo-400 font-extrabold">
                                          {crossfadeDuration}s
                                        </span>
                                      </div>
                                      <div className="relative h-4 flex items-center group">
                                        <input
                                          type="range"
                                          min="1"
                                          max="12"
                                          step="0.5"
                                          value={crossfadeDuration}
                                          onChange={(e) =>
                                            setCrossfadeDuration(
                                              parseFloat(e.target.value),
                                            )
                                          }
                                          className="absolute inset-0 w-full h-full opacity-0 z-25 cursor-pointer"
                                        />
                                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                          <div
                                            className="h-full bg-indigo-500"
                                            style={{
                                              width: `${(crossfadeDuration / 12) * 100}%`,
                                            }}
                                          />
                                        </div>
                                        <div
                                          className="absolute w-3 h-3 bg-white rounded-full shadow-md pointer-events-none z-20 border-2 border-indigo-500"
                                          style={{
                                            left: `calc(${(crossfadeDuration / 12) * 100}% - 6px)`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}

        {/* Lyrics Overlay */}
        {typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {showLyrics && currentSong && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[99999] bg-black/20 flex flex-col justify-end"
                >
                  <div
                    className="absolute inset-0 z-0 bg-transparent"
                    onClick={() => setShowLyrics(false)}
                  />
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className={cn(
                      "relative z-10 w-full bg-[#0A0A0C] flex flex-col overflow-hidden justify-between p-4 border-t border-white/10 shadow-[0_-20px_80px_rgba(0,0,0,0.8)] transition-all duration-500",
                      isLyricsMaximized
                        ? "h-full max-h-[100vh] rounded-none"
                        : "h-full max-h-[50vh] rounded-t-[40px]",
                    )}
                  >
                    <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />

                    <div className="absolute top-4 left-4 flex items-center gap-3 z-50">
                      <button
                        onClick={() =>
                          setIsLyricsSettingsOpen(!isLyricsSettingsOpen)
                        }
                        className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/50 hover:text-white"
                        title="Settings"
                      >
                        <Settings size={20} />
                      </button>
                    </div>

                    <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
                      <button
                        onClick={() => setIsLyricsMaximized(!isLyricsMaximized)}
                        className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/50 hover:text-white"
                        title={isLyricsMaximized ? "Minimize" : "Maximize"}
                      >
                        <Maximize2 size={18} />
                      </button>
                      <button
                        onClick={() => setShowLyrics(false)}
                        className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/50 hover:text-white"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="relative w-full h-full max-w-4xl mx-auto flex flex-col z-10 pt-16">
                      <LyricsViewer
                        lyrics={currentSong.lyrics || []}
                        currentTime={currentTime}
                        duration={duration}
                        onSeek={(time) =>
                          usePlayerStore.getState().seekTo(time)
                        }
                        accentColor={accentColor}
                        isSettingsOpen={isLyricsSettingsOpen}
                        onCloseSettings={() => setIsLyricsSettingsOpen(false)}
                        onEditLyrics={() => setShowLyricsEditor(true)}
                      />
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}

        <ArtistDetails
          artistName={currentSong?.artist || ""}
          isOpen={showArtistInfo}
          onClose={() => setShowArtistInfo(false)}
        />
      </div>
    );
  }

  return (
    <div
      id="player-outer"
      className="h-full relative flex flex-col justify-center px-8"
    >
      {/* Persistent YouTube Iframe container */}
      {typeof document !== "undefined" &&
        !isSidebar &&
        createPortal(
          !isSongDetailPage && (
            <motion.div
              id="yt-player-wrapper"
              ref={ytWrapperRef}
              style={
                youtubeMinimized || isSongDetailPage || isSettingsPage || isMobileSidebarOpen
                  ? {
                      display: "none",
                    }
                  : ({
                      position: "fixed",
                      top: "100px",
                      right: "40px",
                      width: "320px",
                      height: "180px",
                      display: "flex",
                      x: dragX,
                      y: dragY,
                      background: "#000",
                      zIndex: isFullScreen ? 10 : (typeof window !== 'undefined' && window.innerWidth < 768 ? 20 : 99995),
                    } as any)
              }
              className={cn(
                "overflow-hidden rounded-2xl shadow-2xl border border-white/10 bg-black/95 backdrop-blur-md flex flex-col fixed",
                (isSongDetailPage || isSettingsPage || (isMobileSidebarOpen && typeof window !== 'undefined' && window.innerWidth < 768)) && "opacity-0 pointer-events-none hidden",
              )}
            >
              {/* Grab Handle Header - optimized with mouse & touch listeners, calling e.preventDefault() on moves to prevent screen bouncing */}
              <div
                onMouseDown={handleHeaderMouseDown}
                onTouchStart={handleHeaderTouchStart}
                style={youtubeMinimized ? { display: "none" } : undefined}
                className="h-7 cursor-grab active:cursor-grabbing bg-zinc-900 border-b border-white/5 flex items-center justify-between px-2.5 text-[10px] uppercase tracking-wider font-extrabold text-white/50 select-none shrink-0"
              >
                <div className="flex items-center gap-1.5 pointer-events-none">
                  <GripVertical size={11} className="text-white/40" />
                  <span>YouTube Feed (Drag Me)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setYoutubeMinimized(true)}
                    className="w-4 h-4 rounded bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 active:scale-95 transition-all cursor-pointer mr-1"
                    title="Minimize stream to artwork sidebar box"
                  >
                    <Minus size={11} strokeWidth={3} />
                  </button>
                  <span className="flex h-1.5 w-1.5 relative pointer-events-none">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                  </span>
                </div>
              </div>

              {/* Player Container */}
              <div className="flex-1 w-full bg-[#0c0c0e] relative flex flex-col overflow-visible">
                {ytPlaybackError ? (
                  <div className="absolute inset-0 bg-[#0F0F12] flex flex-col z-10 p-3 justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-pink-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping" />
                          Playback Restricted
                        </span>
                        <span className="text-[8px] font-mono font-bold text-white/30 px-1.5 py-0.5 bg-white/5 rounded">
                          Code: {ytPlaybackErrorCode}
                        </span>
                      </div>
                      <p className="text-[9px] text-white/60 leading-normal font-medium mt-1 line-clamp-2">
                        {currentSong?.title} is restricted via core API by
                        publisher. Falling back...
                      </p>
                    </div>

                    {isFetchingFallback ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-2">
                        <div className="w-5 h-5 rounded-full border border-purple-500/25 border-t-purple-400 animate-spin" />
                        <span className="text-[8px] uppercase tracking-wider text-purple-400/80 font-bold">
                          Rerouting dynamic audio-only stream...
                        </span>
                      </div>
                    ) : fallbackAudioUrl ? (
                      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 p-2 bg-purple-500/5 rounded-xl border border-purple-500/10 max-h-[110px] my-1">
                        <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest flex items-center gap-1">
                          <Waves
                            size={12}
                            className="text-purple-400 animate-pulse"
                          />
                          Direct Stream Link Active
                        </span>
                        <p className="text-[8px] text-white/40 uppercase tracking-wide font-medium text-center max-w-[180px]">
                          Equalizer & real-time visualizers fully synced
                        </p>
                      </div>
                    ) : (
                      <div className="relative w-full h-[115px] rounded-xl overflow-hidden border border-white/5 bg-black my-1">
                        {currentSong ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${resolvedYoutubeId || extractYoutubeVideoIdFromString(currentSong.sourceId || currentSong.id)}?autoplay=1&controls=1&rel=0&showinfo=0&modestbranding=1&origin=${window.location.origin}`}
                            className="w-full h-full border-0"
                            allow="autoplay; encrypted-media; picture-in-picture"
                            allowFullScreen
                          />
                        ) : null}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const videoId =
                            resolvedYoutubeId ||
                            extractYoutubeVideoIdFromString(
                              currentSong?.sourceId || currentSong?.id || "",
                            );
                          if (videoId) fetchFallbackAudioStream(videoId);
                        }}
                        disabled={isFetchingFallback}
                        className="flex-1 py-1 text-[8px] uppercase tracking-wider font-extrabold text-center rounded bg-white/5 text-white/70 hover:bg-purple-950/40 hover:text-purple-300 hover:border-purple-500/20 border border-white/5 transition-all select-none cursor-pointer disabled:opacity-50"
                      >
                        {isFetchingFallback
                          ? "Searching..."
                          : "Request Audio Only"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setYtPlaybackError(false);
                          setYtPlaybackErrorCode(null);
                          setFallbackAudioUrl(null);
                        }}
                        className="px-2 py-1 text-[8px] uppercase tracking-wider font-extrabold rounded bg-white/5 text-white/50 hover:bg-white/10 border border-white/5 transition-all select-none cursor-pointer"
                      >
                        Retry API
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative">
                    <div
                      id="youtube-iframe-player-instance"
                      className="w-full h-full"
                    />
                    {!currentSong && (
                      <div className="absolute inset-0 bg-[#0c0c0e] flex flex-col items-center justify-center p-3 gap-1 text-center select-none z-10 pointer-events-none">
                        <span className="flex h-1.5 w-1.5 relative mb-1">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-black">
                          YouTube Engine Active
                        </span>
                        <p className="text-[9px] text-white/30 leading-normal max-w-[180px] font-medium">
                          Select any video track below to start live feed
                          visualizer
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Prevent IFrame pointer event hijacking during dragging */}
                {isDragging && (
                  <div className="absolute inset-0 bg-transparent z-50 cursor-grabbing" />
                )}

                {/* Picture-in-picture restore toggle icon overlay */}
                {youtubeMinimized && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setYoutubeMinimized(false);
                    }}
                    className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity duration-300 z-50 flex flex-col items-center justify-center gap-2 cursor-pointer"
                    title="Click to restore floating YouTube player"
                  >
                    <div className="w-9 h-9 rounded-full bg-black/85 border border-white/20 flex items-center justify-center text-white shadow-xl transform scale-95 hover:scale-105 active:scale-95 transition-all">
                      <Maximize2
                        size={13}
                        className="text-purple-400 font-bold"
                      />
                    </div>
                    <span className="text-[9px] font-black tracking-widest uppercase text-white drop-shadow-md">
                      Expand Feed
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          ),
          document.body,
        )}

      {/* Native Audio Player (Persistent to prevent removal errors) */}
      <audio
        src={
          isOfflineTrack
            ? currentSong?.localUrl || undefined
            : fallbackAudioUrl || undefined
        }
        ref={audioRef}
        onTimeUpdate={(e) => {
          if (isOfflineTrack || !!fallbackAudioUrl) {
            const now = Date.now();
            if (now - lastAudioUpdateRef.current >= 100) {
              setProgress(e.currentTarget.currentTime);
              lastAudioUpdateRef.current = now;
            }
          }
        }}
        onLoadedMetadata={(e) => {
          if (isOfflineTrack || !!fallbackAudioUrl) {
            setProgress(e.currentTarget.currentTime, e.currentTarget.duration);
            // Start crossfade for local files
            if (fadingOutSong) {
              startCrossfade();
            }
          }
        }}
        onEnded={next}
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Fading Out Player */}
      <AnimatePresence>
        {fadingOutSong &&
          (fadingOutSong.source === "local" ||
            fadingOutSong.localUrl ||
            fadingOutSong.id.startsWith("local-")) && (
            <div
              key={`fade-out-${fadingOutSong.id}`}
              className="absolute left-0 top-0 opacity-0 pointer-events-none -z-50 w-0 h-0 overflow-hidden"
            >
              <FadingAudio
                src={fadingOutSong.localUrl || undefined}
                volume={volume * fadeOutVolume}
                startTime={fadeStartTime}
                playing={fadeOutVolume > 0.05}
              />
            </div>
          )}
      </AnimatePresence>

      {!currentSong ? (
        <div
          id="player-empty"
          className="h-full flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-[10px] lg:text-xs italic px-4 text-center"
        >
          Select a sonic signature to begin
        </div>
      ) : (
        <>
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between h-full select-none gap-2 lg:gap-4">
            {/* Song Info */}
            <div
              onClick={(e) => {
                const target = e.target as HTMLElement;
                // Ignore internal clicks on buttons/links, like info or Like
                if (target.closest("button") || target.closest("a")) {
                  return;
                }
                toggleFullScreen();
              }}
              className="flex-1 flex items-center gap-3 lg:gap-5 min-w-0 pr-4 md:pr-6 cursor-pointer group/info transition-all duration-300 hover:opacity-90 active:scale-98"
              title="Click to expand to full screen"
            >
              <motion.div
                whileHover={{
                  scale: 1.08,
                  rotateY: 15,
                  z: 10,
                  boxShadow: "0px 15px 30px rgba(139, 92, 246, 0.25)",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{ perspective: 800, transformStyle: "preserve-3d" }}
                className="w-16 h-16 rounded-2xl bg-zinc-800 shadow-2xl overflow-hidden shrink-0 border border-white/10 relative group/thumb cursor-pointer origin-center"
              >
                <img
                  src={
                    lowDataMode && currentSong?.thumbnail
                      ? currentSong.thumbnail.replace("h=300", "h=50")
                      : currentSong?.thumbnail || undefined
                  }
                  alt={currentSong?.title}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-500 group-hover/thumb:scale-110",
                    lowDataMode && "opacity-50",
                  )}
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                  <ChevronUp size={20} className="text-white drop-shadow-md" />
                </div>
                {lowDataMode && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="px-1.5 py-0.5 rounded bg-black/60 text-[8px] font-black italic tracking-tighter text-purple-400">
                      LDM
                    </div>
                  </div>
                )}
              </motion.div>
              <div className="overflow-hidden space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-3 w-full">
                  <MarqueeTitle 
                    text={currentSong?.title || 'Not Playing'} 
                    className="text-[16px] font-black tracking-tight leading-tight" 
                    widthClass="w-full flex-grow"
                  />
                  <div className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded shrink-0">
                    <span className="text-[8px] font-black text-purple-400 uppercase tracking-tighter">
                      {currentSong?.source}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowArtistInfo(true);
                    }}
                    className="text-[13px] text-white/40 font-bold truncate uppercase tracking-wider hover:text-purple-400 transition-colors flex items-center gap-1.5 group/art"
                  >
                    {currentSong?.artist || 'Unknown Artist'}
                    <Info
                      size={11}
                      className="opacity-0 group-hover/art:opacity-100 transition-opacity"
                    />
                  </button>
                  <div onClick={(e) => e.stopPropagation()}>
                    <LikeButton
                      targetId={currentSong.id}
                      type="song"
                      size={18}
                      className="shrink-0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Wide Seekbar & Centered Music Playback Controls */}
            <div className="flex-1 flex flex-col justify-center py-2 h-full border-r border-transparent lg:border-white/5 min-w-0 md:px-6 lg:px-12">
              <div className="flex flex-col w-full max-w-[380px] md:w-full md:max-w-xl md:mx-auto md:flex md:flex-col md:items-center">
                <div className="flex items-center gap-2 lg:gap-4 text-[10px] font-mono font-black text-white/25 w-full">
                  <span className="w-10 text-right tabular-nums shrink-0">
                    {formatTime(currentTime)}
                  </span>
                  <div
                    className="relative flex-1 flex items-center group touch-none select-none"
                    style={{ padding: "12px 0", pointerEvents: "auto" }}
                    onTouchStart={handleProgressTouchStart}
                    onTouchMove={handleProgressTouchMove}
                    onTouchEnd={handleProgressTouchEnd}
                    onClick={handleSeek}
                  >
                    <div className="relative w-full h-2 flex items-center">
                      <input
                        type="range"
                        min="0"
                        max={duration || 1}
                        step="0.1"
                        value={currentTime}
                        onChange={(e) => {
                          const newTime = parseFloat(e.target.value);
                          usePlayerStore.getState().seekTo(newTime);
                        }}
                        className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-35 pointer-events-auto"
                        style={{ pointerEvents: "auto" }}
                      />
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
                        <div
                          className={cn(
                            "h-full bg-gradient-to-r from-purple-600 to-indigo-400 relative transition-all duration-150 group-hover:from-purple-500 group-hover:to-pink-500",
                            isPlaying && "playing-progress-bg",
                          )}
                          style={{
                            width: `${(currentTime / (duration || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <motion.div
                        className={cn(
                          "absolute w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.6)] transition-all pointer-events-none z-40 border-2 border-purple-500",
                          isPlaying
                            ? "opacity-100 playing-progress-handle"
                            : "opacity-100 block",
                        )}
                        style={{
                          left: `calc(${(currentTime / (duration || 1)) * 100}% - 7px)`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-10 tabular-nums shrink-0">
                    {formatTime(duration)}
                  </span>
                </div>

                {/* Center Media Playback Controls Row matching the exact horizontal width of the seek progress track */}
                <div className="flex items-center gap-2 lg:gap-4 w-full mt-2 select-none md:w-full md:flex md:justify-center">
                  <div className="w-10 shrink-0" />{" "}
                  {/* Left spacer matching time counter offset */}
                  <div className="flex-1 flex items-center justify-between pointer-events-auto">
                    <div className="w-full flex items-center justify-between rounded-xl px-0 py-1.5 shrink-0">
                      <motion.button
                        whileHover={{
                          scale: 1.15,
                          rotate: -15,
                          filter: "brightness(1.5)",
                        }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setIsShuffle(!isShuffle)}
                        className={cn(
                          "transition-all p-1.5 rounded-lg border border-transparent",
                          isShuffle
                            ? "text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.4)]"
                            : "text-white/20 hover:text-white/40",
                        )}
                        id="desktop-shuffle"
                        title="Shuffle"
                      >
                        <Shuffle
                          size={17}
                          className={cn(
                            isShuffle && "drop-shadow-[0_0_6px_currentColor]",
                          )}
                        />
                      </motion.button>

                      <motion.button
                        whileHover={hasPrev ? { scale: 1.2, x: -2 } : {}}
                        whileTap={hasPrev ? { scale: 0.9 } : {}}
                        onClick={previous}
                        disabled={!hasPrev}
                        className={cn(
                          "transition-all p-1.5 rounded-full",
                          hasPrev
                            ? "text-white/70 hover:text-white hover:bg-white/10"
                            : "text-white/5 cursor-not-allowed",
                        )}
                        title="Previous"
                      >
                        <SkipBack size={17} fill="currentColor" />
                      </motion.button>

                      {showForwardBackward && (
                        <motion.button
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={jumpBackward}
                          className="transition-all p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                          title={`Jump backward ${fastForwardTime}`}
                        >
                          <ChevronLeft size={17} />
                        </motion.button>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          if (audioContextRef.current?.state === "suspended") {
                            audioContextRef.current.resume();
                          }
                          togglePlay();
                        }}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-all relative overflow-hidden text-black border",
                          isPlaying
                            ? "bg-white border-white/30 text-black shadow-[0_5px_15px_rgba(255,255,255,0.2)]"
                            : "bg-purple-600 text-white border-purple-500/40 shadow-[0_5px_15px_rgba(168,85,247,0.4)]",
                        )}
                      >
                        {isPlaying ? (
                          <Pause size={17} fill="currentColor" />
                        ) : (
                          <Play
                            size={17}
                            fill="currentColor"
                            className="ml-0.5"
                          />
                        )}
                      </motion.button>

                      {showForwardBackward && (
                        <motion.button
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={jumpForward}
                          className="transition-all p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                          title={`Jump forward ${fastForwardTime}`}
                        >
                          <ChevronRight size={17} />
                        </motion.button>
                      )}

                      <motion.button
                        whileHover={
                          hasNext || repeatMode === "all"
                            ? { scale: 1.2, x: 2 }
                            : {}
                        }
                        whileTap={
                          hasNext || repeatMode === "all" ? { scale: 0.9 } : {}
                        }
                        onClick={next}
                        disabled={!hasNext && repeatMode !== "all"}
                        className={cn(
                          "transition-all p-1.5 rounded-full",
                          hasNext || repeatMode === "all"
                            ? "text-white/70 hover:text-white hover:bg-white/10"
                            : "text-white/5 cursor-not-allowed",
                        )}
                        title="Next"
                      >
                        <SkipForward size={17} fill="currentColor" />
                      </motion.button>

                      <motion.button
                        whileHover={{
                          scale: 1.15,
                          rotate: 15,
                          filter: "brightness(1.5)",
                        }}
                        whileTap={{ scale: 0.85 }}
                        onClick={() => {
                          const modes: ("off" | "all" | "one")[] = [
                            "off",
                            "all",
                            "one",
                          ];
                          const nextMode =
                            modes[(modes.indexOf(repeatMode) + 1) % modes.length];
                          setRepeatMode(nextMode);
                        }}
                        className={cn(
                          "transition-all p-1.5 rounded-lg border border-transparent relative",
                          repeatMode !== "off"
                            ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                            : "text-white/20 hover:text-white/40",
                        )}
                        id="desktop-repeat"
                        title={`Repeat: ${repeatMode}`}
                      >
                        <Repeat
                          size={17}
                          className={cn(
                            repeatMode !== "off" &&
                              "drop-shadow-[0_0_6px_currentColor]",
                          )}
                        />
                        {repeatMode === "one" && (
                          <span className="absolute -top-1 -right-1 text-[7px] font-black bg-indigo-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center border border-indigo-400">
                            1
                          </span>
                        )}
                      </motion.button>
                    </div>
                  </div>
                  <div className="w-10 shrink-0" />{" "}
                  {/* Right spacer matching duration offset */}
                </div>
              </div>
            </div>

            {/* Right Side: Vertically Stacked Volume & System Controls Cluster */}
            <div className="flex flex-col items-end justify-center gap-2 w-[160px] md:w-[180px] lg:w-[260px] xl:w-1/4 shrink-0 h-full pl-0 lg:pl-6">
              {/* Row 1: Volume Controller Slider */}
              <div className="flex items-center justify-between w-full max-w-[220px] group px-2 lg:px-4 py-1.5 bg-white/[0.02] rounded-xl border border-transparent hover:border-white/10 transition-all shadow-lg hover:bg-white/[0.04] shrink-0">
                <Volume2
                  size={19}
                  className="text-white/30 group-hover:text-white transition-all group-hover:drop-shadow-[0_0_8px_white]"
                />
                <div className="w-32 h-1.5 bg-white/5 rounded-full relative cursor-pointer overflow-hidden border border-white/5">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/40 to-white group-hover:from-purple-600 group-hover:to-blue-400 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    style={{ width: `${volume * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-black text-white/30 w-6 text-right select-none">
                  {Math.round(volume * 100)}
                </span>
              </div>

              {/* Row 2: Equalizer and System Controls, positioned vertically right below the volume slider */}
              <div className="flex items-center justify-end w-full">
                {/* System / Equalizer & Audio Engine Controls Bar */}
                <div className="flex items-center justify-between w-full max-w-[220px] p-1 bg-white/[0.03] rounded-xl border border-white/10 shadow-[0_5px_15px_rgba(0,0,0,0.3)] shrink-0">
                  <div className="relative">
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setShowEQ(!showEQ)}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        showEQ
                          ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-105"
                          : "text-white/30 hover:text-white hover:bg-white/5",
                      )}
                      title="Equalizer"
                    >
                      <SlidersHorizontal
                        size={18}
                        className={cn(
                          showEQ && "drop-shadow-[0_0_5px_currentColor]",
                        )}
                      />
                    </button>
                  </div>

                  <div className="relative">
                    <button
                      onClick={handleScanDevice}
                      disabled={isScanningDevice}
                      className={cn(
                        "p-2 rounded-xl transition-all",
                        isScanningDevice
                          ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                          : "text-white/30 hover:text-white hover:bg-white/5",
                      )}
                      title="Scan Device Folders"
                    >
                      <HardDrive
                        size={18}
                        className={cn(
                          isScanningDevice &&
                            "animate-pulse drop-shadow-[0_0_5px_currentColor]",
                        )}
                      />
                    </button>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowDesktopCrossfade(!showDesktopCrossfade);
                        setShowDesktopNormalization(false);
                      }}
                      className={cn(
                        "desktop-settings-trigger p-2 rounded-xl transition-all",
                        crossfadeEnabled
                          ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                          : "text-white/30 hover:text-white hover:bg-white/5",
                      )}
                      title="Crossfade Engine"
                    >
                      <Waves
                        size={18}
                        className={cn(
                          crossfadeEnabled &&
                            "drop-shadow-[0_0_5px_currentColor]",
                        )}
                      />
                    </button>
                    <AnimatePresence>
                      {showDesktopCrossfade && (
                        <motion.div
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 15, scale: 0.95 }}
                          className="desktop-settings-menu absolute bottom-14 right-0 w-64 bg-[#0F0F12]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 shadow-2xl z-[200] space-y-4 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-white">
                              Crossfade
                            </span>
                            <button
                              onClick={() =>
                                setCrossfadeEnabled(!crossfadeEnabled)
                              }
                              className={cn(
                                "w-10 h-6 rounded-full border transition-all p-0.5 flex items-center",
                                crossfadeEnabled
                                  ? "bg-indigo-500 border-indigo-400"
                                  : "bg-white/5 border-white/10",
                              )}
                            >
                              <motion.div
                                animate={{ x: crossfadeEnabled ? 16 : 0 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 30,
                                }}
                                className="w-4 h-4 rounded-full bg-white shadow-md"
                              />
                            </button>
                          </div>
                          {crossfadeEnabled && (
                            <div className="space-y-3 pt-3 border-t border-white/5">
                              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-white/40">
                                <span>Overlap</span>
                                <span className="text-indigo-400 font-extrabold">
                                  {crossfadeDuration}s
                                </span>
                              </div>
                              <div className="relative h-4 flex items-center group">
                                <input
                                  type="range"
                                  min="1"
                                  max="12"
                                  step="0.5"
                                  value={crossfadeDuration}
                                  onChange={(e) =>
                                    setCrossfadeDuration(
                                      parseFloat(e.target.value),
                                    )
                                  }
                                  className="absolute inset-0 w-full h-full opacity-0 z-25 cursor-pointer"
                                />
                                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                  <div
                                    className="h-full bg-indigo-500"
                                    style={{
                                      width: `${(crossfadeDuration / 12) * 100}%`,
                                    }}
                                  />
                                </div>
                                <div
                                  className="absolute w-3 h-3 bg-white rounded-full shadow-md pointer-events-none z-20 border-2 border-indigo-500"
                                  style={{
                                    left: `calc(${(crossfadeDuration / 12) * 100}% - 6px)`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowDesktopNormalization(!showDesktopNormalization);
                        setShowDesktopCrossfade(false);
                      }}
                      className={cn(
                        "desktop-settings-trigger p-2 rounded-xl transition-all",
                        normalizationEnabled
                          ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                          : "text-white/30 hover:text-white hover:bg-white/5",
                      )}
                      title="Volume Normalization"
                    >
                      <Volume2
                        size={18}
                        className={cn(
                          normalizationEnabled &&
                            "drop-shadow-[0_0_5px_currentColor]",
                        )}
                      />
                    </button>
                    <AnimatePresence>
                      {showDesktopNormalization && (
                        <motion.div
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 15, scale: 0.95 }}
                          className="desktop-settings-menu absolute bottom-14 right-0 w-64 bg-[#0F0F12]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 shadow-2xl z-[200] space-y-4 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-white">
                              Normalization
                            </span>
                            <button
                              onClick={() =>
                                setNormalizationEnabled(!normalizationEnabled)
                              }
                              className={cn(
                                "w-10 h-6 rounded-full border transition-all p-0.5 flex items-center",
                                normalizationEnabled
                                  ? "bg-indigo-500 border-indigo-400"
                                  : "bg-white/5 border-white/10",
                              )}
                            >
                              <motion.div
                                animate={{ x: normalizationEnabled ? 16 : 0 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 30,
                                }}
                                className="w-4 h-4 rounded-full bg-white shadow-md"
                              />
                            </button>
                          </div>
                          <p className="text-[10px] text-white/40 leading-relaxed font-semibold">
                            Maintains uniform average volume levels across all
                            tracks using real-time Web Audio API analysis.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    onClick={() => {
                      if (
                        !showLyrics &&
                        currentSong &&
                        (!currentSong.lyrics || currentSong.lyrics.length === 0)
                      ) {
                        autoFetchLyrics(
                          currentSong.id,
                          currentSong.artist,
                          currentSong.title,
                        );
                      }
                      setShowLyrics(!showLyrics);
                    }}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      showLyrics
                        ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)] scale-105"
                        : "text-white/30 hover:text-white hover:bg-white/5",
                    )}
                    title="Lyrics"
                  >
                    <Mic2
                      size={18}
                      className={cn(
                        showLyrics && "drop-shadow-[0_0_5px_currentColor]",
                      )}
                    />
                  </button>

                  <button
                    onClick={() => setShowNowPlaying(!showNowPlaying)}
                    className={cn(
                      "p-2 rounded-xl transition-all",
                      showNowPlaying
                        ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105"
                        : "text-white/30 hover:text-white hover:bg-white/5",
                    )}
                    title="Fullscreen View"
                  >
                    <LayoutList
                      size={20}
                      className={cn(
                        showNowPlaying && "drop-shadow-[0_0_5px_currentColor]",
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Player Viewport (Compact Minimized / Full Mobile Bar Stacked Layout) */}
          <div 
            onTouchStart={handleMobileBarTouchStart}
            onTouchMove={handleMobileBarTouchMove}
            onTouchEnd={handleMobileBarTouchEnd}
            className={cn(
              "md:hidden fixed bottom-16 left-0 w-full z-40 bg-zinc-950/95 backdrop-blur-md border-t border-neutral-800/80 text-white transition-all duration-300 ease-out px-4 flex",
              isMobilePlayerHidden ? "h-16 py-2 items-center justify-between" : "h-[140px] py-3 flex-col gap-2"
            )}
            style={{ pointerEvents: "auto" }}
          >
            {isMobilePlayerHidden ? (
              /* COMPACT MINIMIZED LAYOUT: ONLY Artwork, Info (Title/Artist), & compact right control group */
              <div 
                onClick={() => setIsMobilePlayerHidden(false)}
                className="flex items-center justify-between w-full h-full cursor-pointer select-none"
              >
                {/* Far Left: Artwork & Song Details */}
                <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                  <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0 flex items-center justify-center overflow-hidden backdrop-blur-sm border border-white/5">
                    {currentSong.thumbnail ? (
                      <img
                        src={currentSong.thumbnail}
                        className="w-full h-full object-cover"
                        alt={currentSong.title}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Music size={18} className="text-white/40" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 justify-center">
                    <span className="text-[13px] font-bold truncate leading-tight text-white max-w-[150px] xs:max-w-[180px]">
                      {currentSong?.title || 'Loading...'}
                    </span>
                    <span className="text-[11px] text-neutral-400 truncate leading-tight mt-0.5 max-w-[130px]">
                      {currentSong?.artist || 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Far Right: Compact Control Group (Queue List, Play/Pause, Next) */}
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="flex items-center gap-2 shrink-0 pointer-events-auto"
                >
                  <button
                    className="p-1.5 text-white/60 hover:text-white transition-colors"
                    onClick={() => setIsMobileExpanded(true)}
                    title="Queue"
                  >
                    <ListMusic size={20} />
                  </button>

                  <button
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center transition-transform active:scale-90 shadow-md"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={next}
                    disabled={!hasNext && repeatMode !== "all"}
                    className={cn(
                      "p-1.5 transition-colors",
                      hasNext || repeatMode === "all" ? "text-white/60 hover:text-white" : "text-white/20 cursor-not-allowed"
                    )}
                    title="Next"
                  >
                    <SkipForward fill="currentColor" size={20} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMobilePlayerHidden(false);
                    }}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center text-white/65 hover:text-white pointer-events-auto"
                    title="Maximize Player"
                  >
                    <ChevronUp size={20} />
                  </button>
                </div>
              </div>
            ) : (
              /* FULL STACKED EXPANDED MOBILE CONTROLS */
              <>
                {/* 1. TOP ROW (METADATA) */}
                <div 
                  onClick={(e) => {
                    toggleFullScreen();
                  }}
                  className="flex items-center justify-between w-full cursor-pointer select-none h-10"
                >
                  <div className="flex items-center gap-3 min-w-0 pointer-events-auto flex-1">
                    <div className="w-10 h-10 rounded-xl bg-white/10 shrink-0 flex items-center justify-center overflow-hidden backdrop-blur-md">
                      {currentSong.thumbnail ? (
                        <img
                          src={currentSong.thumbnail}
                          className="w-full h-full object-cover"
                          alt={currentSong.title}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Music size={20} className="text-white/40" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 justify-center flex-1 w-full overflow-hidden">
                      <MarqueeTitle 
                        text={currentSong?.title || 'Loading...'} 
                        className="text-[13px] font-bold leading-tight" 
                        widthClass="w-full flex-grow"
                      />
                      <span className="text-[11px] text-neutral-400 mt-0.5 truncate leading-tight w-full flex-grow">{currentSong?.artist || 'Loading...'}</span>
                    </div>
                  </div>
                  <div 
                    className="shrink-0 pl-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMobilePlayerHidden(true);
                    }}
                  >
                    <button
                      className="p-1 hover:bg-white/10 rounded-full transition-colors flex items-center justify-center pointer-events-auto"
                      style={{ pointerEvents: "auto" }}
                    >
                      <ChevronDown size={18} className="text-white/50" />
                    </button>
                  </div>
                </div>

                {/* 2. MIDDLE ROW (PROGRESS SEEKER) */}
                <div className="flex flex-col w-full gap-1 touch-none select-none">
                  <div 
                    className="relative w-full h-2 flex items-center group cursor-pointer"
                    onTouchStart={handleProgressTouchStart}
                    onTouchMove={handleProgressTouchMove}
                    onTouchEnd={handleProgressTouchEnd}
                    onClick={handleSeek}
                  >
                    <input
                      type="range"
                      min="0"
                      max={duration || 1}
                      step="0.1"
                      value={currentTime}
                      onChange={(e) => {
                        const newTime = parseFloat(e.target.value);
                        usePlayerStore.getState().seekTo(newTime);
                      }}
                      className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10 pointer-events-auto"
                    />
                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-red-500 transition-all duration-150"
                        style={{
                          width: `${(currentTime / (duration || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <div
                      className="absolute w-2.5 h-2.5 bg-white rounded-full shadow-md z-20 pointer-events-none"
                      style={{
                        left: `calc(${(currentTime / (duration || 1)) * 100}% - 5px)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-medium text-neutral-400">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* 3. BOTTOM ROW (CONTROL ACTIONS) */}
                <div className="flex items-center justify-between w-full px-1 lg:px-4 flex-1">
                  <button
                    className="p-2 text-white/50 hover:text-white transition-colors"
                    onClick={() => setIsMobileExpanded(true)}
                    title="Queue"
                  >
                    <ListMusic size={20} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      previous();
                    }}
                    disabled={!hasPrev}
                    className={cn(
                      "p-2 transition-colors",
                      hasPrev ? "text-white hover:text-white" : "text-white/20 cursor-not-allowed"
                    )}
                    title="Previous"
                  >
                    <SkipBack fill="currentColor" size={24} />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                    className="w-12 h-12 rounded-full bg-transparent flex items-center justify-center transition-transform active:scale-95 text-white shadow-none"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause size={36} fill="currentColor" />
                    ) : (
                      <Play size={36} fill="currentColor" className="ml-1" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      next();
                    }}
                    disabled={!hasNext && repeatMode !== "all"}
                    className={cn(
                      "p-2 transition-colors",
                      hasNext || repeatMode === "all" ? "text-white hover:text-white" : "text-white/20 cursor-not-allowed"
                    )}
                    title="Next"
                  >
                    <SkipForward fill="currentColor" size={24} />
                  </button>

                  <div onClick={(e) => e.stopPropagation()} className="p-2 flex items-center justify-center">
                    <LikeButton targetId={currentSong.id} type="song" size={20} className="text-white/50 hover:text-white" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile Expanded Player */}
          {typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {isMobileExpanded && (
                  <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-0 bg-[#0F0F12] z-[99998] flex flex-col p-6 pt-16 md:hidden overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                  >
                    {/* Background Atmosphere */}
                    <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent pointer-events-none" />

                    <button
                      onClick={() => setIsMobileExpanded(false)}
                      className="absolute top-6 right-6 text-white/30 hover:text-white p-2 bg-white/5 rounded-full border border-white/5 active:scale-90 z-20"
                    >
                      <X size={20} />
                    </button>

                    <div className="flex-1 w-full flex flex-col gap-6 items-center pt-4 justify-start pb-6">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative aspect-square w-48 h-48 xs:w-60 xs:h-60 sm:w-72 sm:h-72 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.8)] border border-white/10 shrink-0"
                      >
                        <img
                          src={currentSong.thumbnail || undefined}
                          className="w-full h-full object-cover"
                          alt={currentSong.title}
                        />
                      </motion.div>

                      <div className="w-full space-y-6">
                        <div className="space-y-2 text-center px-4">
                          <h2 className="text-xl sm:text-2xl font-black italic tracking-tighter text-white leading-tight truncate">
                            {currentSong.title || 'Loading...'}
                          </h2>
                          <button
                            onClick={() => {
                              setShowArtistInfo(true);
                              setIsMobileExpanded(false);
                            }}
                            className="text-xs sm:text-sm text-purple-400 font-bold uppercase tracking-widest hover:text-white transition-colors"
                          >
                            {currentSong.artist || 'Loading...'}
                          </button>
                        </div>

                        <div className="space-y-3 px-4">
                          <div
                            className="relative flex items-center group touch-none select-none w-full"
                            style={{ padding: "12px 0", pointerEvents: "auto" }}
                            onTouchStart={handleProgressTouchStart}
                            onTouchMove={handleProgressTouchMove}
                            onTouchEnd={handleProgressTouchEnd}
                            onClick={handleSeek}
                          >
                            <div className="relative w-full h-8 flex items-center">
                              <input
                                type="range"
                                min="0"
                                max={duration || 1}
                                step="0.1"
                                value={currentTime}
                                onChange={(e) => {
                                  const newTime = parseFloat(e.target.value);
                                  usePlayerStore.getState().seekTo(newTime);
                                }}
                                className="absolute inset-x-0 w-full h-full opacity-0 z-10 cursor-pointer pointer-events-auto"
                                style={{ pointerEvents: "auto" }}
                              />
                              <div className="w-full h-3.5 bg-white/10 rounded-full overflow-hidden relative border border-white/5">
                                <div
                                  className={cn(
                                    "h-full bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-400 relative transition-all duration-150",
                                    isPlaying && "playing-progress-bg",
                                  )}
                                  style={{
                                    width: `${(currentTime / (duration || 1)) * 100}%`,
                                  }}
                                />
                              </div>
                              <div
                                className="absolute w-8 h-8 bg-white rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)] border-4 border-purple-500 z-20 pointer-events-none transition-all opacity-100"
                                style={{
                                  left: `calc(${(currentTime / (duration || 1)) * 100}% - 16px)`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex justify-between text-[10px] font-mono font-black text-white/30 uppercase tracking-widest">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-6 sm:gap-10">
                          <motion.button
                            whileTap={{ scale: 0.8 }}
                            onClick={previous}
                            disabled={!hasPrev}
                            className={cn(
                              "text-white transition-all p-3 bg-white/5 rounded-full border border-white/5",
                              !hasPrev && "opacity-20",
                            )}
                          >
                            <SkipBack size={20} fill="currentColor" />
                          </motion.button>

                          {forwardBackward && (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={jumpBackward}
                              className="text-white transition-all p-3 bg-white/5 rounded-full border border-white/5"
                              title={`Jump backward ${fastForwardTime}`}
                            >
                              <RotateCcw size={20} />
                            </motion.button>
                          )}

                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={togglePlay}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-all active:scale-95"
                          >
                            {isPlaying ? (
                              <Pause size={24} fill="currentColor" />
                            ) : (
                              <Play
                                size={24}
                                fill="currentColor"
                                className="ml-1"
                              />
                            )}
                          </motion.button>

                          {forwardBackward && (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={jumpForward}
                              className="text-white transition-all p-3 bg-white/5 rounded-full border border-white/5"
                              title={`Jump forward ${fastForwardTime}`}
                            >
                              <RotateCw size={20} />
                            </motion.button>
                          )}

                          <motion.button
                            whileTap={{ scale: 0.8 }}
                            onClick={next}
                            disabled={!hasNext && repeatMode !== "all"}
                            className={cn(
                              "text-white transition-all p-3 bg-white/5 rounded-full border border-white/5",
                              !hasNext && repeatMode !== "all" && "opacity-20",
                            )}
                          >
                            <SkipForward size={20} fill="currentColor" />
                          </motion.button>
                        </div>

                        <div className="w-full mt-auto pt-6 space-y-4 shrink-0 pb-6 relative">
                          <AnimatePresence>
                            {showMobileAudioSettings && (
                              <motion.div
                                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                className="absolute bottom-[140px] left-0 right-0 w-full bg-[#0F0F12]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 shadow-2xl z-50 space-y-4 text-left"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase tracking-wider text-white">
                                    Crossfade
                                  </span>
                                  <button
                                    onClick={() =>
                                      setCrossfadeEnabled(!crossfadeEnabled)
                                    }
                                    className={cn(
                                      "w-10 h-6 rounded-full border transition-all p-0.5 flex items-center",
                                      crossfadeEnabled
                                        ? "bg-indigo-500 border-indigo-400"
                                        : "bg-white/5 border-white/10",
                                    )}
                                  >
                                    <motion.div
                                      animate={{ x: crossfadeEnabled ? 16 : 0 }}
                                      transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 30,
                                      }}
                                      className="w-4 h-4 rounded-full bg-white shadow-md"
                                    />
                                  </button>
                                </div>
                                {crossfadeEnabled && (
                                  <div className="space-y-3 pt-3 border-t border-white/5">
                                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-white/40">
                                      <span>Overlap</span>
                                      <span className="text-indigo-400 font-extrabold">
                                        {crossfadeDuration}s
                                      </span>
                                    </div>
                                    <div className="relative h-4 flex items-center group">
                                      <input
                                        type="range"
                                        min="1"
                                        max="12"
                                        step="0.5"
                                        value={crossfadeDuration}
                                        onChange={(e) =>
                                          setCrossfadeDuration(
                                            parseFloat(e.target.value),
                                          )
                                        }
                                        className="absolute inset-0 w-full h-full opacity-0 z-25 cursor-pointer"
                                      />
                                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                        <div
                                          className="h-full bg-indigo-500"
                                          style={{
                                            width: `${(crossfadeDuration / 12) * 100}%`,
                                          }}
                                        />
                                      </div>
                                      <div
                                        className="absolute w-3 h-3 bg-white rounded-full shadow-md pointer-events-none z-20 border-2 border-indigo-500"
                                        style={{
                                          left: `calc(${(crossfadeDuration / 12) * 100}% - 6px)`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="flex items-center justify-between px-2 pb-2 gap-4">
                            <button
                              onClick={() => setIsShuffle(!isShuffle)}
                              className={cn(
                                "p-3 flex-1 flex justify-center rounded-xl transition-all border",
                                isShuffle
                                  ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
                                  : "text-white/20 border-transparent hover:text-white/40 bg-white/[0.02]",
                              )}
                            >
                              <Shuffle size={18} />
                            </button>
                            <button
                              onClick={() => {
                                const modes: ("off" | "all" | "one")[] = [
                                  "off",
                                  "all",
                                  "one",
                                ];
                                setRepeatMode(
                                  modes[
                                    (modes.indexOf(repeatMode) + 1) %
                                      modes.length
                                  ],
                                );
                              }}
                              className={cn(
                                "p-3 flex-1 flex justify-center rounded-xl transition-all border relative",
                                repeatMode !== "off"
                                  ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                                  : "text-white/20 border-transparent hover:text-white/40 bg-white/[0.02]",
                              )}
                            >
                              <Repeat size={18} />
                              {repeatMode === "one" && (
                                <span className="absolute top-1 right-1/4 text-[10px] font-black text-indigo-400">
                                  1
                                </span>
                              )}
                            </button>
                          </div>

                          {/* Row 1: Volume Controller Slider */}
                          <div className="flex items-center justify-between w-full group px-4 py-3 bg-white/[0.02] rounded-2xl border border-transparent hover:border-white/10 transition-all shadow-lg hover:bg-white/[0.04]">
                            <Volume2
                              size={19}
                              className="text-white/30 group-hover:text-white transition-all group-hover:drop-shadow-[0_0_8px_white]"
                            />
                            <div className="flex-1 mx-4 h-1.5 bg-white/5 rounded-full relative cursor-pointer overflow-hidden border border-white/5">
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={(e) =>
                                  setVolume(parseFloat(e.target.value))
                                }
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-white/40 to-white group-hover:from-purple-600 group-hover:to-blue-400 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                style={{ width: `${volume * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono font-black text-white/30 w-6 text-right select-none">
                              {Math.round(volume * 100)}
                            </span>
                          </div>

                          {/* Row 2: Secondary Utility Modules */}
                          <div className="flex items-center justify-between w-full p-2 bg-white/[0.03] rounded-2xl border border-white/10 shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
                            <button
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => setShowEQ(!showEQ)}
                              className={cn(
                                "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                showEQ
                                  ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-105"
                                  : "text-white/30 hover:text-white hover:bg-white/5",
                              )}
                              title="Equalizer"
                            >
                              <SlidersHorizontal
                                size={20}
                                className={cn(
                                  showEQ &&
                                    "drop-shadow-[0_0_5px_currentColor]",
                                )}
                              />
                            </button>

                            <button
                              onClick={() => {
                                setShowMobileAudioSettings(
                                  !showMobileAudioSettings,
                                );
                              }}
                              className={cn(
                                "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                showMobileAudioSettings || crossfadeEnabled
                                  ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                                  : "text-white/30 hover:text-white hover:bg-white/5",
                              )}
                              title="Crossfade Engine"
                            >
                              <Waves
                                size={20}
                                className={cn(
                                  (showMobileAudioSettings ||
                                    crossfadeEnabled) &&
                                    "drop-shadow-[0_0_5px_currentColor]",
                                )}
                              />
                            </button>

                            <button
                              onClick={() => {
                                setNormalizationEnabled(!normalizationEnabled);
                              }}
                              className={cn(
                                "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                normalizationEnabled
                                  ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                                  : "text-white/30 hover:text-white hover:bg-white/5",
                              )}
                              title="Volume Normalization"
                            >
                              <Volume2
                                size={20}
                                className={cn(
                                  normalizationEnabled &&
                                    "drop-shadow-[0_0_5px_currentColor]",
                                )}
                              />
                            </button>

                            <button
                              onClick={() => {
                                if (
                                  !showLyrics &&
                                  currentSong &&
                                  (!currentSong.lyrics ||
                                    currentSong.lyrics.length === 0)
                                ) {
                                  autoFetchLyrics(
                                    currentSong.id,
                                    currentSong.artist,
                                    currentSong.title,
                                  );
                                }
                                setShowLyrics(!showLyrics);
                                setIsMobileExpanded(false);
                              }}
                              className={cn(
                                "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                showLyrics
                                  ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)] scale-105"
                                  : "text-white/30 hover:text-white hover:bg-white/5",
                              )}
                              title="Lyrics"
                            >
                              <Mic2
                                size={20}
                                className={cn(
                                  showLyrics &&
                                    "drop-shadow-[0_0_5px_currentColor]",
                                )}
                              />
                            </button>

                            <button
                              onClick={() => {
                                setShowNowPlaying(true);
                                setIsMobileExpanded(false);
                                setNowPlayingTab("queue");
                              }}
                              className={cn(
                                "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                showNowPlaying
                                  ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105"
                                  : "text-white/30 hover:text-white hover:bg-white/5",
                              )}
                              title="Fullscreen View"
                            >
                              <LayoutList
                                size={20}
                                className={cn(
                                  showNowPlaying &&
                                    "drop-shadow-[0_0_5px_currentColor]",
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}

          {/* Full Screen Immersive Mode */}
          {typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {isFullScreen && (
                  <motion.div
                    ref={fullScreenRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      zIndex: 100,
                      background: "#000",
                    }}
                    className={cn(
                      "fixed top-0 left-0 right-0 bottom-0 md:bottom-24 z-[100] bg-[#060608] flex flex-col items-center justify-start lg:justify-center px-4 py-4 lg:p-16 overflow-y-auto overflow-x-hidden select-none scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10",
                      isFullScreen ? "fullscreen-active" : "",
                    )}
                  >
                    {/* Background Art (Blur) */}
                    <div
                      className="absolute inset-0 z-0 scale-150 fixed pointer-events-none"
                      style={{
                        animation: "spin 20s linear infinite",
                        animationPlayState: !autoRotate
                          ? "paused"
                          : isPlaying
                            ? "running"
                            : "paused",
                      }}
                    >
                      <img
                        src={currentSong.thumbnail || undefined}
                        className="w-full h-full object-cover opacity-30 blur-[120px]"
                        alt=""
                      />
                    </div>

                    <button
                      onClick={toggleFullScreen}
                      className="fixed top-4 right-4 md:top-10 md:right-10 w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all z-50 group backdrop-blur-2xl"
                    >
                      <X className="text-white w-5 h-5 md:w-7 md:h-7 group-hover:scale-110 transition-transform" />
                    </button>

                    <div
                      onDoubleClick={toggleFullScreen}
                      className="relative z-10 w-full min-h-[min-content] lg:min-h-full flex flex-col justify-between px-0 sm:px-6 overflow-visible pt-16 pb-2 lg:py-6"
                    >
                      <div
                        style={{
                          transform: `translateX(${slideX})`,
                          transition: slideTransition,
                        }}
                        className="w-full min-h-full flex flex-col justify-between gap-8 lg:gap-0 items-center text-center py-2"
                      >
                        {/* Artwork Section */}
                        <motion.div
                          layoutId="full-art"
                          whileHover={{ scale: 1.02 }}
                          style={
                            isYTSource
                              ? {
                                  borderRadius: "50%",
                                }
                              : undefined
                          }
                          className={cn(
                            "overflow-hidden shadow-[0_30px_60px_-10px_rgba(0,0,0,0.8)] sm:shadow-[0_100px_180px_-40px_rgba(0,0,0,0.9)] border border-white/10 ring-1 ring-white/20 transition-all duration-700 shrink-0 flex items-center justify-center bg-black relative",
                            isYTSource
                              ? "w-full max-w-[280px] h-[280px] md:max-w-[340px] md:h-[340px] lg:max-w-[300px] lg:h-[300px] aspect-square rounded-full border-4 border-purple-500/20"
                              : "w-full max-w-[280px] h-[280px] md:max-w-[340px] md:h-[340px] lg:max-w-[300px] lg:h-[300px] aspect-square rounded-[2rem] sm:rounded-[3rem] lg:rounded-[4rem]",
                          )}
                        >
                          {isYTSource && currentSong ? (
                            <div className="w-full h-full relative select-none rounded-full overflow-hidden">
                              {/* Rotating Vinyl Wrapper */}
                              <div
                                className="rotating-vinyl-wrapper absolute inset-0 w-full h-full rounded-full overflow-hidden"
                                style={{
                                  animation: "spin-gpu 20s linear infinite",
                                  animationPlayState: !autoRotate
                                    ? "paused"
                                    : isPlaying
                                      ? "running"
                                      : "paused",
                                  willChange: "transform",
                                  transform: "translate3d(0, 0, 0)",
                                }}
                              >
                                <iframe
                                  key={extractYoutubeVideoIdFromString(
                                    currentSong.sourceId || currentSong.id,
                                  )}
                                  src={`https://www.youtube.com/embed/${extractYoutubeVideoIdFromString(currentSong.sourceId || currentSong.id)}?autoplay=${isPlaying ? 1 : 0}&controls=0&mute=${volume > 0 ? 0 : 1}&playsinline=1&enablejsapi=1&start=${iframeStartVal}&rel=0&showinfo=0&modestbranding=1`}
                                  className="absolute inset-[0] w-full h-full border-0 rounded-full pointer-events-none"
                                  style={{
                                    scale: "1.35",
                                    willChange: "transform",
                                    transform: "translate3d(0, 0, 0)",
                                  }}
                                  allow="autoplay; encrypted-media"
                                />
                              </div>
                              {/* Hardware accelerated overlay */}
                              <div
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: "50%",
                                  pointerEvents: "none",
                                  zIndex: 10,
                                  background:
                                    "conic-gradient(from 0deg, rgba(255,255,255,0.1) 0%, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%, rgba(255,255,255,0.1) 100%)",
                                  boxShadow:
                                    "inset 0 0 30px rgba(0,0,0,0.4), inset 0 0 100px rgba(0,0,0,0.2)",
                                  animation: "spin-gpu 20s linear infinite",
                                  animationPlayState: !autoRotate
                                    ? "paused"
                                    : isPlaying
                                      ? "running"
                                      : "paused",
                                  willChange: "transform",
                                  transform: "translate3d(0, 0, 0)",
                                }}
                                className="border border-white/10 ring-1 ring-white/5"
                              />
                              {/* Centered Spindle core */}
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="w-[15%] h-[15%] rounded-full bg-black border-2 border-white/20 shadow-inner flex items-center justify-center">
                                  <div className="w-[30%] h-[30%] rounded-full bg-zinc-900" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={currentSong.thumbnail || undefined}
                              className="w-full h-full object-cover"
                              alt={currentSong.title}
                            />
                          )}
                        </motion.div>

                        {/* Info & Controls Section */}
                        <div className="flex-1 w-full flex flex-col justify-end text-center space-y-3 sm:space-y-4 max-w-4xl h-auto max-h-none overflow-visible mb-2">
                          <div className="space-y-3 sm:space-y-6 text-center">
                            <motion.div
                              initial={{ y: 40, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.1 }}
                              className="space-y-2 sm:space-y-4"
                            >
                              <h1 className="text-3xl md:text-5xl font-bold text-center tracking-tight text-white leading-tight">
                                {currentSong
                                  ? decodeHtmlEntities(currentSong.title)
                                  : ""}
                              </h1>
                              <div className="flex items-center justify-center gap-4 sm:gap-6">
                                <button
                                  onClick={() => {
                                    setShowArtistInfo(true);
                                    toggleFullScreen();
                                  }}
                                  className="text-sm sm:text-lg lg:text-3xl xl:text-4xl text-purple-400 font-bold uppercase tracking-[0.25em] hover:text-white transition-all hover:translate-x-2"
                                >
                                  {currentSong.artist || 'Loading...'}
                                </button>
                                <LikeButton
                                  targetId={currentSong.id}
                                  type="song"
                                  size={24}
                                />
                              </div>
                            </motion.div>
                          </div>

                          {/* Player controls view - hidden on desktop immersive view to avoid duplicate controls with the persistent player bar */}
                          <div className="w-full flex md:hidden flex-col space-y-4">
                            {/* Progress */}
                            <div className="space-y-3 sm:space-y-6 w-full">
                              <div className="flex justify-between text-[10px] sm:text-sm font-mono font-black text-white/40 uppercase tracking-[0.2em] sm:tracking-[0.4em]">
                                <span>{formatTime(currentTime)}</span>
                                {(!duration ||
                                  duration === Infinity ||
                                  (currentSong?.source === "youtube" &&
                                    duration === 0)) &&
                                !(
                                  currentSong?.source === "youtube" &&
                                  /^[a-zA-Z0-9_-]{11}$/.test(
                                    extractYoutubeVideoIdFromString(
                                      currentSong.sourceId || currentSong.id,
                                    ),
                                  )
                                ) ? (
                                  <div className="flex items-center gap-1.5 sm:gap-2 text-purple-400/50">
                                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                    LIVE SIGNAL
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 sm:gap-2 text-cyan-400/70">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    TRACK SEQUENCE
                                  </div>
                                )}
                                <span>{formatTime(duration)}</span>
                              </div>
                              <div
                                className="relative flex items-center group touch-none select-none w-full"
                                style={{
                                  padding: "12px 0",
                                  pointerEvents: "auto",
                                }}
                                onTouchStart={handleProgressTouchStart}
                                onTouchMove={handleProgressTouchMove}
                                onTouchEnd={handleProgressTouchEnd}
                                onClick={handleSeek}
                              >
                                <div className="relative w-full h-4 flex items-center">
                                  <input
                                    type="range"
                                    min="0"
                                    max={duration || 1}
                                    step="0.1"
                                    value={currentTime}
                                    onChange={(e) => {
                                      const newTime = parseFloat(
                                        e.target.value,
                                      );
                                      usePlayerStore.getState().seekTo(newTime);
                                    }}
                                    className="absolute inset-x-0 w-full h-full opacity-0 z-10 cursor-pointer pointer-events-auto"
                                    style={{ pointerEvents: "auto" }}
                                  />
                                  <div className="w-full h-1.5 sm:h-2 bg-white/5 rounded-full overflow-hidden backdrop-blur-md border border-white/5">
                                    <div
                                      className={cn(
                                        "h-full bg-gradient-to-r from-purple-600 via-pink-500 to-white shadow-[0_0_20px_rgba(168,85,247,0.5)]",
                                        isPlaying && "playing-progress-bg",
                                      )}
                                      style={{
                                        width: `${(currentTime / (duration || 1)) * 100}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Main Controls - Responsive size */}
                            <div className="flex items-center justify-center lg:justify-start gap-8 sm:gap-16">
                              <button
                                onClick={previous}
                                disabled={!hasPrev}
                                className={cn(
                                  "text-white/40 hover:text-white transition-all hover:scale-125 active:scale-90 p-2 sm:p-4 bg-white/5 rounded-full border border-white/5",
                                  !hasPrev && "opacity-0",
                                )}
                              >
                                <SkipBack
                                  className="w-6 h-6 sm:w-10 sm:h-10 lg:w-12 lg:h-12"
                                  fill="currentColor"
                                />
                              </button>

                              <button
                                onClick={togglePlay}
                                className="w-16 h-16 sm:w-28 sm:h-28 lg:w-40 lg:h-40 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.15)] lg:shadow-[0_0_120px_rgba(255,255,255,0.15)] hover:scale-110 active:scale-95 transition-all relative group/play"
                              >
                                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-transparent opacity-0 group-hover/play:opacity-100 transition-opacity rounded-full" />
                                {isPlaying ? (
                                  <Pause
                                    className="w-6 h-6 sm:w-10 sm:h-10 lg:w-16 lg:h-16"
                                    fill="currentColor"
                                  />
                                ) : (
                                  <Play
                                    className="w-6 h-6 sm:w-10 sm:h-10 lg:w-16 lg:h-16 ml-1 sm:ml-2.5"
                                    fill="currentColor"
                                  />
                                )}
                              </button>

                              <button
                                onClick={next}
                                disabled={!hasNext && repeatMode !== "all"}
                                className={cn(
                                  "text-white/40 hover:text-white transition-all hover:scale-125 active:scale-90 p-2 sm:p-4 bg-white/5 rounded-full border border-white/5",
                                  !hasNext &&
                                    repeatMode !== "all" &&
                                    "opacity-0",
                                )}
                              >
                                <SkipForward
                                  className="w-6 h-6 sm:w-10 sm:h-10 lg:w-12 lg:h-12"
                                  fill="currentColor"
                                />
                              </button>
                            </div>

                            <div className="w-full space-y-4 relative px-0 sm:px-2 mb-2">
                              {/* Row 1: Volume Controller Slider */}
                              <div className="flex items-center justify-between w-full group px-4 py-3 bg-white/[0.02] rounded-2xl border border-transparent hover:border-white/10 transition-all shadow-lg hover:bg-white/[0.04]">
                                <Volume2
                                  size={19}
                                  className="text-white/30 group-hover:text-white transition-all group-hover:drop-shadow-[0_0_8px_white]"
                                />
                                <div className="flex-1 mx-4 h-1.5 bg-white/5 rounded-full relative cursor-pointer overflow-hidden border border-white/5">
                                  <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={volume}
                                    onChange={(e) =>
                                      setVolume(parseFloat(e.target.value))
                                    }
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  />
                                  <div
                                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 via-pink-500 to-white group-hover:from-purple-600 group-hover:to-blue-400 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                    style={{ width: `${volume * 100}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono font-black text-white/30 w-6 text-right select-none">
                                  {Math.round(volume * 100)}
                                </span>
                              </div>

                              {/* Row 2: Secondary Utility Modules */}
                              <div className="flex items-center justify-between w-full p-2 bg-white/[0.03] rounded-2xl border border-white/10 shadow-[0_5px_15px_rgba(0,0,0,0.3)]">
                                <button
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={() => setShowEQ(!showEQ)}
                                  className={cn(
                                    "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                    showEQ
                                      ? "bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-105"
                                      : "text-white/30 hover:text-white hover:bg-white/5",
                                  )}
                                  title="Equalizer"
                                >
                                  <SlidersHorizontal
                                    size={20}
                                    className={cn(
                                      showEQ &&
                                        "drop-shadow-[0_0_5px_currentColor]",
                                    )}
                                  />
                                </button>

                                <button
                                  onClick={() => {
                                    setShowDesktopCrossfade(
                                      !showDesktopCrossfade,
                                    );
                                    setShowDesktopNormalization(false);
                                  }}
                                  className={cn(
                                    "desktop-settings-trigger p-3 flex-1 flex items-center justify-center rounded-xl transition-all relative",
                                    crossfadeEnabled
                                      ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                                      : "text-white/30 hover:text-white hover:bg-white/5",
                                  )}
                                  title="Crossfade Engine"
                                >
                                  <Waves
                                    size={20}
                                    className={cn(
                                      crossfadeEnabled &&
                                        "drop-shadow-[0_0_5px_currentColor]",
                                    )}
                                  />
                                </button>

                                <button
                                  onClick={() => {
                                    setNormalizationEnabled(
                                      !normalizationEnabled,
                                    );
                                  }}
                                  className={cn(
                                    "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                    normalizationEnabled
                                      ? "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105"
                                      : "text-white/30 hover:text-white hover:bg-white/5",
                                  )}
                                  title="Volume Normalization"
                                >
                                  <Volume2
                                    size={20}
                                    className={cn(
                                      normalizationEnabled &&
                                        "drop-shadow-[0_0_5px_currentColor]",
                                    )}
                                  />
                                </button>

                                <button
                                  onClick={() => {
                                    if (
                                      !showLyrics &&
                                      currentSong &&
                                      (!currentSong.lyrics ||
                                        currentSong.lyrics.length === 0)
                                    ) {
                                      autoFetchLyrics(
                                        currentSong.id,
                                        currentSong.artist,
                                        currentSong.title,
                                      );
                                    }
                                    setShowLyrics(!showLyrics);
                                  }}
                                  className={cn(
                                    "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                    showLyrics
                                      ? "bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)] scale-105"
                                      : "text-white/30 hover:text-white hover:bg-white/5",
                                  )}
                                  title="Lyrics"
                                >
                                  <Mic2
                                    size={20}
                                    className={cn(
                                      showLyrics &&
                                        "drop-shadow-[0_0_5px_currentColor]",
                                    )}
                                  />
                                </button>

                                <button
                                  onClick={() =>
                                    setShowNowPlaying(!showNowPlaying)
                                  }
                                  className={cn(
                                    "p-3 flex-1 flex items-center justify-center rounded-xl transition-all",
                                    showNowPlaying
                                      ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105"
                                      : "text-white/30 hover:text-white hover:bg-white/5",
                                  )}
                                  title="Fullscreen View"
                                >
                                  <LayoutList
                                    size={20}
                                    className={cn(
                                      showNowPlaying &&
                                        "drop-shadow-[0_0_5px_currentColor]",
                                    )}
                                  />
                                </button>
                              </div>
                              <AnimatePresence>
                                {showDesktopCrossfade && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                                    className="desktop-settings-menu absolute bottom-[100px] left-0 right-0 mx-4 bg-[#0F0F12]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-5 shadow-2xl z-[200] space-y-4 text-left"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-black uppercase tracking-wider text-white">
                                        Crossfade
                                      </span>
                                      <button
                                        onClick={() =>
                                          setCrossfadeEnabled(!crossfadeEnabled)
                                        }
                                        className={cn(
                                          "w-10 h-6 rounded-full border transition-all p-0.5 flex items-center",
                                          crossfadeEnabled
                                            ? "bg-indigo-500 border-indigo-400"
                                            : "bg-white/5 border-white/10",
                                        )}
                                      >
                                        <motion.div
                                          animate={{
                                            x: crossfadeEnabled ? 16 : 0,
                                          }}
                                          transition={{
                                            type: "spring",
                                            stiffness: 500,
                                            damping: 30,
                                          }}
                                          className="w-4 h-4 rounded-full bg-white shadow-md"
                                        />
                                      </button>
                                    </div>
                                    {crossfadeEnabled && (
                                      <div className="space-y-3 pt-3 border-t border-white/5">
                                        <div className="flex items-center justify-between text-[10px] font-mono font-bold text-white/40">
                                          <span>Overlap</span>
                                          <span className="text-indigo-400 font-extrabold">
                                            {crossfadeDuration}s
                                          </span>
                                        </div>
                                        <div className="relative h-4 flex items-center group">
                                          <input
                                            type="range"
                                            min="1"
                                            max="12"
                                            step="0.5"
                                            value={crossfadeDuration}
                                            onChange={(e) =>
                                              setCrossfadeDuration(
                                                parseFloat(e.target.value),
                                              )
                                            }
                                            className="absolute inset-0 w-full h-full opacity-0 z-25 cursor-pointer"
                                          />
                                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                            <div
                                              className="h-full bg-indigo-500"
                                              style={{
                                                width: `${(crossfadeDuration / 12) * 100}%`,
                                              }}
                                            />
                                          </div>
                                          <div
                                            className="absolute w-3 h-3 bg-white rounded-full shadow-md pointer-events-none z-20 border-2 border-indigo-500"
                                            style={{
                                              left: `calc(${(crossfadeDuration / 12) * 100}% - 6px)`,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}

          {/* Now Playing Prominent View */}
          {typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {showNowPlaying && (
                  <motion.div
                    initial={{ opacity: 0, x: "100%" }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-y-0 right-0 w-[450px] bg-[#0F0F12] border-l border-white/5 z-[99999] shadow-2xl p-8 flex flex-col pt-24"
                  >
                    <button
                      onClick={() => setShowNowPlaying(false)}
                      className="absolute top-8 left-8 text-white/30 hover:text-white transition-colors"
                    >
                      <X size={24} />
                    </button>

                    <div className="flex bg-white/5 rounded-full p-1 mb-12">
                      <button
                        onClick={() => setNowPlayingTab("playing")}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                          nowPlayingTab === "playing"
                            ? "bg-white text-black"
                            : "text-white/40 hover:text-white",
                        )}
                      >
                        Now Playing
                      </button>
                      <button
                        onClick={() => setNowPlayingTab("queue")}
                        className={cn(
                          "flex-1 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                          nowPlayingTab === "queue"
                            ? "bg-white text-black"
                            : "text-white/40 hover:text-white",
                        )}
                      >
                        Queue ({queue.length})
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      {nowPlayingTab === "playing" ? (
                        <motion.div
                          key="playing"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex-1 flex flex-col justify-center gap-12"
                        >
                          <div
                            onClick={toggleFullScreen}
                            className="relative aspect-square w-full rounded-[2.5rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 ring-1 ring-white/10 cursor-pointer group/art-thumb"
                            title="Click to expand to full screen"
                          >
                            <img
                              src={currentSong.thumbnail || undefined}
                              alt={currentSong.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as any).src =
                                  "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop";
                              }}
                            />
                          </div>

                          <div className="space-y-6">
                            <div className="space-y-4">
                              <h2 className="text-4xl font-black italic tracking-tighter text-white leading-tight">
                                {currentSong.title || 'Loading...'}
                              </h2>
                              <button
                                onClick={() => setShowArtistInfo(true)}
                                className="text-xl text-purple-400 font-bold uppercase tracking-widest hover:text-white transition-colors"
                              >
                                {currentSong.artist || 'Loading...'}
                              </button>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-[10px] font-mono font-black text-white/40 tracking-[0.2em]">
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                              </div>
                              <div
                                className="relative flex items-center group touch-none select-none w-full"
                                style={{
                                  padding: "12px 0",
                                  pointerEvents: "auto",
                                }}
                                onTouchStart={handleProgressTouchStart}
                                onTouchMove={handleProgressTouchMove}
                                onTouchEnd={handleProgressTouchEnd}
                                onClick={handleSeek}
                              >
                                <div className="relative w-full h-2 flex items-center">
                                  <input
                                    type="range"
                                    min="0"
                                    max={duration || 1}
                                    step="0.1"
                                    value={currentTime}
                                    onChange={(e) => {
                                      const newTime = parseFloat(
                                        e.target.value,
                                      );
                                      usePlayerStore.getState().seekTo(newTime);
                                    }}
                                    className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10 pointer-events-auto"
                                    style={{ pointerEvents: "auto" }}
                                  />
                                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                                    <div
                                      className={cn(
                                        "h-full bg-purple-500 relative transition-all duration-100 group-hover:bg-purple-400",
                                        isPlaying && "playing-progress-bg",
                                      )}
                                      style={{
                                        width: `${(currentTime / (duration || 1)) * 100}%`,
                                      }}
                                    />
                                  </div>
                                  <div
                                    className={cn(
                                      "absolute w-4 h-4 bg-white rounded-full shadow-2xl transition-all pointer-events-none z-20 border-4 border-purple-500",
                                      isPlaying
                                        ? "opacity-100 playing-progress-handle"
                                        : "opacity-100 block",
                                    )}
                                    style={{
                                      left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "px-2 py-0.5 rounded-full flex items-center justify-center",
                                  currentSong.source === "youtube"
                                    ? "bg-[#FF0000]"
                                    : currentSong.source === "spotify"
                                      ? "bg-[#1DB954]"
                                      : "bg-white/5 border border-white/10",
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider",
                                    currentSong.source === "youtube" ||
                                      currentSong.source === "spotify"
                                      ? "text-white"
                                      : "text-white/40",
                                  )}
                                >
                                  {currentSong.source === "youtube"
                                    ? "YOUTUBE"
                                    : currentSong.source === "spotify"
                                      ? "SPOTIFY"
                                      : `${currentSong.source} SIGNAL`}
                                </span>
                              </div>
                              {currentSong.duration && (
                                <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                                    {formatTime(currentSong.duration)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 mt-auto">
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] mb-4">
                              Acoustic fingerprint
                            </p>
                            <div className="flex items-end gap-1 h-12">
                              {[...Array(24)].map((_, i) => (
                                <motion.div
                                  key={i}
                                  animate={{
                                    height: isPlaying
                                      ? [10, 48, 15, 30, 10]
                                      : 10,
                                  }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 1.5,
                                    delay: i * 0.05,
                                  }}
                                  className="flex-1 bg-purple-500/30 rounded-t-full"
                                />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="queue"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex-1 flex flex-col overflow-hidden"
                        >
                          <div className="mb-6 flex items-center justify-between px-1">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
                              Up Next
                            </p>
                            <button
                              onClick={shuffleQueue}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-95 group/shuffle"
                              title="Shuffle Queue"
                            >
                              <Shuffle
                                size={12}
                                className="group-hover/shuffle:rotate-12 transition-transform"
                              />
                              <span className="text-[8px] font-black uppercase tracking-widest">
                                Shuffle
                              </span>
                            </button>
                          </div>
                          <Reorder.Group
                            axis="y"
                            values={queue}
                            onReorder={setQueue}
                            className="flex-1 overflow-y-auto space-y-2 pr-2 scroll-hide"
                          >
                            {queue.map((song, index) => {
                              const isCurrent = currentSong?.id === song.id;
                              // The "next up" is simply the item immediately following the current song in the queue array.
                              const currentLocIdx = queue.findIndex(s => s.id === currentSong?.id);
                              const isNext = currentLocIdx !== -1 && index === currentLocIdx + 1;

                              return (
                                <QueueItem
                                  key={`${song.id}-${index}`}
                                  song={song}
                                  isCurrent={isCurrent}
                                  isNext={isNext}
                                  setSong={setSong}
                                  removeFromQueue={removeFromQueue}
                                />
                              )
                            })}
                          </Reorder.Group>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}

          {/* Device Sync Progress Overlay */}
          {typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {isScanningDevice && (
                  <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="fixed bottom-32 right-8 bg-[#0F0F12]/90 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 z-[9999]"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20" />
                      <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[8px] font-black italic text-indigo-400">
                          {scanningProgress.total > 0
                            ? Math.round(
                                (scanningProgress.current /
                                  scanningProgress.total) *
                                  100,
                              )
                            : "..."}
                          %
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                        Syncing Local Files
                      </p>
                      <p className="text-[10px] text-zinc-500 font-bold">
                        {scanningProgress.total > 0
                          ? `PROCESSED ${scanningProgress.current} OF ${scanningProgress.total} TRACKS`
                          : "PREPARING SCAN..."}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}

          {/* Lyrics Overlay */}
          {typeof document !== "undefined" &&
            createPortal(
              <AnimatePresence>
                {showLyrics && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[99999] bg-black/20 flex flex-col justify-end"
                  >
                    <div
                      className="absolute inset-0 z-0 bg-transparent"
                      onClick={() => setShowLyrics(false)}
                    />

                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{
                        type: "spring",
                        damping: 25,
                        stiffness: 200,
                      }}
                      className={cn(
                        "relative z-10 w-full bg-[#0A0A0C] flex flex-col overflow-hidden justify-between p-4 border-t border-white/10 shadow-[0_-20px_80px_rgba(0,0,0,0.8)] transition-all duration-500",
                        isLyricsMaximized
                          ? "h-full max-h-[100vh] rounded-none"
                          : "h-full max-h-[50vh] rounded-t-[40px]",
                      )}
                    >
                      {/* Background Atmosphere */}
                      <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />

                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-3 z-50">
                        {/* Left Side: Settings & Edit */}
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() =>
                              setIsLyricsSettingsOpen(!isLyricsSettingsOpen)
                            }
                            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/50 hover:text-white"
                            title="Settings"
                          >
                            <Settings size={20} />
                          </button>
                          {!showLyricsEditor && (
                            <button
                              onClick={() => setShowLyricsEditor(true)}
                              className="px-6 h-12 rounded-full bg-white/5 border border-white/10 flex items-center gap-2 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest italic text-white"
                            >
                              <Mic2 size={16} />
                              <span className="hidden sm:inline">
                                Edit Lyrics
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Center Side: Lyrics Keyword Search Bar */}
                        {!showLyricsEditor && (
                          <div className="flex-1 max-w-xs md:max-w-md mx-2 md:mx-4 relative">
                            <div className="relative flex items-center bg-white/5 hover:bg-white/10 hover:border-white/20 focus-within:bg-white/10 focus-within:border-white/30 border border-white/10 rounded-full h-12 px-4 transition-all w-full pr-2">
                              <Search
                                size={18}
                                className="text-white/40 shrink-0"
                              />
                              <input
                                type="text"
                                value={lyricsSearchQuery}
                                onChange={(e) => {
                                  setLyricsSearchQuery(e.target.value);
                                  setActiveSearchMatchIndex(0);
                                }}
                                placeholder="Search keywords..."
                                className="w-full bg-transparent border-0 outline-none text-white text-sm placeholder-white/30 px-2 select-text"
                              />
                              {lyricsSearchQuery.trim() && (
                                <div className="flex items-center gap-1 shrink-0 ml-1">
                                  <span className="text-[10px] font-mono tracking-tight text-white/50 bg-white/10 px-2 py-0.5 rounded mr-1">
                                    {matchedLyricsIndices.length > 0
                                      ? `${activeSearchMatchIndex + 1}/${matchedLyricsIndices.length}`
                                      : "0"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (matchedLyricsIndices.length > 0) {
                                        setActiveSearchMatchIndex(
                                          (prev) =>
                                            (prev -
                                              1 +
                                              matchedLyricsIndices.length) %
                                            matchedLyricsIndices.length,
                                        );
                                      }
                                    }}
                                    disabled={matchedLyricsIndices.length === 0}
                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                                    title="Previous Match"
                                  >
                                    <ChevronUp size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (matchedLyricsIndices.length > 0) {
                                        setActiveSearchMatchIndex(
                                          (prev) =>
                                            (prev + 1) %
                                            matchedLyricsIndices.length,
                                        );
                                      }
                                    }}
                                    disabled={matchedLyricsIndices.length === 0}
                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
                                    title="Next Match"
                                  >
                                    <ChevronDown size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLyricsSearchQuery("");
                                      setActiveSearchMatchIndex(0);
                                    }}
                                    className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all ml-0.5"
                                    title="Clear search"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Right Side: Maximize & Close */}
                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() =>
                              setIsLyricsMaximized(!isLyricsMaximized)
                            }
                            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/50 hover:text-white"
                            title={isLyricsMaximized ? "Minimize" : "Maximize"}
                          >
                            <Maximize2 size={18} />
                          </button>
                          <button
                            onClick={() => setShowLyrics(false)}
                            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-white/50 hover:text-white overflow-hidden"
                            title="Close"
                          >
                            <X size={20} />
                          </button>
                        </div>
                      </div>

                      <motion.div
                        animate={{ x: showLyricsEditor ? "-100%" : 0 }}
                        className="relative w-full h-full mx-auto max-w-4xl flex flex-col z-10 pt-16"
                      >
                        <LyricsViewer
                          lyrics={currentSong?.lyrics || []}
                          currentTime={currentTime}
                          duration={duration}
                          onSeek={(time) =>
                            usePlayerStore.getState().seekTo(time)
                          }
                          accentColor={accentColor}
                          isSettingsOpen={isLyricsSettingsOpen}
                          onCloseSettings={() => setIsLyricsSettingsOpen(false)}
                          onEditLyrics={() => setShowLyricsEditor(true)}
                          searchQuery={lyricsSearchQuery}
                          matchedIndices={matchedLyricsIndices}
                          activeSearchMatchIndex={activeSearchMatchIndex}
                        />
                      </motion.div>

                      <AnimatePresence>
                        {showLyricsEditor && (
                          <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            className="fixed inset-y-0 right-0 w-full lg:w-1/2 z-[60]"
                          >
                            <LyricsEditor
                              onClose={() => setShowLyricsEditor(false)}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}
          <ArtistDetails
            artistName={currentSong.artist || 'Loading...'}
            isOpen={showArtistInfo}
            onClose={() => setShowArtistInfo(false)}
          />
          <AnimatePresence>
            {showEQ && (
              <EqualizerControls
                onClose={() => setShowEQ(false)}
                analyser={analyserRef.current}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function QueueItem({
  song,
  isCurrent,
  isNext,
  setSong,
  removeFromQueue,
}: {
  song: Song;
  isCurrent: boolean;
  isNext: boolean;
  setSong: (song: Song) => void;
  removeFromQueue: (id: string) => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={song}
      dragListener={false}
      dragControls={dragControls}
      onClick={() => {
        if (!isCurrent) {
          setSong(song);
        }
      }}
      className={cn(
        "group flex items-center gap-4 p-3 rounded-2xl border transition-all relative cursor-pointer",
        isCurrent
          ? "bg-white/5 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.1)]"
          : isNext
            ? "bg-white/5 border-blue-500/20"
            : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]",
      )}
    >
      <div className="flex items-center gap-1 shrink-0">
        <div
          className="text-white/10 group-hover:text-white/30 transition-colors p-1 cursor-grab active:cursor-grabbing hover:bg-white/5 rounded-lg pointer-events-auto"
          onPointerDown={(e) => dragControls.start(e)}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </div>
        <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden flex items-center justify-center bg-white/5">
          <img
            src={song.thumbnail || undefined}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
          {isCurrent && (
            <div className="absolute inset-0 bg-purple-600/40 flex items-center justify-center pointer-events-none z-10">
              <div className="flex items-baseline gap-0.5">
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [4, 12, 4] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.5,
                      delay: i * 0.1,
                    }}
                    className="w-1 bg-white rounded-full"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 pr-2 pointer-events-none">
        <div className="flex items-center gap-2 mb-0.5">
          <h4
            className={cn(
              "text-sm font-bold truncate",
              isCurrent
                ? "text-purple-400"
                : isNext
                  ? "text-blue-400"
                  : "text-white",
            )}
          >
            {song.title}
          </h4>
          {isCurrent && (
            <div className="flex items-center justify-center shrink-0 w-3 h-3 bg-purple-500/20 rounded-full">
              <div className="flex items-end gap-[1px] h-1.5">
                <motion.div animate={{ height: ["20%", "80%", "30%", "60%", "20%"] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-0.5 bg-purple-400" />
                <motion.div animate={{ height: ["50%", "30%", "90%", "40%", "50%"] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-0.5 bg-purple-400" />
                <motion.div animate={{ height: ["30%", "70%", "20%", "80%", "30%"] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-0.5 bg-purple-400" />
              </div>
            </div>
          )}
          {isCurrent && (
            <span className="px-1.5 py-0.5 rounded bg-purple-500 text-[6px] font-black uppercase text-white tracking-[0.2em] shrink-0">
              Current
            </span>
          )}
          {isNext && (
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-[6px] font-black uppercase text-blue-400 border border-blue-500/30 tracking-[0.2em] shrink-0">
              Next Up
            </span>
          )}
        </div>
        <p className="text-[10px] text-white/40 uppercase font-medium tracking-wider truncate">
          {song.artist}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-100 block transition-opacity z-10 relative pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeFromQueue(song.id);
          }}
          className="p-2 text-zinc-600 hover:text-red-500 transition-colors bg-white/5 hover:bg-white/10 rounded-lg"
          title="Remove"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Reorder.Item>
  );
}

function getAccentTextColor(accentColor: string) {
  switch (accentColor) {
    case "Blue":
      return "text-blue-500";
    case "Emerald":
      return "text-emerald-500";
    case "Sunset":
      return "text-orange-500";
    case "Rose":
      return "text-rose-500";
    case "Purple":
    default:
      return "text-purple-500";
  }
}

function getAccentDecorationColor(accentColor: string) {
  switch (accentColor) {
    case "Blue":
      return "decoration-blue-500";
    case "Emerald":
      return "decoration-emerald-500";
    case "Sunset":
      return "decoration-orange-500";
    case "Rose":
      return "decoration-rose-500";
    case "Purple":
    default:
      return "decoration-purple-500";
  }
}

function LyricsViewer({
  lyrics,
  currentTime,
  duration,
  onSeek,
  accentColor,
  isSettingsOpen,
  onCloseSettings,
  onEditLyrics,
  searchQuery = "",
  matchedIndices = [],
  activeSearchMatchIndex = -1,
}: {
  lyrics: LyricLine[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  accentColor: string;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  onEditLyrics?: () => void;
  searchQuery?: string;
  matchedIndices?: number[];
  activeSearchMatchIndex?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Settings State
  const {
    lyricsFontSizeMult: fontSizeMult,
    setLyricsFontSizeMult: setFontSizeMult,
    lyricsColor,
    setLyricsColor,
    lyricsAlign: align,
    setLyricsAlign: setAlign,
    lyricsIsItalic: isItalic,
    setLyricsIsItalic: setIsItalic,
    lyricsFontWeight: fontWeight,
    setLyricsFontWeight: setFontWeight,
    lyricsSyncOffset: syncOffset,
    setLyricsSyncOffset: setSyncOffset,
    desktopLyrics: isDesktopLyrics,
    setDesktopLyrics: setIsDesktopLyrics,
    lyricsBackdropEnabled,
    setLyricsBackdropEnabled,
    lyricsBackdropBlur,
    setLyricsBackdropBlur,
    lyricsTextStyle,
    setLyricsTextStyle,
  } = usePlayerStore();

  const LYRICS_COLORS = [
    { name: "Red", value: "#ef4444" },
    { name: "Green", value: "#22c55e" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Yellow", value: "#eab308" },
    { name: "Orange", value: "#f97316" },
    { name: "White", value: "#ffffff" },
  ];

  // Lookahead buffer to make lyrics highlight line up with audio better + user manual sync offset
  const effectiveTime = currentTime + 0.2 + syncOffset;

  const parsedLyrics = useMemo(() => {
    if (!lyrics) return [];

    return lyrics.map((line, i) => {
      const nextTime = lyrics[i + 1]?.time || duration || line.time + 5;
      const lineDuration = nextTime - line.time;

      const words = line.text.split(/(\s+)/);
      const totalChars = words
        .filter((w) => w.trim().length > 0)
        .join("").length;

      let currentWordTime = line.time;
      const parsedWords = words.map((word) => {
        if (word.trim().length === 0) {
          return {
            text: word,
            startTime: currentWordTime,
            endTime: currentWordTime,
            isSpace: true,
          };
        } else {
          const wordDuration =
            (word.length / Math.max(1, totalChars)) * lineDuration;
          const w = {
            text: word,
            startTime: currentWordTime,
            endTime: currentWordTime + wordDuration,
            isSpace: false,
          };
          currentWordTime += wordDuration;
          return w;
        }
      });

      return {
        ...line,
        words: parsedWords,
      };
    });
  }, [lyrics, duration]);

  const activeLineIndex = useMemo(() => {
    return parsedLyrics.findIndex((line, i) => {
      return (
        line.time > 0 &&
        effectiveTime >= line.time &&
        (i === parsedLyrics.length - 1 ||
          effectiveTime < parsedLyrics[i + 1].time)
      );
    });
  }, [parsedLyrics, effectiveTime]);

  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const isProgrammaticScroll = useRef(false);
  const programScrollTimeout = useRef<NodeJS.Timeout | null>(null);

  const scrollToActiveLine = useCallback(
    (force = false) => {
      if (!containerRef.current || activeLineIndex === -1) return;
      if (!autoScrollEnabled && !force) return;

      const activeLine =
        containerRef.current.querySelector(".active-lyric-line");
      if (activeLine) {
        isProgrammaticScroll.current = true;
        if (programScrollTimeout.current) {
          clearTimeout(programScrollTimeout.current);
        }
        activeLine.scrollIntoView({ behavior: "smooth", block: "center" });
        programScrollTimeout.current = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 800);
      }
    },
    [activeLineIndex, autoScrollEnabled],
  );

  // Handle active line changes
  useEffect(() => {
    scrollToActiveLine();
  }, [activeLineIndex, scrollToActiveLine]);

  useEffect(() => {
    return () => {
      if (programScrollTimeout.current) {
        clearTimeout(programScrollTimeout.current);
      }
    };
  }, []);

  const handleReturnToActive = () => {
    setAutoScrollEnabled(true);
    setTimeout(() => {
      scrollToActiveLine(true);
    }, 50);
  };

  // Scroll to active search match
  useEffect(() => {
    if (matchedIndices.length === 0 || activeSearchMatchIndex === -1) return;
    const targetIndex = matchedIndices[activeSearchMatchIndex];
    if (targetIndex === undefined) return;

    setAutoScrollEnabled(false);

    const lineElement = containerRef.current?.querySelector(
      `[data-lyric-index="${targetIndex}"]`,
    );
    if (lineElement) {
      isProgrammaticScroll.current = true;
      if (programScrollTimeout.current) {
        clearTimeout(programScrollTimeout.current);
      }
      lineElement.scrollIntoView({ behavior: "smooth", block: "center" });
      programScrollTimeout.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 800);
    }
  }, [matchedIndices, activeSearchMatchIndex]);

  const alignmentClass =
    align === "center"
      ? "text-center origin-center"
      : align === "right"
        ? "text-right origin-right"
        : "text-left origin-left";

  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const getBgOpacity = (index: number) => {
    const center = index / 3;
    const distance = Math.abs(progressRatio - center);
    return Math.max(0, 1 - distance / (1 / 3));
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center">
      {/* Dynamic Background Art */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[100vw] pointer-events-none z-0 bg-black overflow-hidden">
        <img
          src={bgImage1}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 blur-xl scale-110"
          style={{ opacity: getBgOpacity(0) * 0.4 }}
          alt="Background 1"
        />
        <img
          src={bgImage2}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 blur-xl scale-110"
          style={{ opacity: getBgOpacity(1) * 0.4 }}
          alt="Background 2"
        />
        <img
          src={bgImage3}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 blur-xl scale-110"
          style={{ opacity: getBgOpacity(2) * 0.4 }}
          alt="Background 3"
        />
        <img
          src={bgImage4}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 blur-xl scale-110"
          style={{ opacity: getBgOpacity(3) * 0.4 }}
          alt="Background 4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80" />
      </div>

      {/* Settings Dropdown */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => onCloseSettings()}
          />
        )}
        {isSettingsOpen && (
          <motion.div
            key="settings-panel"
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute top-12 left-0 right-0 z-50 bg-[#1A1A1A]/95 backdrop-blur-xl border-b border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col gap-6"
          >
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
              <h3 className="text-white font-bold text-base sm:text-lg flex-shrink-0">
                Lyrics Configuration
              </h3>
              <button
                onClick={() => onCloseSettings()}
                className="text-white/50 hover:text-white p-2 flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
              {/* Size Slider */}
              <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-white/50 font-bold text-sm flex-shrink-0">
                  T-
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={fontSizeMult}
                  onChange={(e) => setFontSizeMult(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer flex-shrink-0"
                  style={{ accentColor: lyricsColor }}
                />
                <span className="text-white/50 font-bold text-lg flex-shrink-0">
                  T+
                </span>
              </div>

              {/* Color Palette */}
              <div className="flex flex-nowrap overflow-x-auto scrollbar-none gap-3 w-full pb-2 flex-shrink-0">
                {LYRICS_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setLyricsColor(c.value)}
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all shadow-sm flex-shrink-0"
                    style={{
                      backgroundColor: c.value,
                      borderColor:
                        lyricsColor === c.value ? "white" : "transparent",
                    }}
                  >
                    {lyricsColor === c.value && (
                      <Check
                        size={18}
                        className={
                          c.value === "#ffffff" ? "text-black" : "text-white"
                        }
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Font & Style Settings - Enclosed & horizontally scrollable */}
              <div className="bg-white/5 p-4 rounded-xl flex-shrink-0">
                <div className="flex flex-nowrap overflow-x-auto scrollbar-none gap-3 w-full pb-1 select-none whitespace-nowrap flex-shrink-0">
                  {/* Alignment Group */}
                  <div className="flex bg-white/5 rounded-lg p-1 shrink-0">
                    <button
                      onClick={() => setAlign("left")}
                      title="Align Left"
                      className={cn(
                        "p-2 rounded-md transition-colors flex-shrink-0",
                        align === "left"
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      <AlignLeft size={18} />
                    </button>
                    <button
                      onClick={() => setAlign("center")}
                      title="Align Center"
                      className={cn(
                        "p-2 rounded-md transition-colors flex-shrink-0",
                        align === "center"
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      <AlignCenter size={18} />
                    </button>
                    <button
                      onClick={() => setAlign("right")}
                      title="Align Right"
                      className={cn(
                        "p-2 rounded-md transition-colors flex-shrink-0",
                        align === "right"
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      <AlignRight size={18} />
                    </button>
                  </div>

                  <div className="w-px h-8 bg-white/10 shrink-0 mx-0.5 flex-shrink-0"></div>

                  {/* Italic Group */}
                  <div className="flex bg-white/5 rounded-lg p-1 shrink-0">
                    <button
                      onClick={() => setIsItalic(false)}
                      title="Regular Font"
                      className={cn(
                        "p-2 rounded-md transition-colors font-bold flex-shrink-0",
                        !isItalic
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      <Type size={18} />
                    </button>
                    <button
                      onClick={() => setIsItalic(true)}
                      title="Italic Font"
                      className={cn(
                        "p-2 rounded-md transition-colors font-serif italic flex-shrink-0",
                        isItalic
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      <Italic size={18} />
                    </button>
                  </div>

                  <div className="w-px h-8 bg-white/10 shrink-0 mx-0.5 flex-shrink-0"></div>

                  {/* Font Weight Group */}
                  <div className="flex bg-white/5 rounded-lg p-1 shrink-0">
                    <button
                      onClick={() => setFontWeight("font-medium")}
                      className={cn(
                        "px-3 py-1.5 rounded-md transition-colors text-sm font-medium flex-shrink-0",
                        fontWeight === "font-medium"
                          ? "bg-white/10"
                          : "text-white/40 hover:text-white",
                      )}
                      style={{
                        color:
                          fontWeight === "font-medium"
                            ? lyricsColor
                            : undefined,
                      }}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => setFontWeight("font-bold")}
                      className={cn(
                        "px-3 py-1.5 rounded-md transition-colors text-sm font-bold flex-shrink-0",
                        fontWeight === "font-bold"
                          ? "bg-white/10"
                          : "text-white/40 hover:text-white",
                      )}
                      style={{
                        color:
                          fontWeight === "font-bold" ? lyricsColor : undefined,
                      }}
                    >
                      Bold
                    </button>
                    <button
                      onClick={() => setFontWeight("font-black")}
                      className={cn(
                        "px-3 py-1.5 rounded-md transition-colors text-sm font-black flex-shrink-0",
                        fontWeight === "font-black"
                          ? "bg-white/10"
                          : "text-white/40 hover:text-white",
                      )}
                      style={{
                        color:
                          fontWeight === "font-black" ? lyricsColor : undefined,
                      }}
                    >
                      Black
                    </button>
                  </div>

                  <div className="w-px h-8 bg-white/10 shrink-0 mx-0.5 flex-shrink-0"></div>

                  {/* Character Styles / Transformations */}
                  <div className="flex bg-white/5 rounded-lg p-1 shrink-0 gap-1">
                    <button
                      onClick={() => setLyricsTextStyle("normal")}
                      className={cn(
                        "px-3 py-1.5 rounded-md transition-colors text-sm font-semibold flex-shrink-0",
                        lyricsTextStyle === "normal"
                          ? "bg-white/10"
                          : "text-white/40 hover:text-white",
                      )}
                      style={{
                        color:
                          lyricsTextStyle === "normal"
                            ? lyricsColor
                            : undefined,
                      }}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setLyricsTextStyle("bold_fraktur")}
                      className={cn(
                        "px-3 py-1.5 rounded-md transition-colors text-sm font-serif font-bold flex-shrink-0",
                        lyricsTextStyle === "bold_fraktur"
                          ? "bg-white/10"
                          : "text-white/40 hover:text-white",
                      )}
                      style={{
                        color:
                          lyricsTextStyle === "bold_fraktur"
                            ? lyricsColor
                            : undefined,
                      }}
                    >
                      𝕭𝖔𝖑𝖉 𝕱𝖗𝖆𝖐𝖙𝖚𝖗
                    </button>
                    <button
                      onClick={() => setLyricsTextStyle("bold_script")}
                      className={cn(
                        "px-3 py-1.5 rounded-md transition-colors text-sm font-serif italic font-bold flex-shrink-0",
                        lyricsTextStyle === "bold_script"
                          ? "bg-white/10"
                          : "text-white/40 hover:text-white",
                      )}
                      style={{
                        color:
                          lyricsTextStyle === "bold_script"
                            ? lyricsColor
                            : undefined,
                      }}
                    >
                      𝓑𝓸𝓵𝓭 𝓢𝓬𝓻𝓲𝓹𝓽
                    </button>
                    <button
                      onClick={() => setLyricsTextStyle("zalgo")}
                      className={cn(
                        "px-3 py-1.5 rounded-md transition-colors text-sm font-mono tracking-tight flex-shrink-0",
                        lyricsTextStyle === "zalgo"
                          ? "bg-white/10"
                          : "text-white/40 hover:text-white",
                      )}
                      style={{
                        color:
                          lyricsTextStyle === "zalgo" ? lyricsColor : undefined,
                      }}
                    >
                      Z̷a̷l̷g̷o̷
                    </button>
                    <button
                      onClick={() => setLyricsTextStyle("fullwidth")}
                      className={cn(
                        "px-3 py-1.5 rounded-md transition-colors text-sm font-mono flex-shrink-0",
                        lyricsTextStyle === "fullwidth"
                          ? "bg-white/10"
                          : "text-white/40 hover:text-white",
                      )}
                      style={{
                        color:
                          lyricsTextStyle === "fullwidth"
                            ? lyricsColor
                            : undefined,
                      }}
                    >
                      Ｆｕｌｌｗｉｄｔｈ
                    </button>
                  </div>
                </div>
              </div>

              {/* Adjust Lyrics Speed */}
              <div className="flex items-center justify-between w-full gap-2 bg-white/5 p-4 rounded-xl flex-shrink-0">
                <div className="flex flex-col flex-shrink-0">
                  <span className="text-white font-medium text-xs sm:text-sm flex-shrink-0">
                    Adjust Lyrics Speed
                  </span>
                  <span className="text-white/50 text-[11px] sm:text-xs flex-shrink-0">
                    Sync offsets for early/late lyrics
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  <button
                    onClick={() => setSyncOffset(syncOffset - 0.5)}
                    className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 flex-shrink-0"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-white font-mono w-12 sm:w-16 whitespace-nowrap text-center text-xs sm:text-sm flex-shrink-0">
                    {syncOffset === 0
                      ? "Normal"
                      : syncOffset > 0
                        ? `+${syncOffset.toFixed(1)}s`
                        : `${syncOffset.toFixed(1)}s`}
                  </span>
                  <button
                    onClick={() => setSyncOffset(syncOffset + 0.5)}
                    className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 flex-shrink-0"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Desktop Lyrics Toggle */}
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl flex-shrink-0">
                <div className="flex items-center gap-3 text-white flex-shrink-0">
                  <Monitor size={18} className="text-white/70 flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base flex-shrink-0">
                    Desktop Lyrics
                  </span>
                </div>
                <button
                  onClick={() => setIsDesktopLyrics(!isDesktopLyrics)}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative flex-shrink-0",
                    isDesktopLyrics ? "bg-emerald-500" : "bg-white/20",
                  )}
                >
                  <motion.div
                    initial={false}
                    animate={{ x: isDesktopLyrics ? 24 : 2 }}
                    className="w-5 h-5 bg-white rounded-full absolute top-0.5"
                  />
                </button>
              </div>

              {/* Lyrics Backdrop Toggle */}
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl flex-shrink-0">
                <div className="flex items-center gap-3 text-white flex-shrink-0">
                  <Layers size={18} className="text-white/70 flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base flex-shrink-0">
                    Lyrics Backdrop
                  </span>
                </div>
                <button
                  onClick={() =>
                    setLyricsBackdropEnabled(!lyricsBackdropEnabled)
                  }
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative flex-shrink-0",
                    lyricsBackdropEnabled ? "bg-emerald-500" : "bg-white/20",
                  )}
                >
                  <motion.div
                    initial={false}
                    animate={{ x: lyricsBackdropEnabled ? 24 : 2 }}
                    className="w-5 h-5 bg-white rounded-full absolute top-0.5"
                  />
                </button>
              </div>

              {/* Backdrop Blur Intensity Adjuster */}
              {lyricsBackdropEnabled && (
                <div className="bg-white/5 p-4 rounded-xl space-y-3 flex-shrink-0">
                  <div className="flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 text-white flex-shrink-0">
                      <SlidersHorizontal
                        size={16}
                        className="text-white/70 flex-shrink-0"
                      />
                      <span className="font-medium text-xs sm:text-sm flex-shrink-0">
                        Blur Intensity
                      </span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded-md font-mono font-bold capitalize flex-shrink-0">
                      {lyricsBackdropBlur === "none"
                        ? "None"
                        : lyricsBackdropBlur.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 bg-black/25 p-1 rounded-lg flex-shrink-0">
                    {(
                      ["none", "sm", "md", "lg", "xl", "2xl", "3xl"] as const
                    ).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setLyricsBackdropBlur(lvl)}
                        className={cn(
                          "text-[10px] py-1.5 rounded-md font-medium transition-all select-none flex-shrink-0",
                          lyricsBackdropBlur === lvl
                            ? "bg-white text-black font-semibold shadow-sm"
                            : "text-white/60 hover:text-white hover:bg-white/5",
                        )}
                      >
                        {lvl === "none" ? "None" : lvl}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={containerRef}
        onWheel={() => setAutoScrollEnabled(false)}
        onTouchMove={() => setAutoScrollEnabled(false)}
        onScroll={() => {
          if (!isProgrammaticScroll.current) {
            setAutoScrollEnabled(false);
          }
        }}
        className={cn(
          "relative z-10 space-y-10 tracking-tighter text-white/5 pb-24 h-full w-full overflow-y-auto scroll-hide transition-all duration-300 select-none",
          fontWeight,
          isItalic ? "italic" : "not-italic",
          lyricsBackdropEnabled
            ? cn(
                "bg-black/45 border border-white/10 rounded-[32px] p-6 md:p-10 shadow-2xl mt-8 max-w-3xl mx-auto",
                lyricsBackdropBlur === "none" && "backdrop-blur-none",
                lyricsBackdropBlur === "sm" && "backdrop-blur-sm",
                lyricsBackdropBlur === "md" && "backdrop-blur-md",
                lyricsBackdropBlur === "lg" && "backdrop-blur-lg",
                lyricsBackdropBlur === "xl" && "backdrop-blur-xl",
                lyricsBackdropBlur === "2xl" && "backdrop-blur-2xl",
                lyricsBackdropBlur === "3xl" && "backdrop-blur-3xl",
              )
            : "mt-12 px-4",
        )}
      >
        {parsedLyrics.length > 0 ? (
          parsedLyrics.map((line, i) => {
            const isActiveLine =
              line.time > 0 &&
              effectiveTime >= line.time &&
              (i === parsedLyrics.length - 1 ||
                effectiveTime < parsedLyrics[i + 1].time);

            const isMatch = matchedIndices.includes(i);
            const isCurrentMatch =
              isMatch && i === matchedIndices[activeSearchMatchIndex];

            let textColor = "rgba(255,255,255,0.05)";
            if (isActiveLine) {
              textColor = lyricsColor;
            } else if (isCurrentMatch) {
              textColor = "#ffffff";
            } else if (isMatch) {
              textColor = "rgba(255,255,255,0.5)";
            }

            return (
              <motion.div
                key={i}
                data-lyric-index={i}
                className={cn(
                  "transition-all duration-500 cursor-default w-full flex items-center gap-4 flex-wrap",
                  align === "center"
                    ? "justify-center text-center origin-center"
                    : align === "right"
                      ? "justify-end text-right origin-right"
                      : "justify-start text-left origin-left",
                  isActiveLine
                    ? `active-lyric-line drop-shadow-[0_0_30px_${lyricsColor}40] underline decoration-2`
                    : "",
                  isCurrentMatch
                    ? "bg-white/10 rounded-2xl px-4 py-2 ring-1 ring-white/20 shadow-lg shadow-black/80"
                    : "",
                  isMatch && !isCurrentMatch
                    ? "bg-white/[0.02] rounded-xl px-4 py-1.5"
                    : "",
                )}
                style={{
                  fontSize: `calc(3rem * ${fontSizeMult})`,
                  lineHeight: 1.1,
                  textDecorationColor: lyricsColor,
                }}
                animate={{
                  color: textColor,
                  scale: isActiveLine ? 1.05 : isCurrentMatch ? 1.03 : 1,
                  x:
                    isActiveLine && align === "left"
                      ? 16
                      : isActiveLine && align === "right"
                        ? -16
                        : 0,
                }}
              >
                {align === "left" && isActiveLine && (
                  <span className="inline-flex items-center gap-1.5 h-[1em]">
                    {[1, 2, 3].map((bar) => (
                      <motion.div
                        key={bar}
                        animate={{ height: ["0.2em", "0.8em", "0.2em"] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          ease: "easeInOut",
                          delay: bar * 0.2,
                        }}
                        className="w-[0.15em] rounded-full opacity-80"
                        style={{ backgroundColor: lyricsColor }}
                      />
                    ))}
                  </span>
                )}
                <div>
                  {line.words.map((word, wIdx) => {
                    if (word.isSpace)
                      return (
                        <span key={wIdx}>
                          {transformLyricsText(word.text, lyricsTextStyle)}
                        </span>
                      );

                    const isWordPast =
                      isActiveLine && effectiveTime >= word.endTime;
                    const isWordActive =
                      isActiveLine &&
                      effectiveTime >= word.startTime &&
                      effectiveTime < word.endTime;

                    let fillPercent = 0;
                    if (isWordPast) fillPercent = 100;
                    else if (isWordActive) {
                      const dur = word.endTime - word.startTime;
                      if (dur > 0) {
                        fillPercent = Math.max(
                          0,
                          Math.min(
                            100,
                            ((effectiveTime - word.startTime) / dur) * 100,
                          ),
                        );
                      } else {
                        fillPercent = 100;
                      }
                    }

                    return (
                      <span
                        key={wIdx}
                        className={cn(
                          "relative inline-block",
                          isWordActive && isActiveLine
                            ? "scale-[1.05] drop-shadow-lg"
                            : "",
                        )}
                        style={{ transition: "transform 0.1s linear" }}
                      >
                        {/* Base Text */}
                        <span
                          className={cn(
                            "inline-block transition-opacity duration-300",
                            isActiveLine && !isWordPast && !isWordActive
                              ? "opacity-30"
                              : "opacity-100",
                          )}
                        >
                          {transformLyricsText(word.text, lyricsTextStyle)}
                        </span>

                        {/* Highlight Fill Overlay */}
                        {isActiveLine && (
                          <span
                            className="absolute left-0 top-0 overflow-hidden whitespace-pre text-left inline-block"
                            style={{ width: `${fillPercent}%` }}
                          >
                            <span style={{ color: lyricsColor }}>
                              {transformLyricsText(word.text, lyricsTextStyle)}
                            </span>
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
                {align !== "left" && isActiveLine && (
                  <span className="inline-flex items-center gap-1.5 h-[1em]">
                    {[1, 2, 3].map((bar) => (
                      <motion.div
                        key={bar}
                        animate={{ height: ["0.2em", "0.8em", "0.2em"] }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.8,
                          ease: "easeInOut",
                          delay: bar * 0.2,
                        }}
                        className="w-[0.15em] rounded-full opacity-80"
                        style={{ backgroundColor: lyricsColor }}
                      />
                    ))}
                  </span>
                )}
              </motion.div>
            );
          })
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[300px]">
            <p
              className="text-zinc-800 mb-8 uppercase opacity-20 select-none text-center leading-tight font-black"
              style={{ fontSize: `calc(3rem * ${fontSizeMult})` }}
            >
              NO LYRICS DETECTED
            </p>
            {onEditLyrics && (
              <button
                onClick={onEditLyrics}
                className="px-8 py-4 bg-white text-black rounded-full font-black uppercase italic tracking-tighter hover:bg-zinc-200 transition-all flex items-center gap-3 text-sm z-10"
              >
                <Mic2 size={18} />
                Synthesize Lyrics
              </button>
            )}
          </div>
        )}
      </div>

      {/* Floating Back-to-Sync Button (Plus Icon) */}
      <AnimatePresence>
        {!autoScrollEnabled && activeLineIndex !== -1 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReturnToActive}
            className="absolute bottom-6 left-6 z-30 w-14 h-14 rounded-full flex items-center justify-center border shadow-xl backdrop-blur-md transition-shadow group"
            style={{
              backgroundColor: "rgba(26, 26, 26, 0.85)",
              borderColor: "rgba(255, 255, 255, 0.15)",
              boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${lyricsColor}25`,
            }}
            title="Auto scroll to current verse"
          >
            <Plus
              size={24}
              style={{ color: lyricsColor }}
              className="transition-transform group-hover:rotate-90 duration-300"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
