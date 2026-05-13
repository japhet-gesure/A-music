import axios from "axios";
import { LyricLine } from "../store/usePlayerStore";
import { ai } from "../lib/gemini";

export async function fetchLyrics(artist: string, title: string, duration?: number): Promise<LyricLine[] | null> {
  try {
    const response = await axios.get("/api/lyrics", {
      params: { artist, title, duration }
    });

    if (response.data && response.data.lyrics) {
      if (response.data.isSynced) {
        return parseLrc(response.data.lyrics);
      } else {
        return response.data.lyrics.split('\n').map((text: string) => ({
          text,
          time: 0
        }));
      }
    }
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 500) {
      console.warn("Backend lyrics lookup failed, trying frontend AI fallback...");
      try {
        const aiResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Provide the full lyrics for the song "${title}" by "${artist}". 
Return ONLY the lyrics text. If you can't find them precisely, provide a best-effort transcription. 
No conversational filler.`
        });

        const aiLyrics = aiResponse.text;
        if (aiLyrics && aiLyrics.length > 20) {
          return aiLyrics.split('\n').map((text: string) => ({
            text: text.trim(),
            time: 0
          })).filter(line => line.text.length > 0);
        }
      } catch (aiErr: any) {
        console.error("Frontend AI Lyrics Fallback failed:", aiErr.message);
      }
    } else {
      console.error("Failed to fetch lyrics from API:", error.message);
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
