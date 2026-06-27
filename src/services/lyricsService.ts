import axios from "axios";
import { LyricLine } from "../store/usePlayerStore";

async function fetchWithTimeout(url: string, options: any = {}, timeout = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchLyrics(artist: string, title: string, duration?: number): Promise<LyricLine[] | null> {
  let lyricsData: { lyrics: string, isSynced: boolean } | null = null;
  const q = `${artist} ${title}`.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();

  // 1. Try fetching from LrcLib directly on the client side (bypasses datacenter IP blocks)
  try {
    let item = null;
    
    // Clean names for exact match
    const artistClean = artist.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
    const titleClean = title.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
    const isDurationValid = duration && duration >= 1 && duration <= 3600;

    if (isDurationValid && artistClean.length > 0 && titleClean.length > 0) {
      try {
        const getUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artistClean)}&track_name=${encodeURIComponent(titleClean)}&duration=${Math.floor(duration!)}`;
        const getRes = await fetchWithTimeout(getUrl);
        if (getRes.ok) {
          const data = await getRes.json();
          if (data && (data.syncedLyrics || data.plainLyrics)) {
            item = data;
          }
        }
      } catch (e) {
        console.warn("Client LrcLib GET failed", e);
      }
    }

    if (!item && q) {
      try {
        const searchRes = await fetchWithTimeout(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
        if (searchRes.ok) {
          const data = await searchRes.json();
          if (data && data.length > 0) {
            if (duration) {
              const bestMatch = data.find((i: any) => Math.abs(i.duration - duration) < 5 && i.syncedLyrics);
              item = bestMatch || data.find((i: any) => i.syncedLyrics) || data[0];
            } else {
              item = data.find((i: any) => i.syncedLyrics) || data[0];
            }
          }
        }
      } catch (e) {
        console.warn("Client LrcLib search failed", e);
      }
    }

    if (item && (item.syncedLyrics || item.plainLyrics)) {
      lyricsData = {
        lyrics: item.syncedLyrics || item.plainLyrics,
        isSynced: !!item.syncedLyrics
      };
    }
  } catch (error) {
    console.warn("Client side lrclib fetch failed, falling back to server...", error);
  }

  // 2. Fallback to our backend server
  if (!lyricsData) {
    try {
      const response = await axios.get("/api/lyrics", {
        params: { artist, title, duration },
        timeout: 15000
      });
      if (response.data && response.data.lyrics) {
        lyricsData = response.data;
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.info(`[Lyrics] No lyrics found (404) for: ${artist} - ${title}`);
      } else {
        console.warn("Failed to fetch lyrics from backend:", error.message);
      }
    }
  }

  // 3. Parse result
  if (lyricsData && lyricsData.lyrics) {
    if (lyricsData.isSynced) {
      return parseLrc(lyricsData.lyrics);
    } else {
      return lyricsData.lyrics.split('\n').map((text: string) => ({
        text: text.trim(),
        time: 0
      })).filter((line: LyricLine) => line.text.length > 0);
    }
  }

  return null;
}

function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const timeRegex = /\[(\d+):(\d+\.\d+)\]/g;
  
  const lrcLines = lrc.split('\n');
  
  for (const line of lrcLines) {
    const text = line.replace(timeRegex, "").trim();
    if (!text) continue;
    
    let match;
    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1]);
      const seconds = parseFloat(match[2]);
      const totalTime = minutes * 60 + seconds;
      lines.push({ text, time: totalTime });
    }
  }
  
  return lines.sort((a, b) => a.time - b.time);
}
