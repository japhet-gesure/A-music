import { saveTrack, OfflineTrack, deleteTrack, isTrackOffline } from "../lib/offlineStorage";
import { Song, usePlayerStore, extractYoutubeVideoIdFromString } from "../store/usePlayerStore";
import axios from "axios";

async function resolveAudioStreamUrl(videoId: string): Promise<string | null> {
  const endpoints = [
    `https://pipedapi.kavin.rocks/streams/${videoId}`,
    `https://pipedapi.tokhmi.xyz/streams/${videoId}`,
    `https://pipedapi.river.rocks/streams/${videoId}`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.audioStreams && data.audioStreams.length > 0) {
          const audioStreams = [...data.audioStreams].sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
          const bestStream = audioStreams[0].url;
          if (bestStream) {
            return bestStream;
          }
        }
      }
    } catch (err) {
      console.warn(`[Download Stream Resolver] Failed resolving from ${url}:`, err);
    }
  }

  const invidiousInstances = [
    `https://vid.priv.au/api/v1/videos/${videoId}`,
    `https://invidious.flokinet.to/api/v1/videos/${videoId}`,
    `https://inv.tux.im/api/v1/videos/${videoId}`
  ];

  for (const url of invidiousInstances) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
          const audioFormats = data.adaptiveFormats.filter((f: any) => 
            f.type?.includes("audio") || (!f.videoCodec && f.audioCodec)
          );
          if (audioFormats.length > 0) {
            const bestStream = audioFormats[0].url;
            if (bestStream) {
              return bestStream;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Download Stream Resolver] Failed resolving from Invidious ${url}:`, err);
    }
  }

  return null;
}

export async function downloadSong(song: Song): Promise<void> {
  const { setDownloadStatus, removeDownload } = usePlayerStore.getState();

  // If it's already local, we just need to ensure it's in IndexedDB
  if (song.source === "local") {
     return;
  }

  // Request Persistent Storage to prevent deletion
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Storage] Persistent storage granted: ${isPersisted}`);
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        console.log(`[Storage] Storage quota estimate: usage=${estimate.usage}, quota=${estimate.quota}`);
      }
    }
  } catch (err) {
    console.warn("Persistent storage request failed", err);
  }

  setDownloadStatus(song.id, { progress: 0, status: "downloading", song });

  let blob: Blob | null = null;
  
  try {
    let downloadUrl = song.localUrl;
    
    // If not local, resolve the audio stream
    if (!downloadUrl) {
      const videoId = extractYoutubeVideoIdFromString(song.sourceId || song.id);
      if (videoId) {
        console.log(`[Download] Extracting audio stream for video: ${videoId}`);
        const streamUrl = await resolveAudioStreamUrl(videoId);
        if (streamUrl) {
          downloadUrl = streamUrl;
        } else {
          throw new Error("Failed to resolve audio stream URL from upstream providers.");
        }
      }
    }

    if (downloadUrl) {
      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadStatus(song.id, { progress, status: "downloading", song });
          }
        },
      });
      blob = response.data;
    } else {
      throw new Error("No download URL available.");
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
      source: "local", // Bypasses youtube iframe player, flags as offline/local
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
