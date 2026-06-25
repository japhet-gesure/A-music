import { getAllTracks, saveTrack } from "../lib/offlineStorage";

const MOCK_TRACKS = [
  {
    id: "mock-local-1",
    title: "Ambient Piano",
    artist: "Native Media Store",
    url: "https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg",
    thumbnail: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&h=300&fit=crop",
    genre: "Ambient"
  },
  {
    id: "mock-local-2",
    title: "Tropical Birds",
    artist: "Native Media Store",
    url: "https://actions.google.com/sounds/v1/animals/birds_singing_in_forest.ogg",
    thumbnail: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&h=300&fit=crop",
    genre: "Nature"
  },
  {
    id: "mock-local-3",
    title: "Urban Traffic",
    artist: "Native Media Store",
    url: "https://actions.google.com/sounds/v1/alarms/phone_ringing.ogg",
    thumbnail: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=300&h=300&fit=crop",
    genre: "Urban"
  },
  {
     id: "mock-local-4",
     title: "Rain Drops",
     artist: "Native Media Store",
     url: "https://actions.google.com/sounds/v1/water/rain_on_roof.ogg",
     thumbnail: "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=300&h=300&fit=crop",
     genre: "Nature"
  },
  {
     id: "mock-local-5",
     title: "Wind Chimes",
     artist: "Native Media Store",
     url: "https://actions.google.com/sounds/v1/foley/wind_chimes.ogg",
     thumbnail: "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=300&h=300&fit=crop",
     genre: "Ambient"
  }
];

export const seedNativeMediaStore = async () => {
  try {
    const existing = await getAllTracks();
    if (existing.length > 0) {
      return false; // Already populated
    }

    console.log("[NativeStore] Initializing mock device storage...");
    
    for (const track of MOCK_TRACKS) {
      try {
        const resp = await fetch(track.url);
        const blob = await resp.blob();
        
        await saveTrack({
          id: track.id,
          blob: blob,
          metadata: {
            title: track.title,
            artist: track.artist,
            album: "Device Folders",
            thumbnail: track.thumbnail,
            source: "local",
            genre: track.genre,
            duration: 60, // Mock duration
            lyrics: []
          }
        });
      } catch (e) {
        console.error(`Failed to fetch and save mock track: ${track.id}`, e);
      }
    }
    return true; // Seeded successfully
  } catch (err) {
    console.error("Failed to seed native media store", err);
    return false;
  }
};
