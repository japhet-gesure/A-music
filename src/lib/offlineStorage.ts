
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

export async function saveTrack(track: OfflineTrack): Promise<void> {
  await set(`${STORE_NAME}_${track.id}`, track);
}

export async function getAllTracks(): Promise<OfflineTrack[]> {
  const allKeys = await keys();
  const trackKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(STORE_NAME));
  const tracks: OfflineTrack[] = [];
  
  for (const key of trackKeys) {
    const track = await get(key as string);
    if (track) tracks.push(track);
  }
  
  return tracks;
}

export async function getTrack(id: string): Promise<OfflineTrack | undefined> {
  return await get(`${STORE_NAME}_${id}`);
}

export async function deleteTrack(id: string): Promise<void> {
  await del(`${STORE_NAME}_${id}`);
}

export async function isTrackOffline(id: string): Promise<boolean> {
  const track = await get(`${STORE_NAME}_${id}`);
  return !!track;
}
