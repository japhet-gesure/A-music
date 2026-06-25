import React, { useState, useEffect } from "react";
import { Volume2, Sparkles, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { safeSessionStorage } from "../../lib/safeStorage";

const sessionStorage = safeSessionStorage;

export function AudioHandshake() {
  const [isVisible, setIsVisible] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Check if we need to show the handshake in the current browser session
    const isDone = sessionStorage.getItem("audio_handshake_done") === "true";
    if (!isDone) {
      // Small timeout delay for a smooth entrance animation
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleUnlock = async () => {
    if (isActivating || isSuccess) return;
    setIsActivating(true);

    try {
      // 1. Resume and Unlock HTML5 & Web Audio contexts
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          if (ctx.state === "suspended") {
            await ctx.resume();
          }
        } catch (err) {
          console.warn("Failed to unlock Web Audio context:", err);
        }
      }

      // 2. Clear HTML5 Core Audio autoplay blockage
      const dummyAudio = new Audio();
      dummyAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
      await dummyAudio.play()
        .then(() => {
          dummyAudio.pause();
        })
        .catch(err => {
          console.warn("HTML5 audio playback interaction failed to unlock:", err);
        });

      // 3. Ensure global YT IFrame script is injected (if not already there)
      if (!(window as any).YT) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // 4. Instantiate a hidden, temporary dummy Youtube Player instance to bypass iframe blockages
      const runYTUnlock = () => {
        const dummyDiv = document.createElement("div");
        const dummyId = `dummy-yt-unlocker-${Date.now()}`;
        dummyDiv.id = dummyId;
        dummyDiv.style.position = "absolute";
        dummyDiv.style.width = "1px";
        dummyDiv.style.height = "1px";
        dummyDiv.style.opacity = "0";
        dummyDiv.style.pointerEvents = "none";
        dummyDiv.style.left = "-1000px";
        dummyDiv.style.top = "-1000px";
        document.body.appendChild(dummyDiv);

        if ((window as any).YT && (window as any).YT.Player) {
          try {
            const player = new (window as any).YT.Player(dummyId, {
              videoId: "dQw4w9WgXcQ", // short video to play and mute
              playerVars: {
                autoplay: 1,
                mute: 1,
                controls: 0,
                showinfo: 0,
                modestbranding: 1,
                origin: window.location.origin
              },
              events: {
                onReady: (event: any) => {
                  try {
                    const yt = event.target;
                    yt.playVideo();
                    yt.mute();
                    
                    // Toggle a brief play & unmute/mute cycle to register interaction
                    setTimeout(() => {
                      try {
                        yt.unMute();
                        yt.setVolume(1);
                        setTimeout(() => {
                          try {
                            yt.mute();
                            yt.destroy();
                          } catch (e) {}
                          dummyDiv.remove();
                        }, 50);
                      } catch (e) {
                        dummyDiv.remove();
                      }
                    }, 100);
                  } catch (err) {
                    console.warn("Failed executing dummy play seq:", err);
                    dummyDiv.remove();
                  }
                },
                onError: () => {
                  dummyDiv.remove();
                }
              }
            });
          } catch (err) {
            console.warn("Failed instantiating YT player context:", err);
            dummyDiv.remove();
          }
        } else {
          dummyDiv.remove();
        }
      };

      if ((window as any).YT && (window as any).YT.Player) {
        runYTUnlock();
      } else {
        const prevAPIReady = (window as any).onYouTubeIframeAPIReady;
        (window as any).onYouTubeIframeAPIReady = () => {
          if (prevAPIReady) prevAPIReady();
          runYTUnlock();
        };
      }

      setIsSuccess(true);
      sessionStorage.setItem("audio_handshake_done", "true");

      // Set a small delay for user state feedback before dismissal
      setTimeout(() => {
        setIsVisible(false);
      }, 1000);

    } catch (err) {
      console.error("Audio gesture handshake failed:", err);
      setIsActivating(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="fixed bottom-36 md:bottom-32 right-4 md:right-8 z-50 max-w-sm w-full mx-auto"
        >
          <div className="backdrop-blur-xl bg-black/70 border border-white/10 rounded-2xl p-4 shadow-[0_10px_40px_rgba(0,0,0,0.6)] relative overflow-hidden flex flex-col gap-3">
            {/* Glossy color bar top highlight */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500" />
            
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Volume2 size={20} className="animate-pulse" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm tracking-tight flex items-center gap-1.5">
                  Enable Audio Playback
                  <Sparkles size={12} className="text-purple-400" />
                </h4>
                <p className="text-white/60 text-xs mt-1 leading-relaxed">
                  Browser security requires a quick gesture to authorize music streams. Tap here to enable seamless, full-quality sound.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsVisible(false)}
                className="px-3 py-1.5 rounded-lg text-white/40 hover:text-white/70 text-xs font-semibold transition-colors"
              >
                Dismiss
              </button>
              
              <button
                type="button"
                onClick={handleUnlock}
                disabled={isActivating || isSuccess}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-[0_4px_12px_rgba(147,51,234,0.3)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.5)] ${
                  isSuccess
                    ? "bg-emerald-500 text-white"
                    : isActivating
                    ? "bg-purple-600/50 text-white/50 cursor-wait"
                    : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-[1.02] active:scale-[0.98]"
                }`}
              >
                {isSuccess ? (
                  <>
                    <CheckCircle size={14} />
                    Activated!
                  </>
                ) : isActivating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Unlocking Audio...
                  </>
                ) : (
                  "Unlock Streams"
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
