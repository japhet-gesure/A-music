import axios from "axios";

export interface ArtistInfo {
  bio: string;
  career_highlights: string[];
  genre: string;
  similar_artists: string[];
}

export async function fetchArtistDetailsFromAI(name: string): Promise<ArtistInfo | null> {
  try {
    const response = await axios.get("/api/artist-details", {
      params: { name }
    });
    return response.data || null;
  } catch (error) {
    console.error("fetchArtistDetailsFromAI Client API call failed:", error);
    return null;
  }
}
