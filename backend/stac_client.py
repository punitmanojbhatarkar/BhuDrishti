"""
stac_client.py — Real Satellite Data Fetcher v2
Uses Microsoft Planetary Computer STAC API (no key required for basic access!)
Also uses AWS Earth Search as fallback (completely free, no key ever needed)
"""

import requests
from datetime import datetime, timedelta

# ── STAC API Endpoints ──
PLANETARY_COMPUTER_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
AWS_EARTH_SEARCH_URL   = "https://earth-search.aws.element84.com/v1"

# ── India Bounding Boxes ──
BBOXES = {
    "assam":       [89.5,  25.5,  92.5, 27.5],
    "punjab":      [73.0,  29.5,  76.5, 32.5],
    "bengaluru":   [77.3,  12.8,  77.8, 13.2],
    "uttarakhand": [78.0,  29.5,  80.5, 31.5],
    "chilika":     [85.0,  19.5,  85.8, 20.2],
    "delhi":       [76.8,  28.4,  77.4, 28.9],
    "mumbai":      [72.7,  18.9,  73.1, 19.3],
}


def _fix_s3_url(url: str, scene_id: str = None) -> str:
    """
    Convert s3://bucket/key -> https://bucket.s3.amazonaws.com/key
    If it's a directory path (no image extension), append the quick-look suffix.
    """
    if not url:
        return url
    if url.startswith("s3://"):
        parts = url[5:].split("/", 1)
        bucket = parts[0]
        key    = parts[1] if len(parts) > 1 else ""
        url    = f"https://{bucket}.s3.amazonaws.com/{key}"
    # If path has no image extension, it's a scene directory — append quick-look
    ext = url.split("?")[0].lower().split(".")[-1]
    if ext not in ("jpg", "jpeg", "png", "webp", "tif", "tiff"):
        url = url.rstrip("/") + "/preview/quick-look.png"
    return url


def _best_thumbnail(assets: dict) -> str | None:
    """Extract the best publicly accessible thumbnail from a STAC assets dict."""
    for key in ["rendered_preview", "thumbnail", "overview", "visual", "preview"]:
        href = assets.get(key, {}).get("href")
        if href:
            fixed = _fix_s3_url(href)
            print(f"Thumbnail [{key}]: {fixed[:80]}")
            return fixed
    return None


def search_sentinel2(bbox: list, date_from: str, date_to: str, max_cloud: int = 30) -> dict:
    """
    Search for Sentinel-2 optical imagery via AWS Earth Search (FREE, no key needed).
    Returns the best (least cloudy) scene thumbnail URL.
    """
    try:
        payload = {
            "collections": ["sentinel-2-l2a"],
            "bbox": bbox,
            "datetime": f"{date_from}T00:00:00Z/{date_to}T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": max_cloud}},
            "sortby": [{"field": "eo:cloud_cover", "direction": "asc"}],
            "limit": 5,
            "fields": {
                "include": ["id", "properties", "assets", "bbox"],
            }
        }
        resp = requests.post(f"{AWS_EARTH_SEARCH_URL}/search", json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        features = data.get("features", [])
        if not features:
            return {"success": False, "error": "No scenes found", "image_url": None}

        best   = features[0]
        props  = best.get("properties", {})
        assets = best.get("assets", {})

        thumb_url = _best_thumbnail(assets)

        return {
            "success":     True,
            "scene_id":    best.get("id"),
            "cloud_cover": round(props.get("eo:cloud_cover", 0), 1),
            "date":        props.get("datetime", "")[:10],
            "sensor":      "Sentinel-2 L2A",
            "image_url":   thumb_url,
            "bbox":        best.get("bbox"),
        }

    except requests.exceptions.Timeout:
        return {"success": False, "error": "STAC API timeout", "image_url": None}
    except Exception as e:
        return {"success": False, "error": str(e), "image_url": None}


def search_sentinel1_sar(bbox: list, date_from: str, date_to: str) -> dict:
    """
    Search for Sentinel-1 SAR imagery via AWS Earth Search.
    SAR penetrates clouds — perfect for flood detection!
    """
    try:
        payload = {
            "collections": ["sentinel-1-grd"],
            "bbox": bbox,
            "datetime": f"{date_from}T00:00:00Z/{date_to}T23:59:59Z",
            "limit": 5,
        }
        resp = requests.post(f"{AWS_EARTH_SEARCH_URL}/search", json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        features = data.get("features", [])
        if not features:
            return search_sentinel1_planetary_computer(bbox, date_from, date_to)

        best   = features[0]
        props  = best.get("properties", {})
        assets = best.get("assets", {})

        thumb_url = _best_thumbnail(assets)

        # If we still have no HTTPS thumbnail, try Planetary Computer
        if not thumb_url:
            pc_result = search_sentinel1_planetary_computer(bbox, date_from, date_to)
            if pc_result.get("image_url"):
                thumb_url = pc_result["image_url"]

        return {
            "success":      True,
            "scene_id":     best.get("id"),
            "cloud_cover":  0,
            "date":         props.get("datetime", "")[:10],
            "sensor":       "Sentinel-1 SAR (GRD)",
            "image_url":    thumb_url,
            "polarization": props.get("sar:polarizations", ["VV", "VH"]),
            "bbox":         best.get("bbox"),
        }

    except Exception as e:
        return {"success": False, "error": str(e), "image_url": None}


def search_sentinel1_planetary_computer(bbox: list, date_from: str, date_to: str) -> dict:
    """Fallback: Search Sentinel-1 RTC on Microsoft Planetary Computer."""
    try:
        payload = {
            "collections": ["sentinel-1-rtc"],
            "bbox": bbox,
            "datetime": f"{date_from}T00:00:00Z/{date_to}T23:59:59Z",
            "limit": 3,
        }
        resp = requests.post(f"{PLANETARY_COMPUTER_URL}/search", json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        if not features:
            return {"success": False, "error": "No SAR scenes found", "image_url": None}

        best   = features[0]
        props  = best.get("properties", {})
        assets = best.get("assets", {})
        thumb_url = _best_thumbnail(assets)

        return {
            "success":     True,
            "scene_id":    best.get("id"),
            "cloud_cover": 0,
            "date":        props.get("datetime", "")[:10],
            "sensor":      "Sentinel-1 RTC",
            "image_url":   thumb_url,
            "bbox":        best.get("bbox"),
        }
    except Exception as e:
        return {"success": False, "error": str(e), "image_url": None}


def fetch_satellite_image(lon: float, lat: float, date_range: str = None, use_sar: bool = False) -> dict:
    """Main function called by FastAPI."""
    if not date_range:
        today    = datetime.utcnow()
        past     = today - timedelta(days=30)
        date_from = past.strftime("%Y-%m-%d")
        date_to   = today.strftime("%Y-%m-%d")
    else:
        date_from, date_to = date_range.split("/")

    bbox = [lon - 0.5, lat - 0.5, lon + 0.5, lat + 0.5]

    if use_sar:
        return search_sentinel1_sar(bbox, date_from, date_to)
    else:
        return search_sentinel2(bbox, date_from, date_to, max_cloud=30)


def get_bbox_for_location(location_name: str) -> list:
    """Returns the bounding box for a known India location."""
    name = location_name.lower()
    for key, bbox in BBOXES.items():
        if key in name:
            return bbox
    return [68.0, 8.0, 97.0, 37.0]


def get_real_weather(lat: float, lon: float) -> dict:
    try:
        url = (f"https://api.open-meteo.com/v1/forecast"
               f"?latitude={lat}&longitude={lon}"
               f"&current=temperature_2m,precipitation,rain"
               f"&timezone=Asia/Kolkata")
        r = requests.get(url, timeout=6)
        if r.status_code == 200:
            return r.json().get("current", {})
    except Exception:
        pass
    return {}
