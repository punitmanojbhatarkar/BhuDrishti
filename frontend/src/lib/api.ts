// Backend API types and helpers
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://bhudrishti-backend.onrender.com";

export interface ChatRequest {
  query: string;
  location?: string;
  date?: string;
  language?: string;
  geojson?: any;
  ai_provider?: string;
}

export interface ChatResponse {
  // AI report
  reply: string;
  module?: string;
  module_label?: string;
  location?: string;

  // Geo-pinning — the KEY fields for real map overlay
  image_url?: string | null;       // Real STAC thumbnail URL
  bbox?: number[] | null;          // [min_lon, min_lat, max_lon, max_lat]
  center_lat?: number | null;
  center_lon?: number | null;

  // Scene metadata
  scene_id?: string;
  sensor?: string;
  scene_date?: string;
  cloud_cover?: number;
  stac_source?: string;

  // GEE computed metrics
  ndvi_score?: number | null;
  area_km2?: number | null;
  gee_tile_url?: string | null;
  compare_years?: number[] | null;
}

export async function sendChatMessage(payload: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Bypass-Tunnel-Reminder": "true" 
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
