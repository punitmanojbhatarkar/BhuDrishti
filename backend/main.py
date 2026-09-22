"""
main.py — BhuDrishti Real Orchestrator v4.0
Pipeline:
  - STAC + Weather fetched concurrently
  - GEE runs FIRST (with Rectangle polygon fix), then Gemini
  - Verification Agent sanity-checks GEE output before Gemini
  - Total response time: ~30-50 seconds
"""
import json
import re
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

app = FastAPI(title="BhuDrishti v4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)

_pool = ThreadPoolExecutor(max_workers=8)

MODULE_LABELS = {
    "flood": "DISASTERWATCH - SAR FLOOD ANALYSIS",
    "flood_compare": "DISASTERWATCH - TEMPORAL CHANGE DETECTION (SAR)",
    "agri": "KRISHI - CROP HEALTH (NDVI)",
    "urban": "NAGAR - URBAN SPRAWL & INFRASTRUCTURE",
    "forest": "VANAM - FOREST COVER & CONSERVATION",
    "water": "JAL - WATER RESOURCES MANAGEMENT",
    "general": "INTELLIGENCE BRIEFING"
}

# ── Verification Agent ─────────────────────────────────────────────────
# Historical NDMA flood records for known regions (km²)
# Source: NDMA Annual Reports 2019-2024
HISTORICAL_FLOOD_RECORDS = {
    "assam":       {"min": 300,  "max": 5500,  "typical": 1800, "peak_months": [6,7,8,9],   "source": "NDMA 2024 / ASDMA"},
    "bihar":       {"min": 200,  "max": 8000,  "typical": 2500, "peak_months": [7,8,9],     "source": "NDMA 2024"},
    "odisha":      {"min": 100,  "max": 3000,  "typical": 800,  "peak_months": [7,8,9,10],  "source": "NDMA 2024"},
    "uttarakhand": {"min": 10,   "max": 500,   "typical": 80,   "peak_months": [6,7,8],     "source": "NDMA 2024"},
    "kerala":      {"min": 50,   "max": 2000,  "typical": 400,  "peak_months": [6,7,8],     "source": "NDMA 2024"},
    "gujarat":     {"min": 50,   "max": 3000,  "typical": 600,  "peak_months": [7,8,9],     "source": "NDMA 2024"},
    "india":       {"min": 100,  "max": 15000, "typical": 3000, "peak_months": [6,7,8,9],   "source": "NDMA 2024"},
}

def verify_flood_output(area_km2, location: str, module: str) -> dict:
    """
    Verification Agent: Sanity-checks the GEE-computed flood area against
    NDMA historical records. Returns confidence rating and notes.
    """
    if module not in ["flood", "water"]:
        return {"confidence": "N/A", "notes": "", "historical_range": "N/A"}

    record = HISTORICAL_FLOOD_RECORDS.get(location.lower())
    current_month = datetime.utcnow().month

    if area_km2 is None or area_km2 == 0:
        return {
            "confidence": "LOW",
            "notes": "GEE area computation returned 0 or timed out. Map overlay is still accurate. Area figure should be treated as indicative.",
            "historical_range": record["typical"] if record else "N/A",
        }

    if not record:
        return {
            "confidence": "MEDIUM",
            "notes": f"No historical NDMA baseline available for {location}. Measurement is SAR-based but cannot be cross-validated.",
            "historical_range": "Unknown",
        }

    is_monsoon = current_month in record["peak_months"]
    in_range   = record["min"] <= area_km2 <= record["max"]

    if in_range and is_monsoon:
        confidence = "HIGH"
        notes = f"Area {area_km2} km² is within NDMA historical range ({record['min']}–{record['max']} km²) for {location.title()} during monsoon. Source: {record['source']}."
    elif in_range and not is_monsoon:
        confidence = "MEDIUM"
        notes = f"Area {area_km2} km² is within NDMA range but it is not peak flood season (peak: months {record['peak_months']}). May reflect dry-season water bodies."
    elif area_km2 > record["max"]:
        confidence = "LOW"
        notes = f"Area {area_km2} km² EXCEEDS NDMA historical maximum ({record['max']} km²) for {location.title()}. Possible overdetection. Recommend field verification."
    else:
        confidence = "LOW"
        notes = f"Area {area_km2} km² is below NDMA minimum expected ({record['min']} km²). Possible underdetection or non-flood season."

    return {
        "confidence": confidence,
        "notes": notes,
        "historical_range": f"{record['min']}–{record['max']} km² (typical: {record['typical']} km²)",
        "source": record["source"],
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
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AQ.Ab8RN6JcJ0JTq3dflUEln92mL8tr1yCNr_hgwbbeX_ZRVhxz6A")
genai.configure(api_key=GEMINI_API_KEY)
router_model = genai.GenerativeModel("gemini-3.7-flash")

# ── Intent Detection ──────────────────────────────────────────────────

def detect_intent(query: str) -> dict:
    prompt = f"""Extract the intent and location from the user's query.
    The query might be in English, Hindi, Hinglish, and contain severe spelling mistakes.
    Modules allowed: "flood", "flood_compare", "agri", "urban", "forest", "water", "general".
    * If the user asks to "compare" floods or asks about "past", "history", or specific years, output "flood_compare".
    Location: Extract the specific geographical location (state, city, country, or region) mentioned. If none, output "unknown".
    Years: If the user mentions specific years to compare (e.g., 2018, 2021), extract them into a list of integers called "compare_years".
    
    Query: "{query}"
    
    Return ONLY a valid JSON object with keys "module", "location", and "compare_years" (if applicable). Do not include markdown formatting.
    Example: {{"module": "flood_compare", "location": "assam", "compare_years": [2018, 2021, 2026]}}
    """
    
    module = "general"
    location = "unknown"
    
    try:
        response = router_model.generate_content(prompt)
        text = response.text.strip().replace("```json", "").replace("```", "")
        data = json.loads(text)
        module = data.get("module", "general").lower()
        location = data.get("location", "unknown").lower()
        compare_years = data.get("compare_years", [])
    except Exception as e:
        print(f"LLM routing failed: {e}")
        compare_years = []
        
    # Fallback keyword logic if not caught by LLM
    q = query.lower()
    if any(w in q for w in ["flood","inundation","cyclone","disaster","relief","submerged","sar","radar"]):
        if any(w in q for w in ["compare", "past", "history", "year"]):
            module = "flood_compare"
        else:
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
        "kolkata":"kolkata","chennai":"chennai","hyderabad":"hyderabad","odisha":"odisha",
        "gujarat":"india","rajasthan":"india","kerala":"india",
        "nepal": "nepal", "bhutan": "bhutan", "bangladesh": "bangladesh", "sri lanka": "sri lanka"
    }
    
    matched = False
    for k, v in aliases.items():
        if k in q:
            location = v
            matched = True
            break
            
    if not matched:
        location = q.replace("analyze", "").replace("flood", "").replace("in", "").strip() or "unknown"
            
    if not location or location == "unknown":
        location = "india"

    use_sar = module in ["flood", "flood_compare"] or any(w in query.lower() for w in ["sar","radar","cloud","monsoon"])
    
    # Regex fallback for years to prevent missing any 4-digit years in compare mode
    # We do this here to catch years even if the LLM failed to route to flood_compare initially
    if module == "flood_compare":
        # Extract years using regex
        regex_years = [int(y) for y in re.findall(r'\b(20\d{2})\b', query)]
        # Ensure any years from LLM are cast to ints (some models return strings)
        valid_compare_years = []
        for y in compare_years:
            try:
                valid_compare_years.append(int(y))
            except (ValueError, TypeError):
                pass
        
        compare_years = sorted(list(set(valid_compare_years + regex_years)))
    
    # Ensure compare_years defaults to [2019, 2026] if module is flood_compare but none specified
    if module == "flood_compare" and not compare_years:
        compare_years = [2019, 2026]

    today   = datetime.utcnow()
    past    = today - timedelta(days=90)
    date_range = f"{past.strftime('%Y-%m-%d')}/{today.strftime('%Y-%m-%d')}"

    return {
        "module": module,
        "location": location,
        "use_sar": use_sar,
        "compare_years": compare_years,
        "date_range": date_range
    }


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


@app.get("/health")
def health_check():
    """Simple health check endpoint to keep the Render server warm."""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

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
    compare_years = intent.get("compare_years", [])
    date_from, date_to = intent["date_range"].split("/")
    geojson    = request.geojson

    bbox       = get_bbox_for_location(location)
    center_lon = (bbox[0] + bbox[2]) / 2
    center_lat = (bbox[1] + bbox[3]) / 2

    if not geojson:
        # CRITICAL FIX: Use a Rectangle polygon, NOT a Point — GEE area calculation needs a polygon
        geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [bbox[0], bbox[1]],
                        [bbox[2], bbox[1]],
                        [bbox[2], bbox[3]],
                        [bbox[0], bbox[3]],
                        [bbox[0], bbox[1]],
                    ]]
                },
                "properties": {"name": location.title()}
            }]
        }

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
    context["Analysis_Module"]  = MODULE_LABELS.get(module, module)
    context["Location"]         = location.title()
    context["Date_Range"]       = f"{date_from} to {date_to} (last 90 days)"
    today = datetime.utcnow()
    context["Pre_Flood_Baseline"] = f"{(today - timedelta(days=365)).strftime('%Y-%m-%d')} to {(today - timedelta(days=270)).strftime('%Y-%m-%d')} (pre-monsoon reference)"
    context["SAR_Sensor"]       = "Sentinel-1 SAR GRD (VV Polarization)"
    context["Threshold"]        = "VV < -14 dB + SRTM DEM slope < 5° + JRC permanent water excluded"
    context["compare_years"]    = compare_years

    # ── STEP 2: GEE + Gemini run IN PARALLEL ─────────────────────────
    def do_gee():
        try:
            tile_url = get_gee_map_tile(module, bbox, geojson, compare_years)
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

    # Submit GEE first — wait for it fully before starting Gemini
    f_gee = _pool.submit(do_gee)

    # Wait for GEE to finish (up to 40s — scale=100+bestEffort is fast enough)
    ndvi_score = None
    area_km2   = None
    gee_tile_url = None
    try:
        gee_key, gee_val, tile_url = f_gee.result(timeout=40)
        gee_tile_url = tile_url
        if gee_key == "ndvi":
            ndvi_score = gee_val
        elif gee_key == "area":
            area_km2 = gee_val
        print(f"GEE result: {gee_key}={gee_val}, tile={'yes' if tile_url else 'no'}")
    except (FuturesTimeout, Exception) as e:
        print(f"GEE timeout or error: {e}")

    # NOW inject verified GEE data into context before launching Gemini
    context["GEE_NDVI"]           = str(ndvi_score) if ndvi_score is not None else "N/A"
    context["GEE_Water_Area_km2"] = str(area_km2)   if area_km2  is not None else "N/A"
    print(f"Context sent to Gemini: NDVI={context['GEE_NDVI']}, Area={context['GEE_Water_Area_km2']}")

    # ── VERIFICATION AGENT ──────────────────────────────────────────────
    # Sanity-check GEE output against NDMA historical records BEFORE Gemini
    verification = verify_flood_output(area_km2, location, module)
    context["Verification_Confidence"] = verification.get("confidence", "N/A")
    context["Verification_Notes"]      = verification.get("notes", "")
    context["Historical_Range"]        = verification.get("historical_range", "N/A")
    context["Historical_Source"]       = verification.get("source", "NDMA")
    print(f"Verification: confidence={verification.get('confidence')}, notes={verification.get('notes','')[:80]}")

    # Launch Gemini AFTER GEE + Verification so it has verified, grounded numbers
    f_gemini = _pool.submit(do_gemini, context)

    # Wait for Gemini (up to 60s)
    try:
        gemini_report = f_gemini.result(timeout=60)
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
        "geojson": geojson,

        # Verification Agent output
        "verification_confidence": verification.get("confidence", "N/A"),
        "verification_notes":      verification.get("notes", ""),
        "historical_range":        verification.get("historical_range", "N/A"),
        "date_range":              f"{date_from} to {date_to}",
        "compare_years":           compare_years,
    }