import { usePlayerStore } from "../../store/usePlayerStore";
import { X, SlidersHorizontal } from "lucide-react";
import { motion } from "motion/react";
import React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

interface EqualizerControlsProps {
  onClose: () => void;
  analyser?: AnalyserNode | null;
}

const BANDS = [
  { freq: 60, label: "BASS" },
  { freq: 230, label: "LOW-MID" },
  { freq: 910, label: "MID" },
  { freq: 4000, label: "HIGH-MID" },
  { freq: 14000, label: "TREBLE" },
];

const PRESETS: Record<string, Record<number, number>> = {
  "Flat": { 60: 0, 230: 0, 910: 0, 4000: 0, 14000: 0 },
  "Bass Boost": { 60: 7, 230: 4, 910: 0, 4000: 0, 14000: 0 },
  "Rock": { 60: 5, 230: 3, 910: -1, 4000: 3, 14000: 5 },
  "Pop": { 60: -1, 230: 1, 910: 3, 4000: 4, 14000: -1 },
  "Jazz": { 60: 3, 230: 2, 910: -1, 4000: 2, 14000: 4 },
  "Classical": { 60: 4, 230: 3, 910: 0, 4000: 4, 14000: 5 },
};

export function EqualizerControls({ onClose }: EqualizerControlsProps) {
  const { equalizerSettings, setEqualizerBand } = usePlayerStore();

  const getActivePresetName = () => {
    for (const [name, settings] of Object.entries(PRESETS)) {
      const isMatch = Object.entries(settings).every(([freq, val]) => 
        equalizerSettings[parseInt(freq) as keyof typeof equalizerSettings] === val
      );
      if (isMatch) return name;
    }
    return "Custom";
  };

  const currentPresetName = getActivePresetName();

  const applyPreset = (name: string) => {
    const preset = PRESETS[name];
    if (preset) {
      Object.entries(preset).forEach(([freq, val]) => {
        setEqualizerBand(parseInt(freq), val);
      });
    }
  };

  const handleReset = () => {
    BANDS.forEach((band) => {
      setEqualizerBand(band.freq, 0);
    });
  };

  const content = (
    <>
      {/* Click-outside dim backdrop overlaying ALL views (full screen, portal, etc.) */}
      <div 
        className="fixed inset-0 z-[99998] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300" 
        onClick={onClose}
      />

      {/* Centered layout container forced exactly to center viewport */}
      <div 
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 99999,
        }}
        className="pointer-events-none flex items-center justify-center w-[460px] max-w-[95vw]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          style={{ background: "#111" }}
          className="pointer-events-auto w-full border border-white/10 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.85)] p-6 select-none cursor-default"
        >
          {/* Header (No Drag / Drag Handles Completely Removed) */}
          <div 
            className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 text-white"
          >
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal size={16} className="text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
              <span className="text-xs font-black tracking-widest uppercase font-sans text-white/90">EQUALIZER ENGINE</span>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all active:scale-90 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Preset Pills List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[9px] font-black tracking-wider text-white/40 uppercase font-sans">Master Presets</p>
              <button
                id="eq-reset-presets-btn"
                onClick={handleReset}
                className="text-[9px] font-semibold tracking-wider text-zinc-400 hover:text-white transition-all bg-white/5 hover:bg-white/10 border border-white/5 px-2 py-0.5 rounded uppercase font-sans select-none cursor-pointer"
              >
                Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PRESETS).map((name) => {
                const isActive = currentPresetName === name;
                return (
                  <button
                    key={name}
                    onClick={() => applyPreset(name)}
                    className={cn(
                      "px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-full border transition-all cursor-pointer",
                      isActive
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black shadow-[0_0_12px_rgba(168,85,247,0.4)] border-transparent scale-105"
                        : "bg-white/[0.02] border-white/5 text-white/55 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders Console section */}
          <div className="p-4 bg-black/30 border border-white/5 rounded-2xl flex items-stretch">
            {/* Main vertical scale indicators on the left */}
            <div className="w-10 flex flex-col justify-between items-center text-[9px] font-mono font-bold text-white/30 h-[180px] py-1 shrink-0">
              <span>+12</span>
              <span>+6</span>
              <span>0</span>
              <span>-6</span>
              <span>-12</span>
            </div>

            {/* Equalizer sliders row */}
            <div className="flex-1 flex justify-around items-stretch h-[240px] pl-2">
              {BANDS.map((band) => {
                const val = equalizerSettings[band.freq as keyof typeof equalizerSettings] ?? 0;
                return (
                  <div key={band.freq} className="flex flex-col items-center justify-between h-full group">
                    
                    {/* Slider visual track */}
                    <div className="relative w-7 h-[180px] bg-white/5 rounded-full flex justify-center items-center cursor-ns-resize ring-1 ring-white/5 hover:ring-white/20 transition-all">
                      
                      {/* Tick markings */}
                      <div className="absolute inset-y-2 flex flex-col justify-between items-center opacity-10 pointer-events-none w-full px-2">
                        {[...Array(13)].map((_, i) => (
                          <div 
                            key={i} 
                            className={cn(
                              "h-[1px] bg-white rounded-full",
                              i === 6 ? "w-2 opacity-100" : i % 3 === 0 ? "w-1.5 opacity-60" : "w-1 opacity-30"
                            )} 
                          />
                        ))}
                      </div>

                      {/* Cool Neon Purple/Pink Gradient Slider Fill */}
                      <div className="absolute inset-x-0 bottom-0 rounded-b-full overflow-hidden pointer-events-none" style={{ height: `${((val + 12) / 24) * 100}%` }}>
                        <div className="w-full h-full bg-gradient-to-t from-purple-500 via-pink-500 to-pink-500" />
                      </div>

                      {/* Standard Invisible Input Range Vertical Overlay */}
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={val}
                        onInput={(e) => {
                          setEqualizerBand(band.freq, parseInt((e.target as HTMLInputElement).value));
                        }}
                        onChange={(e) => {
                          setEqualizerBand(band.freq, parseInt(e.target.value));
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ns-resize z-20"
                        // @ts-ignore
                        orient="vertical"
                        orientation="vertical"
                        style={{ WebkitAppearance: "slider-vertical", width: '100%', height: '100%' } as any}
                      />

                      {/* Dynamically Color-Coded Slider Handle */}
                      <div 
                        className={cn(
                          "absolute left-[3px] right-[3px] h-5 rounded-full border pointer-events-none z-10 transition-all",
                          val > 0 && "bg-sky-400 border-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.8)]",
                          val < 0 && "bg-rose-500 border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]",
                          val === 0 && "bg-white border-neutral-300 shadow-[0_2px_8px_rgba(255,255,255,0.8)]"
                        )}
                        style={{ bottom: `calc(${((val + 12) / 24) * 100}% - 10px)` }}
                      />
                    </div>

                    {/* Value & Label underneath (Conditional color coding!) */}
                    <div className="text-center mt-3">
                      <p className={cn(
                        "text-[10px] font-black font-mono leading-none transition-colors duration-150",
                        val > 0 && "text-sky-400 font-extrabold",
                        val < 0 && "text-rose-500 font-extrabold",
                        val === 0 && "text-white"
                      )}>
                        {val > 0 ? `+${val}` : val}
                      </p>
                      <p className="text-[8px] text-white/40 group-hover:text-white/80 transition-opacity font-black tracking-tighter uppercase leading-none mt-1">
                        {band.label}
                      </p>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </motion.div>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
