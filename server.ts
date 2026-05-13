import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Lyrics proxy/aggregator (External database only now)
  app.get("/api/lyrics", async (req, res) => {
    const { artist, title, duration } = req.query;
    if (!artist || !title) return res.status(400).json({ error: "Artist and Title required" });

    try {
      const artistStr = String(artist);
      const titleStr = String(title);
      const durationVal = duration ? parseInt(String(duration)) : undefined;

      // Clean names for fallback search
      const q = `${artistStr} ${titleStr}`.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
      
      console.log(`[Lyrics] Searching for: ${artistStr} - ${titleStr} (${durationVal || 'no duration'}s)`);

      let lyricsData = null;

      // 1. Try LrcLib precise GET if duration is available
      if (durationVal) {
        try {
          const getResponse = await axios.get("https://lrclib.net/api/get", {
            params: {
              artist_name: artistStr,
              track_name: titleStr,
              duration: durationVal
            },
            timeout: 15000,
            headers: {
              'User-Agent': 'MusicApp/1.0 (https://ais-build.app)'
            }
          });
 
          if (getResponse.data && (getResponse.data.syncedLyrics || getResponse.data.plainLyrics)) {
            console.log(`[Lyrics] LrcLib GET match found`);
            lyricsData = {
              lyrics: getResponse.data.syncedLyrics || getResponse.data.plainLyrics,
              isSynced: !!getResponse.data.syncedLyrics,
              source: "lrclib_get"
            };
          }
        } catch (err: any) {
          // If 404, we continue to search. If other error, we log it.
          if (err.response?.status !== 404) {
             console.warn(`[Lyrics] LrcLib GET failed: ${err.message}${err.code === 'ECONNABORTED' ? ' (Timeout)' : ''}`);
          }
        }
      }
 
      // 2. Fallback to LrcLib Search
      if (!lyricsData && q) {
        try {
          const searchResponse = await axios.get("https://lrclib.net/api/search", {
            params: { q },
            timeout: 20000, 
            headers: {
              'User-Agent': 'MusicApp/1.0 (https://ais-build.app)'
            }
          });

          if (searchResponse.data && searchResponse.data.length > 0) {
            // Prefer matches that have similar duration if possible
            let item = searchResponse.data[0];
            if (durationVal) {
              const bestMatch = searchResponse.data.find((i: any) => 
                Math.abs(i.duration - durationVal) < 5 && i.syncedLyrics
              );
              item = bestMatch || searchResponse.data.find((i: any) => i.syncedLyrics) || searchResponse.data[0];
            } else {
              item = searchResponse.data.find((i: any) => i.syncedLyrics) || searchResponse.data[0];
            }

            lyricsData = {
              lyrics: item.syncedLyrics || item.plainLyrics,
              isSynced: !!item.syncedLyrics,
              source: "lrclib_search"
            };
            console.log(`[Lyrics] LrcLib search match found`);
          }
        } catch (err: any) {
          console.warn(`[Lyrics] LrcLib search failed or timed out: ${err.message}`);
        }
      }

      if (lyricsData) {
        return res.json(lyricsData);
      }

      console.info(`[Lyrics] No lyrics found for ${artistStr} - ${titleStr}. Client will use AI fallback.`);
      res.status(404).json({ message: "No lyrics found in external database" });
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.message || error.message || "Lyrics service error";
      
      console.error(`[Lyrics Error] Status: ${status}, Message: ${message}`);
      
      if (status === 404) {
        return res.status(404).json({ error: "Lyrics not found upstream" });
      }

      res.status(status).json({ 
        error: "Lyrics service failure", 
        detail: message,
        upstreamStatus: status
      });
    }
  });

  app.get("/api/metadata", (req, res) => {
    const { songId, source } = req.query;
    
    const mockMetadata: Record<string, any> = {
      "1": { id: "1", title: "Midnight City", artist: "M83", album: "Hurry Up, We're Dreaming", duration: 243, source: "youtube", thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop" },
      "2": { id: "2", title: "Starboy", artist: "The Weeknd", album: "Starboy", duration: 230, source: "spotify", thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop" },
      "3": { id: "3", title: "Blinding Lights", artist: "The Weeknd", album: "After Hours", duration: 200, source: "youtube", thumbnail: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop" },
      "4": { id: "4", title: "Levitating", artist: "Dua Lipa", album: "Future Nostalgia", duration: 203, source: "spotify", thumbnail: "https://images.unsplash.com/photo-1514525253361-bee8718a300a?w=300&h=300&fit=crop" },
    };

    const metadata = mockMetadata[songId as string] || {
      id: songId,
      title: `Unknown Track`,
      artist: "Various Artists",
      album: "Sonic Vault",
      duration: 215,
      source: source || "cloud",
      thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop"
    };

    res.json(metadata);
  });

  // YouTube search logic
  app.get("/api/search", async (req, res) => {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn("YOUTUBE_API_KEY is missing. Providing fallback results.");
      return res.json([
        { id: "1", title: `${q} (Mock Mode)`, artist: "YouTube API Key Needed", thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop", source: "youtube", sourceId: "dQw4w9WgXcQ" }
      ]);
    }

    try {
      const searchResponse = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: {
          q: q,
          part: "snippet",
          type: "video",
          maxResults: 15,
          key: apiKey,
          videoCategoryId: "10",
        }
      });

      const videoIds = searchResponse.data.items.map((item: any) => item.id.videoId).join(",");
      
      const videosResponse = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params: {
          part: "contentDetails",
          id: videoIds,
          key: apiKey,
        }
      });

      const durations = videosResponse.data.items.reduce((acc: any, video: any) => {
        acc[video.id] = parseISO8601Duration(video.contentDetails.duration);
        return acc;
      }, {});

      const results = searchResponse.data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high.url,
        source: "youtube",
        sourceId: item.id.videoId,
        duration: durations[item.id.videoId] || 0
      }));

      res.json(results);
    } catch (error: any) {
      console.error("YouTube Search Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch results from YouTube" });
    }
  });
  
  // YouTube explore (trending music)
  app.get("/api/explore", async (req, res) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn("YOUTUBE_API_KEY is missing. Providing fallback explore content.");
      return res.json([
        { id: "trending1", title: "Mock Trending Track", artist: "Explore AI", thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop", source: "youtube", sourceId: "dQw4w9WgXcQ" }
      ]);
    }

    try {
      const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params: {
          part: "snippet,contentDetails",
          chart: "mostPopular",
          videoCategoryId: "10",
          maxResults: 20,
          key: apiKey,
        }
      });

      const results = response.data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high.url,
        source: "youtube",
        sourceId: item.id,
        duration: parseISO8601Duration(item.contentDetails.duration)
      }));

      res.json(results);
    } catch (error: any) {
      console.error("YouTube Explore Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch explore content from YouTube" });
    }
  });

  // Helper to parse ISO 8601 duration
  function parseISO8601Duration(duration: string) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
