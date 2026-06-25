import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

export default function CreatePlaylist() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    if (!name || !auth.currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "playlists"), {
        name,
        description,
        isPublic: true,
        collaborative: false,
        ownerId: auth.currentUser.uid,
        memberIds: [],
        songIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate("/playlists");
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
        <p className="text-white/40 text-sm font-medium uppercase tracking-widest mt-2">Personal Selection</p>
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
