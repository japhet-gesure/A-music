import { twMerge } from "tailwind-merge";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseLyrics(lyricsStr: string): { text: string; time: number }[] {
  if (!lyricsStr) return [];
  
  const lines = lyricsStr.split('\n');
  const parsedLines: { text: string; time: number }[] = [];
  
  // LRC format: [mm:ss.xx] lyrics
  const lrcRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
  
  for (const line of lines) {
    const match = line.match(lrcRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3], 10);
      const text = match[4].trim();
      
      const time = minutes * 60 + seconds + (milliseconds / 100);
      parsedLines.push({ text, time });
    } else {
      const text = line.trim();
      if (text) {
        parsedLines.push({ text, time: 0 });
      }
    }
  }
  
  return parsedLines;
}
