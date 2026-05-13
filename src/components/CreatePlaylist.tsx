import { useState } from "react";
import { Plus, Users, Globe, Lock } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";

export default function CreatePlaylist() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [collaborative, setCollaborative] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name || !auth.currentUser) return;
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, "playlists"), {
        name,
        description,
        isPublic,
        collaborative,
        ownerId: auth.currentUser.uid,
        memberIds: [],
        songIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate(`/playlist/${docRef.id}`);
    } catch (error) {
      console.error("Error creating playlist:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10 space-y-12">
      <header>
        <h1 className="text-5xl font-black italic tracking-tighter text-gradient leading-tight">CREATE NEW PLAYLIST</h1>
        <p className="text-white/40 text-sm font-medium uppercase tracking-widest mt-2">Personal or Collaborative Selection</p>
      </header>

      <div className="space-y-8 bg-white/5 p-10 rounded-3xl border border-white/10 shadow-2xl">
        <div className="space-y-2">
          <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Playlist Name</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Mix"
            className="w-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-2xl py-4 px-6 text-xl font-bold focus:outline-none focus:border-dashed focus:border-purple-500/50 transition-all shadow-2xl"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-white/40 uppercase tracking-widest">Description (Optional)</label>
          <textarea 
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the vibe?"
            className="w-full bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 rounded-2xl py-4 px-6 text-sm focus:outline-none focus:border-dashed focus:border-purple-500/50 transition-all resize-none shadow-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setIsPublic(true)}
            className={cn(
              "flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all",
              isPublic ? "bg-white/10 border-purple-500 shadow-lg shadow-purple-500/10" : "bg-transparent border-white/5 hover:border-white/10"
            )}
          >
            <Globe size={24} className={isPublic ? "text-purple-400" : "text-white/20"} />
            <div className="text-center">
              <p className="text-sm font-bold">Public</p>
              <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">Anyone can search</p>
            </div>
          </button>

          <button 
            onClick={() => setIsPublic(false)}
            className={cn(
              "flex flex-col items-center gap-4 p-6 rounded-2xl border transition-all",
              !isPublic ? "bg-white/10 border-purple-500 shadow-lg shadow-purple-500/10" : "bg-transparent border-white/5 hover:border-white/10"
            )}
          >
            <Lock size={24} className={!isPublic ? "text-purple-400" : "text-white/20"} />
            <div className="text-center">
              <p className="text-sm font-bold">Private</p>
              <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest">Only you (and members)</p>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-4">
             <div className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-colors", collaborative ? "bg-purple-500 text-white" : "bg-white/5 text-white/20")}>
                <Users size={20} />
             </div>
             <div>
                <p className="text-sm font-bold">Collaborative</p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Invite others to edit</p>
             </div>
          </div>
          <button 
            onClick={() => setCollaborative(!collaborative)}
            className={cn(
              "w-12 h-6 rounded-full transition-all relative",
              collaborative ? "bg-purple-600" : "bg-white/10"
            )}
          >
             <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-md", collaborative ? "right-1" : "left-1")} />
          </button>
        </div>

        <button 
          onClick={handleCreate}
          disabled={loading || !name}
          className="w-full btn-primary py-4 text-sm tracking-widest uppercase disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Playlist"}
        </button>
      </div>
    </div>
  );
}
