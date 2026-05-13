import { Type } from "@google/genai";
import { ai } from "../lib/gemini";

export interface ArtistInfo {
  bio: string;
  career_highlights: string[];
  genre: string;
  similar_artists: string[];
}

export async function fetchArtistDetailsFromAI(name: string): Promise<ArtistInfo | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide detailed information for the music artist: ${name}. 
Include: bio (short), career_highlights (3 items), genre, and similar_artists (3 names).
Return ONLY a JSON object.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bio: { type: Type.STRING },
            career_highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            genre: { type: Type.STRING },
            similar_artists: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["bio", "career_highlights", "genre", "similar_artists"],
        },
      }
    });

    return JSON.parse(response.text || "{}") as ArtistInfo;
  } catch (error) {
    console.error("Artist AI Info Error:", error);
    return null;
  }
}
