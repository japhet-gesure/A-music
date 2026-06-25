import axios from "axios";

export async function fetchArtwork(title: string, artist: string): Promise<string | null> {
  try {
    const response = await axios.get("/api/artwork", {
      params: { title, artist }
    });
    return response.data?.artworkUrl || null;
  } catch (error) {
    console.error("fetchArtwork Client API call failed:", error);
    // Last resort fallback placeholder
    return `https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop&q=80&auto=format&keywords=${encodeURIComponent(artist + " " + title)}`;
  }
}
