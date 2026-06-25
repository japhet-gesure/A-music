import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import axios from "axios";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import { Buffer } from "buffer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini SDK on the server side
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// Track if image generation is disabled globally due to quota or rate-limiting
let isImageGenerationDisabledGlobally = false;

// Track if YouTube API is disabled globally due to quota, rate-limiting or developer plan limits
let isYouTubeQuotaExceeded = false;
let lastYouTubeQuotaCheckTime = 0;
const YOUTUBE_QUOTA_COOLDOWN_DURATION = 15 * 60 * 1000; // 15 minutes cooldown

function handleYouTubeError(err: any, endpointContext: string) {
  const status = err.response?.status;
  const responseData = err.response?.data;
  let errorMsg = err.message || String(err);

  if (responseData && responseData.error) {
    const apiError = responseData.error;
    errorMsg = `[API ${apiError.code || status}]: ${apiError.message || ""}`;
    const cleanMsgLower = (apiError.message || "").toLowerCase();

    const isQuota =
      cleanMsgLower.includes("quota") ||
      cleanMsgLower.includes("limit") ||
      cleanMsgLower.includes("exceeded") ||
      cleanMsgLower.includes("capacity") ||
      status === 403 ||
      status === 429;

    if (isQuota) {
      isYouTubeQuotaExceeded = true;
      lastYouTubeQuotaCheckTime = Date.now();
      console.warn(
        `[YouTube Quota] Rate limit/quota hit at ${endpointContext}. Activating auto-fallback bypass for 15 minutes: ${errorMsg}`,
      );
    } else {
      console.warn(`[YouTube Warning] At ${endpointContext}: ${errorMsg}`);
    }
  } else {
    console.warn(
      `[YouTube Connection Exception] At ${endpointContext}: ${errorMsg}`,
    );
  }
}

// In-memory cache to prevent 429 quota exhaustion
interface CacheEntry {
  data: any;
  timestamp: number;
}
const serverCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour TTL

function getCached(key: string): any | null {
  const entry = serverCache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    console.info(`[Cache] Cache HIT for key: ${key}`);
    return entry.data;
  }
  return null;
}

function setCached(key: string, data: any): void {
  console.info(`[Cache] Caching fresh data for key: ${key}`);
  serverCache[key] = {
    data,
    timestamp: Date.now(),
  };
}

// Robust fallback data structures for when Gemini is offline or overloaded
interface Recommendation {
  title: string;
  artist: string;
  reason: string;
}

const FALLBACK_LIBRARY: Record<string, Recommendation[]> = {
  pop: [
    {
      title: "Levitating",
      artist: "Dua Lipa",
      reason:
        "An irresistible stellar disco-pop groove with infectious energy.",
    },
    {
      title: "As It Was",
      artist: "Harry Styles",
      reason:
        "A bittersweet synth-pop melody wrapped in lighthearted vulnerability.",
    },
    {
      title: "Cruel Summer",
      artist: "Taylor Swift",
      reason:
        "Searing synth-driven pop anthem with a phenomenal emotional climax.",
    },
    {
      title: "Save Your Tears",
      artist: "The Weeknd",
      reason:
        "Bright retro-pop beat contrasted with deeply emotional storytelling.",
    },
    {
      title: "Flowers",
      artist: "Miley Cyrus",
      reason:
        "Empowering disco-inspired rhythm detailing self-love and independence.",
    },
  ],
  electronic: [
    {
      title: "Midnight City",
      artist: "M83",
      reason:
        "Symphonic synth-pop masterpiece reflecting retro-future horizons.",
    },
    {
      title: "Intro",
      artist: "The XX",
      reason:
        "Atmospheric minimalist electronic loop that builds supreme tension.",
    },
    {
      title: "Around the World",
      artist: "Daft Punk",
      reason: "Hypnotic house baseline carrying a vibrant electronic wave.",
    },
    {
      title: "Giorgio by Moroder",
      artist: "Daft Punk",
      reason:
        "Philosophical electronic evolution complete with soaring synths.",
    },
    {
      title: "Strobe",
      artist: "deadmau5",
      reason:
        "Progressive electronic odyssey that delivers pristine sound design.",
    },
  ],
  indie: [
    {
      title: "The Less I Know The Better",
      artist: "Tame Impala",
      reason:
        "Hypnotic bassline and psychedelic synth textures of modern indie.",
    },
    {
      title: "Sweater Weather",
      artist: "The Neighbourhood",
      reason: "Melancholic moody indie flow perfectly captured in warm reverb.",
    },
    {
      title: "Riptide",
      artist: "Vance Joy",
      reason:
        "Uplifting acoustic indie arrangements with bright, unforgettable lyrics.",
    },
    {
      title: "Borderline",
      artist: "Tame Impala",
      reason: "Sunny psych-pop rhythms backed by gorgeous analog synth swells.",
    },
    {
      title: "Do I Wanna Know?",
      artist: "Arctic Monkeys",
      reason:
        "Heavy swaggering indie rock riff paired with crisp, dark delivery.",
    },
  ],
  rb: [
    {
      title: "Starboy",
      artist: "The Weeknd",
      reason:
        "Sultry dark R&B groove wrapped in pristine electronic production.",
    },
    {
      title: "Blinding Lights",
      artist: "The Weeknd",
      reason: "An infectious, fast-paced tribute to 80s synth-wave energy.",
    },
    {
      title: "Redbone",
      artist: "Childish Gambino",
      reason:
        "Sumptuous neo-soul groove filled with vintage psychedelic warmth.",
    },
    {
      title: "Snooze",
      artist: "SZA",
      reason:
        "Lush contemporary R&B flow with outstanding emotional vocal layers.",
    },
    {
      title: "Die For You",
      artist: "The Weeknd",
      reason: "Enchanting falsetto-laden ballad of undying love and devotion.",
    },
  ],
  synthwave: [
    {
      title: "Nightcall",
      artist: "Kavinsky",
      reason: "Haunting vocals and heavy vintage analog synth rhythms.",
    },
    {
      title: "After Hours",
      artist: "The Weeknd",
      reason: "Lush cinematic build with an elegant and fast-paced finish.",
    },
    {
      title: "Resonance",
      artist: "HOME",
      reason: "Chill instrumental lo-fi synthwave painting sunset nostalgia.",
    },
  ],
};

const DEFAULT_FALLBACKS: Recommendation[] = [
  {
    title: "Midnight City",
    artist: "M83",
    reason: "Symphonic synth-pop masterpiece reflecting retro-future horizons.",
  },
  {
    title: "Starboy",
    artist: "The Weeknd",
    reason: "Sultry dark R&B groove wrapped in pristine electronic production.",
  },
  {
    title: "Blinding Lights",
    artist: "The Weeknd",
    reason: "An infectious, fast-paced tribute to 80s synth-wave energy.",
  },
  {
    title: "The Less I Know The Better",
    artist: "Tame Impala",
    reason: "Hypnotic bassline and psychedelic synth textures of modern indie.",
  },
  {
    title: "Redbone",
    artist: "Childish Gambino",
    reason: "Sumptuous neo-soul groove filled with vintage psychedelic warmth.",
  },
];

function getFallbackRecommendations(genres: string[]): Recommendation[] {
  const result: Recommendation[] = [];
  const lowercaseGenres = (genres || []).map((g) => g.toLowerCase());

  for (const genre of lowercaseGenres) {
    if (FALLBACK_LIBRARY[genre]) {
      result.push(...FALLBACK_LIBRARY[genre]);
    } else {
      for (const [key, list] of Object.entries(FALLBACK_LIBRARY)) {
        if (genre.includes(key) || key.includes(genre)) {
          result.push(...list);
        }
      }
    }
  }

  if (result.length >= 3) {
    const shuffled = [...result].sort(() => 0.5 - Math.random());
    const unique: Recommendation[] = [];
    const keys = new Set<string>();
    for (const item of shuffled) {
      const k = `${item.title.toLowerCase()}|${item.artist.toLowerCase()}`;
      if (!keys.has(k)) {
        keys.add(k);
        unique.push(item);
      }
      if (unique.length >= 5) break;
    }
    if (unique.length >= 3) return unique;
  }

  const pool = [...DEFAULT_FALLBACKS, ...result];
  const uniqueSongs: Recommendation[] = [];
  const keys = new Set<string>();
  const shuffledPool = pool.sort(() => 0.5 - Math.random());
  for (const item of shuffledPool) {
    const k = `${item.title.toLowerCase()}|${item.artist.toLowerCase()}`;
    if (!keys.has(k)) {
      keys.add(k);
      uniqueSongs.push(item);
    }
    if (uniqueSongs.length >= 5) break;
  }
  return uniqueSongs;
}

// In-memory circuit breaker to prevent high-latency retries when the API key is out of quota
let isGeminiQuotaExceeded = false;
let lastQuotaCheckTime = 0;
const QUOTA_COOLDOWN_DURATION = 15 * 60 * 1000; // 15 minutes cooldown

// Helper to sanitize and turn complex or stringified JSON API errors into clean sentences
function cleanErrorMessage(error: any): string {
  if (!error) return "Unknown error";

  // Try to extract from error object if it's an object, or serialize to string
  let msg = "";
  if (typeof error === "object") {
    if (error.message) {
      msg = error.message;
    } else if (error.statusText) {
      msg = error.statusText;
    } else {
      try {
        msg = JSON.stringify(error);
      } catch (e) {
        msg = String(error);
      }
    }
  } else {
    msg = String(error);
  }

  msg = msg.trim();

  // If the message is a stringified JSON of a status exception, parse it
  if (msg.startsWith("{") || msg.includes('"error"')) {
    try {
      const startIdx = msg.indexOf("{");
      const endIdx = msg.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = msg.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.error && parsed.error.message) {
          msg = parsed.error.message;
        } else if (parsed.message) {
          msg = parsed.message;
        }
      }
    } catch (e) {
      const match = msg.match(/"message"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        msg = match[1];
      }
    }
  }

  // Replace both real newlines and escaped newlines with a single space
  msg = msg.replace(/[\r\n]+/g, " ");
  msg = msg.replace(/\\n/g, " ");

  // Remove URLs and their leading labels/intro text
  msg = msg.replace(
    /For more information on this error, head to:\s*https?:\/\/[^\s]+/gi,
    "",
  );
  msg = msg.replace(
    /To monitor your current usage, head to:\s*https?:\/\/[^\s]+/gi,
    "",
  );
  msg = msg.replace(/Please retry in\s*[^\s]+/gi, "");

  // Clean up any remaining URLs in the string just in case
  msg = msg.replace(/https?:\/\/[^\s]+/gi, "");

  // Clean duplicate/redundant quota lines and metrics from the raw Google API error
  if (msg.includes("Quota exceeded for metric")) {
    const parts = msg.split(/Quota exceeded for metric:/i);
    if (parts.length > 1) {
      const baseMsg = parts[0].trim();
      const uniqueMetrics = new Set<string>();
      for (let i = 1; i < parts.length; i++) {
        const metricPart = parts[i].trim();
        const modelMatch = metricPart.match(/model:\s*([^\s,;.*()]+)/i);
        const metricMatch = metricPart.match(/([^\s,;.*()]+)/i);
        if (modelMatch && modelMatch[1]) {
          uniqueMetrics.add(
            `Quota exceeded for ${metricMatch ? metricMatch[1].split("/").pop() : "metric"} on ${modelMatch[1]}`,
          );
        } else if (metricMatch) {
          uniqueMetrics.add(
            `Quota exceeded for ${metricMatch[1].split("/").pop()}`,
          );
        }
      }
      if (uniqueMetrics.size > 0) {
        msg = `${baseMsg} (${Array.from(uniqueMetrics).join("; ")})`;
      }
    }
  }

  // Clean up punctuation remnants from stripped blocks (e.g., trailing periods, commas, double periods, backslashes)
  msg = msg.replace(/\\"/g, '"');
  msg = msg.replace(/\\'/g, "'");
  msg = msg.replace(/\s+/g, " ");
  msg = msg.replace(/\s*[.,;]+\s*(?=[.,;])/g, "");
  msg = msg.replace(/\.{2,}/g, ".");
  msg = msg.trim();

  // If the message is still very long, or contains billing advice, simplify it to a clean and friendly developer note
  if (
    msg.includes("You exceeded your current quota") ||
    msg.includes("quota exceeded") ||
    msg.includes("RESOURCE_EXHAUSTED")
  ) {
    const metricMatch = msg.match(/\(([^)]+)\)/);
    const detail = metricMatch ? ` (${metricMatch[1]})` : "";
    return `Gemini API quota exceeded or billing upgrade required${detail}`;
  }

  return msg || "Unknown Gemini API error";
}

// Wrapper with robust exponential backoff retry mechanism for transient API errors
async function generateContentWithRetry(
  params: any,
  retries = 3,
  delay = 1000,
): Promise<any> {
  const now = Date.now();
  const isImageModel =
    params?.model &&
    (params.model.includes("image") || params.model.includes("imagen"));

  if (isImageModel && isImageGenerationDisabledGlobally) {
    throw new Error(
      "Gemini Image generation is currently in fallback cooldown mode because the API model is rate-limited or out of quota.",
    );
  }

  if (
    !isImageModel &&
    isGeminiQuotaExceeded &&
    now - lastQuotaCheckTime < QUOTA_COOLDOWN_DURATION
  ) {
    throw new Error(
      "Gemini Text API is currently in fallback cooldown mode because the API Key has exceeded its quota or plan limits.",
    );
  }

  for (let i = 0; i < retries; i++) {
    try {
      if (!ai) {
        throw new Error("Gemini API not initialized (Missing API Key)");
      }
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const cleanMsg = cleanErrorMessage(error);

      // Determine if this is a permanent/severe quota limit, billing, or resource exhaustion error
      const isQuotaLimitError =
        cleanMsg.includes("exceeded your current quota") ||
        cleanMsg.includes("billing details") ||
        cleanMsg.includes("check your plan") ||
        cleanMsg.includes("quota exceeded") ||
        error.status === "RESOURCE_EXHAUSTED" ||
        error.code === 429 ||
        error.status === 429 ||
        cleanMsg.includes("429") ||
        cleanMsg.includes("RESOURCE_EXHAUSTED") ||
        cleanMsg.includes("quota");

      if (isQuotaLimitError) {
        if (isImageModel) {
          isImageGenerationDisabledGlobally = true;
          console.log(
            `[Gemini Info] Resource limit for image generation model (${params?.model}). Disabling image generation globally, but leaving text APIs active.`,
          );
        } else {
          isGeminiQuotaExceeded = true;
          lastQuotaCheckTime = now;
          console.log(
            `[Gemini Info] Managed text quota/billing limit reached (${params?.model}). Activating fallback bypass mode for 15 minutes.`,
          );
        }
        // Throw a simplified error with cleanMsg context instead of stringified json
        throw new Error(cleanMsg);
      }

      const isTransient =
        error.status === "UNAVAILABLE" ||
        error.code === 503 ||
        error.status === 503 ||
        cleanMsg.includes("503") ||
        cleanMsg.includes("experiencing high demand");

      if (isTransient && i < retries - 1) {
        console.log(
          `[Gemini Backoff] Busy status (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw new Error(cleanMsg);
      }
    }
  }
}

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
    if (!artist || !title)
      return res.status(400).json({ error: "Artist and Title required" });

    try {
      const artistStr = String(artist);
      const titleStr = String(title);
      let durationVal = duration ? parseInt(String(duration)) : undefined;

      // Clean names for fallback search and exact match
      const artistClean = artistStr.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
      const titleClean = titleStr.replace(/\([^)]*\)|\[[^\]]*\]/g, "").trim();
      const q = `${artistClean} ${titleClean}`.trim();
      
      // LrcLib requires duration between 1 and 3600 seconds
      if (durationVal && (durationVal < 1 || durationVal > 3600 || isNaN(durationVal))) {
        durationVal = undefined;
      }

      console.log(
        `[Lyrics] Searching for: ${artistStr} - ${titleStr} (${durationVal || "no duration"}s)`,
      );

      let lyricsData = null;

      // 1. Try LrcLib precise GET if duration is available and strings are valid
      if (durationVal && artistClean.length > 0 && titleClean.length > 0) {
        try {
          const getResponse = await axios.get("https://lrclib.net/api/get", {
            params: {
              artist_name: artistClean,
              track_name: titleClean,
              duration: durationVal,
            },
            timeout: 3000,
            headers: {
              "User-Agent": "MusicApp/1.0 (https://ais-build.app)",
            },
          });

          if (
            getResponse.data &&
            (getResponse.data.syncedLyrics || getResponse.data.plainLyrics)
          ) {
            console.log(`[Lyrics] LrcLib GET match found`);
            lyricsData = {
              lyrics:
                getResponse.data.syncedLyrics || getResponse.data.plainLyrics,
              isSynced: !!getResponse.data.syncedLyrics,
              source: "lrclib_get",
            };
          }
        } catch (err: any) {
          // If 404, we continue to search. If other error (like 400), we log it as an info/warning.
          if (err.response?.status !== 404) {
             console.log(
              `[Lyrics] LrcLib GET exact match unable to find result. Continuing to search. Reason: ${err.code === "ECONNABORTED" ? "timeout" : err.message}`
            );
          }
        }
      }

      // 2. Fallback to LrcLib Search
      if (!lyricsData && q) {
        try {
          const searchResponse = await axios.get(
            "https://lrclib.net/api/search",
            {
              params: { q },
              timeout: 3000,
              headers: {
                "User-Agent": "MusicApp/1.0 (https://ais-build.app)",
              },
            },
          );

          if (searchResponse.data && searchResponse.data.length > 0) {
            // Prefer matches that have similar duration if possible
            let item = searchResponse.data[0];
            if (durationVal) {
              const bestMatch = searchResponse.data.find(
                (i: any) =>
                  Math.abs(i.duration - durationVal) < 5 && i.syncedLyrics,
              );
              item =
                bestMatch ||
                searchResponse.data.find((i: any) => i.syncedLyrics) ||
                searchResponse.data[0];
            } else {
              item =
                searchResponse.data.find((i: any) => i.syncedLyrics) ||
                searchResponse.data[0];
            }

            lyricsData = {
              lyrics: item.syncedLyrics || item.plainLyrics,
              isSynced: !!item.syncedLyrics,
              source: "lrclib_search",
            };
            console.log(`[Lyrics] LrcLib search match found`);
          }
        } catch (err: any) {
          console.log(
            `[Lyrics] LrcLib search request did not complete: ${err.message} - falling back to AI.`,
          );
        }
      }

      if (lyricsData) {
        return res.json(lyricsData);
      }

      if (ai && !isGeminiQuotaExceeded) {
        try {
          console.info(
            `[Lyrics] No lyrics found for ${artistStr} - ${titleStr}. Attempting server-side AI fallback.`,
          );

          let response;
          const fallbackModels = [
            "gemini-3.5-flash",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
          ];

          for (const model of fallbackModels) {
            try {
              response = await generateContentWithRetry({
                model,
                contents: `Provide the full lyrics for the song "${titleStr}" by "${artistStr}". 
Return ONLY the lyrics text. If you can't find them precisely, provide a best-effort transcription. 
No conversational filler.`,
              }, 1); // 1 retry only for speed
              break; // Success!
            } catch (err: any) {
              const errMsg = err.message || String(err);
              if (
                errMsg.includes("high demand") ||
                errMsg.includes("overloaded") ||
                errMsg.includes("503")
              ) {
                console.warn(
                  `[Lyrics] Model ${model} is overloaded, trying next model...`,
                );
                continue; // Try next model
              } else {
                throw err; // Other errors like quota or API key issues should still fail out
              }
            }
          }

          if (response) {
            const aiLyrics = response.text || "";
            if (aiLyrics && aiLyrics.length > 20) {
              return res.json({
                lyrics: aiLyrics,
                isSynced: false,
                source: "gemini_fallback",
              });
            }
          }
        } catch (aiErr: any) {
          const errMsg = aiErr.message || String(aiErr);
          if (
            errMsg.includes("fallback cooldown mode") ||
            errMsg.includes("quota exceeded") ||
            errMsg.includes("exceeded your current quota") ||
            errMsg.includes("RESOURCE_EXHAUSTED") ||
            errMsg.includes("429")
          ) {
            console.warn(
              `[Lyrics] Lyrics fallback triggered safely for "${artistStr} - ${titleStr}" (Quota active).`,
            );
          } else {
            console.warn(
              "[Lyrics] Server-side AI Lyrics fallback failed:",
              errMsg,
            );
          }
        }
      }

      console.info(`[Lyrics] No lyrics found for ${artistStr} - ${titleStr}.`);
      res.status(404).json({ message: "No lyrics found in external database" });
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message =
        error.response?.data?.message ||
        error.message ||
        "Lyrics service error";

      console.error(`[Lyrics Error] Status: ${status}, Message: ${message}`);

      if (status === 404) {
        return res.status(404).json({ error: "Lyrics not found upstream" });
      }

      res.status(status).json({
        error: "Lyrics service failure",
        detail: message,
        upstreamStatus: status,
      });
    }
  });

  app.get("/api/metadata", (req, res) => {
    const { songId, source } = req.query;

    const mockMetadata: Record<string, any> = {
      "1": {
        id: "1",
        title: "Midnight City",
        artist: "M83",
        album: "Hurry Up, We're Dreaming",
        duration: 243,
        source: "youtube",
        thumbnail:
          "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
      },
      "2": {
        id: "2",
        title: "Starboy",
        artist: "The Weeknd",
        album: "Starboy",
        duration: 230,
        source: "spotify",
        thumbnail:
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
      },
      "3": {
        id: "3",
        title: "Blinding Lights",
        artist: "The Weeknd",
        album: "After Hours",
        duration: 200,
        source: "youtube",
        thumbnail:
          "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop",
      },
      "4": {
        id: "4",
        title: "Levitating",
        artist: "Dua Lipa",
        album: "Future Nostalgia",
        duration: 203,
        source: "spotify",
        thumbnail:
          "https://images.unsplash.com/photo-1514525253361-bee8718a300a?w=300&h=300&fit=crop",
      },
    };

    const metadata = mockMetadata[songId as string] || {
      id: songId,
      title: `Unknown Track`,
      artist: "Various Artists",
      album: "Sonic Vault",
      duration: 215,
      source: source || "cloud",
      thumbnail:
        "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
    };

    res.json(metadata);
  });

  // YouTube search logic
  app.get("/api/search", async (req, res) => {
    let { q } = req.query;

    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    // rigorous validation and sanitization layer
    let sanitizedQuery = q.replace(/<[^>]*>?/gm, ""); // strip out HTML tags
    sanitizedQuery = sanitizedQuery.replace(/[<>{}\[\]=]/g, ""); // strip script elements/unsafe punctuation
    sanitizedQuery = sanitizedQuery.trim();

    if (!sanitizedQuery) {
      return res
        .status(400)
        .json({ error: "Query cannot be empty or just whitespace" });
    }

    if (sanitizedQuery.length > 100) {
      sanitizedQuery = sanitizedQuery.substring(0, 100);
    }

    q = sanitizedQuery; // use sanitized query

    const apiKey = process.env.YOUTUBE_API_KEY;
    const now = Date.now();
    const isYTQuotaActive =
      isYouTubeQuotaExceeded &&
      now - lastYouTubeQuotaCheckTime < YOUTUBE_QUOTA_COOLDOWN_DURATION;

    if (!apiKey || isYTQuotaActive) {
      if (isYTQuotaActive) {
        console.warn(
          `[YouTube Bypass] Active quota cooldown. Serving smart fallback results instantly for query "${q}"`,
        );
      } else {
        console.warn("YOUTUBE_API_KEY is missing. Providing fallback results.");
      }
      return res.json([
        {
          id: `yt-fallback-${Buffer.from(String(q)).toString("hex").substring(0, 8)}`,
          title: `${q} (Playback Cached)`,
          artist: "Cloud Stream Server",
          thumbnail:
            "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 215,
        },
      ]);
    }

    try {
      const searchResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            q: q,
            part: "snippet",
            type: "video",
            videoEmbeddable: "any",
            maxResults: 15,
            key: apiKey,
          },
          timeout: 5000,
        },
      );

      const videoIds = searchResponse.data.items
        .map((item: any) => item.id.videoId)
        .join(",");

      const videosResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: {
            part: "contentDetails",
            id: videoIds,
            key: apiKey,
          },
          timeout: 5000,
        },
      );

      const durations = videosResponse.data.items.reduce(
        (acc: any, video: any) => {
          acc[video.id] = parseISO8601Duration(video.contentDetails.duration);
          return acc;
        },
        {},
      );

      let results = searchResponse.data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high.url,
        description: item.snippet.description || "",
        source: "youtube",
        sourceId: item.id.videoId,
        duration: durations[item.id.videoId] || 0,
      }));

      // Non-blocking AI Filter to augment results
      try {
        const titlesToFilter = results.map((r: any) => ({
          id: r.id,
          title: r.title,
        }));
        const promptText = `Analyze these titles and determine if they are standalone songs/music tracks. 
Exclude full albums, podcasts, reaction videos, interviews, concert full shows, vlogs, documentary, long DJ mixes.
It MUST be marked as a song if it has "lyrics" or "lyric video" in the name as long as it isn't an entire album.
If it is over 20 minutes, it's rarely a standalone song.
Return ONLY a JSON map where keys are strictly the IDs from the array below and values are boolean true (if it's a song) or false (if not).
Do NOT wrap the JSON in Markdown formatting block. Only raw JSON.
${JSON.stringify(titlesToFilter, null, 2)}`;

        const filterResponse = await generateContentWithRetry(
          {
            model: "gemini-3.1-flash-lite",
            contents: promptText,
            config: {
              responseMimeType: "application/json",
            },
          },
          1,
          500,
        );

        if (filterResponse && filterResponse.text) {
          const aiMap = JSON.parse(filterResponse.text);
          results = results.map((r: any) => ({
            ...r,
            isAiSong: aiMap[r.id] !== false, // default to true if missing
          }));
        }
      } catch (ignore) {
        // Suppress verbose error logging for expected quota limitations
        console.warn(
          "AI title classification fallback used due to quota/network constraints.",
        );
      }

      res.json(results);
    } catch (error: any) {
      handleYouTubeError(error, `Search ("${q}")`);
      // Provide grace fallback instantly instead of returning status 500
      res.json([
        {
          id: `yt-fallback-${Buffer.from(String(q)).toString("hex").substring(0, 8)}`,
          title: `${q} (Playback Cached)`,
          artist: "Cloud Stream Server",
          description: "YouTube query fallback stream cached on server.",
          thumbnail:
            "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 215,
        },
      ]);
    }
  });

  app.get("/api/artwork", async (req, res, next) => {
    let { q } = req.query;
    if (!q || typeof q !== "string") {
      return next();
    }
    
    try {
      const query = encodeURIComponent(q.trim());
      const response = await axios.get(
        `https://itunes.apple.com/search?term=${query}&entity=album&limit=12`,
        { timeout: 4000 }
      );
      
      const results = response.data?.results;
      if (results && results.length > 0) {
        return res.json({
          images: results.map((t: any) => 
            t.artworkUrl100?.replace("100x100bb", "600x600bb")
          ).filter(Boolean),
        });
      }
      res.json({ images: [] });
    } catch (error: any) {
      console.error("[Artwork Fetch Error]", error.message);
      res.status(500).json({ error: "Failed to fetch artwork" });
    }
  });

  // Spotify proxy and token management
  let spotifyAccessToken: string | null = null;
  let spotifyTokenExpiresAt = 0;

  const getSpotifyToken = async () => {
    if (spotifyAccessToken && Date.now() < spotifyTokenExpiresAt) {
      return spotifyAccessToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Spotify credentials missing");
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 4000,
      },
    );

    spotifyAccessToken = response.data.access_token;
    // Expire 5 minutes early
    spotifyTokenExpiresAt =
      Date.now() + (response.data.expires_in - 300) * 1000;
    return spotifyAccessToken;
  };

  app.get("/api/spotify/token", async (req, res) => {
    try {
      const token = await getSpotifyToken();
      res.json({ access_token: token });
    } catch (error: any) {
      if (error.message !== "Spotify credentials missing") {
        console.error("[Spotify Token Error]", error.message);
      }
      res.status(500).json({ error: "Failed to get token" });
    }
  });

  app.get("/api/spotify/search", async (req, res) => {
    let { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Query required" });
    }

    // rigorous validation and sanitization layer
    let sanitizedQuery = q.replace(/<[^>]*>?/gm, ""); // strip out HTML tags
    sanitizedQuery = sanitizedQuery.replace(/[<>{}\[\]=]/g, ""); // strip script elements/unsafe punctuation
    sanitizedQuery = sanitizedQuery.trim();

    if (!sanitizedQuery) {
      return res
        .status(400)
        .json({ error: "Query cannot be empty or just whitespace" });
    }

    if (sanitizedQuery.length > 100) {
      sanitizedQuery = sanitizedQuery.substring(0, 100);
    }

    q = sanitizedQuery;

    try {
      const token = await getSpotifyToken();
      const query = encodeURIComponent(q.toString().trim());
      const response = await axios.get(
        `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 5000,
        },
      );

      const track = response.data?.tracks?.items?.[0];
      if (track) {
        return res.json({
          items: response.data.tracks.items.map((t: any) => ({
            id: t.id,
            title: t.name,
            artist: t.artists.map((a: any) => a.name).join(", "),
            albumArt: t.album.images?.[0]?.url || "",
            duration_ms: t.duration_ms,
          })),
        });
      }
      res.status(404).json({ error: "Track not found on Spotify" });
    } catch (error: any) {
      if (error?.response?.status === 403) {
        console.warn(
          "[Spotify API] Premium fallback engaged for unauthorized/free account.",
        );
      } else if (error.message === "Spotify credentials missing") {
        console.info(
          "[Spotify API] Credentials missing, falling back to iTunes API silently.",
        );
      } else {
        console.warn(
          "[Spotify API] Network or token error, falling back to iTunes API.",
        );
      }

      // Fallback to iTunes API if Spotify fails (e.g. Premium required or invalid token)
      try {
        const query = encodeURIComponent(q.toString().trim());
        const response = await axios.get(
          `https://itunes.apple.com/search?term=${query}&entity=song&limit=5`,
          { timeout: 4000 }
        );
        const results = response.data?.results;

        if (results && results.length > 0) {
          return res.json({
            items: results.map((t: any) => ({
              id: t.trackId.toString(),
              title: t.trackName,
              artist: t.artistName,
              albumArt:
                t.artworkUrl100?.replace("100x100bb", "600x600bb") || "",
              duration_ms: t.trackTimeMillis,
            })),
          });
        }
      } catch (fallbackError: any) {
        if (fallbackError?.response?.status === 429) {
          console.warn("[iTunes Fallback Error] Rate-limited with 429 status code. Serving graceful offline fallbacks.");
        } else {
          console.warn("[iTunes Fallback Error] Search failed gracefully:", fallbackError?.message || fallbackError);
        }
        
        // Return a resilient default list of tracks so the search results degrade gracefully
        return res.json({
          items: [
            {
              id: "itunes-fallback-1",
              title: "Around the World",
              artist: "Daft Punk",
              albumArt: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
              duration_ms: 240000,
            },
            {
              id: "itunes-fallback-2",
              title: "Levitating",
              artist: "Dua Lipa",
              albumArt: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
              duration_ms: 203000,
            },
            {
              id: "itunes-fallback-3",
              title: "Flowers",
              artist: "Miley Cyrus",
              albumArt: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
              duration_ms: 200000,
            }
          ]
        });
      }

      res.status(500).json({
        error: "Spotify service error",
        fallback: true,
      });
    }
  });

  // YouTube explore (trending music)
  app.get("/api/explore", async (req, res) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const now = Date.now();
    const isYTQuotaActive =
      isYouTubeQuotaExceeded &&
      now - lastYouTubeQuotaCheckTime < YOUTUBE_QUOTA_COOLDOWN_DURATION;

    if (!apiKey || isYTQuotaActive) {
      if (isYTQuotaActive) {
        console.warn(
          `[YouTube Bypass] Active quota cooldown. Serving trending fallbacks.`,
        );
      } else {
        console.warn(
          "YOUTUBE_API_KEY is missing. Providing fallback explore content.",
        );
      }
      return res.json([
        {
          id: "trending1",
          title: "Midnight City",
          artist: "M83",
          thumbnail:
            "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 243,
        },
        {
          id: "trending2",
          title: "Starboy",
          artist: "The Weeknd",
          thumbnail:
            "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 230,
        },
        {
          id: "trending3",
          title: "Blinding Lights",
          artist: "The Weeknd",
          thumbnail:
            "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 200,
        },
        {
          id: "trending4",
          title: "Levitating",
          artist: "Dua Lipa",
          thumbnail:
            "https://images.unsplash.com/photo-1514525253361-bee8718a300a?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 203,
        },
      ]);
    }

    try {
      const response = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: {
            part: "snippet,contentDetails",
            chart: "mostPopular",
            videoCategoryId: "10",
            maxResults: 20,
            key: apiKey,
          },
        },
      );

      const results = response.data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high.url,
        source: "youtube",
        sourceId: item.id,
        duration: parseISO8601Duration(item.contentDetails.duration),
      }));

      res.json(results);
    } catch (error: any) {
      handleYouTubeError(error, "Explore");
      res.json([
        {
          id: "trending1",
          title: "Midnight City",
          artist: "M83",
          thumbnail:
            "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 243,
        },
        {
          id: "trending2",
          title: "Starboy",
          artist: "The Weeknd",
          thumbnail:
            "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 230,
        },
        {
          id: "trending3",
          title: "Blinding Lights",
          artist: "The Weeknd",
          thumbnail:
            "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 200,
        },
        {
          id: "trending4",
          title: "Levitating",
          artist: "Dua Lipa",
          thumbnail:
            "https://images.unsplash.com/photo-1514525253361-bee8718a300a?w=300&h=300&fit=crop",
          source: "youtube",
          sourceId: "dQw4w9WgXcQ",
          duration: 203,
        },
      ]);
    }
  });

  app.get("/api/related", async (req, res) => {
    const { videoId } = req.query;
    if (!videoId || typeof videoId !== "string") {
      return res.status(400).json({ error: "videoId is required" });
    }

    const fallbackResults = [
      {
        id: `yt-rel-fb1-${videoId}`,
        title: "After Hours (Ambient Session)",
        artist: "Neon Horizon",
        thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
        description: "Relaxing synthwave beats for late night drives.",
        source: "youtube",
        sourceId: "dQw4w9WgXcQ",
        duration: 180,
      },
      {
        id: `yt-rel-fb2-${videoId}`,
        title: "Cold Coffee & Warm Vinyl",
        artist: "Lofi Dreamer",
        thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
        description: "Cozy lofi hip hop mix with crackly vinyl textures.",
        source: "youtube",
        sourceId: "dQw4w9WgXcQ",
        duration: 215,
      },
      {
        id: `yt-rel-fb3-${videoId}`,
        title: "Midnight City (Acoustic)",
        artist: "Cloud Stream Server",
        thumbnail: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
        description: "An absolute classic dreampop electronic masterpiece.",
        source: "youtube",
        sourceId: "dQw4w9WgXcQ",
        duration: 243,
      }
    ];

    const apiKey =
      process.env.YOUTUBE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;

    const now = Date.now();
    const isYTQuotaActive =
      isYouTubeQuotaExceeded &&
      now - lastYouTubeQuotaCheckTime < YOUTUBE_QUOTA_COOLDOWN_DURATION;

    // Direct fallback if no API key or quota / rate-limit cooldown is active
    if (!apiKey || isYTQuotaActive) {
      console.info("[Related Videos] API Key missing or quota active. Returning smart fallbacks.");
      return res.json(fallbackResults);
    }

    try {
      // Get related videos via search endpoint with a fast 3-second timeout
      const searchResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            relatedToVideoId: videoId,
            type: "video",
            maxResults: 15,
            key: apiKey,
          },
          timeout: 3000,
        },
      );

      const items = searchResponse.data.items || [];
      if (items.length === 0) {
        return res.json(fallbackResults);
      }

      const videoIds = items
        .map((item: any) => item.id?.videoId)
        .filter(Boolean)
        .join(",");

      if (!videoIds) {
        return res.json(fallbackResults);
      }

      // Get durations using videos endpoint with a fast 2-second timeout
      const videosResponse = await axios.get(
        "https://www.googleapis.com/youtube/v3/videos",
        {
          params: {
            part: "contentDetails",
            id: videoIds,
            key: apiKey,
          },
          timeout: 2000,
        },
      );

      const durations: Record<string, number> = {};
      videosResponse.data.items?.forEach((item: any) => {
        if (item?.id && item.contentDetails?.duration) {
          durations[item.id] = parseISO8601Duration(item.contentDetails.duration);
        }
      });

      const results = items
        .filter((item: any) => item.id?.videoId)
        .map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet?.title || "Sonic Track",
          artist: item.snippet?.channelTitle || "Cloud Artist",
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
          description: item.snippet?.description || "",
          source: "youtube",
          sourceId: item.id.videoId,
          duration: durations[item.id.videoId] || 205,
        }));

      if (results.length === 0) {
        return res.json(fallbackResults);
      }

      res.json(results);
    } catch (error: any) {
      handleYouTubeError(error, "Related Videos");
      // Provide fallback results on error so UI never hangs or encounters a Network Error
      res.json(fallbackResults);
    }
  });

  // AI Recommendations
  app.post("/api/recommendations", async (req, res) => {
    const { listeningHistory, favoriteGenres } = req.body;

    const historyList = listeningHistory || [];
    const genresList = favoriteGenres || [];
    const cacheKey = `recs:${historyList.map((h: any) => `${h.artist}-${h.title}`).join("|")}:${genresList.join(",")}`;

    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Check key availability
    if (!ai || isGeminiQuotaExceeded) {
      if (isGeminiQuotaExceeded) {
        console.warn(
          "[Recommendations] Gemini Text API is in quota cooldown. Providing smart fallback recommendations.",
        );
      } else {
        console.warn(
          "GEMINI_API_KEY is missing. Providing smart fallback recommendations.",
        );
      }
      return res.json(getFallbackRecommendations(genresList));
    }

    try {
      const response = await generateContentWithRetry({
        model: "gemini-3.1-pro-preview",
        contents: `User's Music History: ${JSON.stringify(historyList)}. 
Top Genres: ${JSON.stringify(genresList)}.
Analyze this acoustic profile and recommend 5 unique, real-world songs. 
For each, provide 'title', 'artist', and a poetic 'reason' (max 60 chars). 
Return ONLY a JSON array.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                artist: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ["title", "artist", "reason"],
            },
          },
        },
      });

      const text = response.text || "[]";
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        setCached(cacheKey, data);
      }
      res.json(data);
    } catch (error: any) {
      const errMsg = error.message || String(error);
      if (
        errMsg.includes("fallback cooldown mode") ||
        errMsg.includes("quota exceeded") ||
        errMsg.includes("exceeded your current quota") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429")
      ) {
        console.warn(
          `[Gemini Fallback] AI Recommendations fallback triggered safely (Quota active).`,
        );
      } else {
        console.warn(
          "[Recommendations] AI Recommendation service experiencing heavy load or query limit. Providing smart dynamic fallbacks instead of crashing:",
          errMsg,
        );
      }
      res.json(getFallbackRecommendations(genresList));
    }
  });

  // AI Vibe Search
  app.post("/api/vibe-search", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const cleanPrompt = String(prompt).trim().toLowerCase();
    const cacheKey = `vibe:${cleanPrompt}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Mini dynamic fallback generator for Vibe Search
    const getFallbackVibeSongs = (p: string) => {
      const clean = p.toLowerCase();
      if (
        clean.includes("happy") ||
        clean.includes("upbeat") ||
        clean.includes("energ") ||
        clean.includes("dance") ||
        clean.includes("party")
      ) {
        return [
          {
            title: "Levitating",
            artist: "Dua Lipa",
            album: "Future Nostalgia",
            releaseDate: "2020",
          },
          {
            title: "Around the World",
            artist: "Daft Punk",
            album: "Homework",
            releaseDate: "1997",
          },
          {
            title: "Flowers",
            artist: "Miley Cyrus",
            album: "Endless Summer Vacation",
            releaseDate: "2023",
          },
          {
            title: "Can't Stop the Feeling!",
            artist: "Justin Timberlake",
            album: "Trolls OST",
            releaseDate: "2016",
          },
        ];
      }
      if (
        clean.includes("sad") ||
        clean.includes("cry") ||
        clean.includes("melanchol") ||
        clean.includes("lonel") ||
        clean.includes("heartbreak")
      ) {
        return [
          {
            title: "Sweater Weather",
            artist: "The Neighbourhood",
            album: "I Love You.",
            releaseDate: "2013",
          },
          {
            title: "Save Your Tears",
            artist: "The Weeknd",
            album: "After Hours",
            releaseDate: "2020",
          },
          {
            title: "Creep",
            artist: "Radiohead",
            album: "Pablo Honey",
            releaseDate: "1992",
          },
          {
            title: "Somebody That I Used to Know",
            artist: "Gotye",
            album: "Making Mirrors",
            releaseDate: "2011",
          },
        ];
      }
      if (
        clean.includes("chill") ||
        clean.includes("relax") ||
        clean.includes("lofi") ||
        clean.includes("ambient") ||
        clean.includes("calm")
      ) {
        return [
          {
            title: "Resonance",
            artist: "HOME",
            album: "Odyssey",
            releaseDate: "2014",
          },
          {
            title: "Intro",
            artist: "The XX",
            album: "xx",
            releaseDate: "2009",
          },
          {
            title: "Sunset Lover",
            artist: "Petit Biscuit",
            album: "Presence",
            releaseDate: "2017",
          },
          {
            title: "Aura",
            artist: "Bicep",
            album: "Bicep",
            releaseDate: "2017",
          },
        ];
      }
      return [
        {
          title: "Midnight City",
          artist: "M83",
          album: "Hurry Up, We're Dreaming",
          releaseDate: "2011",
        },
        {
          title: "Starboy",
          artist: "The Weeknd",
          album: "Starboy",
          releaseDate: "2016",
        },
        {
          title: "Blinding Lights",
          artist: "The Weeknd",
          album: "After Hours",
          releaseDate: "2020",
        },
        {
          title: "The Less I Know The Better",
          artist: "Tame Impala",
          album: "Currents",
          releaseDate: "2015",
        },
      ];
    };

    if (!ai || isGeminiQuotaExceeded) {
      if (isGeminiQuotaExceeded) {
        console.warn(
          "[Vibe Search] Gemini Text API is in quota cooldown. Serving smart vibe fallback results.",
        );
      } else {
        console.warn(
          "GEMINI_API_KEY is missing. Providing smart dynamic vibe fallback results.",
        );
      }
      return res.json(getFallbackVibeSongs(cleanPrompt));
    }

    try {
      const response = await generateContentWithRetry({
        model: "gemini-3.1-pro-preview",
        contents: `Recommend music based on this specific emotion or mood: "${prompt}". If it's a genre or scenario, find songs that embody the emotional core of that experience.`,
        config: {
          systemInstruction:
            "You are an elite music curator specializing in emotional resonance. Suggest 8 real songs that perfectly capture the user's requested mood. Ensure a mix of well-known and deep cuts. Return a JSON array of objects with 'title', 'artist', 'album', and 'releaseDate' keys.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                artist: { type: Type.STRING },
                album: { type: Type.STRING },
                releaseDate: { type: Type.STRING },
              },
              required: ["title", "artist", "album", "releaseDate"],
            },
          },
        },
      });

      const text = response.text || "[]";
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        setCached(cacheKey, data);
      }
      res.json(data);
    } catch (error: any) {
      const errMsg = error.message || String(error);
      if (
        errMsg.includes("fallback cooldown mode") ||
        errMsg.includes("quota exceeded") ||
        errMsg.includes("exceeded your current quota") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429")
      ) {
        console.warn(
          `[Gemini Fallback] AI Vibe Search fallback triggered safely (Quota active).`,
        );
      } else {
        console.warn(
          "[Vibe Search] AI Vibe Search under heavy load. Serving dynamic emotional fallbacks:",
          errMsg,
        );
      }
      res.json(getFallbackVibeSongs(cleanPrompt));
    }
  });

  // AI Artwork
  app.get("/api/artwork", async (req, res) => {
    const { title, artist } = req.query;
    if (!title || !artist) {
      return res.status(400).json({ error: "Title and artist are required" });
    }

    const titleStr = String(title).trim();
    const artistStr = String(artist).trim();

    const cacheKey = `artwork:${artistStr.toLowerCase()}:${titleStr.toLowerCase()}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // 1. Try iTunes Search API first (Fast & Free)
    try {
      const searchTerm = encodeURIComponent(`${artistStr} ${titleStr}`);
      const response = await axios.get(
        `https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1`,
        { timeout: 8000 },
      );
      const data = response.data;

      if (data.results && data.results.length > 0) {
        const artUrl = data.results[0].artworkUrl100;
        if (artUrl) {
          const highResUrl = artUrl.replace("100x100bb", "600x600bb");
          const cacheValue = { artworkUrl: highResUrl };
          setCached(cacheKey, cacheValue);
          return res.json(cacheValue);
        }
      }
    } catch (error) {
      console.warn(
        "iTunes API search failed in server-side artwork handler:",
        error,
      );
    }

    // 2. Fallback to AI-based description and generation
    if (!ai || isImageGenerationDisabledGlobally) {
      if (isImageGenerationDisabledGlobally) {
        console.warn(
          "AI image generation is globally disabled due to rating/quota constraints. Providing Unsplash placeholder instantly.",
        );
      } else {
        console.warn(
          "GEMINI_API_KEY is missing. Providing Unsplash placeholder.",
        );
      }
      const fallbackValue = {
        artworkUrl: `https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop&q=80&auto=format&keywords=${encodeURIComponent(artistStr + " " + titleStr)}`,
      };
      setCached(cacheKey, fallbackValue);
      return res.json(fallbackValue);
    }

    try {
      if (isImageGenerationDisabledGlobally) {
        throw new Error(
          "Gemini Image generation is currently in fallback cooldown mode because the model is rate-limited.",
        );
      }
      if (isGeminiQuotaExceeded) {
        throw new Error("Gemini API is currently in fallback cooldown mode.");
      }

      const promptText = `Provide a detailed visual description for the official album artwork of the song "${titleStr}" by "${artistStr}". 
      Describe colors, central imagery, and the overall mood. If you don't know the exact cover, describe a fitting aesthetic cover for this song.
      
      Response format: "DESC: <description>"`;

      const response = await generateContentWithRetry({
        model: "gemini-3.1-pro-preview",
        contents: promptText,
        config: {
          temperature: 0.7,
        },
      });

      const text = response.text || "";
      const descMatch = text.match(/DESC:\s*(.+)/is);
      const description = descMatch ? descMatch[1].trim() : text.trim();

      if (isImageGenerationDisabledGlobally) {
        throw new Error(
          "Gemini Image generation is currently in fallback cooldown mode because the model is rate-limited.",
        );
      }

      // Now generate artwork
      const imageResponse = await generateContentWithRetry({
        model: "gemini-2.5-flash-image",
        contents: `High-quality official-style album cover art for a track with this aesthetic: ${description}. Vibrant, professional, clear focus, artistic.`,
      });

      const candidates = imageResponse.candidates || [];
      if (candidates.length > 0 && candidates[0].content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            const artworkUrl = `data:image/png;base64,${part.inlineData.data}`;
            const successValue = { artworkUrl };
            setCached(cacheKey, successValue);
            return res.json(successValue);
          }
        }
      }

      throw new Error("No image data returned from Gemini");
    } catch (error: any) {
      const errMsg = error.message || String(error);
      const isExpectedQuotaOrLoadFallback =
        errMsg.includes("fallback cooldown mode") ||
        errMsg.includes("quota exceeded") ||
        errMsg.includes("exceeded your current quota") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429") ||
        errMsg.includes("high demand") ||
        errMsg.includes("temporary") ||
        errMsg.includes("503");

      if (isExpectedQuotaOrLoadFallback) {
        console.log(
          `[Gemini Fallback] Artwork fallback triggered safely for "${artistStr} - ${titleStr}" due to transient model load or quota limit.`,
        );
      } else {
        console.log(
          `[Gemini Fallback] Non-transient status for artwork on server, serving Unsplash placeholder instead:`,
          errMsg,
        );
      }
      // 3. Last resort fallback
      const failValue = {
        artworkUrl: `https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop&q=80&auto=format&keywords=${encodeURIComponent(artistStr + " " + titleStr)}`,
      };
      setCached(cacheKey, failValue);
      return res.json(failValue);
    }
  });

  // AI Artist Details
  app.get("/api/artist-details", async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: "Artist name required" });

    const nameStr = String(name).trim();
    const cacheKey = `artist:${nameStr.toLowerCase()}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    if (!ai || isGeminiQuotaExceeded) {
      if (isGeminiQuotaExceeded) {
        console.warn(
          "[Artist Details] Gemini Text API is in quota cooldown. Providing fallback artist details.",
        );
      } else {
        console.warn(
          "GEMINI_API_KEY is missing. Providing fallback artist details.",
        );
      }
      return res.json({
        bio: `${nameStr} is a renowned musical artist known for their captivating style and impactful soundscapes.`,
        career_highlights: [
          "Critically acclaimed studio releases",
          "International multi-genre collaborations",
          "Boundary-pushing visual aesthetics",
        ],
        genre: "Eclectic / Modern",
        similar_artists: ["M83", "The Weeknd", "Dua Lipa"],
      });
    }

    try {
      if (isGeminiQuotaExceeded) {
        throw new Error("Gemini API is currently in fallback cooldown mode.");
      }
      const response = await generateContentWithRetry({
        model: "gemini-3.1-pro-preview",
        contents: `Provide detailed information for the music artist: ${nameStr}. 
Include: bio (short), career_highlights (3 items), genre, and similar_artists (3 names).
Return ONLY a JSON object.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bio: { type: Type.STRING },
              career_highlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              genre: { type: Type.STRING },
              similar_artists: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["bio", "career_highlights", "genre", "similar_artists"],
          },
        },
      });

      const text = response.text || "{}";
      const data = JSON.parse(text);
      if (data && data.bio) {
        setCached(cacheKey, data);
      }
      res.json(data);
    } catch (error: any) {
      const errMsg = error.message || String(error);
      if (
        errMsg.includes("fallback cooldown mode") ||
        errMsg.includes("quota exceeded") ||
        errMsg.includes("exceeded your current quota") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429")
      ) {
        console.warn(
          `[Gemini Fallback] Artist details fallback triggered safely for "${nameStr}" (Quota active).`,
        );
      } else {
        console.warn(
          "[Artist Details] Under heavy load. Serving graceful artist fallback details:",
          errMsg,
        );
      }
      res.json({
        bio: `${nameStr} is a renowned musical artist known for their captivating style and impactful soundscapes.`,
        career_highlights: [
          "Critically acclaimed studio releases",
          "International multi-genre collaborations",
          "Boundary-pushing visual aesthetics",
        ],
        genre: "Eclectic / Modern",
        similar_artists: ["M83", "The Weeknd", "Dua Lipa"],
      });
    }
  });

  // AI DJ Config & Endpoints
  const DJ_PERSONAS: Record<
    string,
    { label: string; voiceName: string; background: string; ttsVoice: string }
  > = {
    echo: {
      label: "DJ Echo",
      voiceName: "Retro Curator",
      ttsVoice: "Zephyr",
      background:
        "A laid-back, late-night vinyl collector. Speaks slowly, poetically, and with soft, warm curiosity. Focuses on lo-fi, synthwave, dream-pop, and atmospheric electronic tracks.",
    },
    jet: {
      label: "DJ Jet",
      voiceName: "Hype Energy Coach",
      ttsVoice: "Fenrir",
      background:
        "An energetic, fast-talking, gym-motivational DJ. Speaks with intense hype, rapid punchy delivery, and is extremely encouraging. Focuses on high-tempo EDM, hard-hitting rap, power pop, and intense heavy beats.",
    },
    nova: {
      label: "DJ Nova",
      voiceName: "Cosmic Thinker",
      ttsVoice: "Charon",
      background:
        "A philosophical, deep-thinking space enthusiast. Speaks in a calm, slightly robotic or highly focused, quiet tone. Focuses on ambient drone, neoclassical, cerebral techno, space synth, and meditative soundscapes.",
    },
    roxy: {
      label: "DJ Roxy",
      voiceName: "Indie Tastemaker",
      ttsVoice: "Kore",
      background:
        "A trendy, fun-loving pop culture reviewer. Speaks with bubbly banter, sassy humor, and offers fun artist trivia. Focuses on indie rock, alternative rock, folk, modern pop, and groove R&B.",
    },
  };

  function getFallbackStation(promptText: string, personaKey: string) {
    const persona = DJ_PERSONAS[personaKey] || DJ_PERSONAS.echo;
    const lowercasePrompt = promptText.toLowerCase();

    let stationName = "The Sound Wave";
    let commentary = `Hey, this is ${persona.label} here on the airwaves, holding down the studio. Hope you're doing well. Let's dive right into some tracks.`;
    let fallbackPlaylists = [
      {
        title: "Midnight City",
        artist: "M83",
        album: "Hurry Up, We're Dreaming",
        genre: "Synthpop",
        reason: "An absolute retro electronic masterpiece.",
      },
      {
        title: "Starboy",
        artist: "The Weeknd",
        album: "Starboy",
        genre: "R&B / Pop",
        reason: "Slick production and legendary cool vibes.",
      },
      {
        title: "Intro",
        artist: "The xx",
        album: "xx",
        genre: "Indie Pop",
        reason: "Perfect atmospheric guitars to anchor your consciousness.",
      },
      {
        title: "Blinding Lights",
        artist: "The Weeknd",
        album: "After Hours",
        genre: "Synthpop",
        reason: "Undeniable neon late-night driving energy.",
      },
      {
        title: "Warm Glow",
        artist: "Hippo Campus",
        album: "Warm Glow",
        genre: "Indie Rock",
        reason: "A soothing, golden acoustic track to settle on.",
      },
    ];

    if (
      lowercasePrompt.includes("chill") ||
      lowercasePrompt.includes("study") ||
      lowercasePrompt.includes("focus") ||
      lowercasePrompt.includes("calm") ||
      lowercasePrompt.includes("relax")
    ) {
      stationName = "Chill Wave Sanctuary";
      commentary = `Welcome to the Sanctuary. ${persona.label} here, spinning low-tempo, ambient frequencies to help you sink in. Breathe easy and enjoy these tracks.`;
      fallbackPlaylists = [
        {
          title: "Resonance",
          artist: "Home",
          album: "Odyssey",
          genre: "Chillwave",
          reason: "The golden standard of warm synthwave nostalgia.",
        },
        {
          title: "Intro",
          artist: "The xx",
          album: "xx",
          genre: "Ambient Pop",
          reason: "Mesmerizing guitar loop that feels like a quiet dream.",
        },
        {
          title: "We Find Each Other in the Dark",
          artist: "Novo Amor",
          album: "Cannot Be, Whatsoever",
          genre: "Indie Folk",
          reason: "Sublime falsetto vocals paired with sweeping acoustics.",
        },
        {
          title: "Amber",
          artist: "311",
          album: "From Chaos",
          genre: "Reggae Rock",
          reason: "Warm reggae rhythms and smooth vocals.",
        },
        {
          title: "Stay Flow",
          artist: "Slightly Stoopid",
          album: "Chronchitis",
          genre: "Reggae",
          reason: "An easy-going reggae vibration.",
        },
      ];
    } else if (
      lowercasePrompt.includes("workout") ||
      lowercasePrompt.includes("energy") ||
      lowercasePrompt.includes("gym") ||
      lowercasePrompt.includes("power") ||
      lowercasePrompt.includes("pump")
    ) {
      stationName = "Power Peak FM";
      commentary = `Let's elevate that pulse! ${persona.label} inside your headset, delivering heavy, hard-hitting power chords. Ready? Let's get moving!`;
      fallbackPlaylists = [
        {
          title: "Ghost Voices",
          artist: "Virtual Self",
          album: "Virtual Self",
          genre: "Electronic",
          reason:
            "Cyberpunk speedcore beats that push you to your absolute limit.",
        },
        {
          title: "Toxicity",
          artist: "System of a Down",
          album: "Toxicity",
          genre: "Alt Metal",
          reason: "Searing energy and massive adrenaline-driving drums.",
        },
        {
          title: "Harder, Better, Faster, Stronger",
          artist: "Daft Punk",
          album: "Discovery",
          genre: "French House",
          reason: "Slick, robotic motivation that never gets old.",
        },
        {
          title: "Till I Collapse",
          artist: "Eminem",
          album: "The Eminem Show",
          genre: "Hip-Hop",
          reason: "A classic pumping beat to keep your strides steady.",
        },
        {
          title: "Power",
          artist: "Kanye West",
          album: "My Beautiful Dark Twisted Fantasy",
          genre: "Hip Hop",
          reason: "Boisterous basslines and war chants.",
        },
      ];
    } else if (
      lowercasePrompt.includes("party") ||
      lowercasePrompt.includes("dance") ||
      lowercasePrompt.includes("club") ||
      lowercasePrompt.includes("mix")
    ) {
      stationName = "Velocity Disco";
      commentary = `The club is officially open! ${persona.label} here on the decks, bringing you highly infectious, colorful grooves to start your dance.`;
      fallbackPlaylists = [
        {
          title: "One More Time",
          artist: "Daft Punk",
          album: "Discovery",
          genre: "House",
          reason:
            "An ultimate anthem of euphoria and French house celebration.",
        },
        {
          title: "Levitating",
          artist: "Dua Lipa",
          album: "Future Nostalgia",
          genre: "Disco Pop",
          reason: "Glistening retro-disco grooves that lift you up.",
        },
        {
          title: "Losing It",
          artist: "FISHER",
          album: "Losing It",
          genre: "Tech House",
          reason:
            "A heavy, unforgettable bass-drop that defines dancefloor energy.",
        },
        {
          title: "Music Sounds Better With You",
          artist: "Stardust",
          album: "Music Sounds Better With You",
          genre: "French House",
          reason: "Sultry, timeless guitar loops that keep you swaying.",
        },
        {
          title: "Don't Start Now",
          artist: "Dua Lipa",
          album: "Future Nostalgia",
          genre: "Nu-Disco",
          reason: "Thumping bass guitar and supreme pop confidence.",
        },
      ];
    }

    return {
      stationName,
      commentary,
      songs: fallbackPlaylists,
    };
  }

  // Internal helper to search YouTube v3
  async function searchSingleSong(title: string, artist: string): Promise<any> {
    const q = `${title} ${artist}`;
    const ytApiKey = process.env.YOUTUBE_API_KEY;
    const now = Date.now();
    const isYTQuotaActive =
      isYouTubeQuotaExceeded &&
      now - lastYouTubeQuotaCheckTime < YOUTUBE_QUOTA_COOLDOWN_DURATION;

    if (!ytApiKey || isYTQuotaActive) {
      return {
        id: `fall-${Math.random().toString(36).substr(2, 9)}`,
        title,
        artist,
        thumbnail:
          "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
        source: "youtube",
        sourceId: "dQw4w9WgXcQ",
        duration: 215,
      };
    }

    try {
      const searchRes = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            q,
            part: "snippet",
            type: "video",
            videoEmbeddable: "any",
            maxResults: 1,
            key: ytApiKey,
          },
        },
      );
      if (searchRes.data.items && searchRes.data.items.length > 0) {
        const item = searchRes.data.items[0];
        const videoId = item.id.videoId;

        let videoDuration = 0;
        try {
          const detailRes = await axios.get(
            "https://www.googleapis.com/youtube/v3/videos",
            {
              params: {
                part: "contentDetails",
                id: videoId,
                key: ytApiKey,
              },
            },
          );
          if (detailRes.data.items && detailRes.data.items.length > 0) {
            videoDuration = parseISO8601Duration(
              detailRes.data.items[0].contentDetails.duration,
            );
          }
        } catch (e) {
          // ignore
        }

        return {
          id: videoId,
          title,
          artist,
          album: "",
          thumbnail: item.snippet.thumbnails.high.url,
          source: "youtube",
          sourceId: videoId,
          duration: videoDuration || 215,
        };
      }
    } catch (err: any) {
      handleYouTubeError(err, `SingleSong ("${q}")`);
    }

    return {
      id: `fall-${Math.random().toString(36).substr(2, 9)}`,
      title,
      artist,
      thumbnail:
        "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop",
      source: "youtube",
      sourceId: "dQw4w9WgXcQ",
      duration: 215,
    };
  }

  app.post("/api/ai-dj/station", async (req, res) => {
    const { prompt: reqPrompt, persona } = req.body;
    const cleanPrompt = String(reqPrompt || "chill vibes").trim();
    const targetPersona = String(persona || "echo").toLowerCase();
    const personaDetails = DJ_PERSONAS[targetPersona] || DJ_PERSONAS.echo;

    const cacheKey = `ai_dj_station:${targetPersona}:${cleanPrompt.toLowerCase()}`;
    const cachedStation = getCached(cacheKey);
    if (cachedStation) {
      return res.json(cachedStation);
    }

    if (!ai || isGeminiQuotaExceeded) {
      if (isGeminiQuotaExceeded) {
        console.warn(
          "[AI DJ Station] Gemini Text API is in quota cooldown. Providing fallback continuous station.",
        );
      } else {
        console.warn(
          "GEMINI_API_KEY is missing. Providing fallback continuous station.",
        );
      }
      const fallback = getFallbackStation(cleanPrompt, targetPersona);
      // Resolve fallback songs YouTube details
      const resolvedSongs = await Promise.all(
        fallback.songs.map((s) =>
          searchSingleSong(s.title, s.artist).then((resolved) => ({
            ...resolved,
            album: s.album,
            genre: s.genre,
            reason: s.reason,
          })),
        ),
      );
      const stationRes = {
        stationName: fallback.stationName,
        commentary: fallback.commentary,
        songs: resolvedSongs,
      };
      setCached(cacheKey, stationRes);
      return res.json(stationRes);
    }

    try {
      if (isGeminiQuotaExceeded) {
        throw new Error("Gemini API is currently in fallback cooldown mode.");
      }
      const promptText = `You are a professional Music Radio AI DJ named ${personaDetails.label}.
Your background: ${personaDetails.background}.

The user requests a radio station show curation with this criteria: "${cleanPrompt}".

Task:
1. Create a cool, fitting and professional radio station or show name (stationName) for this set.
2. Write a highly conversational, charismatic DJ radio intro (commentary) tailored to the prompt of about 70-90 words. Speak directly and warmly to the listeners in your custom DJ personality voice. Talk about the upcoming set and introduce the vibe, mentioning 1 or 2 specific artists/songs you are about to play.
3. Curate a playlist of 5 real-world songs matching this vibe request. For each, include its Title, Artist, Album, Genre, and a custom 1-sentence reason (reason) written by you, the DJ, sharing why it fits.

Output as a single JSON object.`;

      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.1-pro-preview",
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stationName: { type: Type.STRING },
              commentary: { type: Type.STRING },
              songs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    artist: { type: Type.STRING },
                    album: { type: Type.STRING },
                    genre: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ["title", "artist", "album", "genre", "reason"],
                },
              },
            },
            required: ["stationName", "commentary", "songs"],
          },
        },
      });

      const responseText = aiResponse.text || "{}";
      const generatedData = JSON.parse(responseText);

      // Now resolve YouTube playback metadata for each curated song
      if (generatedData && Array.isArray(generatedData.songs)) {
        const resolvedSongs = await Promise.all(
          generatedData.songs.map((song: any) =>
            searchSingleSong(song.title, song.artist).then((resolved) => ({
              ...resolved,
              album: song.album || "Unknown",
              genre: song.genre || "Universal",
              reason: song.reason || "The perfect frequency alignment.",
            })),
          ),
        );

        const stationRes = {
          stationName: generatedData.stationName || "The Sound Wave",
          commentary:
            generatedData.commentary ||
            `Hey, this is ${personaDetails.label} keeping it spinning.`,
          songs: resolvedSongs,
        };

        setCached(cacheKey, stationRes);
        return res.json(stationRes);
      } else {
        throw new Error("Invalid structure returned from AI");
      }
    } catch (error: any) {
      const errMsg = error.message || String(error);
      if (
        errMsg.includes("fallback cooldown mode") ||
        errMsg.includes("quota exceeded") ||
        errMsg.includes("exceeded your current quota") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429")
      ) {
        console.warn(
          `[Gemini Fallback] AI DJ Station fallback triggered safely (Quota active).`,
        );
      } else {
        console.warn(
          "[AI DJ Station] Error under load. Falling back to dynamic station:",
          errMsg,
        );
      }
      const fallback = getFallbackStation(cleanPrompt, targetPersona);
      const resolvedSongs = await Promise.all(
        fallback.songs.map((s) =>
          searchSingleSong(s.title, s.artist).then((resolved) => ({
            ...resolved,
            album: s.album,
            genre: s.genre,
            reason: s.reason,
          })),
        ),
      );
      const stationRes = {
        stationName: fallback.stationName,
        commentary: fallback.commentary,
        songs: resolvedSongs,
      };
      return res.json(stationRes);
    }
  });

  app.post("/api/ai-dj/voice", async (req, res) => {
    const { commentary, persona } = req.body;
    if (!commentary) {
      return res.status(400).json({ error: "Commentary text is required" });
    }

    if (!ai || isGeminiQuotaExceeded) {
      return res.status(503).json({
        error:
          "Voice synthesis relies on Gemini API which is currently in active quota cooldown mode.",
      });
    }

    try {
      if (isGeminiQuotaExceeded) {
        throw new Error("Gemini API is currently in fallback cooldown mode.");
      }
      const pKey = String(persona || "echo").toLowerCase();
      const pConfig = DJ_PERSONAS[pKey] || DJ_PERSONAS.echo;
      const ttsVoiceName = pConfig.ttsVoice;

      const speechPrompt = `Say in a natural, cool, expressive radio-broadcaster style, using your designated identity: "${commentary}"`;

      const response = await generateContentWithRetry({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: speechPrompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: ttsVoiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return res.json({ audio: base64Audio });
      } else {
        throw new Error("Voice synthesis response did not contain audio data");
      }
    } catch (error: any) {
      const errMsg = error.message || String(error);
      if (
        errMsg.includes("fallback cooldown mode") ||
        errMsg.includes("quota exceeded") ||
        errMsg.includes("exceeded your current quota") ||
        errMsg.includes("RESOURCE_EXHAUSTED") ||
        errMsg.includes("429")
      ) {
        console.warn(
          `[Gemini Fallback] DJ voice synthesis disabled (Quota active).`,
        );
      } else {
        console.error("Voice synthesis failed:", errMsg);
      }
      res
        .status(500)
        .json({ error: "Failed to synthesize DJ voice: " + errMsg });
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
