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

  try {
    const response = await axios.get(`/api/metadata`, {
      params: { songId, source }
    });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch song metadata:", error);
    return {
       id: songId,
       title: "Unknown Track",
       artist: "Unknown Artist",
       thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop",
       source: (source as any) || "cloud",
       sourceId: songId
    };
  }
}
