import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Shell } from "./components/layout/Shell";
import Home from "./components/Home";
import Search from "./components/Search";
import Explore from "./components/Explore";
import ForYou from "./components/ForYou";
import Liked from "./components/Liked";
import Playlists from "./components/Playlists";
import AIVibeSearch from "./components/AIVibeSearch";
import AIDJ from "./components/AIDJ";
import PlaylistDetail from "./components/PlaylistDetail";
import CreatePlaylist from "./components/CreatePlaylist";
import LocalFiles from "./components/LocalFiles";
import Settings from "./components/Settings";
import SongDetail from "./components/SongDetail";
import { BackgroundArtFetcher } from "./components/BackgroundArtFetcher";

export default function App() {
  return (
    <Router>
      <BackgroundArtFetcher />
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/vibes" element={<AIVibeSearch />} />
          <Route path="/ai-dj" element={<AIDJ />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/for-you" element={<ForYou />} />
          <Route path="/library" element={<LocalFiles />} />
          <Route path="/playlists" element={<Playlists />} />
          <Route path="/playlist/:id" element={<PlaylistDetail />} />
          <Route path="/song/:id" element={<SongDetail />} />
          <Route path="/create-playlist" element={<CreatePlaylist />} />
          <Route path="/liked" element={<Liked />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/auth" element={<div className="text-4xl font-black italic">AUTH GATEWAY</div>} />
        </Routes>
      </Shell>
    </Router>
  );
}
