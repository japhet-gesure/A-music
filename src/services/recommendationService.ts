import axios from "axios";
import { safeSessionStorage } from "../lib/safeStorage";

const sessionStorage = safeSessionStorage;

export async function getPersonalizedRecommendations(
  listeningHistory: { title: string; artist: string }[],
  favoriteGenres: string[],
  forceRefresh = false
): Promise<{ title: string; artist: string; reason: string }[]> {
  const cacheKey = "music_ai_recommendations";

  if (!forceRefresh) {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        // Continue to fresh fetch
      }
    }
  }

  try {
    const response = await axios.post("/api/recommendations", {
      listeningHistory,
      favoriteGenres
    });
    const data = response.data || [];
    if (data.length > 0) {
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    }
    return data;
  } catch (error) {
    console.error("AI Recommendation Error (Client API call):", error);
    // On error, return cached data if available
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    return [];
  }
}
