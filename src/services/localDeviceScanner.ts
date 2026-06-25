import * as mm from "music-metadata-browser";
import { getAllTracks, saveTrack, isTrackOffline, getTrack } from "../lib/offlineStorage";
import { fetchLyrics } from "./lyricsService";
import { usePlayerStore, Song } from "../store/usePlayerStore";

export const processLocalFile = async (file: File): Promise<Song | null> => {
  const deterministicId = `local-${file.name}-${file.size}`;
  const placeholderSong: Song = {
    id: deterministicId,
    title: file.name.replace(/\.[^/.]+$/, ""),
    artist: "Processing...",
    thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
    source: "local",
    sourceId: file.name,
  };

  usePlayerStore.getState().setDownloadStatus(deterministicId, {
    progress: 10,
    status: "syncing",
    song: placeholderSong
  });

  try {
    const exists = await isTrackOffline(deterministicId);
    if (exists) {
      usePlayerStore.getState().removeDownload(deterministicId);
      // Wait, if it exists, maybe we want to fetch the track and return it? Let's just return what getTrack gives
      const track = await getTrack(deterministicId);
      if (track) {
         let thumbUrl = track.metadata.thumbnail;
         if (track.metadata.thumbnailBlob) {
            thumbUrl = URL.createObjectURL(track.metadata.thumbnailBlob);
         }
         return {
            id: track.id,
            title: track.metadata.title,
            artist: track.metadata.artist,
            thumbnail: thumbUrl || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
            source: "local",
            sourceId: track.id,
            duration: track.metadata.duration,
            localUrl: URL.createObjectURL(track.blob),
            lyrics: track.metadata.lyrics,
            genre: track.metadata.genre || "Unknown Genre"
         };
      }
      return null;
    }

    const metadata = await mm.parseBlob(file);
    const title = metadata.common.title || file.name.replace(/\.[^/.]+$/, "");
    const artist = metadata.common.artist || "Unknown Artist";
    const album = metadata.common.album || "Unknown Album";
    const genre = metadata.common.genre && metadata.common.genre.length > 0 ? metadata.common.genre.join(", ") : "Unknown Genre";
    
    let thumbnail = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop";
    let thumbnailBlob: Blob | undefined;
    
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      thumbnailBlob = new Blob([pic.data], { type: pic.format });
      thumbnail = URL.createObjectURL(thumbnailBlob);
    }

    const duration = Math.round(metadata.format.duration || 0);

    usePlayerStore.getState().setDownloadStatus(deterministicId, {
      progress: 50,
      status: "syncing",
      song: { ...placeholderSong, title, artist, thumbnail, duration }
    });

    await saveTrack({
      id: deterministicId,
      blob: file,
      metadata: {
        title,
        artist,
        album,
        duration,
        thumbnail: !thumbnail.startsWith("blob:") ? thumbnail : undefined,
        thumbnailBlob,
        source: "local",
        lyrics: [],
        genre
      }
    });

    const finalSong: Song = {
      id: deterministicId,
      title,
      artist,
      thumbnail,
      source: "local",
      sourceId: file.name,
      duration,
      localUrl: URL.createObjectURL(file),
      lyrics: [],
      genre
    };

    usePlayerStore.getState().setDownloadStatus(deterministicId, {
      progress: 100,
      status: "completed",
      song: finalSong
    });

    setTimeout(() => {
      usePlayerStore.getState().removeDownload(deterministicId);
    }, 3000);

    setTimeout(async () => {
       try {
           const lyrics = await fetchLyrics(finalSong.artist, finalSong.title);
           if (lyrics) {
               const track = await getTrack(finalSong.id);
               if (track) {
                   track.metadata.lyrics = lyrics;
                   await saveTrack(track);
               }
           }
       } catch (err) {}
    }, 1000);

    return finalSong;
  } catch (err) {
    console.error("Error parsing metadata for", file.name, err);
    usePlayerStore.getState().setDownloadStatus(deterministicId, {
      progress: 0,
      status: "failed",
      error: "Sync failed",
      song: placeholderSong
    });
    return null;
  }
};

export const scanDeviceDirectory = async (
  onProgress?: (current: number, total: number | null) => void
): Promise<Song[]> => {
  if (!('showDirectoryPicker' in window)) {
    throw new Error("Folder sync requires a modern browser with File System Access API support (e.g. Chrome, Edge).");
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker();
    const newSongs: Song[] = [];
    
    if (onProgress) onProgress(0, null);

    async function* getFilesRecursively(entry: any): AsyncGenerator<File> {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        if (file.type.startsWith("audio/") || file.name.match(/\.(mp3|wav|m4a|flac|ogg)$/i)) {
          yield file;
        }
      } else if (entry.kind === 'directory') {
         for await (const handle of entry.values()) {
           yield* getFilesRecursively(handle);
         }
      }
    }

    let processedCount = 0;
    for await (const file of getFilesRecursively(dirHandle)) {
      const song = await processLocalFile(file);
      if (song) {
        newSongs.push(song);
      }
      processedCount++;
      if (onProgress) onProgress(processedCount, null);
    }

    return newSongs;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return [];
    }
    if (err.message?.includes('Cross origin sub frames')) {
      throw new Error("SECURITY RESTRICTION: Browser security prevents opening a folder picker inside an iframe. \n\nPlease open this app in a NEW TAB (icon in top right) to use the Folder Sync feature.");
    }
    throw err;
  }
};
