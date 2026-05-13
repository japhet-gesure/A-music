import { ReactNode, useEffect } from "react";
import { Home, Search, Library, PlusCircle, Heart, Settings, User, Compass, Sparkles, Music } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { MusicPlayer } from "../player/MusicPlayer";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { useLikeStore } from "../../store/useLikeStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  const location = useLocation();
  const initLikes = useLikeStore(state => state.init);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      initLikes();
    });
    return () => unsubAuth();
  }, [initLikes]);

  const navItems = [
    { icon: Home, label: "Home", path: "/", color: "text-blue-400" },
    { icon: Search, label: "Search", path: "/search", color: "text-emerald-400" },
    { icon: Sparkles, label: "AI Vibes", path: "/vibes", color: "text-purple-400" },
    { icon: Compass, label: "Explore", path: "/explore", color: "text-orange-400" },
    { icon: Sparkles, label: "For You", path: "/for-you", color: "text-pink-400" },
  ];

  const secondaryNav = [
    { icon: Library, label: "Offline Vault", path: "/library", color: "text-indigo-400" },
    { icon: Music, label: "Playlists", path: "/playlists", color: "text-cyan-400" },
    { icon: Heart, label: "Liked Songs", path: "/liked", color: "text-rose-400" },
    { icon: PlusCircle, label: "Create Playlist", path: "/create-playlist", color: "text-amber-400" },
  ];

  const { theme } = usePlayerStore();

  const themeStyles = {
    classic: "bg-[#0A0A0C] text-[#E0E0E0]",
    midnight: "bg-slate-950 text-slate-100",
    ocean: "bg-cyan-950 text-teal-50",
    sunset: "bg-orange-950 text-orange-50",
  }[theme];

  const mainGradients = {
    classic: "from-[#121218] to-[#0A0A0C]",
    midnight: "from-[#0F172A] to-slate-950",
    ocean: "from-[#064E3B] to-cyan-950",
    sunset: "from-[#431407] to-orange-950",
  }[theme];

  return (
    <div id="app-shell" className={cn("flex h-screen w-full overflow-hidden font-sans border border-white/5", themeStyles)}>
      {/* Sidebar */}
      <aside id="sidebar" className={cn("w-64 backdrop-blur-xl border-r border-white/5 flex flex-col p-6 gap-8 z-30", theme === "classic" ? "bg-[#0F0F12]/80" : "bg-black/40")}>
        <div>
          <Link to="/" className="inline-block group">
            <div className="text-2xl font-black text-gradient tracking-tighter group-hover:scale-105 transition-transform flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)] group-hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all">
                <Music size={18} className="text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]" />
              </div>
              <span>A MUSIC</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-8 overflow-y-auto pr-2 scroll-hide">
          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-black mb-6 px-3">Discovery</h3>
            <div className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold transition-all group relative overflow-hidden",
                      isActive
                        ? "bg-white/5 text-white border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                        : "text-white/40 hover:text-white hover:bg-white/[0.02]"
                    )}
                  >
                    <div className={cn(
                      "transition-all duration-300",
                      isActive ? cn(item.color, "drop-shadow-[0_0_10px_currentColor]") : "opacity-40 group-hover:opacity-100 group-hover:scale-110"
                    )}>
                      <item.icon size={20} />
                    </div>
                    <span>{item.label}</span>
                    {isActive && (
                      <>
                        <motion.div layoutId="active-nav-glow" className={cn("absolute left-0 w-1 h-6 rounded-full blur-[2px]", item.color.replace('text-', 'bg-'))} />
                        <motion.div layoutId="active-nav-bg" className={cn("absolute inset-0 opacity-[0.03] pointer-events-none", item.color.replace('text-', 'bg-'))} />
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-black mb-6 px-3">My Collection</h3>
            <div className="space-y-1.5">
              {secondaryNav.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold transition-all group relative overflow-hidden",
                      isActive
                        ? "bg-white/5 text-white border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                        : "text-white/40 hover:text-white hover:bg-white/[0.02]"
                    )}
                  >
                    <div className={cn(
                      "transition-all duration-300",
                      isActive ? cn(item.color, "drop-shadow-[0_0_10px_currentColor]") : "opacity-40 group-hover:opacity-100 group-hover:scale-110"
                    )}>
                      <item.icon size={20} />
                    </div>
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.div layoutId="active-nav-bg-sec" className={cn("absolute inset-0 opacity-[0.03] pointer-events-none", item.color.replace('text-', 'bg-'))} />
                    )}
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 p-4 rounded-xl border border-purple-500/10">
            <p className="text-[10px] font-bold text-purple-400 mb-1">OFFLINE MODE</p>
            <p className="text-[10px] text-white/40 leading-relaxed">System ready for offline listening caching.</p>
          </section>
        </nav>

        <div className="pt-4 border-t border-white/5">
           <div className="flex items-center gap-3 bg-white/5 p-2 rounded-full border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
               <User size={14} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">Alex Rivera</p>
            </div>
            <Link 
              to="/settings" 
              className={cn(
                "p-2 rounded-full transition-all duration-300",
                location.pathname === "/settings" ? "bg-purple-500 text-white" : "text-white/30 hover:text-white hover:bg-white/5 active:scale-90"
              )}
            >
              <Settings size={18} />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main id="main-content" className={cn("flex-1 flex flex-col relative overflow-y-auto bg-gradient-to-b", mainGradients)}>
        <header className={cn("sticky top-0 z-20 px-8 py-4 backdrop-blur-md flex items-center justify-between border-b border-white/5", theme === "classic" ? "bg-[#0F0F12]/80" : "bg-black/40")}>
          <div className="flex items-center gap-6">
             <div className="flex gap-2">
                <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
                   &lt;
                </button>
                <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors">
                   &gt;
                </button>
             </div>
             
             <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
                <input 
                  type="text" 
                  placeholder="Search artists, songs, or lyrics..." 
                  className="bg-white/5 border border-white/10 rounded-full py-2 px-10 text-xs w-80 focus:outline-none focus:border-purple-500/50 transition-all"
                />
             </div>
          </div>

          <div className="flex items-center gap-3">
             <button className="text-white/60 hover:text-white text-sm font-medium px-4">Upgrade</button>
             <div className="h-4 w-[1px] bg-white/10 mx-2" />
             <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <span className="text-[10px] font-bold">AR</span>
             </div>
          </div>
        </header>

        <div className="p-8 pb-28">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Integrated Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-28 bg-[#0F0F12]/95 backdrop-blur-3xl border-t border-white/5 z-50">
        <MusicPlayer />
      </footer>
    </div>
  );
}
