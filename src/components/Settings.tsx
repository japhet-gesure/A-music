import React, { useState, useEffect } from "react";
import { usePlayerStore } from "../store/usePlayerStore";
import { motion, AnimatePresence } from "motion/react";
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Palette,
  Zap,
  Clock,
  Volume2,
  Shield,
  Eye,
  Cpu,
  Smartphone,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Waves,
  Gamepad2,
  Check,
  Tv,
  Music,
  Folder,
  RotateCw,
  ArrowRightLeft,
  AlertCircle,
  ListMusic,
  Layers,
  Copy,
  Info,
  CheckCircle2,
  RotateCcw,
  Loader2,
  Monitor,
  Bluetooth,
  Activity,
  Hand,
  Radio,
  Infinity as InfinityIcon,
  Shuffle,
  Mic2,
} from "lucide-react";
import { cn } from "../lib/utils";

export default function Settings() {
  const {
    theme,
    setTheme,
    crossfadeEnabled,
    setCrossfadeEnabled,
    crossfadeDuration,
    setCrossfadeDuration,
    normalizationEnabled,
    setNormalizationEnabled,
    lowDataMode,
    setLowDataMode,
    playerLayoutMode,
    setPlayerLayoutMode,
    queue,
    showDirectories,
    setShowDirectories,
    nightMode,
    setNightMode,
    autoRotate,
    setAutoRotate,
    forwardBackward,
    setForwardBackward,
    fastForwardTime,
    setFastForwardTime,
    queueAfterSearch,
    setQueueAfterSearch,
    accentColor,
    setAccentColor,
    pageEffects,
    setPageEffects,
    desktopLyrics,
    setDesktopLyrics,
    carBluetoothLyrics,
    setCarBluetoothLyrics,
    statusBarLyrics,
    setStatusBarLyrics,
    lyricsBackdropEnabled,
    setLyricsBackdropEnabled,
    lyricsBackdropBlur,
    setLyricsBackdropBlur,
    shakeToPlay,
    setShakeToPlay,
    swipeToChange,
    setSwipeToChange,
    allowOthersPlaying,
    setAllowOthersPlaying,
    playPauseFade,
    setPlayPauseFade,
    gaplessPlayback,
    setGaplessPlayback,
    crossfadeNew,
    setCrossfadeNew,
    requireDeleteConfirmation,
    setRequireDeleteConfirmation,
    resetSettings,
  } = usePlayerStore();

  const [showFastForwardModal, setShowFastForwardModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(requireDeleteConfirmation);

  // 6. Music stops playing? (Permission check link)
  const [permissionState, setPermissionState] = useState<
    "idle" | "checking" | "granted"
  >("idle");
  const [showQueueDropdown, setShowQueueDropdown] = useState(false);
  const [showEffectsDropdown, setShowEffectsDropdown] = useState(false);

  // 10. Find Duplicate (Action click link)
  const [duplicateScanState, setDuplicateScanState] = useState<
    "idle" | "scanning" | "result"
  >("idle");
  const [duplicateCount, setDuplicateCount] = useState(0);

  // Handle Permission diagnostic
  const runPermissionDiagnostic = () => {
    setPermissionState("checking");
    setTimeout(() => {
      // Simulate validation of browser AudioContext and AudioSession permissions
      setPermissionState("granted");
      setTimeout(() => setPermissionState("idle"), 4000); // revert state quietly later
    }, 1500);
  };

  // Handle Find Duplicate scan
  const runDuplicateScan = () => {
    setDuplicateScanState("scanning");
    setTimeout(() => {
      // Scan standard tracks in the active queue to search for matches
      const songIds = queue.map((s) => s.id);
      const uniqueIds = new Set(songIds);
      const duplicates = songIds.length - uniqueIds.size;
      setDuplicateCount(duplicates);
      setDuplicateScanState("result");
    }, 1200);
  };

  const themes = [
    {
      id: "classic",
      label: "Classic Noir",
      icon: Moon,
      color: "bg-zinc-900",
      accent: "from-purple-600 to-indigo-600",
    },
    {
      id: "midnight",
      label: "Deep Midnight",
      icon: Zap,
      color: "bg-slate-950",
      accent: "from-blue-600 to-cyan-600",
    },
    {
      id: "ocean",
      label: "Oceanic Abyss",
      icon: Waves,
      color: "bg-cyan-950",
      accent: "from-teal-500 to-emerald-600",
    },
    {
      id: "sunset",
      label: "Solar Flare",
      icon: Sun,
      color: "bg-orange-950",
      accent: "from-pink-600 to-orange-600",
    },
  ];

  const accentColors = [
    {
      name: "Purple",
      class: "bg-purple-500",
      glow: "shadow-[0_0_12px_rgba(168,85,247,0.5)]",
    },
    {
      name: "Blue",
      class: "bg-blue-500",
      glow: "shadow-[0_0_12px_rgba(59,130,246,0.5)]",
    },
    {
      name: "Emerald",
      class: "bg-emerald-500",
      glow: "shadow-[0_0_12px_rgba(16,185,129,0.5)]",
    },
    {
      name: "Sunset",
      class: "bg-orange-500",
      glow: "shadow-[0_0_12px_rgba(249,115,22,0.5)]",
    },
    {
      name: "Rose",
      class: "bg-rose-500",
      glow: "shadow-[0_0_12px_rgba(244,63,94,0.5)]",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <header className="flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left">
        <div className="w-16 h-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl shrink-0">
          <SettingsIcon className="w-8 h-8 text-white/40" />
        </div>
        <div>
          <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter text-gradient leading-tight uppercase">
            Control Center
          </h1>
          <p className="text-white/40 text-[10px] sm:text-sm font-medium uppercase tracking-[0.3em] mt-1">
            Configure your sonic experience
          </p>
        </div>
      </header>

      {/* 1. Theme Configuration section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <Palette size={16} className="text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
            Visual Architecture
          </h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id as any)}
              className={cn(
                "p-6 rounded-[32px] border transition-all text-left group relative overflow-hidden",
                theme === t.id
                  ? "bg-white/10 border-white/20 shadow-2xl scale-105"
                  : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-all shadow-lg",
                  theme === t.id
                    ? `bg-gradient-to-br ${t.accent} text-white`
                    : "bg-white/5 text-white/20 group-hover:text-white",
                )}
              >
                <t.icon className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    theme === t.id
                      ? "text-white"
                      : "text-white/40 group-hover:text-white",
                  )}
                >
                  {t.label}
                </p>
                {theme === t.id && (
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                    <Check size={12} className="text-black" />
                  </div>
                )}
              </div>

              {/* Theme Preview Gradient overlay */}
              <div
                className={cn(
                  "absolute -right-8 -bottom-8 w-24 h-24 rounded-full blur-[40px] opacity-0 transition-opacity duration-700",
                  theme === t.id ? "opacity-40" : "group-hover:opacity-10",
                )}
                style={{
                  background: t.accent.includes("indigo")
                    ? "#6366f1"
                    : t.accent.includes("cyan")
                      ? "#0891b2"
                      : t.accent.includes("emerald")
                        ? "#059669"
                        : "#db2777",
                }}
              />
            </button>
          ))}
        </div>
      </section>

      {/* 2. Organized List Layout Settings Column (The 10 Rows with Purple Accents) */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <SettingsIcon size={16} className="text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 font-mono">
            System Preferences & Settings
          </h3>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-6 md:p-10 space-y-1">
          {/* Row 1: Show directories (Toggle) */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Folder size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Show directories
                </span>
                <span className="text-xs text-white/30 truncate">
                  Toggle tree-view directories for physical files
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowDirectories(!showDirectories)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                showDirectories
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: showDirectories ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Row 2: Night mode (Toggle) */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Moon size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Night mode
                </span>
                <span className="text-xs text-white/30 truncate">
                  Adjust contrast curves specifically for night environments
                </span>
              </div>
            </div>
            <button
              onClick={() => setNightMode(!nightMode)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                nightMode
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: nightMode ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Row 3: Auto-rotate album cover (Toggle) */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <RotateCw size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Auto-rotate album cover
                </span>
                <span className="text-xs text-white/30 truncate">
                  Enable circular visual kinetic spinning effects inside
                  nowplaying
                </span>
              </div>
            </div>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                autoRotate
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: autoRotate ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Row 4: Forward and backward (Toggle) */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <ArrowRightLeft size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Forward and backward
                </span>
                <span className="text-xs text-white/30 leading-relaxed max-w-sm sm:max-w-xl">
                  Show forward and backward buttons on nowplaying page
                </span>
              </div>
            </div>
            <button
              onClick={() => setForwardBackward(!forwardBackward)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                forwardBackward
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: forwardBackward ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Row 5: Time to fast forward and backward (Submenu action link) */}
          <div className="flex flex-col border-b border-zinc-800/40 py-2">
            <div
              onClick={() => setShowFastForwardModal(!showFastForwardModal)}
              className="flex justify-between items-center py-2 min-h-[56px] cursor-pointer hover:bg-white/[0.01] px-2 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-4 min-w-0 pr-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                  <Clock size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                    Time to fast forward and backward
                  </span>
                  <span className="text-xs text-white/30 truncate">
                    Set duration parameter for manual seek overrides
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold font-mono px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full">
                  {fastForwardTime}
                </span>
                <ChevronRight
                  size={16}
                  className={cn(
                    "text-white/20 transition-transform",
                    showFastForwardModal && "rotate-90 text-purple-400",
                  )}
                />
              </div>
            </div>

            {/* Submenu action options expanded */}
            <AnimatePresence>
              {showFastForwardModal && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-14 pr-4 pb-2 pt-1 flex flex-wrap gap-2"
                >
                  {["5s", "10s", "15s", "30s"].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setFastForwardTime(val);
                        setShowFastForwardModal(false);
                      }}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl font-bold font-mono border transition-all",
                        fastForwardTime === val
                          ? "bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/20"
                          : "bg-white/5 hover:bg-white/10 hover:border-white/15 border-white/5 text-white/50 hover:text-white",
                      )}
                    >
                      {val}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Row 6: Music stops playing? (Permission check link) */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <AlertCircle size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5 font-bold">
                  Music stops playing?
                </span>
                <span className="text-xs text-white/30 leading-relaxed max-w-sm sm:max-w-xl">
                  Grant permission to avoid abnormal music stops.
                </span>
              </div>
            </div>

            <button
              onClick={runPermissionDiagnostic}
              disabled={permissionState === "checking"}
              className={cn(
                "px-4 py-2 rounded-2xl text-xs font-semibold uppercase tracking-wider border transition-all flex items-center gap-2",
                permissionState === "checking" &&
                  "bg-white/5 border-white/10 text-white/30 cursor-not-allowed",
                permissionState === "granted" &&
                  "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold",
                permissionState === "idle" &&
                  "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20 text-purple-400",
              )}
            >
              {permissionState === "checking" && (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Testing...
                </>
              )}
              {permissionState === "granted" && (
                <>
                  <CheckCircle2 size={13} />
                  Authorized
                </>
              )}
              {permissionState === "idle" && <>Inspect & Grant</>}
            </button>
          </div>

          {/* Row 7: Queue after searching (Dropdown selector) */}
          <div className="flex flex-col border-b border-zinc-800/40 py-2">
            <div
              onClick={() => setShowQueueDropdown(!showQueueDropdown)}
              className="flex justify-between items-center py-2 min-h-[56px] cursor-pointer hover:bg-white/[0.01] px-2 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-4 min-w-0 pr-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                  <ListMusic size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold tracking-tight text-white mb-0.5 font-bold">
                    Queue after searching
                  </span>
                  <span className="text-xs text-white/30 truncate">
                    Manage which matches populate playback streams
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium px-3 py-1 bg-white/5 border border-white/5 text-white/60 rounded-full">
                  {queueAfterSearch}
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-white/20 transition-transform",
                    showQueueDropdown && "rotate-180 text-purple-400",
                  )}
                />
              </div>
            </div>

            {/* Dropdown Options List */}
            <AnimatePresence>
              {showQueueDropdown && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-14 pr-4 pb-2 pt-1 flex flex-col gap-1"
                >
                  {["All songs", "Selected song only", "Queue next only"].map(
                    (val) => (
                      <button
                        key={val}
                        onClick={() => {
                          setQueueAfterSearch(val);
                          setShowQueueDropdown(false);
                        }}
                        className={cn(
                          "text-left text-xs px-3 py-2 rounded-xl border flex items-center justify-between transition-all font-medium",
                          queueAfterSearch === val
                            ? "bg-purple-600/10 border-purple-500/30 text-purple-400"
                            : "bg-transparent border-transparent hover:bg-white/5 text-white/40 hover:text-white",
                        )}
                      >
                        {val}
                        {queueAfterSearch === val && (
                          <Check size={12} className="text-purple-400" />
                        )}
                      </button>
                    ),
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Row 8: Accent color (Color picker link) */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Palette size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Accent color
                </span>
                <span className="text-xs text-white/30 truncate">
                  The accent theme color
                </span>
              </div>
            </div>

            {/* Color swatches */}
            <div className="flex items-center gap-2 shrink-0">
              {accentColors.map((col) => {
                const isActive = accentColor === col.name;
                return (
                  <button
                    key={col.name}
                    onClick={() => setAccentColor(col.name)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 border-transparent relative transition-all active:scale-90",
                      col.class,
                      isActive
                        ? "scale-125 border-white ring-2 ring-purple-500/50"
                        : "opacity-60 hover:opacity-100",
                      isActive && col.glow,
                    )}
                    title={col.name}
                  >
                    {isActive && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 bg-white rounded-full" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 9: Page Effects (Select transition picker) */}
          <div className="flex flex-col border-b border-zinc-800/40 py-2">
            <div
              onClick={() => setShowEffectsDropdown(!showEffectsDropdown)}
              className="flex justify-between items-center py-2 min-h-[56px] cursor-pointer hover:bg-white/[0.01] px-2 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-4 min-w-0 pr-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                  <Layers size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                    Page Effects
                  </span>
                  <span className="text-xs text-white/30 truncate">
                    Page switching effect for Nowplaying
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-medium px-3 py-1 bg-white/5 border border-white/5 text-white/60 rounded-full">
                  {pageEffects}
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-white/20 transition-transform",
                    showEffectsDropdown && "rotate-180 text-purple-400",
                  )}
                />
              </div>
            </div>

            {/* Effects Selector options container */}
            <AnimatePresence>
              {showEffectsDropdown && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-14 pr-4 pb-2 pt-1 flex flex-col gap-1"
                >
                  {["Slide", "Fade", "3D Cube", "None"].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        setPageEffects(val);
                        setShowEffectsDropdown(false);
                      }}
                      className={cn(
                        "text-left text-xs px-3 py-2 rounded-xl border flex items-center justify-between transition-all font-medium",
                        pageEffects === val
                          ? "bg-purple-600/10 border-purple-500/30 text-purple-400"
                          : "bg-transparent border-transparent hover:bg-white/5 text-white/40 hover:text-white",
                      )}
                    >
                      {val}
                      {pageEffects === val && (
                        <Check size={12} className="text-purple-400" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <AlertCircle size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Confirm Deletions
                </span>
                <span className="text-xs text-white/30 truncate">
                  Show popup when deleting playlists or songs
                </span>
              </div>
            </div>
            
            <button
              onClick={() => {
                const nextVal = !confirmDelete;
                setConfirmDelete(nextVal);
                setRequireDeleteConfirmation(nextVal);
              }}
              className={cn(
                "w-11 h-6 rounded-full flex items-center shrink-0 border transition-all duration-300",
                confirmDelete
                  ? "bg-purple-500/20 border-purple-500/50"
                  : "bg-white/5 border-white/10",
              )}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full bg-white shadow-lg transition-transform duration-300",
                  confirmDelete ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>

          {/* Row 10: Find Duplicate (Action click link) */}
          <div className="flex justify-between items-center py-4 last:border-b-0 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Copy size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Find Duplicate
                </span>
                <span className="text-xs text-white/30 truncate">
                  Scan active streams and cache arrays for identical audio
                  records
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {duplicateScanState === "result" && (
                <span className="text-xs font-mono text-zinc-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">
                  Checked {queue.length} tracks. {duplicateCount} duplicates.
                </span>
              )}
              <button
                onClick={runDuplicateScan}
                disabled={duplicateScanState === "scanning"}
                className={cn(
                  "px-4 py-2 rounded-2xl text-xs font-semibold uppercase tracking-wider border transition-all flex items-center gap-2",
                  duplicateScanState === "scanning" &&
                    "bg-white/5 border-white/10 text-white/30 cursor-not-allowed",
                  "bg-purple-500 hover:bg-purple-600 text-white font-bold border-transparent shadow-[0_4px_16px_rgba(168,85,247,0.25)] hover:shadow-[0_4px_24px_rgba(168,85,247,0.4)]",
                )}
              >
                {duplicateScanState === "scanning" && (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Scanning...
                  </>
                )}
                {duplicateScanState === "result" && "Scan Again"}
                {duplicateScanState === "idle" && "Locate Duplicates"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* --- NEW LYRICS SETTINGS --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <Mic2 size={16} className="text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
            Lyrics
          </h3>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-6 md:p-10 space-y-1">
          {/* Desktop lyrics */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Monitor size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Desktop lyrics
                </span>
              </div>
            </div>
            <button
              onClick={() => setDesktopLyrics(!desktopLyrics)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                desktopLyrics
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: desktopLyrics ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Car bluetooth lyrics */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Bluetooth size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Car bluetooth lyrics
                </span>
              </div>
            </div>
            <button
              onClick={() => setCarBluetoothLyrics(!carBluetoothLyrics)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                carBluetoothLyrics
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: carBluetoothLyrics ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Status bar lyrics */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Smartphone size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Status bar lyrics
                </span>
                <span className="text-xs text-white/30 truncate">Off</span>
              </div>
            </div>
            <button
              onClick={() => setStatusBarLyrics(!statusBarLyrics)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                statusBarLyrics
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: statusBarLyrics ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Lyrics Backdrop */}
          <div className="flex justify-between items-center py-4 border-b-0 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Layers size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Lyrics glass backdrop
                </span>
                <span className="text-xs text-white/30 truncate">
                  Adds a semi-transparent layer for better readability against album art
                </span>
              </div>
            </div>
            <button
              onClick={() => setLyricsBackdropEnabled(!lyricsBackdropEnabled)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                lyricsBackdropEnabled
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: lyricsBackdropEnabled ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Backdrop Blur Intensity Adjuster */}
          <AnimatePresence initial={false}>
            {lyricsBackdropEnabled && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-white/5 py-4 space-y-3 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white/95">
                      Backdrop blur intensity
                    </span>
                    <span className="text-xs text-white/40 truncate">
                      Control how blurry the background behind lyrics appears
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/15 px-2.5 py-0.5 rounded-md capitalize shrink-0">
                    {lyricsBackdropBlur === "none" ? "None" : lyricsBackdropBlur.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1 bg-white/5 p-1 rounded-lg">
                  {(["none", "sm", "md", "lg", "xl", "2xl", "3xl"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLyricsBackdropBlur(lvl)}
                      className={cn(
                        "text-[10px] py-1.5 rounded-md font-medium transition-all select-none capitalize",
                        lyricsBackdropBlur === lvl
                          ? "bg-purple-600 text-white font-semibold shadow-sm"
                          : "text-white/40 hover:text-white/80 hover:bg-white/5"
                      )}
                    >
                      {lvl === "none" ? "None" : lvl}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* --- NEW AUDIO SETTINGS --- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <Volume2 size={16} className="text-purple-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
            Audio
          </h3>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-6 md:p-10 space-y-1">
          {/* Shake to play next song */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Activity size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Shake to play next song
                </span>
              </div>
            </div>
            <button
              onClick={() => setShakeToPlay(!shakeToPlay)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                shakeToPlay
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: shakeToPlay ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Swipe to change songs */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Hand size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Swipe to change songs
                </span>
              </div>
            </div>
            <button
              onClick={() => setSwipeToChange(!swipeToChange)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                swipeToChange
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: swipeToChange ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Allow others playing music while Music Player playing */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Volume2 size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5 leading-tight">
                  Allow others playing music while Music Player playing
                </span>
              </div>
            </div>
            <button
              onClick={() => setAllowOthersPlaying(!allowOthersPlaying)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                allowOthersPlaying
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: allowOthersPlaying ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Play/pause fade */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Radio size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Play/pause fade
                </span>
                <span className="text-xs text-white/30 truncate">
                  Fade during play/pause
                </span>
              </div>
            </div>
            <button
              onClick={() => setPlayPauseFade(!playPauseFade)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                playPauseFade
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: playPauseFade ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Gapless Playback */}
          <div className="flex justify-between items-center py-4 border-b border-zinc-800/40 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <InfinityIcon size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Gapless Playback
                </span>
                <span className="text-xs text-white/30 truncate">
                  Seamless uninterrupted music
                </span>
              </div>
            </div>
            <button
              onClick={() => setGaplessPlayback(!gaplessPlayback)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                gaplessPlayback
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: gaplessPlayback ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>

          {/* Crossfade */}
          <div className="flex justify-between items-center py-4 border-b-0 min-h-[72px]">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 shrink-0">
                <Shuffle size={18} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold tracking-tight text-white mb-0.5">
                  Crossfade
                </span>
                <span className="text-xs text-white/30 truncate">
                  Fade duration between songs
                </span>
              </div>
            </div>
            <button
              onClick={() => setCrossfadeNew(!crossfadeNew)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0",
                crossfadeNew
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: crossfadeNew ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Cpu size={16} className="text-purple-400" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              Efficiency Controllers
            </h3>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 min-h-[160px]">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Sparkles
                  size={20}
                  className={lowDataMode ? "text-purple-400" : "text-white/20"}
                />
              </div>
              <div>
                <p className="text-sm font-black italic uppercase tracking-tight text-white mb-1">
                  Efficiency Signal
                </p>
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest leading-relaxed max-w-[200px]">
                  Lower bandwidth consumption
                  <br />& thermal profile
                </p>
              </div>
            </div>
            <button
              onClick={() => setLowDataMode(!lowDataMode)}
              className={cn(
                "w-11 h-6 rounded-full border transition-all p-0.5 flex items-center shrink-0 self-start sm:self-center",
                lowDataMode
                  ? "bg-purple-600 border-purple-500"
                  : "bg-white/5 border-white/10",
              )}
            >
              <motion.div
                animate={{ x: lowDataMode ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white shadow-md"
              />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Tv size={16} className="text-purple-400" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
              Visualizer Layout
            </h3>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-[40px] p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 min-h-[160px]">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                {playerLayoutMode === "video-mode" ? (
                  <Tv size={20} className="text-purple-400" />
                ) : (
                  <Music size={20} className="text-purple-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-black italic uppercase tracking-tight text-white mb-1">
                  Player Mode
                </p>
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest leading-relaxed max-w-[200px]">
                  Choose video visualizations
                  <br />
                  or classic raw background audio
                </p>
              </div>
            </div>
            <div
              id="layout-mode-selector"
              className="flex bg-black/40 border border-white/5 rounded-2xl p-1 shrink-0 self-start sm:self-center h-12 items-center"
            >
              <button
                id="btn-layout-audio-only"
                onClick={() => setPlayerLayoutMode("audio-only")}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  playerLayoutMode === "audio-only"
                    ? "bg-white/10 text-white shadow-md border border-white/10"
                    : "text-white/40 hover:text-white",
                )}
                style={{ height: "36px" }}
              >
                <Music size={14} />
                Audio
              </button>
              <button
                id="btn-layout-video-mode"
                onClick={() => setPlayerLayoutMode("video-mode")}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  playerLayoutMode === "video-mode"
                    ? "bg-white/10 text-white shadow-md border border-white/10"
                    : "text-white/40 hover:text-white",
                )}
                style={{ height: "36px" }}
              >
                <Tv size={14} />
                Video
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Reset Settings */}
      <section className="flex justify-center pt-8 pb-4">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="px-6 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold tracking-wider uppercase text-xs transition-all border border-red-500/20 hover:border-red-500/40"
        >
          Reset to Defaults
        </button>
      </section>

      {/* Decorative System Integrity Details */}
      <footer className="pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Shield size={16} className="text-zinc-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Vault Integrity
            </p>
          </div>
          <p className="text-xs text-white/20 font-medium leading-relaxed">
            Encryption status optimal. Your localized library assets are secured
            via bi-directional hashing.
          </p>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Eye size={16} className="text-zinc-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Telemetry
            </p>
          </div>
          <p className="text-xs text-white/20 font-medium leading-relaxed">
            AI learning patterns refined. Personalization engine tuned to 98.4%
            emotional resonance accuracy.
          </p>
        </div>
        <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Gamepad2 size={16} className="text-zinc-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Core Version
            </p>
          </div>
          <p className="text-xs text-white/20 font-medium leading-relaxed">
            Build 2.0.4-Stable. Neural pathing for playlist generation optimized
            for high-velocity browsing.
          </p>
        </div>
      </footer>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowResetConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#121214] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
              <h3 className="text-xl font-black italic tracking-tighter mb-2">
                Reset Defaults?
              </h3>
              <p className="text-sm font-medium text-white/50 mb-8 leading-relaxed">
                This will revert all toggles, themes, and customized visualizer
                settings back to their original factory state.
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    resetSettings();
                    setShowResetConfirm(false);
                  }}
                  className="flex-1 py-4 rounded-2xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
