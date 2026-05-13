import { usePlayerStore } from "../../store/usePlayerStore";
import { X, SlidersHorizontal, ChevronDown, AlertCircle, Check, Plus, Trash2, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect } from "react";
import { cn } from "../../lib/utils";

interface EqualizerControlsProps {
  onClose: () => void;
  analyser?: AnalyserNode | null;
}

const BANDS = [
  { freq: 60, label: "Bass" },
  { freq: 230, label: "Low-Mid" },
  { freq: 910, label: "Mid" },
  { freq: 4000, label: "High-Mid" },
  { freq: 14000, label: "Treble" },
];

const PRESETS: Record<string, Record<number, number>> = {
  "Flat": { 60: 0, 230: 0, 910: 0, 4000: 0, 14000: 0 },
  "Bass Boost": { 60: 7, 230: 4, 910: 0, 4000: 0, 14000: 0 },
  "Rock": { 60: 5, 230: 3, 910: -1, 4000: 3, 14000: 5 },
  "Pop": { 60: -1, 230: 1, 910: 3, 4000: 4, 14000: -1 },
  "Jazz": { 60: 3, 230: 2, 910: -1, 4000: 2, 14000: 4 },
  "Classical": { 60: 4, 230: 3, 910: 0, 4000: 4, 14000: 5 },
  "Chillhop": { 60: 5, 230: 2, 910: 0, 4000: -3, 14000: -5 },
  "Synthwave": { 60: 7, 230: 2, 910: -3, 4000: 5, 14000: 7 },
  "Classical Cello": { 60: 6, 230: 8, 910: 3, 4000: 0, 14000: 1 },
  "Vibes": { 60: 3, 230: -2, 910: 1, 4000: 5, 14000: 7 },
};

export function EqualizerControls({ onClose, analyser }: EqualizerControlsProps) {
  const { 
    equalizerSettings, setEqualizerBand, lowDataMode, setLowDataMode,
    currentTime, duration, seekTo, isPlaying,
    customPresets, saveCustomPreset, deleteCustomPreset
  } = usePlayerStore();
  const [activePreset, setActivePreset] = useState<string>("Flat");
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Find if we clicked the toggle button
        const isToggleButton = (event.target as HTMLElement).closest('[title="Equalizer"]');
        if (!isToggleButton) {
          onClose();
        }
      }
    }
    
    // Use a delay for attaching the listener to prevent immediate closing when button is clicked
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Constants for enhanced visualizer
  const VIS_BARS = 32;
  const [analyzerBars, setAnalyzerBars] = useState<number[]>(new Array(VIS_BARS).fill(0));
  const [peaks, setPeaks] = useState<number[]>(new Array(VIS_BARS).fill(0));

  // Real-time spectral analyzer (Logarithmic FFT + Momentum)
  const barMomentumRef = useRef<number[]>(new Array(VIS_BARS).fill(0));
  
  useEffect(() => {
    if (!analyser) return;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId: number;

    const update = () => {
      if (isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        
        setAnalyzerBars(prevBars => {
          const newBars = [...prevBars];
          const binCount = dataArray.length;
          
          // Logarithmic binning for VIS_BARS
          // This maps frequency bins (linear) to bars (logarithmic)
          // formula: i = min_bin * (max_bin/min_bin)^(k/N)
          for (let k = 0; k < VIS_BARS; k++) {
            const startBin = Math.floor(Math.pow(binCount / 1.5, k / VIS_BARS));
            const endBin = Math.floor(Math.pow(binCount / 1.5, (k + 1) / VIS_BARS));
            
            let sum = 0;
            let count = 0;
            for (let i = startBin; i < endBin && i < binCount; i++) {
              sum += dataArray[i];
              count++;
            }
            
            const average = count > 0 ? sum / count : 0;
            
            // Apply gain influence based on EQ setting for that range
            const bandIndex = Math.floor((k / VIS_BARS) * BANDS.length);
            const freq = BANDS[bandIndex].freq;
            const gain = equalizerSettings[freq as keyof typeof equalizerSettings] || 0;
            // Boost sensitivity slightly for higher bands which naturally have less energy
            const weight = 1 + (k / VIS_BARS) * 0.5;
            const gainMultiplier = ((gain + 12) / 24) + 0.5;

            // Target value (0-12)
            const target = (average / 255) * 12 * gainMultiplier * weight * 1.8;
            
            // Momentum/Smoothing
            // If target is significantly higher than current, jump faster
            // If lower, decay slowly
            const current = barMomentumRef.current[k];
            if (target > current) {
              barMomentumRef.current[k] = current + (target - current) * 0.6;
            } else {
              barMomentumRef.current[k] = current - (current - target) * 0.2;
            }
            
            newBars[k] = barMomentumRef.current[k];
          }
          return newBars;
        });
      } else {
        // Quiet mode - slow decay to zero
        barMomentumRef.current = barMomentumRef.current.map(v => Math.max(0, v * 0.9));
        setAnalyzerBars([...barMomentumRef.current]);
      }
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, analyser, equalizerSettings]);

  // Simulation Fallback (only if no analyzer)
  useEffect(() => {
    if (analyser) return;
    
    let t = 0;
    let animationFrameId: number;

    const simulate = () => {
      if (isPlaying) {
        t += 0.2;
        setAnalyzerBars(prev => prev.map((_, i) => {
          const bandIndex = Math.floor((i / VIS_BARS) * BANDS.length);
          const freq = BANDS[bandIndex].freq;
          const gain = equalizerSettings[freq as keyof typeof equalizerSettings];
          
          // More complex simulation: multiple sine waves + noise
          const base = (Math.sin(t + i * 0.2) + 1) * 1.5;
          const fast = (Math.sin(t * 2 + i * 0.5) + 1) * 0.5;
          const slow = (Math.sin(t * 0.5 + i * 0.1) + 1) * 2;
          const noise = Math.random() * 1.5;
          
          const gainMultiplier = ((gain + 12) / 24) + 0.5;
          return (base + fast + slow + noise) * gainMultiplier * 1.2;
        }));
      } else {
        setAnalyzerBars(prev => prev.map(v => Math.max(0, v * 0.9)));
      }
      animationFrameId = requestAnimationFrame(simulate);
    };

    animationFrameId = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, analyser, equalizerSettings]);

  // Handle peak decay
  useEffect(() => {
    let animationFrameId: number;
    const decay = () => {
      setPeaks(currentPeaks => 
        currentPeaks.map((peak, i) => {
          const currentVal = analyzerBars[i] || 0;
          if (currentVal > peak) return currentVal;
          // Smooth decay
          return Math.max(0, peak - 0.15);
        })
      );
      animationFrameId = requestAnimationFrame(decay);
    };
    animationFrameId = requestAnimationFrame(decay);
    return () => cancelAnimationFrame(animationFrameId);
  }, [analyzerBars]);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const applyPreset = (name: string) => {
    setActivePreset(name);
    let preset: Record<number, number> | undefined;
    
    if (name in PRESETS) {
      preset = PRESETS[name as keyof typeof PRESETS];
    } else if (name in customPresets) {
      preset = customPresets[name];
    }

    if (preset) {
      Object.entries(preset).forEach(([freq, val]) => {
        setEqualizerBand(parseInt(freq), val);
      });
    }
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    saveCustomPreset(newPresetName.trim(), { ...equalizerSettings });
    setActivePreset(newPresetName.trim());
    setNewPresetName("");
    setIsSaving(false);
  };

  return (
    <>
      {/* Backdrop for click-outside to close */}
      <div 
        className="fixed inset-0 z-40 bg-black/5" 
        onClick={onClose}
      />
      
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="absolute bottom-full right-[-80px] mb-8 bg-[#0B0B0E]/95 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)] p-8 w-[540px] z-50 overflow-hidden"
      >
      {/* Glossy Header Overlay */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-10 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center text-purple-400 shadow-xl">
             <SlidersHorizontal size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black italic tracking-tighter text-white uppercase leading-none">Studio Mastering</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              10-Band Analysis Engine
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="px-5 h-11 rounded-2xl bg-purple-500 text-white shadow-[0_10px_20px_-5px_rgba(168,85,247,0.4)] flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest text-[10px]"
            title="Save & Close"
          >
            Save & Exit
          </button>
          <button 
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            title="Close"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Frequency Visualizer (Bar Graph Style) */}
      <div className="mb-10 relative h-28 bg-black/60 rounded-3xl border border-white/5 overflow-hidden group shadow-inner">
         {/* Background Grid */}
         <div className="absolute inset-0 grid grid-cols-5 opacity-10 pointer-events-none">
            {BANDS.map((_, i) => <div key={i} className="border-r border-white/10" />)}
            <div className="absolute inset-0 grid grid-rows-4">
               {[...Array(4)].map((_, i) => <div key={i} className="border-b border-white/10" />)}
            </div>
         </div>

         {/* Spectral Analyzer Bars (Enhanced High-Density) */}
         <div className="absolute inset-0 flex items-end justify-between px-6 pb-4 gap-[2px]">
            {analyzerBars.map((val, i) => {
              const peak = peaks[i] || 0;
              const totalNormalized = Math.min(1, val / 12);
              const peakNormalized = Math.min(1, peak / 12);
              
              // Get the associated gain for coloring
              const bandIndex = Math.floor((i / VIS_BARS) * BANDS.length);
              const gain = equalizerSettings[BANDS[bandIndex].freq as keyof typeof equalizerSettings];

              return (
                <div key={`viz-${i}`} className="flex-1 flex flex-col items-center justify-end h-full relative group/bar">
                  <div className="w-full relative flex flex-col justify-end" style={{ height: '70%', maxHeight: '70px' }}>
                    {/* Peak Marker */}
                    <motion.div 
                      className="absolute left-0 right-0 h-[2px] bg-white/40 rounded-full z-10"
                      initial={false}
                      animate={{ bottom: `${peakNormalized * 100}%` }}
                      transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    />
                    
                    {/* Main Bar */}
                    <motion.div 
                      className={cn(
                        "w-full rounded-t-sm relative overflow-hidden transition-colors duration-200",
                        "group-hover/bar:brightness-125"
                      )}
                      initial={false}
                      animate={{ 
                        height: `${totalNormalized * 100}%`,
                        background: totalNormalized > 0.8 ? "linear-gradient(to top, #7c3aed, #ec4899, #ffffff)" :
                                   totalNormalized > 0.5 ? "linear-gradient(to top, #7c3aed, #d946ef)" :
                                   totalNormalized > 0.2 ? "linear-gradient(to top, #6d28d9, #4f46e5)" :
                                   "linear-gradient(to top, #3f3f46, #71717a)"
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    >
                      {/* Inner Glow / Segmented Look */}
                      <div className="absolute inset-0 opacity-30 flex flex-col-reverse">
                        {[...Array(10)].map((_, i) => (
                          <div key={i} className="flex-1 border-t border-black/20" />
                        ))}
                      </div>

                      {/* Scanning Light Effect */}
                      <motion.div 
                        className="absolute inset-x-0 bg-white/20 blur-[1px]"
                        animate={{ top: ['100%', '-100%'] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        style={{ height: '30%' }}
                      />
                    </motion.div>
                  </div>

                  {/* Reflected Bar (Bottom) */}
                  <div className="w-full relative h-[10px] overflow-hidden opacity-20 scale-y-[-1]">
                    <motion.div 
                       className={cn(
                         "w-full rounded-t-[2px] h-full",
                         gain > 0 ? "bg-gradient-to-t from-purple-600 to-pink-500" : "bg-zinc-800"
                       )}
                       animate={{ height: `${totalNormalized * 100}%` }}
                       transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  </div>
                </div>
              );
            })}
         </div>

         {/* Interactive Overlays for the 5 Bands (Keeping "seeking" functionality) */}
         <div className="absolute inset-0 flex items-stretch justify-between px-6 pb-10">
            {BANDS.map((band) => (
              <div key={`interact-${band.freq}`} className="w-16 relative">
                 <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={equalizerSettings[band.freq as keyof typeof equalizerSettings]}
                    onChange={(e) => {
                      setEqualizerBand(band.freq, parseInt(e.target.value));
                      setActivePreset("custom");
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-30"
                    style={{ WebkitAppearance: "slider-vertical" } as any}
                  />
                  {/* Hover indicator for the band area */}
                  <div className="absolute inset-0 bg-white/0 hover:bg-white/[0.02] transition-colors pointer-events-none rounded-xl" />
              </div>
            ))}
         </div>

         {/* Decorative Active Indicator */}
         <div className="absolute top-3 left-4 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 backdrop-blur-sm">
            <p className="text-[8px] font-black italic text-purple-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-purple-500 animate-ping" />
              Real-time Output
            </p>
         </div>
      </div>

      {/* Integrated Seek Bar */}
      <div className="mb-10 p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 relative group">
         <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black italic text-zinc-500 uppercase tracking-widest">Active scrubbing</p>
            <div className="flex items-center gap-3 text-[10px] font-mono font-bold text-zinc-600">
               <span>{formatTime(currentTime)}</span>
               <span className="opacity-20">/</span>
               <span>{formatTime(duration)}</span>
            </div>
         </div>
         
         <div className="relative h-6 flex items-center">
            <input 
              type="range" 
              min="0" 
              max={duration || 1} 
              step="0.1"
              value={currentTime} 
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative">
               {/* Pulse Layer */}
               <motion.div 
                 className="absolute inset-y-0 left-0 bg-purple-500/20"
                 animate={{ opacity: [0.1, 0.3, 0.1] }}
                 transition={{ repeat: Infinity, duration: 2 }}
                 style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
               />
               <div 
                 className="h-full bg-gradient-to-r from-purple-600 to-pink-500 relative transition-all duration-100" 
                 style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
               />
            </div>
            
            {/* Scrub Handle */}
            <motion.div 
              className="absolute w-4 h-4 bg-white rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border-2 border-purple-500"
              style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 8px)` }}
            />
         </div>
      </div>

      {/* Presets Grid */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-2">
             <SlidersHorizontal size={12} className="text-zinc-600" />
             <p className="text-[10px] font-black italic text-zinc-500 uppercase tracking-[0.2em]">Mastering Presets</p>
           </div>
           
           <div className="flex items-center gap-4">
             <AnimatePresence>
               {activePreset === "custom" && !isSaving && (
                 <motion.button 
                   initial={{ opacity: 0, x: 10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 10 }}
                   onClick={() => setIsSaving(true)}
                   className="text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5 hover:text-purple-300 transition-all px-3 py-1 bg-purple-500/10 rounded-full border border-purple-500/20"
                 >
                   <Save size={12} />
                   Save Current
                 </motion.button>
               )}
             </AnimatePresence>

             <button 
               onClick={() => setIsSaving(!isSaving)}
               className={cn(
                 "text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all px-3 py-1 rounded-full border",
                 isSaving 
                  ? "text-rose-400 bg-rose-500/10 border-rose-500/20" 
                  : "text-zinc-500 bg-white/5 border-white/5 hover:text-white hover:bg-white/10"
               )}
             >
               {isSaving ? <X size={12} /> : <Plus size={12} />}
               {isSaving ? "Cancel" : "New Preset"}
             </button>
           </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {isSaving && (
              <motion.div 
                initial={{ width: 0, opacity: 0, scale: 0.8 }}
                animate={{ width: "auto", opacity: 1, scale: 1 }}
                exit={{ width: 0, opacity: 0, scale: 0.8 }}
                className="flex gap-2 overflow-hidden items-center bg-white/[0.03] border border-white/10 rounded-xl p-1.5 pr-3 shadow-2xl"
              >
                 <input 
                   autoFocus
                   type="text"
                   value={newPresetName}
                   onChange={(e) => setNewPresetName(e.target.value)}
                   placeholder="Name your signal..."
                   className="w-[140px] bg-transparent border-none px-3 py-1 text-[10px] text-white placeholder:text-zinc-600 focus:outline-none font-bold"
                   onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                 />
                 <button 
                   onClick={handleSavePreset}
                   disabled={!newPresetName.trim()}
                   className="w-8 h-8 flex items-center justify-center bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:grayscale transition-all shadow-[0_4px_10px_rgba(168,85,247,0.3)]"
                 >
                   <Check size={14} />
                 </button>
              </motion.div>
            )}
          </AnimatePresence>

          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              onClick={() => applyPreset(name)}
              className={cn(
                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border relative overflow-hidden",
                activePreset === name 
                  ? "bg-white text-black border-white shadow-[0_10px_20px_rgba(255,255,255,0.1)] scale-105 z-10" 
                  : "bg-white/[0.02] border-white/5 text-white/40 hover:text-white hover:bg-white/5 hover:border-white/10"
              )}
            >
              {name}
            </button>
          ))}

          {Object.keys(customPresets).map((name) => (
            <div key={name} className="relative group/preset">
              <button
                onClick={() => applyPreset(name)}
                className={cn(
                  "px-4 py-2 pr-8 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border relative overflow-hidden",
                  activePreset === name 
                    ? "bg-purple-600 text-white border-purple-500 shadow-[0_10px_20px_rgba(168,85,247,0.2)] scale-105 z-10" 
                    : "bg-purple-600/10 border-purple-600/20 text-purple-400 hover:bg-purple-600/20 hover:border-purple-600/40"
                )}
              >
                {name}
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCustomPreset(name);
                  if (activePreset === name) setActivePreset("custom");
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-white/20 hover:text-white transition-all z-20 group-hover/preset:bg-rose-500/20 rounded-md"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* EQ Sliders Section */}
      <div className="bg-black/40 rounded-[2.5rem] p-8 pb-10 border border-white/5 relative overflow-hidden group/eq-container shadow-2xl">
         <div className="absolute inset-x-0 h-1 top-0 bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
         
         {/* Vertical Gain Scale (Left side) */}
         <div className="absolute left-4 top-10 bottom-24 flex flex-col justify-between items-center text-[8px] font-black font-mono text-zinc-700 pointer-events-none select-none z-20">
            <span>+12</span>
            <span>+6</span>
            <span className="text-zinc-500">0</span>
            <span>-6</span>
            <span>-12</span>
         </div>

         <div className="flex justify-between items-end h-56 gap-4 pl-4 pr-2 relative z-10">
           {/* Global Scale Lines (Faint horizontal guides across all sliders) */}
           <div className="absolute inset-x-8 top-1.5 bottom-1.5 pointer-events-none opacity-20">
              <div className="h-full flex flex-col justify-between">
                 {[...Array(5)].map((_, i) => (
                    <div key={`guide-${i}`} className={cn("w-full h-px bg-white/20", i === 2 && "opacity-60 bg-white/40")} />
                 ))}
              </div>
           </div>

           {BANDS.map((band) => {
             const value = equalizerSettings[band.freq as keyof typeof equalizerSettings];
             return (
               <div key={band.freq} className="flex flex-col items-center gap-6 flex-1 relative">
                 <div className="flex-1 w-5 bg-black/60 rounded-xl relative group ring-1 ring-white/5 hover:ring-purple-500/30 transition-all shadow-inner">
                   {/* Track Tick Markings */}
                   <div className="absolute inset-x-0 h-full py-2 flex flex-col justify-between items-center opacity-10 pointer-events-none px-1">
                      {[...Array(25)].map((_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "w-full h-[1px] bg-white", 
                            i === 12 ? "opacity-80 w-3" : i % 6 === 0 ? "opacity-40 w-2.5" : "opacity-20 w-1.5"
                          )} 
                        />
                      ))}
                   </div>

                   {/* The Gain Slider */}
                   <input
                     type="range"
                     min="-12"
                     max="12"
                     step="1"
                     value={value}
                     onChange={(e) => {
                        setEqualizerBand(band.freq, parseInt(e.target.value));
                        setActivePreset("custom");
                     }}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                     style={{ WebkitAppearance: "slider-vertical", direction: 'rtl' } as any}
                   />
                   
                   {/* Value-based filled track */}
                   <div className="absolute inset-x-0 bottom-0 top-0 py-2 flex flex-col justify-end">
                     <motion.div 
                       initial={false}
                       animate={{ height: `${((value + 12) / 24) * 100}%` }}
                       className={cn(
                          "w-full rounded-b-lg absolute bottom-0 left-0 transition-colors duration-500",
                          value > 0 ? "bg-gradient-to-t from-purple-600 via-pink-500 to-rose-400" : "bg-gradient-to-t from-zinc-800 to-zinc-600"
                       )}
                     >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20" />
                     </motion.div>
                   </div>
                   
                   {/* Handle Indicator (Phantom Handle) */}
                   <motion.div 
                     initial={false}
                     animate={{ bottom: `${((value + 12) / 24) * 100}%` }}
                     className="absolute left-[-2px] right-[-2px] h-2 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)] z-10 border border-white/50"
                     style={{ transform: 'translateY(50%)' }}
                   />
                 </div>
                 
                 <div className="text-center group/label">
                    <motion.p 
                      animate={{ scale: value !== 0 ? 1.1 : 1 }}
                      className={cn(
                        "text-[10px] font-black font-mono transition-colors",
                        value > 0 ? "text-rose-400" : value < 0 ? "text-indigo-400" : "text-zinc-600"
                      )}
                    >
                       {value > 0 ? `+${value}` : value}
                    </motion.p>
                    <p className="text-[8px] text-zinc-500 font-black uppercase tracking-tighter truncate w-14 mt-1 opacity-60 group-hover/label:opacity-100 transition-opacity">{band.label}</p>
                 </div>
               </div>
             );
           })}
         </div>
      </div>

      {/* Footer Alerts */}
      <div className="mt-10 flex items-center gap-4">
         <div className="flex-1 px-4 py-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-3">
            <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-500 font-medium leading-relaxed">
              Active only for <span className="text-zinc-300 font-bold">Local Metadata</span>. YouTube streams bypass DSP.
            </p>
         </div>
         
         <button 
           onClick={() => applyPreset("Flat")}
           className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:bg-white/10 transition-all"
         >
            Reset
         </button>
      </div>
    </motion.div>
  </>
);
}
