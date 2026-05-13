import axios from "axios";
import { Type } from "@google/genai";
import { ai } from "../lib/gemini";

export async function getPersonalizedRecommendations(
  listeningHistory: { title: string; artist: string }[],
  favoriteGenres: string[]
): Promise<{ title: string; artist: string; reason: string }[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User's Music History: ${JSON.stringify(listeningHistory)}. 
Top Genres: ${JSON.stringify(favoriteGenres || [])}.
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

    const data = JSON.parse(response.text || "[]");
    return data;
  } catch (error) {
    console.error("AI Recommendation Error:", error);
    return [];
  }
}
