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
  Sparkles,
  Waves,
  Gamepad2,
  Check
} from "lucide-react";
import { cn } from "../lib/utils";

export default function Settings() {
  const { 
    theme, setTheme, 
    crossfadeEnabled, setCrossfadeEnabled, 
    crossfadeDuration, setCrossfadeDuration,
    lowDataMode, setLowDataMode
  } = usePlayerStore();

  const themes = [
    { id: "classic", label: "Classic Noir", icon: Moon, color: "bg-zinc-900", accent: "from-purple-600 to-indigo-600" },
    { id: "midnight", label: "Deep Midnight", icon: Zap, color: "bg-slate-950", accent: "from-blue-600 to-cyan-600" },
    { id: "ocean", label: "Oceanic Abyss", icon: Waves, color: "bg-cyan-950", accent: "from-teal-500 to-emerald-600" },
    { id: "sunset", label: "Solar Flare", icon: Sun, color: "bg-orange-950", accent: "from-pink-600 to-orange-600" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="flex items-end gap-6">
        <div className="w-16 h-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
          <SettingsIcon size={32} className="text-white/40" />
        </div>
        <div>
          <h1 className="text-6xl font-black italic tracking-tighter text-gradient leading-tight uppercase">Control Center</h1>
          <p className="text-white/40 text-sm font-medium uppercase tracking-[0.3em] mt-1">Configure your sonic experience</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Appearance Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Palette size={18} className="text-purple-400" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Visual Architecture</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                className={cn(
                  "p-6 rounded-[32px] border transition-all text-left group relative overflow-hidden",
                  theme === t.id 
                    ? "bg-white/10 border-white/20 shadow-2xl scale-105" 
                    : "bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-all shadow-lg",
                  theme === t.id ? `bg-gradient-to-br ${t.accent} text-white` : "bg-white/5 text-white/20 group-hover:text-white"
                )}>
                  <t.icon size={20} />
                </div>
                <div className="flex items-center justify-between">
                   <p className={cn(
                     "text-xs font-black uppercase tracking-widest",
                     theme === t.id ? "text-white" : "text-white/40 group-hover:text-white"
                   )}>{t.label}</p>
                   {theme === t.id && (
                     <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                        <Check size={12} className="text-black" />
                     </div>
                   )}
                </div>

                {/* Theme Preview Gradient overlay */}
                <div className={cn(
                  "absolute -right-8 -bottom-8 w-24 h-24 rounded-full blur-[40px] opacity-0 transition-opacity duration-700",
                  theme === t.id ? "opacity-40" : "group-hover:opacity-10"
                )} style={{ background: t.accent.includes('indigo') ? '#6366f1' : t.accent.includes('cyan') ? '#0891b2' : t.accent.includes('emerald') ? '#059669' : '#db2777' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Audio Engine Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <Cpu size={18} className="text-indigo-400" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Audio Processor</h3>
          </div>

          <div className="space-y-4">
            <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-8 space-y-8">
              {/* Crossfade Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Waves size={20} className={crossfadeEnabled ? "text-indigo-400" : "text-white/20"} />
                   </div>
                   <div>
                      <p className="text-sm font-black italic uppercase tracking-tight text-white mb-1">Crossfade Engine</p>
                      <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Eliminate gaps between tracks</p>
                   </div>
                </div>
                <button
                  onClick={() => setCrossfadeEnabled(!crossfadeEnabled)}
                  className={cn(
                    "w-14 h-8 rounded-full border-2 transition-all p-1 flex items-center",
                    crossfadeEnabled ? "bg-indigo-500 border-indigo-400" : "bg-white/5 border-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: crossfadeEnabled ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-5 h-5 rounded-full bg-white shadow-lg" 
                  />
                </button>
              </div>

              {/* Crossfade Duration */}
              <AnimatePresence>
                {crossfadeEnabled && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-6 pt-4 border-t border-white/5"
                  >
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Overlap Threshold</label>
                       <span className="text-sm font-mono font-black italic text-indigo-400">{crossfadeDuration}S</span>
                    </div>
                    <div className="relative h-2 flex items-center group">
                      <input 
                        type="range"
                        min="1"
                        max="12"
                        step="0.5"
                        value={crossfadeDuration}
                        onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                      />
                      <div className="w-full h-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                          style={{ width: `${(crossfadeDuration / 12) * 100}%` }}
                        />
                      </div>
                      <div 
                        className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.4)] pointer-events-none z-10 border-4 border-indigo-500"
                        style={{ left: `calc(${(crossfadeDuration / 12) * 100}% - 8px)` }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Performance Mode */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-8 flex items-center justify-between">
               <div className="flex gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Sparkles size={20} className={lowDataMode ? "text-purple-400" : "text-white/20"} />
                   </div>
                   <div>
                      <p className="text-sm font-black italic uppercase tracking-tight text-white mb-1">Efficiency Signal</p>
                      <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest leading-relaxed">Lower bandwidth consumption & thermal profile</p>
                   </div>
                </div>
                <button
                  onClick={() => setLowDataMode(!lowDataMode)}
                  className={cn(
                    "w-14 h-8 rounded-full border-2 transition-all p-1 flex items-center",
                    lowDataMode ? "bg-purple-500 border-purple-400" : "bg-white/5 border-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: lowDataMode ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-5 h-5 rounded-full bg-white shadow-lg" 
                  />
                </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-12 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-6 space-y-4">
            <div className="flex items-center gap-3">
               <Shield size={16} className="text-zinc-500" />
               <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Vault Integrity</p>
            </div>
            <p className="text-xs text-white/20 font-medium leading-relaxed">Encryption status optimal. Your localized library assets are secured via bi-directional hashing.</p>
         </div>
         <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-6 space-y-4">
            <div className="flex items-center gap-3">
               <Eye size={16} className="text-zinc-500" />
               <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Telemetry</p>
            </div>
            <p className="text-xs text-white/20 font-medium leading-relaxed">AI learning patterns refined. Personalization engine tuned to 98.4% emotional resonance accuracy.</p>
         </div>
         <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-6 space-y-4">
            <div className="flex items-center gap-3">
               <Gamepad2 size={16} className="text-zinc-500" />
               <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Core Version</p>
            </div>
            <p className="text-xs text-white/20 font-medium leading-relaxed">Build 2.0.4-Stable. Neural pathing for playlist generation optimized for high-velocity browsing.</p>
         </div>
      </div>
    </div>
  );
}
