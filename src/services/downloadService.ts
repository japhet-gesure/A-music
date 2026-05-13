import { saveTrack, OfflineTrack, deleteTrack, isTrackOffline } from "../lib/offlineStorage";
import { Song, usePlayerStore } from "../store/usePlayerStore";
import axios from "axios";

export async function downloadSong(song: Song): Promise<void> {
  const { setDownloadStatus, removeDownload } = usePlayerStore.getState();

  // If it's already local, we just need to ensure it's in IndexedDB
  if (song.source === "local") {
     return;
  }

  setDownloadStatus(song.id, { progress: 0, status: "downloading", song });

  let blob: Blob | null = null;
  
  try {
    if (song.localUrl) {
      const response = await axios.get(song.localUrl, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadStatus(song.id, { progress, status: "downloading", song });
          }
        },
      });
      blob = response.data;
    }
  } catch (err: any) {
    console.warn("Could not fetch blob for offline storage", err);
    setDownloadStatus(song.id, { progress: 0, status: "failed", error: err.message, song });
    return;
  }

  const offlineTrack: OfflineTrack = {
    id: song.id,
    blob: blob || new Blob(["Mock audio data for YouTube link"], { type: "audio/mpeg" }),
    metadata: {
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration || 0,
      thumbnail: song.thumbnail,
      source: song.source,
      lyrics: song.lyrics || []
    }
  };

  await saveTrack(offlineTrack);
  setDownloadStatus(song.id, { progress: 100, status: "completed", song });
  
  // Optionally remove from downloads list after some time or immediately
  setTimeout(() => {
    removeDownload(song.id);
  }, 3000);
}

export async function removeDownloadedSong(id: string): Promise<void> {
  await deleteTrack(id);
}

export async function getOfflineStatus(id: string): Promise<boolean> {
  return await isTrackOffline(id);
}
