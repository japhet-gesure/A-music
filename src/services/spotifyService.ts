import axios from "axios";

export interface SpotifyTrackMeta {
  id?: string;
  title: string;
  artist: string;
  albumArt: string;
  duration_ms: number;
}

export const searchSpotifyTracks = async (query: string): Promise<SpotifyTrackMeta[]> => {
  try {
    const q = encodeURIComponent(query.trim());
    const response = await fetch(`/api/spotify/search?q=${q}`);
    const data = await response.json();
    
    if (response.ok && data && data.items) {
      return data.items as SpotifyTrackMeta[];
    }
    return [];
  } catch (error) {
    // Suppress verbose error logging for expected fallback cases
    return [];
  }
};

export const searchSpotifyTrack = async (title: string, artist: string): Promise<SpotifyTrackMeta | null> => {
  try {
    const tracks = await searchSpotifyTracks(`${title} ${artist}`);
    if (tracks && tracks.length > 0) {
      return tracks[0];
    }
    return null;
  } catch (error) {
    // Suppress verbose error logging for expected fallback cases
    return null;
  }
};
