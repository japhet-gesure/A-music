import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { Home, Search, Library, PlusCircle, Heart, Settings, User, Compass, Sparkles, Music, Menu, X, Radio, Play, Pause, SkipBack, SkipForward, Maximize2 } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MusicPlayer } from "../player/MusicPlayer";
import { AudioHandshake } from "../player/AudioHandshake";
import { LyricsOverlay } from "../player/LyricsOverlay";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { useLikeStore } from "../../store/useLikeStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";

interface ShellProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { id: "nav-home", icon: Home, label: "Home", path: "/", color: "text-blue-400" },
  { id: "nav-search", icon: Search, label: "Search", path: "/search", color: "text-emerald-400" },
  { id: "nav-vibes", icon: Sparkles, label: "AI Vibes", path: "/vibes", color: "text-purple-400" },
  { id: "nav-ai-dj", icon: Radio, label: "AI Radio DJ", path: "/ai-dj", color: "text-rose-400" },
  { id: "nav-explore", icon: Compass, label: "Explore", path: "/explore", color: "text-orange-400" },
  { id: "nav-for-you", icon: Sparkles, label: "For You", path: "/for-you", color: "text-pink-400" },
];

const SECONDARY_NAV = [
  { id: "sec-library", icon: Library, label: "Offline Vault", path: "/library", color: "text-indigo-400" },
  { id: "sec-playlists", icon: Music, label: "Playlists", path: "/playlists", color: "text-cyan-400" },
  { id: "sec-liked", icon: Heart, label: "Liked Songs", path: "/liked", color: "text-rose-400" },
];

const MOBILE_NAV_ITEMS = [
  { id: "mob-home", icon: Home, label: "Home", path: "/" },
  { id: "mob-search", icon: Search, label: "Search", path: "/search" },
  { id: "mob-vibes", icon: Sparkles, label: "Vibes", path: "/vibes" },
  { id: "mob-library", icon: Library, label: "Library", path: "/library" },
];

interface SidebarContentProps {
  isMobileSidebar?: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

function MobileNowPlaying() {
  const currentTrack = usePlayerStore(state => state.currentSong);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const currentTime = usePlayerStore(state => state.currentTime);
  const duration = usePlayerStore(state => state.duration);
  const togglePlay = usePlayerStore(state => state.togglePlay);
  const next = usePlayerStore(state => state.next);
  const previous = usePlayerStore(state => state.previous);
  const queue = usePlayerStore(state => state.queue);
  const currentIndex = usePlayerStore(state => state.currentIndex);
  const youtubeMinimized = usePlayerStore(state => state.youtubeMinimized);
  const setYoutubeMinimized = usePlayerStore(state => state.setYoutubeMinimized);

  const hasNext = currentIndex < queue.length - 1;
  const hasPrev = currentIndex > 0;

  const defaultArtworkUrl = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop";

  const progressPercentage = (currentTime / (duration || 1)) * 100;

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className={cn(
        "bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex flex-col gap-2.5 shadow-xl relative overflow-hidden",
        isPlaying ? "border-purple-500/30 bg-purple-950/5 shadow-[0_0_20px_rgba(168,85,247,0.15)]" : ""
      )}
    >
      {/* Dynamic play glowing pulse gradient layer */}
      {isPlaying && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent pointer-events-none" />
      )}

      {/* Maximize/Expand Button */}
      <button 
        onClick={() => setYoutubeMinimized(!youtubeMinimized)}
        className={cn(
          "absolute top-2 right-2 p-1 rounded-lg text-white/40 hover:text-purple-400 bg-white/[0.02] hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/20 transition-all z-20 cursor-pointer",
          !youtubeMinimized ? "text-purple-400 border-purple-500/20 bg-purple-500/10 shadow-[0_0_8px_rgba(168,85,247,0.2)]" : ""
        )}
        title={youtubeMinimized ? "Maximize Video Player" : "Minimize Video Player"}
      >
        <Maximize2 size={11} className="w-3 h-3" />
      </button>

      {/* Track info block */}
      <div className="flex items-center gap-3 relative z-10 pr-5">
        <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-white/10 shadow-md">
          <img 
            referrerPolicy="no-referrer"
            src={currentTrack?.thumbnail || defaultArtworkUrl} 
            alt={currentTrack?.title || "Not Playing"} 
            className={cn(
              "w-full h-full object-cover transition-transform duration-500",
              isPlaying ? "scale-105" : "scale-100"
            )}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-white truncate leading-tight">
            {currentTrack?.title || 'Not Playing'}
          </p>
          <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider truncate mt-0.5">
            {currentTrack?.artist || 'Unknown Artist'}
          </p>
        </div>

        {/* Pulsing visualizer bars */}
        {isPlaying && (
          <div className="flex items-end gap-[1.5px] h-3 select-none px-1">
            {[0, 1, 2].map((idx) => (
              <motion.div
                key={idx}
                animate={{ height: [[4, 10, 4], [6, 4, 10], [5, 12, 5]][idx] }}
                transition={{ repeat: Infinity, duration: 0.6 + idx * 0.15, ease: "easeInOut" }}
                className="w-[1.5px] bg-purple-500 rounded-full"
              />
            ))}
          </div>
        )}
      </div>

      {/* Seeker / Progress bar */}
      <div className="space-y-1 relative z-10 px-0.5">
        <div className="relative h-2 flex items-center group cursor-pointer w-full">
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
            className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative border border-white/5">
            <div 
              className={cn(
                "h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-150"
              )}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div 
            className="absolute w-2 h-2 bg-white rounded-full shadow-md pointer-events-none z-20 border border-purple-500"
            style={{ left: `calc(${progressPercentage}% - 4px)` }}
          />
        </div>
        <div className="flex justify-between text-[7.5px] font-mono font-bold text-white/30">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4 relative z-10 pb-0.5">
        <button 
          onClick={previous}
          disabled={!hasPrev}
          className={cn(
            "p-1 rounded-full transition-colors active:scale-90",
            hasPrev ? "text-white/60 hover:text-white" : "text-white/10 cursor-not-allowed"
          )}
          title="Previous Track"
        >
          <SkipBack size={13} fill="currentColor" />
        </button>

        <button 
          onClick={togglePlay}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all active:scale-95"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={12} fill="currentColor" />
          ) : (
            <Play size={12} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        <button 
          onClick={next}
          disabled={!hasNext && usePlayerStore.getState().repeatMode !== "all"}
          className={cn(
            "p-1 rounded-full transition-colors active:scale-90",
            (hasNext || usePlayerStore.getState().repeatMode === "all") ? "text-white/60 hover:text-white" : "text-white/10 cursor-not-allowed"
          )}
          title="Next Track"
        >
          <SkipForward size={13} fill="currentColor" />
        </button>
      </div>
    </motion.div>
  );
}

function SidebarContent({ isMobileSidebar = false, setIsSidebarOpen }: SidebarContentProps) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full w-full select-none overflow-hidden" id="sidebar-panel">
      {/* Scrollable Contents (Links & Caching banner) */}
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          overflowY: "scroll", 
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          padding: "1.5rem",
          gap: "2rem"
        }}
        className="scroll-hide flex-1 w-full"
        id="sidebar-scrollable-area"
      >
        <div className="flex items-center justify-between lg:block">
          <Link to="/" className="inline-block group">
            <div className="text-2xl font-black text-gradient tracking-tighter group-hover:scale-105 transition-transform flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)] group-hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all">
                <Music size={18} className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
              </div>
              <span>A MUSIC</span>
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-white/40 hover:text-white">
            <X size={11} />
          </button>
        </div>

        <nav className="flex-1 space-y-8 pr-2">
          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-black mb-6 px-3">Discovery</h3>
            <div className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-2xl text-sm transition-all group relative overflow-hidden",
                      isActive
                        ? "bg-white/5"
                        : "text-white/40 hover:text-white hover:bg-white/[0.02]"
                    )}
                    style={{
                      backgroundColor: isActive ? "rgba(255, 255, 255, 0.05)" : undefined,
                    }}
                  >
                    <div 
                      className={cn(
                        "transition-all duration-300",
                        isActive ? "text-white shrink-0" : "opacity-40 group-hover:opacity-100 group-hover:scale-110 shrink-0"
                      )}
                      style={{ color: isActive ? "#ffffff" : undefined }}
                    >
                      <item.icon size={20} />
                    </div>
                    <span 
                      style={{ 
                        color: isActive ? "#ffffff" : undefined, 
                        fontWeight: isActive ? 600 : undefined 
                      }}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <>
                        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-white rounded-r-md" />
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-black mb-6 px-3">My Collection</h3>
            <div className="space-y-1.5">
              {SECONDARY_NAV.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-2xl text-sm transition-all group relative overflow-hidden",
                      isActive
                        ? "bg-white/5"
                        : "text-white/40 hover:text-white hover:bg-white/[0.02]"
                    )}
                    style={{
                      backgroundColor: isActive ? "rgba(255, 255, 255, 0.05)" : undefined,
                    }}
                  >
                    <div 
                      className={cn(
                        "transition-all duration-300",
                        isActive ? "text-white shrink-0" : "opacity-40 group-hover:opacity-100 group-hover:scale-110 shrink-0"
                      )}
                      style={{ color: isActive ? "#ffffff" : undefined }}
                    >
                      <item.icon size={20} />
                    </div>
                    <span 
                      style={{ 
                        color: isActive ? "#ffffff" : undefined, 
                        fontWeight: isActive ? 600 : undefined 
                      }}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <>
                        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-white rounded-r-md" />
                      </>
                    )}
                  </Link>
                );
              })}

              {/* Settings Nav Item */}
              <Link
                to="/settings"
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-2xl text-sm transition-all group relative overflow-hidden",
                  location.pathname === "/settings"
                    ? "bg-white/5"
                    : "text-white/40 hover:text-white hover:bg-white/[0.02]"
                )}
                style={{
                  backgroundColor: location.pathname === "/settings" ? "rgba(255, 255, 255, 0.05)" : undefined,
                }}
              >
                <div 
                  className={cn(
                    "transition-all duration-300",
                    location.pathname === "/settings" ? "text-white shrink-0" : "opacity-40 group-hover:opacity-100 group-hover:scale-110 shrink-0"
                  )}
                  style={{ color: location.pathname === "/settings" ? "#ffffff" : undefined }}
                >
                  <Settings size={20} />
                </div>
                <span 
                  style={{ 
                    color: location.pathname === "/settings" ? "#ffffff" : undefined, 
                    fontWeight: location.pathname === "/settings" ? 600 : undefined 
                  }}
                >
                  Settings
                </span>
                {location.pathname === "/settings" && (
                  <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-white rounded-r-md" />
                )}
              </Link>
            </div>
            {!isMobileSidebar && (
              <div className="mt-6 border-t border-white/5 pt-4">
                <MusicPlayer isSidebar={true} />
              </div>
            )}
          </section>

          <section className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 p-4 rounded-xl border border-purple-500/10">
            <p className="text-[10px] font-bold text-purple-400 mb-1">OFFLINE MODE</p>
            <p className="text-[10px] text-white/40 leading-relaxed">System ready for offline listening caching.</p>
          </section>
        </nav>
      </div>

      {/* Permanently Sticky Bottom Row (User Profiles + Dynamic Now Playing) */}
      <div className="p-6 border-t border-white/5 bg-gradient-to-t from-black/20 to-transparent flex flex-col gap-4 shrink-0" id="sidebar-sticky-footer">
        {isMobileSidebar && <MobileNowPlaying />}

        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-full border border-white/10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
             <User size={14} />
          </div>
          <div className="flex-1 overflow-hidden">
             <p className="text-xs font-bold truncate">Alex Rivera</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Shell({ children }: ShellProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [topSearchVal, setTopSearchVal] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.pathname === "/search" && params.get("offline") === "true") {
      setTopSearchVal(params.get("q") || "");
    } else {
      setTopSearchVal("");
    }
  }, [location.pathname, location.search]);

  const handleTopSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTopSearchVal(val);
    if (val.trim() === "") {
      navigate(`/search?offline=true`, { replace: true });
    } else {
      navigate(`/search?q=${encodeURIComponent(val)}&offline=true`, { replace: true });
    }
  };

  const [historyStack, setHistoryStack] = useState<string[]>([location.pathname + location.search]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false;
      return;
    }

    setHistoryStack(prev => {
      const nextStack = prev.slice(0, currentIndex + 1);
      if (nextStack[nextStack.length - 1] !== currentPath) {
        nextStack.push(currentPath);
        setCurrentIndex(nextStack.length - 1);
      }
      return nextStack;
    });
  }, [location.pathname, location.search]);

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
      isNavigatingRef.current = true;
      const prevPath = historyStack[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      navigate(prevPath);
    }
  }, [currentIndex, historyStack, navigate]);

  const handleForward = useCallback(() => {
    if (currentIndex < historyStack.length - 1) {
      isNavigatingRef.current = true;
      const nextPath = historyStack[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      navigate(nextPath);
    }
  }, [currentIndex, historyStack, navigate]);

  const initLikes = useLikeStore(state => state.init);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      initLikes();
    });
    return () => unsubAuth();
  }, [initLikes]);

  // Close sidebar on location change (for mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    usePlayerStore.getState().setIsMobileSidebarOpen(isSidebarOpen);
  }, [isSidebarOpen]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          usePlayerStore.getState().togglePlay();
          break;
        case "KeyK":
          e.preventDefault();
          navigate("/search");
          setTimeout(() => {
            document.getElementById("global-search-input")?.focus();
          }, 50);
          break;
        case "KeyJ":
          e.preventDefault();
          handleBack();
          break;
        case "KeyL":
          e.preventDefault();
          handleForward();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, handleBack, handleForward]);

  const { theme, accentColor, nightMode } = usePlayerStore();

  const accentDetail = {
    Purple: { primary: "#a855f7", rgb: "168, 85, 247", light: "#c084fc", dark: "#9333ea" },
    Blue: { primary: "#3b82f6", rgb: "59, 130, 246", light: "#60a5fa", dark: "#2563eb" },
    Emerald: { primary: "#10b981", rgb: "16, 185, 129", light: "#34d399", dark: "#059669" },
    Sunset: { primary: "#f97316", rgb: "249, 115, 22", light: "#fb923c", dark: "#ea580c" },
    Rose: { primary: "#f43f5e", rgb: "244, 63, 94", light: "#fb7185", dark: "#e11d48" },
  }[accentColor || "Purple"] || { primary: "#a855f7", rgb: "168, 85, 247", light: "#c084fc", dark: "#9333ea" };

  const themeStyles = {
    classic: "bg-[#0A0A0C] text-[#E0E0E0]",
    midnight: "bg-slate-950 text-slate-100",
    ocean: "bg-cyan-950 text-teal-50",
    sunset: "bg-orange-950 text-orange-50",
  }[theme];

  const mainGradients = {
    classic: "from-[#121218] to-[#0A0A0C]",
    midnight: "from-[#0F172A] to-slate-950",
    ocean: "from-[#064E3B] to-cyan-950",
    sunset: "from-[#431407] to-orange-950",
  }[theme];

  return (
    <div id="app-shell" className={cn("flex h-screen w-full overflow-hidden font-sans", themeStyles, nightMode && "night-mode-active")}>
      <style>{`
        :root {
          --accent-color: ${accentDetail.primary};
          --accent-color-light: ${accentDetail.light};
          --accent-color-dark: ${accentDetail.dark};
          --accent-color-rgb: ${accentDetail.rgb};
        }

        /* Direct Tailwind overrides for Chosen Accent theme color */
        .bg-purple-500, .bg-brand-purple, [class~="bg-purple-500"], [class~="hover:bg-purple-500"]:hover, [class~="active:bg-purple-500"]:active {
          background-color: var(--accent-color) !important;
        }
        .bg-purple-600, [class~="bg-purple-600"], [class~="hover:bg-purple-600"]:hover, [class~="active:bg-purple-600"]:active {
          background-color: var(--accent-color-dark) !important;
        }
        .bg-purple-500\\/10, .bg-purple-600\\/10, [class~="bg-purple-500/10"], [class~="bg-[#a855f7]/10"], [class~="bg-purple-600/10"], [class~="hover:bg-purple-500/10"]:hover, [class~="hover:bg-purple-600/10"]:hover {
          background-color: rgba(var(--accent-color-rgb), 0.1) !important;
        }
        .bg-purple-500\\/20, .bg-purple-600\\/20, [class~="bg-purple-500/20"], [class~="bg-purple-600/20"], [class~="hover:bg-purple-500/20"]:hover {
          background-color: rgba(var(--accent-color-rgb), 0.2) !important;
        }
        .text-purple-400, [class~="text-purple-400"], [class~="hover:text-purple-400"]:hover, [class~="group-hover:text-purple-400"]:hover, [class~="group-hover/item:text-purple-400"]:hover {
          color: var(--accent-color-light) !important;
        }
        .text-purple-500, [class~="text-purple-500"], [class~="hover:text-purple-500"]:hover, [class~="group-focus-within:text-purple-500"]:focus-within {
          color: var(--accent-color) !important;
        }
        .border-purple-500, [class~="border-purple-500"], [class~="hover:border-purple-500"]:hover, [class~="focus:border-purple-500"]:focus, [class~="focus-within:border-purple-500"]:focus-within {
          border-color: var(--accent-color) !important;
        }
        .border-purple-500\\/20, [class~="border-purple-500/20"] {
          border-color: rgba(var(--accent-color-rgb), 0.2) !important;
        }
        .border-purple-500\\/30, [class~="border-purple-500/30"] {
          border-color: rgba(var(--accent-color-rgb), 0.3) !important;
        }
        .selection\\:bg-purple-500\\/30::selection {
          background-color: rgba(var(--accent-color-rgb), 0.3) !important;
        }

        .night-mode-active {
          filter: contrast(1.15) brightness(0.86) saturate(0.92) !important;
        }

        @keyframes progress-bg-pulse {
          0%, 100% {
            filter: drop-shadow(0 0 2px rgba(var(--accent-color-rgb), 0.4));
            opacity: 0.9;
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(var(--accent-color-rgb), 0.95)) drop-shadow(0 0 4px rgba(var(--accent-color-rgb), 0.6));
            opacity: 1;
          }
        }

        @keyframes progress-handle-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 6px rgba(var(--accent-color-rgb), 0.4);
          }
          50% {
            transform: scale(1.25);
            box-shadow: 0 0 16px rgba(var(--accent-color-rgb), 0.95), 0 0 8px rgba(var(--accent-color-rgb), 0.5);
          }
        }
      `}</style>
      {/* Desktop Sidebar */}
      <aside 
        id="sidebar" 
        className={cn("hidden md:flex w-64 backdrop-blur-xl border-r border-white/5 flex-col z-30", theme === "classic" ? "bg-[#0F0F12]/80" : "bg-black/40")}
        style={{ position: "relative", height: "100vh", maxHeight: "100vh", flexShrink: 0, overflow: "hidden" }}
      >
        <SidebarContent isMobileSidebar={false} setIsSidebarOpen={setIsSidebarOpen} />
      </aside>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.aside 
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={cn("fixed inset-y-0 left-0 w-80 backdrop-blur-2xl flex flex-col z-[101] shadow-2xl md:hidden", theme === "classic" ? "bg-[#0F0F12]" : "bg-zinc-900")}
              style={{ height: "100vh", maxHeight: "100vh", flexShrink: 0, overflow: "hidden" }}
            >
              <SidebarContent isMobileSidebar={true} setIsSidebarOpen={setIsSidebarOpen} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main id="main-content" className={cn("flex-1 flex flex-col relative overflow-y-auto bg-gradient-to-b", mainGradients)}>
        <header className={cn("sticky top-0 z-40 px-4 md:px-8 py-4 backdrop-blur-3xl flex items-center justify-between border-b border-white/5", theme === "classic" ? "bg-[#0F0F12]/95" : "bg-zinc-950/95")}>
          <div className="flex items-center gap-3 md:gap-6">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="md:hidden p-2 -ml-2 text-white/40 hover:text-white"
             >
                <Menu size={18} />
             </button>

             <div className="hidden md:flex gap-2">
                <button 
                  onClick={handleBack}
                  disabled={currentIndex === 0}
                  className={cn(
                    "w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white transition-colors",
                    currentIndex === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10 hover:border-white/20"
                  )}
                >
                   &lt;
                </button>
                <button 
                  onClick={handleForward}
                  disabled={currentIndex >= historyStack.length - 1}
                  className={cn(
                    "w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white transition-colors",
                    currentIndex >= historyStack.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10 hover:border-white/20"
                  )}
                >
                   &gt;
                </button>
             </div>
             
             <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-white" />
                <input 
                  id="global-search-input"
                  type="text" 
                  value={topSearchVal}
                  onChange={handleTopSearchChange}
                  placeholder="Search offline music..." 
                  className="bg-white/5 border border-white/10 rounded-full py-2 px-10 text-xs w-48 md:w-80 focus:outline-none focus:border-purple-500/50 transition-all text-white placeholder-white/30"
                />
             </div>
          </div>

          <div className="flex items-center gap-3">
             <button className="hidden sm:block text-white/60 hover:text-white text-sm font-medium px-4">Upgrade</button>
             <div className="hidden sm:block h-4 w-[1px] bg-white/10 mx-2" />
             <Link to="/settings" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-[10px] font-bold">AR</span>
             </Link>
          </div>
        </header>

        <div className="p-4 md:p-8 pb-36 md:pb-28 flex-1 w-full h-full flex flex-col min-h-full">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav id="mobile-nav" className="fixed bottom-0 left-0 right-0 h-16 bg-[#0F0F12]/95 backdrop-blur-3xl border-t border-white/5 flex md:hidden items-center justify-around px-4 z-40">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.id}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 transition-colors",
                isActive ? "text-purple-400" : "text-white/30 hover:text-white/60"
              )}
            >
              <item.icon size={18} />
              <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Integrated Player Bar */}
      <footer className="fixed bottom-16 md:bottom-0 left-0 right-0 h-0 md:h-24 bg-transparent md:bg-[#0F0F12]/95 md:backdrop-blur-3xl border-none md:border-t md:border-white/5 z-50 md:z-[100]">
        <MusicPlayer />
      </footer>

      {/* Floating Audio Gesture Handshake activator */}
      <AudioHandshake />

      {/* Real-time Lyrics Overlay */}
      <LyricsOverlay />
    </div>
  );
}
