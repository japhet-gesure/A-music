import { GoogleGenAI } from "@google/genai";

export async function fetchArtwork(title: string, artist: string): Promise<string | null> {
  // 1. Try iTunes Search API first (Fast & Free)
  try {
    const searchTerm = encodeURIComponent(`${artist} ${title}`);
    const response = await fetch(`https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1`);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const artUrl = data.results[0].artworkUrl100;
      if (artUrl) {
        // Get high-res version (100x100 to 600x600)
        return artUrl.replace('100x100bb', '600x600bb');
      }
    }
  } catch (error) {
    console.error("iTunes API search failed:", error);
  }

  // 2. Fallback to AI-based description and generation
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    // Generate description without the broken googleSearch tool
    const prompt = `Provide a detailed visual description for the official album artwork of the song "${title}" by "${artist}". 
    Describe colors, central imagery, and the overall mood. If you don't know the exact cover, describe a fitting aesthetic cover for this song.
    
    Response format: "DESC: <description>"`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    const text = response.text || "";
    const descMatch = text.match(/DESC:\s*(.+)/is);
    if (descMatch) {
      return await generateArtwork(descMatch[1].trim());
    }

    return null;
  } catch (error) {
    console.error("Error in AI fallback for artwork:", error);
    return null;
  }
}

async function generateArtwork(description: string): Promise<string | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: `High-quality official-style album cover art for a track with this aesthetic: ${description}. Vibrant, professional, clear focus, artistic.`,
    });

    const candidates = response.candidates || [];
    if (candidates.length > 0 && candidates[0].content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (error) {
    console.error("Error generating artwork:", error);
  }
  return null;
}
