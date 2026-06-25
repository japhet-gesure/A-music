import { useState, useEffect } from "react";
import React from "react";
import { 
  Sparkles, Search, Play, ListPlus, Loader2, Music, 
  Smile, CloudRain, Wind, Zap, Moon, Heart, Coffee, 
  Flame, Sun, Waves, Ghost, Headphones, Info, Calendar, Disc, X, Star
} from "lucide-react";
import { safeLocalStorage } from "../lib/safeStorage";

const localStorage = safeLocalStorage;
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { LikeButton } from "./LikeButton";
import { motion, AnimatePresence } from "motion/react";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { cn } from "../lib/utils";
import axios from "axios";
import { fetchArtwork } from "../services/artworkService";

const MOODS = [
  { 
    id: "euphoric", 
    label: "Euphoric", 
    prompt: "high energy, happy, upbeat, synthesizers, major key, danceable", 
    icon: Sun, 
    color: "from-amber-400 to-orange-500",
    shadow: "shadow-orange-500/20"
  },
  { 
    id: "melancholic", 
    label: "Melancholic", 
    prompt: "piano, acoustic, sad, deep emotions, slow tempo, reflective", 
    icon: CloudRain, 
    color: "from-blue-400 to-indigo-600",
    shadow: "shadow-indigo-500/20"
  },
  { 
    id: "chill", 
    label: "Zen / Chill", 
    prompt: "lofi, ambient, relaxed, soft textures, atmospheric, calm", 
    icon: Wind, 
    color: "from-teal-400 to-emerald-600",
    shadow: "shadow-emerald-500/20"
  },
  { 
    id: "power", 
    label: "Power", 
    prompt: "aggressive beats, heavy bass, intense, motivating, loud", 
    icon: Zap, 
    color: "from-red-500 to-rose-700",
    shadow: "shadow-rose-500/20"
  },
  { 
    id: "nocturnal", 
    label: "Dark / Nocturnal", 
    prompt: "dark synthwave, mysterious, deep house, night vibes, underground", 
    icon: Moon, 
    color: "from-purple-600 to-slate-900",
    shadow: "shadow-purple-500/20"
  },
  { 
    id: "soulful", 
    label: "Soulful", 
    prompt: "jazz, neo-soul, warm vocals, bluesy, groove, rhythmic", 
    icon: Coffee, 
    color: "from-pink-500 to-purple-600",
    shadow: "shadow-pink-500/20"
  },
  { 
    id: "energetic", 
    label: "Energetic", 
    prompt: "high tempo, pumping beats, electronic, driving percussion, workout energy", 
    icon: Flame, 
    color: "from-orange-500 to-red-600",
    shadow: "shadow-orange-500/20"
  },
  { 
    id: "romantic", 
    label: "Romantic", 
    prompt: "love songs, slow dance, sentimental, soft melodies, romantic lyrics", 
    icon: Heart, 
    color: "from-rose-400 to-pink-500",
    shadow: "shadow-rose-400/20"
  },
  { 
    id: "mysterious", 
    label: "Mysterious", 
    prompt: "eerie, cinematic, dark ambient, unexpected transitions, atmospheric, unknown", 
    icon: Ghost, 
    color: "from-slate-700 to-zinc-900",
    shadow: "shadow-slate-700/20"
  },
  { 
    id: "focus", 
    label: "Focus", 
    prompt: "minimalist, techno, deep house, repetitive, steady rhythm, concentration", 
    icon: Headphones, 
    color: "from-blue-500 to-blue-800",
    shadow: "shadow-blue-500/20"
  },
  { 
    id: "vibrant", 
    label: "Vibrant", 
    prompt: "pop, colourful, funky, infectious groove, summer vibes", 
    icon: Waves, 
    color: "from-cyan-400 to-blue-500",
    shadow: "shadow-cyan-500/20"
  }
];

export default function AIVibeSearch() {
  const [prompt, setPrompt] = useState("");
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const { setSong, currentSong, isPlaying, togglePlay } = usePlayerStore();
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [detailedSong, setDetailedSong] = useState<any | null>(null);
  const [headerBg, setHeaderBg] = useState<string | null>("https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=1200");
  const [favoriteMoods, setFavoriteMoods] = useState<string[]>(() => {
    const saved = localStorage.getItem("favorite_moods");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("favorite_moods", JSON.stringify(favoriteMoods));
  }, [favoriteMoods]);

  const toggleFavorite = (e: React.MouseEvent, moodId: string) => {
    e.stopPropagation();
    setFavoriteMoods(prev => 
      prev.includes(moodId) ? prev.filter(id => id !== moodId) : [...prev, moodId]
    );
  };

  const sortedMoods = [...MOODS].sort((a, b) => {
    const isAFavorite = favoriteMoods.includes(a.id);
    const isBFavorite = favoriteMoods.includes(b.id);
    if (isAFavorite && !isBFavorite) return -1;
    if (!isAFavorite && isBFavorite) return 1;
    return 0;
  });

  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const handleVibeSearch = async (inputPrompt: string) => {
    const finalPrompt = inputPrompt.trim();
    if (!finalPrompt) return;

    setLoading(true);
    setErrorStatus(null);
    setPrompt(finalPrompt);
    try {
      const response = await axios.post("/api/vibe-search", { prompt: finalPrompt });
      const recs = response.data;
      
      if (recs && recs.length > 0) {
        fetchArtwork(recs[0].title, recs[0].artist).then(art => {
          if (art) setHeaderBg(art);
        });
      }

      const initialRecs = recs.map((r: any, i: number) => ({
        id: `ai-vibe-${i}-${Date.now()}`,
        title: r.title,
        artist: r.artist,
        album: r.album,
        releaseDate: r.releaseDate,
        thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
        source: "youtube",
        sourceId: "", 
        pending: true
      }));

      setRecommendations(initialRecs);

      // Background fetch durations and source IDs from YouTube
      initialRecs.forEach(async (song: any) => {
        try {
          const searchRes = await axios.get("/api/search", { params: { q: `${song.title} ${song.artist}` } });
          if (searchRes.data && searchRes.data.length > 0) {
            const topResult = searchRes.data[0];
            setRecommendations(prev => prev.map(r => r.id === song.id ? {
              ...r,
              sourceId: topResult.sourceId,
              thumbnail: topResult.thumbnail,
              duration: topResult.duration,
              pending: false
            } : r));
          } else {
            setRecommendations(prev => prev.map(r => r.id === song.id ? { ...r, pending: false } : r));
          }
        } catch (err) {
          console.error("Failed to fetch metadata in background", err);
          setRecommendations(prev => prev.map(r => r.id === song.id ? { ...r, pending: false } : r));
        }
      });
    } catch (err: any) {
      console.error("Vibe search failed", err);
      if (err.message?.includes("quota") || err.message?.includes("RESOURCE_EXHAUSTED")) {
        setErrorStatus("Vibe Engine at capacity. Using fallback...");
        // Fallback: simple text search for similar songs or just show empty with message
      } else {
        setErrorStatus("Vibe Engine encountered a signal interruption.");
      }
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMoodClick = (mood: typeof MOODS[0]) => {
    setActiveMood(mood.id);
    handleVibeSearch(mood.prompt);
  };

  const SongSkeleton = () => (
    <div className="flex items-center justify-between p-4 rounded-3xl bg-white/[0.03] border border-transparent animate-pulse">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-white/5 shrink-0" />
        <div className="space-y-3">
          <div className="h-5 w-48 bg-white/10 rounded-lg" />
          <div className="h-3 w-32 bg-white/5 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-white/5 rounded-full" />
        <div className="h-8 w-8 bg-white/5 rounded-full" />
      </div>
    </div>
  );

  const playSong = async (song: any, index: number) => {
    const isActive = currentSong?.id === song.id;
    if (isActive) {
      togglePlay();
      return;
    }

    let updatedSong = { ...song };
    if (song.pending) {
      try {
        const searchRes = await axios.get("/api/search", { params: { q: `${song.title} ${song.artist}` } });
        if (searchRes.data && searchRes.data.length > 0) {
          const topResult = searchRes.data[0];
          updatedSong = {
            ...song,
            sourceId: topResult.sourceId,
            thumbnail: topResult.thumbnail,
            duration: topResult.duration,
            pending: false
          };
          
          // Update local state so item looks better
          const nextRecs = [...recommendations];
          nextRecs[index] = updatedSong;
          setRecommendations(nextRecs);
        }
      } catch (err) {
        console.error("Failed to find song on YouTube", err);
      }
    }

    // Now play it
    // Create a queue from the current recommendations
    const queue = recommendations.map((r, i) => i === index ? updatedSong : r);
    setSong(updatedSong, queue as Song[]);
  };

  return (
    <div className="space-y-12 pb-20">
      <AnimatePresence>
        {selectedSong && (
          <AddToPlaylistModal 
            song={selectedSong} 
            onClose={() => setSelectedSong(null)} 
          />
        )}
        {detailedSong && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setDetailedSong(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[40px] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-video">
                <img 
                  src={detailedSong.thumbnail || undefined} 
                  className="w-full h-full object-cover" 
                  alt={detailedSong.title} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
                <button 
                  onClick={() => setDetailedSong(null)}
                  className="absolute top-4 right-4 p-3 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <h2 className="text-3xl font-black italic uppercase text-white truncate mb-1">
                    {detailedSong.title}
                  </h2>
                  <p className="text-lg font-bold text-purple-400 italic">
                    {detailedSong.artist}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 border border-white/5 rounded-3xl p-4 space-y-1">
                    <div className="flex items-center gap-2 text-white/30">
                      <Disc size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Album</span>
                    </div>
                    <p className="text-sm font-bold text-white/90 truncate">{detailedSong.album || "Unknown"}</p>
                  </div>
                  <div className="bg-white/5 border border-white/5 rounded-3xl p-4 space-y-1">
                    <div className="flex items-center gap-2 text-white/30">
                      <Calendar size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Released</span>
                    </div>
                    <p className="text-sm font-bold text-white/90 truncate">{detailedSong.releaseDate || "Unknown"}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const idx = recommendations.findIndex(r => r.id === detailedSong.id);
                      playSong(detailedSong, idx);
                      setDetailedSong(null);
                    }}
                    className="flex-1 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-[10px] items-center justify-center flex gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5"
                  >
                    <Play size={14} fill="black" />
                    Play Signal
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSong(detailedSong);
                      setDetailedSong(null);
                    }}
                    className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white/40 hover:text-white transition-all"
                  >
                    <ListPlus size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className={cn(
        "relative rounded-[40px] overflow-hidden group transition-all duration-700",
        "py-12 px-6 sm:py-20 sm:px-12", // Responsive padding
      )}>
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-800 opacity-90 group-hover:scale-105 transition-transform duration-1000" />
        {headerBg ? (
          <div 
            className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-30 transition-all duration-1000" 
            style={{ backgroundImage: `url(${headerBg})` }} 
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-black/50 to-transparent opacity-30" />
        )}
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-purple-200 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-6"
          >
            <Sparkles size={6} />
            <span>AI Vibes Engine v3.0</span>
          </motion.div>
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black italic tracking-tighter text-white leading-tight mb-8 uppercase px-2">
            Search by <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300">Emotion</span>
          </h1>

          <AnimatePresence>
            {errorStatus && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-3xl backdrop-blur-xl flex items-center justify-center gap-3 text-rose-400 font-bold uppercase tracking-widest text-xs"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {errorStatus}
              </motion.div>
            )}
          </AnimatePresence>
          
          <form onSubmit={(e) => { e.preventDefault(); handleVibeSearch(prompt); }} className="relative group max-w-2xl mx-auto mb-12 sm:mb-16 px-2">
            <input 
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="How are you feeling?"
              className="w-full bg-gradient-to-br from-white/[0.12] to-white/[0.04] backdrop-blur-xl border-2 border-white/10 rounded-full px-6 py-5 sm:px-8 sm:py-7 pr-20 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 transition-all text-lg sm:text-xl font-medium shadow-2xl"
            />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-5 top-3 bottom-3 w-12 sm:w-16 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-all disabled:opacity-50 shadow-lg active:scale-90"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Search className="w-2.5 h-2.5 sm:w-5 sm:h-5 md:w-6 md:h-6" />}
            </button>
          </form>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {sortedMoods.map((mood) => {
              const isFavorite = favoriteMoods.includes(mood.id);
              return (
                <motion.div
                  key={mood.id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleMoodClick(mood)}
                  className={cn(
                    "relative flex flex-col items-center gap-3 p-6 rounded-[32px] transition-all border group overflow-hidden cursor-pointer",
                    activeMood === mood.id 
                      ? `bg-gradient-to-br ${mood.color} border-white/40 shadow-xl ${mood.shadow}` 
                      : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10"
                  )}
                >
                  <button
                    onClick={(e) => toggleFavorite(e, mood.id)}
                    className={cn(
                      "absolute top-4 right-4 p-2 rounded-full transition-all z-20",
                      isFavorite ? "bg-white/20 text-yellow-400" : "bg-black/20 text-white/20 hover:text-white"
                    )}
                  >
                    <Star size={12} fill={isFavorite ? "currentColor" : "none"} />
                  </button>

                  <div className={cn(
                    "w-6 h-6 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-1 transition-all",
                    activeMood === mood.id ? "bg-white/20 text-white" : "bg-white/5 text-white/40 group-hover:text-white"
                  )}>
                    <mood.icon className="w-2.5 h-2.5 sm:w-6 sm:h-6" />
                  </div>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-[0.2em]",
                    activeMood === mood.id ? "text-white" : "text-white/40 group-hover:text-white"
                  )}>
                    {mood.label}
                  </span>
                  
                  {/* Decorative background element */}
                  <div className={cn(
                    "absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-2xl opacity-0 transition-opacity",
                    activeMood === mood.id ? "opacity-40 bg-white" : "group-hover:opacity-20 bg-white"
                  )} />
                </motion.div>
              );
            })}
          </div>
        </div>
      </header>

      {(loading || recommendations.length > 0) && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Music size={20} className="text-white" />
              </div>
              {loading ? "Manifesting Vibes..." : "Generated Vibes"}
            </h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              {loading ? "AI is processing emotions" : `${recommendations.length} Results matched`}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={`skeleton-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <SongSkeleton />
                </motion.div>
              ))
            ) : (
              recommendations.map((song, i) => {
                const isActive = currentSong?.id === song.id;
                return (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ 
                      y: -4, 
                      scale: 1.01,
                      boxShadow: "0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.4)"
                    }}
                    onClick={() => playSong(song, i)}
                    className={cn(
                      "group relative flex items-center justify-between p-4 rounded-3xl transition-all cursor-pointer border",
                      isActive 
                        ? "bg-zinc-800 border-purple-500/50 shadow-2xl" 
                        : "bg-white/5 border-transparent hover:bg-white/10"
                    )}
                  >
                  <div className="flex items-center gap-6 min-w-0">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-xl shrink-0 bg-zinc-800">
                      <img 
                        src={song.thumbnail || undefined} 
                        alt={song.title} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      />
                      {isActive && <div className="absolute inset-0 bg-purple-500/20 backdrop-blur-[2px]" />}
                      <div className={cn(
                        "absolute inset-0 flex items-center justify-center bg-black/40 opacity-100 block transition-opacity",
                        isActive && "opacity-100"
                      )}>
                        {isActive && isPlaying ? (
                           <div className="flex items-end gap-1 h-4">
                             <motion.div animate={{ height: [6, 16, 8, 12, 6] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-white" />
                             <motion.div animate={{ height: [12, 6, 16, 10, 12] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-white" />
                           </div>
                        ) : (
                           <Play size={20} fill="white" className="text-white" />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className={cn("font-bold text-lg truncate leading-tight", isActive ? "text-purple-400" : "text-white")}>
                        {song.title}
                      </h3>
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">
                        {song.artist}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 lg:gap-8 min-w-fit">
                    <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:translate-x-4 sm:group-hover:translate-x-0 transition-all duration-300 ease-out">
                       <button 
                         onClick={(e) => { e.stopPropagation(); setDetailedSong(song); }}
                         className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group/btn"
                       >
                         <Info size={8} />
                         <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block overflow-hidden max-w-0 group-hover/btn:max-w-[100px] transition-all duration-500">Details</span>
                       </button>
                       
                       <LikeButton targetId={song.id} type="song" size={8} className="p-2 hover:bg-white/5 rounded-xl transition-all" />
                       
                       <button 
                         onClick={(e) => { e.stopPropagation(); setSelectedSong(song); }}
                         className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 text-white/40 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all border border-transparent hover:border-cyan-400/20 group/btn"
                       >
                         <ListPlus size={8} />
                         <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block overflow-hidden max-w-0 group-hover/btn:max-w-[100px] transition-all duration-500">Collect</span>
                       </button>
                    </div>
                    {song.pending ? (
                      <div className="h-2 w-8 bg-white/5 rounded animate-pulse hidden md:block" />
                    ) : song.duration ? (
                      <span className="text-[10px] font-mono text-zinc-600 hidden md:block">
                        {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.section>
    )}

      {recommendations.length === 0 && !loading && (
        <div className="max-w-xl mx-auto py-20 text-center space-y-4">
           <div className="inline-flex p-6 rounded-[32px] bg-white/5 border border-white/5 text-white/10 mb-4">
              <Sparkles size={64} />
           </div>
           <h3 className="text-xl font-bold italic text-zinc-500 uppercase tracking-tighter">Your Vibe Is Waiting</h3>
           <p className="text-zinc-600 text-sm max-w-xs mx-auto">Describe what you want to hear and our AI will manifest the perfect signal.</p>
        </div>
      )}
    </div>
  );
}
