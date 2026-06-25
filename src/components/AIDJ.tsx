import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Sparkles, Radio, Play, Pause, Flame, Music, ChevronRight, Mic, 
  Loader2, Headphones, ArrowRight, ListMusic, VolumeX, Star, Check, Info, Waves, Volume2
} from "lucide-react";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import axios from "axios";

const DJ_PERSONAS = [
  {
    id: "echo",
    label: "DJ Echo",
    tagline: "Late-Night Vinyl Curator",
    color: "from-blue-500 to-indigo-600",
    shadow: "shadow-indigo-500/10",
    borderColor: "border-indigo-500/30",
    glowColor: "bg-indigo-500",
    description: "Speaks slowly, poetically, and with soft, warm curiosity. Focuses on lo-fi, synthwave, dream-pop, and atmospheric electronic tracks.",
    genres: ["Lo-Fi", "Synthwave", "Dream Pop", "Ambient"]
  },
  {
    id: "jet",
    label: "DJ Jet",
    tagline: "High-Energy Workout Coach",
    color: "from-orange-500 to-red-600",
    shadow: "shadow-red-500/10",
    borderColor: "border-red-500/30",
    glowColor: "bg-red-500",
    description: "Speaks with intense hype, rapid punchy delivery, and is extremely encouraging. Focuses on tech-house, high-tempo EDM, hip-hop, and rock.",
    genres: ["EDM", "Hip-hop", "Tech House", "Rock"]
  },
  {
    id: "nova",
    label: "DJ Nova",
    tagline: "Cosmic Thinker & Philosopher",
    color: "from-purple-600 to-deep-slate",
    shadow: "shadow-purple-500/10",
    borderColor: "border-purple-500/30",
    glowColor: "bg-purple-500",
    description: "Philosophical, calm, and quiet. Explores the physics of sound and the cosmos. Focuses on ambient drone, neoclassical, cerebral techno, and meditative soundscapes.",
    genres: ["Ambient", "Neoclassical", "Minimal Techno", "Space Ambient"]
  },
  {
    id: "roxy",
    label: "DJ Roxy",
    tagline: "Indie Tastemaker & Trivia Guru",
    color: "from-pink-500 to-rose-600",
    shadow: "shadow-rose-500/10",
    borderColor: "border-rose-500/30",
    glowColor: "bg-rose-500",
    description: "Bubbly banter, sassy humor, and fascinating artist trivia. Focuses on indie rock, alternative rock, modern pop, and groove R&B.",
    genres: ["Indie Rock", "Altrock", "Modern Pop", "R&B"]
  }
];

const PRESET_STATIONS = [
  { label: "Ocean Breeze Lo-fi", prompt: "Chill lo-fi chillhop beats with waves crashing sounds" },
  { label: "Night Cruise Synth", prompt: "Late night neon synthwave driving music with heavy bass" },
  { label: "Peak Performance Hub", prompt: "High BPM tech house and electronic workout motivation" },
  { label: "Deep Space Coding", prompt: "Minimalist cerebral techno and dark ambient focus drone" },
  { label: "Rainy Cafe Folk", prompt: "Cozy accoustic indie folk for a rainy afternoon" },
  { label: "Sunset Groove Club", prompt: "Funky disco pop and infectious house rhythm" }
];

export default function AIDJ() {
  const navigate = useNavigate();
  const [activePersona, setActivePersona] = useState("echo");
  const [prompt, setPrompt] = useState("");
  const [customStationName, setCustomStationName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    navigate(`/search?q=${encodeURIComponent(tag)}&autoplay=true`);
  };
  
  // Real active station states
  const [activeStation, setActiveStation] = useState<{
    stationName: string;
    commentary: string;
    songs: any[];
  } | null>(null);

  const [activeStationPrompt, setActiveStationPrompt] = useState("");
  const [activeStationPersona, setActiveStationPersona] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceAudio, setVoiceAudio] = useState<HTMLAudioElement | null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [textFinished, setTextFinished] = useState(false);
  const [commentaryText, setCommentaryText] = useState("");
  
  // Continuous stream settings
  const [autopilot, setAutopilot] = useState(true);
  const [autoBatching, setAutoBatching] = useState(false);

  // Sound store integrations
  const { setSong, currentSong, isPlaying, togglePlay, queue, currentIndex, addToQueue } = usePlayerStore();

  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor the track queue for continuous auto-append (Autopilot)
  useEffect(() => {
    if (!autopilot || !activeStation || autoBatching) return;

    const remainingTracks = queue.length - 1 - currentIndex;
    
    // Check if we have <= 1 track left in the active playlist queue
    // and if the currently playing song is from the AI DJ station
    const currentIsStationSong = queue[currentIndex]?.id?.startsWith("dj-");

    if (remainingTracks <= 1 && currentIsStationSong) {
      triggerAutopilotNextSegment();
    }
  }, [currentIndex, queue.length, autopilot, activeStation]);

  // Handle continuous track fetching in the background
  const triggerAutopilotNextSegment = async () => {
    if (autoBatching || !activeStation) return;
    setAutoBatching(true);
    console.info("[AI DJ Autopilot] Stream low. Pre-fetching next radio segment...");

    try {
      const pText = activeStationPrompt || prompt || "chill vibes";
      const res = await axios.post("/api/ai-dj/station", {
        prompt: pText,
        persona: activeStationPersona
      });

      if (res.data?.songs && res.data.songs.length > 0) {
        // Map song IDs to ensure unique non-conflicting IDs
        const newSongs = res.data.songs.map((song: any, i: number) => ({
          ...song,
          id: `dj-${activeStationPersona}-${Date.now()}-${i}`
        }));

        // Append to local station history
        setActiveStation(prev => {
          if (!prev) return null;
          return {
            ...prev,
            songs: [...prev.songs, ...newSongs]
          };
        });

        // Add to active player store queue
        newSongs.forEach((song: any) => addToQueue(song));
        console.info("[AI DJ Autopilot] Seamlessly enqueued 5 new tracks");
      }
    } catch (err) {
      console.warn("[AI DJ Autopilot] Failed fetching next segment:", err);
    } finally {
      setAutoBatching(false);
    }
  };

  const handleTuneIn = async (overridePersona?: string, overridePrompt?: string) => {
    const targetPersona = overridePersona || activePersona;
    // We can randomize the prompt slightly depending on the persona to give them life instantly
    let finalPrompt = overridePrompt || prompt.trim();
    if (!finalPrompt) {
      if (targetPersona === "echo") finalPrompt = "Slow lo-fi atmospheric beats to unwind";
      if (targetPersona === "jet") finalPrompt = "High BPM energetic workout music";
      if (targetPersona === "nova") finalPrompt = "Cerebral ambient drone and minimalism";
      if (targetPersona === "roxy") finalPrompt = "Bubbly indie pop and rhythmic grooves";
    }

    setLoading(true);
    setActiveStation(null);
    setCommentaryText("");
    setTextFinished(false);
    
    if (voiceAudio) {
      voiceAudio.pause();
      setVoiceAudio(null);
    }
    setVoicePlaying(false);

    try {
      const response = await axios.post("/api/ai-dj/station", {
        prompt: finalPrompt,
        persona: targetPersona
      });

      const stationData = response.data;
      if (stationData && stationData.songs && stationData.songs.length > 0) {
        const mappedSongs = stationData.songs.map((s: any, idx: number) => ({
          ...s,
          id: `dj-${targetPersona}-${Date.now()}-${idx}`
        }));

        setActiveStation({
          ...stationData,
          songs: mappedSongs
        });
        setActiveStationPrompt(finalPrompt);
        setActiveStationPersona(targetPersona);

        // Start typing out the DJ's commentary
        runTypewriter(stationData.commentary);

        // Feed songs to Player Store Queue
        setSong(mappedSongs[0], mappedSongs);
      }
    } catch (err) {
      console.error("Failed to establish AI DJ broadcast", err);
    } finally {
      setLoading(false);
    }
  };

  const runTypewriter = (text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    
    let currentIdx = 0;
    setCommentaryText("");
    setTextFinished(false);

    typewriterRef.current = setInterval(() => {
      setCommentaryText((prev) => prev + text.charAt(currentIdx));
      currentIdx++;
      if (currentIdx >= text.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        setTextFinished(true);
      }
    }, 25);
  };

  // Perform TTS speech synthesis of DJ commentary
  const handlePlayDJVoice = async () => {
    if (!activeStation) return;
    
    if (voiceAudio) {
      if (voicePlaying) {
        voiceAudio.pause();
        setVoicePlaying(false);
      } else {
        voiceAudio.play();
        setVoicePlaying(true);
      }
      return;
    }

    setVoiceLoading(true);
    try {
      const response = await axios.post("/api/ai-dj/voice", {
        commentary: activeStation.commentary,
        persona: activeStationPersona
      });

      if (response.data?.audio) {
        const audioUrl = `data:audio/wav;base64,${response.data.audio}`;
        const audio = new Audio(audioUrl);
        
        audio.onplay = () => setVoicePlaying(true);
        audio.onpause = () => setVoicePlaying(false);
        audio.onended = () => setVoicePlaying(false);

        setVoiceAudio(audio);
        audio.play();
      }
    } catch (err) {
      console.warn("Speech Synthesis failed or unauth", err);
    } finally {
      setVoiceLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      if (voiceAudio) {
        voiceAudio.pause();
      }
    };
  }, [voiceAudio]);

  const activePersonaConfig = DJ_PERSONAS.find(p => p.id === activePersona)!;

  return (
    <div className="space-y-12 pb-24">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-widest mb-3">
            <Radio size={14} className="animate-pulse text-rose-500" />
            <span>AI DJ Radio Station</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-gradient uppercase">AI DJ Broadcaster</h1>
          <p className="text-white/40 text-sm mt-2 uppercase tracking-widest font-bold">Curated continuous frequency streams styled to your emotions</p>
        </div>
      </header>

      {/* Broadcasting Deck (Visible when channel is established) */}
      <AnimatePresence mode="wait">
        {activeStation ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Live Console Deck */}
            <div className="lg:col-span-2 space-y-6">
              {/* Broadcast Terminal */}
              <div className="relative rounded-[40px] bg-gradient-to-br from-zinc-900 to-black border border-white/5 overflow-hidden p-8 sm:p-10 shadow-2xl space-y-8">
                {/* Neon Aura Backing */}
                <div className={`absolute -right-24 -top-24 w-80 h-80 rounded-full blur-[100px] opacity-20 ${DJ_PERSONAS.find(p => p.id === activeStationPersona)?.glowColor}`} />
                
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                    <span className="text-[10px] font-mono tracking-[0.3em] font-black uppercase text-rose-400">BROADCASTING LIVE</span>
                  </div>

                  <div className="bg-white/5 border border-white/5 px-4 py-1.5 rounded-full text-xs font-mono font-bold text-zinc-400">
                    FM {100.3 + (activeStationPersona.charCodeAt(0) % 8)}.7 / AI
                  </div>
                </div>

                <div className="space-y-1 relative z-10">
                  <h2 className="text-4xl sm:text-5xl font-black italic uppercase text-white truncate max-w-full">
                    {activeStation.stationName}
                  </h2>
                  <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">
                    curated by <span className={cn("text-transparent bg-clip-text bg-gradient-to-r select-none", DJ_PERSONAS.find(p => p.id === activeStationPersona)?.color)}>
                      {DJ_PERSONAS.find(p => p.id === activeStationPersona)?.label}
                    </span>
                  </p>
                </div>

                {/* Animated Audio Spectral Wave (Framer Motion) */}
                <div className="h-24 bg-white/[0.02] rounded-3xl border border-white/5 flex items-center justify-center px-4 overflow-hidden relative group">
                  <div className="absolute top-3 left-4 text-[9px] font-mono tracking-widest uppercase text-white/20 select-none">Voice & Beat Frequency</div>
                  <div className="flex items-end gap-1.5 h-12">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{
                          height: isPlaying ? [10, Math.max(16, Math.sin(i) * 36 + 18), 8, Math.max(10, Math.cos(i) * 44 + 10), 10] : 10
                        }}
                        transition={{
                          repeat: Infinity,
                          duration: 0.7 + (i % 5) * 0.1,
                          delay: (i % 10) * 0.05
                        }}
                        className={`w-1 rounded-full ${
                          DJ_PERSONAS.find(p => p.id === activeStationPersona)?.glowColor || "bg-purple-500/80"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* DJ speech comments */}
                <div className="bg-white/[0.03] rounded-3xl border border-white/5 p-6 relative">
                  <div className="absolute -top-3 left-6 px-4 py-1 rounded-full bg-zinc-900 border border-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                    <Mic size={10} className="text-zinc-500 animate-pulse" />
                    <span>DJ Feed</span>
                  </div>

                  <div className="min-h-[50px] text-zinc-300 leading-relaxed text-sm font-medium italic py-2 pr-6 select-text selection:bg-purple-500/30">
                    "{commentaryText || "Transmitting frequency..."}"
                    {!textFinished && <span className="inline-block w-1.5 h-4 ml-1 bg-white animate-pulse" />}
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePlayDJVoice}
                        disabled={voiceLoading}
                        className={cn(
                          "px-5 py-2.5 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                          voicePlaying 
                            ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:scale-105 active:scale-95" 
                            : "bg-white/5 text-zinc-300 hover:bg-white/10 active:scale-95"
                        )}
                      >
                        {voiceLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : voicePlaying ? (
                          <>
                            <VolumeX size={12} />
                            Mute Commentator
                          </>
                        ) : (
                          <>
                            <Volume2 size={12} className="animate-bounce" />
                            Listen To Commentary
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                      Generated at 24.0 kHz Audio
                    </p>
                  </div>
                </div>

                {/* Quick Station Action */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => setActiveStation(null)}
                    className="flex-1 py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all text-[11px] font-black uppercase tracking-wider text-center"
                  >
                    Change Vibe Preset
                  </button>
                </div>
              </div>
            </div>

            {/* Playlist Queue Side panel */}
            <div className="space-y-6">
              <div className="rounded-[40px] bg-zinc-900/60 border border-white/5 p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/5 rounded-xl border border-white/5">
                      <ListMusic size={18} className="text-zinc-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold uppercase italic leading-none">Broadcast Queue</h3>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mt-1">Live Program</p>
                    </div>
                  </div>

                  {autoBatching && (
                    <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                      <Loader2 size={10} className="animate-spin text-purple-400" />
                      <span className="text-[8px] font-mono text-purple-400 uppercase tracking-widest font-black">Refilling</span>
                    </div>
                  )}
                </div>

                {/* Auto autopilot settings */}
                <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase">Station Autopilot</h4>
                    <p className="text-[9px] text-zinc-500 leading-normal mt-0.5">Auto-appends more tracks when queue runs low</p>
                  </div>
                  <button
                    onClick={() => setAutopilot(!autopilot)}
                    className={cn(
                      "w-12 h-6 rounded-full relative p-0.5 transition-colors duration-300",
                      autopilot ? "bg-rose-500" : "bg-zinc-800"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300",
                        autopilot ? "translate-x-6" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1 scroll-hide">
                  {activeStation.songs.map((song, i) => {
                    const isSongPlaying = currentSong?.title === song.title && isPlaying;
                    const isCurrentSelection = currentSong?.title === song.title;

                    return (
                      <motion.div
                        key={song.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setSong(song, activeStation.songs)}
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-2xl cursor-pointer border group/item transition-all",
                          isCurrentSelection 
                            ? "bg-zinc-800 border-purple-500/30 shadow-md"
                            : "bg-white/[0.03] border-transparent hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative w-12 h-12 rounded-xl shrink-0 overflow-hidden bg-zinc-800 shadow-md">
                            <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                            <div className={cn(
                              "absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity",
                              isCurrentSelection && "opacity-100"
                            )}>
                              {isSongPlaying ? (
                                <div className="flex items-end gap-0.5 h-3">
                                  <motion.div animate={{ height: [4, 12, 6, 10, 4] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-white" />
                                  <motion.div animate={{ height: [10, 4, 12, 8, 10] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.25 }} className="w-0.5 bg-white" />
                                </div>
                              ) : (
                                <Play size={14} fill="white" className="text-white" />
                              )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <h4 className={cn("text-xs font-bold truncate leading-tight", isCurrentSelection ? "text-purple-400" : "text-white")}>
                              {song.title}
                            </h4>
                            <p className="text-[9px] font-black uppercase text-zinc-500 tracking-wider truncate mt-0.5">
                              {song.artist}
                            </p>
                          </div>
                        </div>

                        <span className="text-[9px] font-mono text-zinc-600 font-bold ml-2 shrink-0">
                          {song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : "--:--"}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-12">
            {/* Persona Grid Selector */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                  <Headphones size={18} className="text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Choose Your DJ Persona</h2>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1.5">Each host speaks and curates in their own unique frequency</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {DJ_PERSONAS.map((p) => {
                  const isActive = activePersona === p.id;
                  return (
                    <motion.div
                      key={p.id}
                      onClick={() => {
                        setActivePersona(p.id);
                        handleTuneIn(p.id);
                      }}
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "relative flex flex-col p-6 rounded-[32px] border transition-all cursor-pointer group overflow-hidden h-64 justify-between",
                        isActive 
                          ? `bg-gradient-to-br ${p.color} border-white/30 shadow-2xl ${p.shadow}` 
                          : "bg-[#0F0F12] border-white/5 hover:border-white/15"
                      )}
                    >
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <span 
                            onClick={(e) => handleTagClick(e, p.genres[0])}
                            className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase hover:scale-105 active:scale-95 cursor-pointer hover:bg-white/30 hover:text-white transition-all select-none z-20 relative",
                              isActive ? "bg-white/20 text-white" : "bg-white/5 text-zinc-400 hover:text-zinc-200"
                            )}
                          >
                            {p.genres[0]}
                          </span>
                          
                          {isActive && (
                            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                              <Check size={12} className="text-white" />
                            </div>
                          )}
                        </div>

                        <h3 className="text-2xl font-black italic uppercase text-white leading-tight">
                          {p.label}
                        </h3>
                        <p className={cn("text-[9px] font-bold uppercase tracking-widest mt-0.5", isActive ? "text-white/80" : "text-purple-400")}>
                          {p.tagline}
                        </p>
                        
                        <p className={cn("text-xs leading-relaxed mt-4 line-clamp-3", isActive ? "text-white/80" : "text-zinc-500 group-hover:text-zinc-400")}>
                          {p.description}
                        </p>
                      </div>

                      <div className="relative z-20 border-t border-white/5 pt-3">
                        <div className="flex flex-wrap gap-1">
                          {p.genres.map((g) => (
                            <span 
                              key={g} 
                              onClick={(e) => handleTagClick(e, g)}
                              className="text-[8px] font-mono tracking-widest opacity-60 uppercase bg-white/5 px-1.5 py-0.5 rounded cursor-pointer hover:bg-white/25 hover:text-white hover:opacity-100 transition-all select-none z-20 relative active:scale-95"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Accent glow element */}
                      <div className={cn(
                        "absolute -right-12 -bottom-12 w-24 h-24 rounded-full blur-2xl opacity-0 transition-opacity",
                        isActive ? "opacity-30 bg-white" : "group-hover:opacity-10 bg-white"
                      )} />
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* Custom Station Inputs & Presets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Build Custom Channel Column */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <Sparkles size={18} className="text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Tune Station Frequency</h2>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1.5">Input your target sound coordinates, moods or genres</p>
                  </div>
                </div>

                <div className="rounded-[40px] bg-[#0F0F12] border border-white/5 p-8 sm:p-10 shadow-xl space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">Station coordinates</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder='e.g., "Mellow late-night synthwave driving music with heavy bass and vintage drums" or "Energetic workout high-BPM motivation pop"'
                      rows={4}
                      className="w-full rounded-2xl bg-white/5 border border-white/10 p-5 text-sm font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/10 transition-all leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2">
                    <div className="flex items-center gap-2.5 bg-white/[0.02] border border-white/5 px-4 py-2.5 rounded-full text-zinc-500 text-[10px] font-mono select-none">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      CO-PILOT: ACTIVE VIA {activePersonaConfig.label.toUpperCase()}
                    </div>

                    <button
                      onClick={() => handleTuneIn()}
                      disabled={loading || !prompt.trim()}
                      className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-white active:scale-95 transition-all shadow-xl shadow-white/5"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          Curating Tracks...
                        </>
                      ) : (
                        <>
                          <span>Broadcast Channel Now</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Preset Stations Column */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <Waves size={18} className="text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">Instant Channels</h2>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1.5">Pre-calibrated waves</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {PRESET_STATIONS.map((preset) => (
                    <div
                      key={preset.label}
                      onClick={() => {
                        setPrompt(preset.prompt);
                        handleTuneIn(activePersona, preset.prompt);
                      }}
                      className="flex items-center justify-between p-5 bg-[#0F0F12] border border-white/5 rounded-3xl hover:border-white/15 cursor-pointer hover:bg-white/[0.02] transition-all group/preset"
                    >
                      <div className="space-y-1 pr-4">
                        <h4 className="text-sm font-bold text-white group-hover/preset:text-rose-400 transition-colors uppercase leading-none">
                          {preset.label}
                        </h4>
                        <p className="text-[10px] text-zinc-500 line-clamp-1 mt-1 font-medium italic">
                          "{preset.prompt}"
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-zinc-600 group-hover/preset:translate-x-1 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
