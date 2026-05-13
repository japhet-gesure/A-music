import React, { useEffect, useRef } from 'react';
import { usePlayerStore, Song } from '../store/usePlayerStore';
import { fetchArtwork } from '../services/artworkService';

const PLACEHOLDER_URLS = [
  "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17",
];

export const BackgroundArtFetcher: React.FC = () => {
  const { queue, recentlyPlayed, updateSongThumbnail } = usePlayerStore();
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchArtForSongs = async () => {
      // Prioritize queue, then recently played
      const allSongs = [...queue, ...recentlyPlayed];
      
      // Filter for unique songs that need artwork
      const songsToProcess = allSongs.filter(song => {
        const hasPlaceholder = PLACEHOLDER_URLS.some(p => song.thumbnail?.includes(p));
        const isEmpty = !song.thumbnail || song.thumbnail === "";
        return (hasPlaceholder || isEmpty) && !processingRef.current.has(song.id);
      });

      // Remove duplicates by ID
      const uniqueSongs = Array.from(new Map(songsToProcess.map(s => [s.id, s])).values());

      if (uniqueSongs.length === 0) return;

      // Process one by one to avoid overwhelming the API
      for (const song of uniqueSongs) {
        if (processingRef.current.has(song.id)) continue;
        
        processingRef.current.add(song.id);
        
        console.log(`Searching artwork for: ${song.title} - ${song.artist}`);
        
        // Fetch artwork
        const newArt = await fetchArtwork(song.title, song.artist);
        
        if (newArt) {
          updateSongThumbnail(song.id, newArt);
        } else {
          // If failed, maybe mark it so we don't try again too soon
          // For now, we'll just leave it in processingRef for this session
        }
        
        // Rate limiting: wait 2 seconds between searches
        await new Promise(r => setTimeout(r, 2000));
      }
    };

    fetchArtForSongs();
  }, [queue.length, recentlyPlayed.length]);

  return null; // Side-effect only component
};
