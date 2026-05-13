import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, User, Trophy, Music, Users, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";
import { fetchArtistDetailsFromAI, ArtistInfo } from "../services/artistService";

interface ArtistDetailsProps {
  artistName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ArtistDetails({ artistName, isOpen, onClose }: ArtistDetailsProps) {
  const [info, setInfo] = useState<ArtistInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && artistName) {
      fetchArtistInfo();
    }
  }, [isOpen, artistName]);

  const fetchArtistInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      // Split artist name if multiple (e.g. "feat. X" or "X & Y")
      const soloName = artistName.split(/[,&]|feat\.|ft\./i)[0].trim();
      const data = await fetchArtistDetailsFromAI(soloName);
      if (data) {
        setInfo(data);
      } else {
        setError("AI Signal Interrupted. Could not analyze this artist.");
      }
    } catch (err) {
      console.error("Failed to fetch artist details:", err);
      setError("AI Signal Interrupted. Could not analyze this artist.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-3xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl bg-[#0B0B0E] border border-white/10 rounded-[3rem] shadow-[0_100px_200px_-50px_rgba(0,0,0,1)] overflow-hidden flex flex-col md:flex-row h-[80vh]"
          >
            {/* Header / Image Area */}
            <div className="w-full md:w-2/5 p-12 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/20 to-transparent border-r border-white/5 relative">
               <div className="absolute top-8 left-8">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    <User size={24} className="text-purple-400" />
                  </div>
               </div>
               
               <div className="relative group">
                 <div className="w-48 h-48 rounded-[3rem] bg-zinc-800 shadow-2xl flex items-center justify-center overflow-hidden border-2 border-purple-500/20">
                    <img 
                      src={`https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=400&fit=crop`} 
                      className="w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" 
                    />
                    <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center">
                       <Sparkles size={48} className="text-white/20 animate-pulse" />
                    </div>
                 </div>
               </div>

               <div className="mt-8 text-center">
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-2">{artistName}</h2>
                  <div className="px-4 py-1.5 bg-purple-500/10 rounded-full border border-purple-500/20">
                     <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em]">{info?.genre || "Sonic Artist"}</span>
                  </div>
               </div>
               
               <button 
                 onClick={onClose}
                 className="absolute top-8 right-8 md:hidden text-white/30 hover:text-white"
               >
                 <X size={24} />
               </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-12 overflow-y-auto scroll-hide relative">
              <button 
                 onClick={onClose}
                 className="absolute top-12 right-12 hidden md:flex w-12 h-12 rounded-full bg-white/5 border border-white/10 items-center justify-center hover:bg-white/10 transition-all z-10"
               >
                 <X size={20} />
               </button>

               {loading ? (
                 <div className="h-full flex flex-col items-center justify-center gap-6">
                    <div className="flex items-end gap-1.5 h-12">
                      {[...Array(5)].map((_, i) => (
                        <motion.div 
                          key={i}
                          animate={{ height: [8, 48, 12, 32, 8] }}
                          transition={{ repeat: Infinity, duration: 1, delay: i * 0.1 }}
                          className="w-2 bg-purple-500 rounded-full"
                        />
                      ))}
                    </div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] animate-pulse">Analyzing Signal Profile...</p>
                 </div>
               ) : error ? (
                 <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-rose-400 font-bold mb-4">{error}</p>
                    <button onClick={fetchArtistInfo} className="text-xs font-black uppercase tracking-widest text-white/40 hover:text-white underline">Retry Sync</button>
                 </div>
               ) : info ? (
                 <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-12"
                 >
                    {/* Bio */}
                    <section>
                       <div className="flex items-center gap-3 mb-6">
                          <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Biography</h3>
                       </div>
                       <p className="text-xl font-bold leading-relaxed text-zinc-300 italic">
                         "{info.bio}"
                       </p>
                    </section>

                    {/* Highlights */}
                    <section>
                       <div className="flex items-center gap-3 mb-6">
                          <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Career Milestones</h3>
                       </div>
                       <div className="grid grid-cols-1 gap-4">
                          {info.career_highlights.map((h, i) => (
                            <div key={i} className="group p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 transition-all flex items-start gap-4">
                               <div className="w-10 h-10 rounded-xl bg-purple-500/5 flex items-center justify-center border border-purple-500/10 shrink-0 mt-1">
                                  <Trophy size={16} className="text-purple-400" />
                               </div>
                               <p className="text-sm font-bold text-zinc-400 leading-relaxed group-hover:text-white transition-colors">{h}</p>
                            </div>
                          ))}
                       </div>
                    </section>

                    {/* Similar Artists */}
                    <section>
                       <div className="flex items-center gap-3 mb-6">
                          <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Sonically Similar</h3>
                       </div>
                       <div className="flex flex-wrap gap-3">
                          {info.similar_artists.map((artist, i) => (
                            <button key={i} className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-3 group">
                               <Users size={14} className="text-zinc-500 group-hover:text-purple-400" />
                               <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">{artist}</span>
                            </button>
                          ))}
                       </div>
                    </section>

                    <div className="pt-12 border-t border-white/5 flex items-center justify-between">
                       <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">AI Core generated profile</p>
                       <div className="flex gap-4">
                          <button className="text-[9px] font-black text-white/40 hover:text-white uppercase tracking-widest flex items-center gap-2">
                             Full Discography <ExternalLink size={10} />
                          </button>
                       </div>
                    </div>
                 </motion.div>
               ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
