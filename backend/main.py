"""
main.py — BhuDrishti Real Orchestrator v3.2
True parallel pipeline:
  - STAC + Weather fetched concurrently (max 18s)
  - GEE + Gemini Vision both run concurrently after STAC (max 45s each)
  - Total response time: ~25-45 seconds
"""
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from stac_client import (
    search_sentinel1_sar, search_sentinel2,
    get_bbox_for_location, BBOXES, get_real_weather
)
from gee_client import calculate_real_ndvi, calculate_water_area, get_gee_map_tile
from vlm_client import analyze_image_with_gemini, analyze_image_with_nvidia, translate_text
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

app = FastAPI(title="BhuDrishti v3.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

_pool = ThreadPoolExecutor(max_workers=8)

MODULE_LABELS = {
    "flood":   "DisasterWatch · SAR Flood Analysis",
    "agri":    "AgroVision · Crop Health Index",
    "urban":   "UrbanPulse · Change Detection",
    "forest":  "ForestGuard · Deforestation Alert",
    "water":   "WaterWatch · Hydrology",
    "general": "BhuDrishti · Satellite Intelligence",
}


from typing import Optional, Dict, Any

class QueryRequest(BaseModel):
    query: str
    location: Optional[str] = None
    date: Optional[str] = None
    language: Optional[str] = None
    geojson: Optional[Dict[str, Any]] = None
    ai_provider: Optional[str] = "gemini"


import google.generativeai as genai
import json

import os
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
router_model = genai.GenerativeModel("gemini-3.7-flash")

# ── Intent Detection ──────────────────────────────────────────────────

def detect_intent(query: str) -> dict:
    prompt = f"""Extract the intent and location from the user's query.
    The query might be in English, Hindi, Hinglish, and contain severe spelling mistakes.
    Modules allowed: "flood", "agri", "urban", "forest", "water", "general".
    Location: Extract the specific Indian state, city, or geographical feature (e.g., "punjab", "assam", "bengaluru"). If none, output "india".
    
    Query: "{query}"
    
    Return ONLY a valid JSON object with keys "module" and "location". Do not include markdown formatting.
    Example: {{"module": "agri", "location": "punjab"}}
    """
    
    module = "general"
    location = "india"
    
    try:
        response = router_model.generate_content(prompt)
        text = response.text.strip().replace("```json", "").replace("```", "")
        data = json.loads(text)
        module = data.get("module", "general").lower()
        location = data.get("location", "india").lower()
    except Exception as e:
        print(f"LLM routing failed: {e}")
        # Fallback keyword logic
        q = query.lower()
        if any(w in q for w in ["flood","inundation","cyclone","disaster","relief","submerged","sar","radar"]):
            module = "flood"
        elif any(w in q for w in ["crop","wheat","paddy","rice","farm","agriculture","ndvi","soil","harvest","kharif","rabi","vegetation"]):
            module = "agri"
        elif any(w in q for w in ["urban","city","building","encroachment","sprawl","construction"]):
            module = "urban"
        elif any(w in q for w in ["forest","deforest","tree","jungle","carbon","fire"]):
            module = "forest"
        elif any(w in q for w in ["water","lake","river","reservoir","drought","wetland","dam"]):
            module = "water"

        aliases = {
            "assam":"assam","punjab":"punjab","bengaluru":"bengaluru","bangalore":"bengaluru",
            "uttarakhand":"uttarakhand","chilika":"chilika","delhi":"delhi","mumbai":"mumbai",
            "kolkata":"india","chennai":"india","hyderabad":"india","odisha":"chilika",
            "gujarat":"india","rajasthan":"india","kerala":"india",
            "brahmaputra":"assam","guwahati":"assam",
        }
        for alias, mapped in aliases.items():
            if alias in q:
                location = mapped
                break

    use_sar = module == "flood" or any(w in query.lower() for w in ["sar","radar","cloud","monsoon"])
    today   = datetime.utcnow()
    past    = today - timedelta(days=90)
    date_range = f"{past.strftime('%Y-%m-%d')}/{today.strftime('%Y-%m-%d')}"

    return {"module": module, "location": location, "use_sar": use_sar, "date_range": date_range}


# ── Endpoints ─────────────────────────────────────────────────────────

@app.get("/")
def root(): return {"status": "ok", "version": "3.2"}

@app.get("/api/health")
def health():
    try:
        import requests as req
        ok = req.get("https://earth-search.aws.element84.com/v1", timeout=5).status_code == 200
    except Exception:
        ok = False
    return {"api": "ok", "stac": ok, "version": "3.2"}

@app.get("/api/basemap")
def get_basemap(layer_type: str = "sar"):
    """
    Returns a dynamic Google Earth Engine tile URL for a global/regional basemap.
    """
    try:
        import ee
        if layer_type == "sar":
            # Sentinel-1 SAR GRD mosaic (recent month)
            collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                          .filterDate('2024-07-01', '2024-07-31')
                          .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                          .filter(ee.Filter.eq('instrumentMode', 'IW')))
            image = collection.mosaic()
            vis_params = {'bands': ['VV'], 'min': -25, 'max': 5}
            map_id = image.getMapId(vis_params)
            return {"url": map_id['tile_fetcher'].url_format}
        
        elif layer_type == "optical":
            # Sentinel-2 Optical mosaic (recent month, cloud filtered)
            collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                          .filterDate('2024-05-01', '2024-05-31')
                          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)))
            image = collection.mosaic()
            vis_params = {'bands': ['B4', 'B3', 'B2'], 'min': 0, 'max': 3000, 'gamma': 1.4}
            map_id = image.getMapId(vis_params)
            return {"url": map_id['tile_fetcher'].url_format}
            
    except Exception as e:
        print(f"GEE Basemap Error: {e}")
        return {"url": None}


@app.post("/api/chat")
def chat_endpoint(request: QueryRequest):
    """
    Fully parallel pipeline:
    Step 1 (parallel): STAC search + Weather fetch
    Step 2 (parallel): GEE metric + Gemini Vision  ← both run at same time
    Step 3: Merge results and return
    """
    intent     = detect_intent(request.query)
    module     = intent["module"]
    location   = intent["location"]
    use_sar    = intent["use_sar"]
    date_from, date_to = intent["date_range"].split("/")
    geojson    = request.geojson

    bbox       = get_bbox_for_location(location)
    center_lon = (bbox[0] + bbox[2]) / 2
    center_lat = (bbox[1] + bbox[3]) / 2

    # ── STEP 1: STAC + Weather in parallel (max 18s) ─────────────────
    def do_stac():
        if use_sar:
            return search_sentinel1_sar(bbox, date_from, date_to)
        return search_sentinel2(bbox, date_from, date_to, max_cloud=30)

    f_stac    = _pool.submit(do_stac)
    f_weather = _pool.submit(get_real_weather, center_lat, center_lon)

    try:
        stac_result = f_stac.result(timeout=18)
    except (FuturesTimeout, Exception) as e:
        print(f"STAC error: {e}")
        stac_result = {"success": False}

    try:
        weather = f_weather.result(timeout=8)
    except (FuturesTimeout, Exception):
        weather = {}

    if not stac_result.get("success"):
        stac_result = {
            "success": True, "scene_id": "OFFLINE",
            "cloud_cover": 0, "date": datetime.utcnow().strftime("%Y-%m-%d"),
            "sensor": "Sentinel-1 SAR" if use_sar else "Sentinel-2 L2A",
            "image_url": None, "bbox": bbox,
        }

    thumbnail_url = stac_result.get("image_url")
    scene_bbox    = stac_result.get("bbox") or bbox

    # Build context enrichment for Gemini
    context = dict(weather)
    context["Analysis_Module"] = MODULE_LABELS.get(module, module)

    # ── STEP 2: GEE + Gemini run IN PARALLEL ─────────────────────────
    def do_gee():
        try:
            tile_url = get_gee_map_tile(module, bbox, geojson)
            if module in ["agri", "forest"]:
                return ("ndvi", calculate_real_ndvi(bbox, geojson), tile_url)
            elif module in ["flood", "water"]:
                return ("area", calculate_water_area(bbox, geojson), tile_url)
            else:
                return ("none", None, tile_url)
        except Exception as e:
            print(f"GEE error: {e}")
        return (None, None, None)

    def do_gemini(gee_context: dict):
        if request.ai_provider == "nvidia":
            return analyze_image_with_nvidia(
                thumbnail_url, location, module, gee_context
            )
        else:
            return analyze_image_with_gemini(
                thumbnail_url, location, module, gee_context
            )

    # Submit GEE first
    f_gee = _pool.submit(do_gee)

    # Submit Gemini with the context we have so far (GEE result added later if fast enough)
    # Give Gemini a slightly delayed start so GEE might finish first
    import time
    time.sleep(0.5)  # tiny pause so GEE has a head start

    # Try to get GEE result quickly (3s fast path)
    ndvi_score = None
    area_km2   = None
    gee_tile_url = None
    try:
        gee_key, gee_val, tile_url = f_gee.result(timeout=3)
        gee_tile_url = tile_url
        if gee_key == "ndvi":
            ndvi_score = gee_val
        elif gee_key == "area":
            area_km2 = gee_val
    except (FuturesTimeout, Exception):
        pass  # GEE still running, start Gemini with what we have

    # Inject whatever GEE returned so far
    context["GEE_NDVI"]           = str(ndvi_score) if ndvi_score else "N/A"
    context["GEE_Water_Area_km2"] = str(area_km2)   if area_km2  else "N/A"

    # Launch Gemini
    f_gemini = _pool.submit(do_gemini, context)

    # Wait for GEE to finish (remaining budget)
    try:
        if ndvi_score is None and area_km2 is None and gee_tile_url is None:
            gee_key, gee_val, tile_url = f_gee.result(timeout=20)
            gee_tile_url = tile_url
            if gee_key == "ndvi":
                ndvi_score = gee_val
            elif gee_key == "area":
                area_km2 = gee_val
    except (FuturesTimeout, Exception) as e:
        print(f"GEE timeout: {e}")

    # Wait for Gemini (remaining budget up to 45s from now)
    try:
        gemini_report = f_gemini.result(timeout=45)
    except (FuturesTimeout, Exception) as e:
        print(f"Gemini timeout: {e}")
        gemini_report = (
            f"Satellite imagery acquired for {location.title()}. "
            f"Sensor: {stac_result.get('sensor','Sentinel')}. "
            f"Scene date: {stac_result.get('date','N/A')}. "
            + (f"GEE flood area: {area_km2:.1f} km²." if area_km2 else "")
            + (f"NDVI: {ndvi_score}." if ndvi_score else "")
        )

    # Translate if requested
    if request.language and request.language.lower() not in ["en", "english"]:
        gemini_report = translate_text(gemini_report, request.language)

    return {
        "reply":        gemini_report,
        "module":       module,
        "location":     location.title(),
        "module_label": MODULE_LABELS.get(module, module),

        # Geo-pinning
        "image_url":  thumbnail_url,
        "bbox":       scene_bbox,
        "center_lat": center_lat,
        "center_lon": center_lon,

        # Scene metadata
        "scene_id":    stac_result.get("scene_id", "N/A"),
        "sensor":      stac_result.get("sensor"),
        "scene_date":  stac_result.get("date"),
        "cloud_cover": stac_result.get("cloud_cover", 0),
        "stac_source": "AWS Earth Search" if not use_sar else "MS Planetary Computer",

        # GEE metrics
        "ndvi_score": ndvi_score,
        "area_km2":   area_km2,
        "gee_tile_url": gee_tile_url,
    }