
import { get, set, del, keys } from "idb-keyval";

const STORE_NAME = "SonicVault_Tracks";

export interface LyricLine {
  text: string;
  time: number;
}

export interface OfflineTrack {
  id: string;
  blob: Blob;
  metadata: {
    title: string;
    artist: string;
    album?: string;
    duration: number;
    thumbnail?: string;
    thumbnailBlob?: Blob;
    source: string;
    lyrics?: LyricLine[];
    genre?: string;
  };
}

// Detect if we are running in a native packaged app (e.g. Capacitor, Tauri, React Native WebView, Android WebView)
export const isNativeEnvironment = () => {
  return !!(
    (window as any).__TAURI__ ||
    (window as any).Capacitor ||
    (window as any).electron ||
    (window as any).cordova ||
    (window as any).ReactNativeWebView ||
    (window as any).Android ||
    // For AI Studio Android wrapper emulation
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  );
};

export async function saveTrack(track: OfflineTrack): Promise<void> {
  if (isNativeEnvironment() && navigator.storage && navigator.storage.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('OfflineVault', { create: true });
      
      // Save Audio Blob directly to local sandbox device storage
      const audioFileHandle = await dir.getFileHandle(`${track.id}.audio`, { create: true });
      const audioWritable = await audioFileHandle.createWritable();
      await audioWritable.write(track.blob);
      await audioWritable.close();

      // Save Thumbnail Blob
      if (track.metadata.thumbnailBlob) {
        const thumbFileHandle = await dir.getFileHandle(`${track.id}.thumb`, { create: true });
        const thumbWritable = await thumbFileHandle.createWritable();
        await thumbWritable.write(track.metadata.thumbnailBlob);
        await thumbWritable.close();
      }

      // Save Meta
      const meta = { ...track.metadata, thumbnailBlob: undefined };
      const metaFileHandle = await dir.getFileHandle(`${track.id}.meta`, { create: true });
      const metaWritable = await metaFileHandle.createWritable();
      await metaWritable.write(JSON.stringify(meta));
      await metaWritable.close();
      return;
    } catch (err) {
      console.warn("Native sandbox OPFS failed, falling back to IndexedDB Web Cache", err);
    }
  }

  // Fallback to WEB Environment: IndexedDB
  await set(`${STORE_NAME}_${track.id}`, track);
}

export async function getAllTracks(): Promise<OfflineTrack[]> {
  const tracks: OfflineTrack[] = [];

  if (isNativeEnvironment() && navigator.storage && navigator.storage.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('OfflineVault');
      
      for await (const [name, handle] of (dir as any).entries()) {
        if (name.endsWith('.meta') && handle.kind === 'file') {
          const id = name.replace('.meta', '');
          const track = await getTrack(id);
          if (track) tracks.push(track);
        }
      }
      return tracks; // Return Native tracks if success
    } catch (err) {
      // ignore, try IndexedDb
    }
  }

  // Web fallback: IndexedDB
  try {
    const allKeys = await keys();
    const trackKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORE_NAME));
    
    for (const key of trackKeys) {
      const track = await get(key as string);
      if (track) tracks.push(track as OfflineTrack);
    }
  } catch (err) { }
  
  return tracks;
}

export async function getTrack(id: string): Promise<OfflineTrack | undefined> {
  if (isNativeEnvironment() && navigator.storage && navigator.storage.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('OfflineVault');
      
      // Read Audio
      const audioHandle = await dir.getFileHandle(`${id}.audio`);
      const audioFile = await audioHandle.getFile();
      
      // Read Meta
      const metaHandle = await dir.getFileHandle(`${id}.meta`);
      const metaFile = await metaHandle.getFile();
      const metaText = await metaFile.text();
      const metadata = JSON.parse(metaText);
      
      let thumbnailBlob: Blob | undefined;
      try {
        const thumbHandle = await dir.getFileHandle(`${id}.thumb`);
        thumbnailBlob = await thumbHandle.getFile();
        metadata.thumbnailBlob = thumbnailBlob;
      } catch (e) { }
      
      return { id, blob: audioFile, metadata };
    } catch (err) {
      // not found in native or OPFS Error, try IndexedDB
    }
  }

  // Web DB
  try {
    const track = await get(`${STORE_NAME}_${id}`);
    return track as OfflineTrack | undefined;
  } catch (e) {
    return undefined;
  }
}

export async function deleteTrack(id: string): Promise<void> {
  if (navigator.storage && navigator.storage.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('OfflineVault');
      await dir.removeEntry(`${id}.audio`).catch(() => {});
      await dir.removeEntry(`${id}.meta`).catch(() => {});
      await dir.removeEntry(`${id}.thumb`).catch(() => {});
    } catch (err) { }
  }
  
  await del(`${STORE_NAME}_${id}`);
}

export async function isTrackOffline(id: string): Promise<boolean> {
  if (isNativeEnvironment() && navigator.storage && navigator.storage.getDirectory) {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('OfflineVault');
      await dir.getFileHandle(`${id}.meta`);
      await dir.getFileHandle(`${id}.audio`);
      return true;
    } catch (err) { }
  }

  const track = await get(`${STORE_NAME}_${id}`);
  return !!track;
}
