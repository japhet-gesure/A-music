import { useEffect, useState } from "react";
import { Sparkles, Play, Info } from "lucide-react";
import { getPersonalizedRecommendations } from "../services/recommendationService";
import { usePlayerStore, Song } from "../store/usePlayerStore";
import { motion } from "motion/react";
import axios from "axios";
import { cn } from "../lib/utils";
import { Link } from "react-router-dom";

interface Recommendation {
  title: string;
  artist: string;
  reason: string;
}

export default function AIPicks() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const { setSong, currentSong, isPlaying, togglePlay, recentlyPlayed } = usePlayerStore();

  const fetchRecommendations = async () => {
    if (recentlyPlayed.length === 0) return;
    
    setLoading(true);
    try {
      const history = recentlyPlayed.map(s => ({ title: s.title, artist: s.artist }));
      const genres = Array.from(new Set(
        recentlyPlayed.map(s => s.genre).filter((g): g is string => !!g)
      )).slice(0, 3);

      const recs = await getPersonalizedRecommendations(history, genres.length > 0 ? genres : ["Electronic", "Pop"]);
      setRecommendations(recs);
    } catch (err) {
      console.error("Home AI Recommendation Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [recentlyPlayed.length === 0]); // Re-fetch if history was empty and now isn't

  if (recentlyPlayed.length === 0) return null;

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Sparkles size={20} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter uppercase">Magic Selections</h2>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-1 italic">Synthesized from your frequency history</p>
          </div>
        </div>
        <Link to="/for-you" className="text-[10px] font-black text-purple-400 hover:text-white transition-colors uppercase tracking-widest border border-purple-400/20 px-3 py-1.5 rounded-full hover:bg-purple-400/10">Full Analysis</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {loading && recommendations.length === 0 ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="aspect-square bg-white/[0.02] border border-white/5 rounded-3xl animate-pulse" />
          ))
        ) : (
          recommendations.slice(0, 5).map((rec, i) => {
            const songId = `ai-${i}`;
            const isActive = currentSong?.title === rec.title && currentSong?.artist === rec.artist;
            
            return (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                className={cn(
                  "p-5 rounded-3xl transition-all duration-500 group cursor-pointer border relative overflow-hidden",
                  isActive ? "bg-purple-600 border-purple-400 shadow-[0_20px_40px_rgba(168,85,247,0.2)]" : "bg-white/[0.03] border-white/5 hover:border-purple-500/30"
                )}
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

                  const song: Song = {
                    id: `ai-${i}`,
                    title: rec.title,
                    artist: rec.artist,
                    thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
                    source: "youtube",
                    sourceId: sid
                  };
                  setSong(song);
                }}
              >
                <div className="aspect-square bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl mb-4 flex items-center justify-center relative overflow-hidden shadow-inner font-black text-zinc-800 italic select-none">
                  AI
                  <div className="absolute inset-x-0 bottom-0 py-2 bg-black/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={20} fill="white" className="text-white" />
                  </div>
                  {isActive && (
                    <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                       <div className="flex items-end gap-1 h-6">
                        <motion.div animate={{ height: [8, 20, 10, 16, 8] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-white" />
                        <motion.div animate={{ height: [16, 8, 20, 12, 16] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-white" />
                        <motion.div animate={{ height: [12, 18, 8, 20, 12] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-white" />
                      </div>
                    </div>
                  )}
                </div>
                <h3 className={cn("text-sm font-black truncate tracking-tight transition-colors", isActive ? "text-white" : "text-white")}>{rec.title}</h3>
                <p className={cn("text-[10px] font-bold uppercase tracking-widest truncate mt-1 transition-colors", isActive ? "text-white/60" : "text-zinc-500")}>{rec.artist}</p>
                
                {/* Reason Tooltip on Hover */}
                <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-center text-center">
                   <Info size={16} className="text-purple-400 mx-auto mb-3" />
                   <p className="text-[9px] font-bold text-white/80 leading-relaxed italic uppercase tracking-tighter">
                     "{rec.reason}"
                   </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </section>
  );
}
