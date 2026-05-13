import { useEffect, useState } from "react";
import { Sparkles, Play, RefreshCw } from "lucide-react";
import { getPersonalizedRecommendations } from "../services/recommendationService";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { motion } from "motion/react";
import axios from "axios";

interface Recommendation {
  title: string;
  artist: string;
  reason: string;
}

export default function ForYou() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const { setSong, currentSong, isPlaying, togglePlay, recentlyPlayed } = usePlayerStore();
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    if (recentlyPlayed.length === 0) {
      setRecommendations([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const history = recentlyPlayed.map(s => ({ title: s.title, artist: s.artist }));
      
      // Extract unique genres from history to help the AI
      const genres = Array.from(new Set(
        recentlyPlayed
          .map(s => s.genre)
          .filter((g): g is string => !!g)
      )).slice(0, 3);

      const recs = await getPersonalizedRecommendations(history, genres.length > 0 ? genres : ["Contemporary", "Electronic"]);
      setRecommendations(recs);
    } catch (err) {
      console.error("Failed to fetch AI recommendations:", err);
      setError("AI Signal Interrupted. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-gradient leading-tight">AI FOR YOU</h1>
          <p className="text-white/40 text-sm font-medium uppercase tracking-widest mt-2">Personalized curations updated in real-time</p>
        </div>
        <button 
          onClick={fetchRecommendations}
          disabled={loading}
          className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-50"
        >
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm font-bold text-zinc-500 animate-pulse">ANALYZING YOUR TASTE...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recommendations.map((rec, i) => {
            const songId = `rec-${i}`;
            const isActive = currentSong?.id === songId;
            return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className={`flex items-center gap-6 p-6 rounded-3xl border transition-all ${
                isActive ? "bg-zinc-800 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.1)]" : "bg-zinc-900 border-white/5 group hover:border-purple-500/30"
              }`}
            >
              <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-xl overflow-hidden">
                 <Sparkles size={32} className="text-white/80 group-hover:scale-110 transition-transform" />
                 <button 
                   onClick={async () => {
                     if (isActive) {
                       togglePlay();
                       return;
                     }

                     let sid = "";
                     try {
                        const searchRes = await axios.get("/api/search", { params: { q: `${rec.title} ${rec.artist}` } });
                        if (searchRes.data && searchRes.data.length > 0) {
                          sid = searchRes.data[0].sourceId;
                        }
                     } catch (e) {
                        console.error("Search failed for recommendation", e);
                     }

                     const queue: Song[] = recommendations.map((r, idx) => ({
                       id: `rec-${idx}`,
                       title: r.title,
                       artist: r.artist,
                       thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
                       source: "youtube",
                       sourceId: i === idx ? sid : ""
                     }));
                     setSong(queue[i], queue);
                   }}
                   className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity rounded-2xl ${
                     isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                   }`}
                 >
                   {isActive && isPlaying ? (
                      <div className="flex items-end gap-1 h-6">
                        <motion.div animate={{ height: [8, 24, 10, 18, 8] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-white" />
                        <motion.div animate={{ height: [18, 8, 24, 12, 18] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-white" />
                        <motion.div animate={{ height: [12, 20, 8, 24, 12] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-white" />
                      </div>
                   ) : (
                      <Play size={32} fill="white" />
                   )}
                 </button>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-xl font-bold truncate leading-tight ${isActive ? "text-purple-400" : "text-white"}`}>{rec.title}</h3>
                <p className="text-zinc-400 font-bold text-sm mb-3">{rec.artist}</p>
                <div className="bg-white/5 px-4 py-2 rounded-xl">
                  <p className="text-[10px] text-purple-300 italic leading-relaxed">{rec.reason}</p>
                </div>
              </div>
            </motion.div>
          )})}
        </div>
      )}
      
      {!loading && recommendations.length === 0 && (
         <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <p className="text-zinc-500 font-bold italic">NOT ENOUGH DATA YET. KEEP LISTENING!</p>
         </div>
      )}
    </div>
  );
}
