import axios from "axios";
import { Song } from "../store/usePlayerStore";
import { getTrack } from "../lib/offlineStorage";

export async function fetchSongMetadata(songId: string, source?: string): Promise<Song> {
  if (songId.startsWith("local-")) {
    const ot = await getTrack(songId);
    if (ot) {
      let thumbUrl = ot.metadata.thumbnail;
      if (ot.metadata.thumbnailBlob) {
        thumbUrl = URL.createObjectURL(ot.metadata.thumbnailBlob);
      }
      
      return {
        id: ot.id,
        title: ot.metadata.title,
        artist: ot.metadata.artist,
        thumbnail: thumbUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop",
        source: "local",
        sourceId: ot.id,
        duration: ot.metadata.duration,
        localUrl: URL.createObjectURL(ot.blob)
      };
    }
  }

  let retries = 2;
  while (retries >= 0) {
    try {
      const response = await axios.get(`/api/metadata`, {
        params: { songId, source },
        timeout: 5000
      });
      return response.data;
    } catch (error: any) {
      if (retries > 0 && (error.message === "Network Error" || error.code === "ERR_NETWORK")) {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      console.warn("Gracefully handled song metadata fetch failure (using fallback):", error.message || error);
      break;
    }
  }

  return {
     id: songId,
     title: "Unknown Track",
     artist: "Unknown Artist",
     thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop",
     source: (source as any) || "cloud",
     sourceId: songId
  };
}
