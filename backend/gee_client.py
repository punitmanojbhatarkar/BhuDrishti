import ee
import os

import json

# Initialize Earth Engine with the service account
try:
    if os.environ.get('GEE_KEY_JSON'):
        # On Render, read from Environment Variable
        key_data = json.loads(os.environ.get('GEE_KEY_JSON'))
        client_email = key_data.get('client_email')
        # ServiceAccountCredentials expects a file or a dictionary
        credentials = ee.ServiceAccountCredentials(client_email, key_data=key_data)
    else:
        # Locally, read from the file
        with open('gee_key.json', 'r') as f:
            key_data = json.load(f)
            client_email = key_data.get('client_email')
        credentials = ee.ServiceAccountCredentials(client_email, 'gee_key.json')
        
    ee.Initialize(credentials)
    print("Earth Engine Initialized Successfully!")
except Exception as e:
    print(f"Earth Engine init failed: {e}")

def calculate_real_ndvi(bbox, geojson=None):
    """
    Calculates the mean NDVI for the latest cloud-free Sentinel-2 image in the bbox or geojson region.
    bbox format: [min_lon, min_lat, max_lon, max_lat]
    """
    try:
        if geojson and 'geometry' in geojson:
            geometry = ee.Geometry(geojson['geometry'])
        elif geojson and 'features' in geojson and len(geojson['features']) > 0:
            geometry = ee.Geometry(geojson['features'][0]['geometry'])
        else:
            geometry = ee.Geometry.Rectangle(bbox)
        
        # Get the latest Sentinel-2 image with low cloud cover
        collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                      .filterBounds(geometry)
                      .filterDate('2023-01-01', '2026-12-31')
                      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                      .sort('system:time_start', False))
                      
        image = collection.first()
        
        if not image:
            return None

        # Calculate NDVI: (NIR - RED) / (NIR + RED)
        ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        # Calculate mean NDVI over the region
        # scale=100m is 100x faster than scale=10m for large regions like states
        mean_ndvi = ndvi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=geometry,
            scale=100,
            maxPixels=1e13,
            bestEffort=True   # auto-coarsen if still too slow
        ).get('NDVI').getInfo()
        
        return round(float(mean_ndvi), 3) if mean_ndvi is not None else None
    except Exception as e:
        print(f"GEE NDVI Error: {e}")
        return None

def calculate_water_area(bbox, geojson=None):
    """
    Calculates total water/flooded area in sq km using Sentinel-1 SAR.
    """
    try:
        if geojson and 'geometry' in geojson:
            geometry = ee.Geometry(geojson['geometry'])
        elif geojson and 'features' in geojson and len(geojson['features']) > 0:
            geometry = ee.Geometry(geojson['features'][0]['geometry'])
        else:
            geometry = ee.Geometry.Rectangle(bbox)
        
        # Get latest Sentinel-1 SAR GRD image
        collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                      .filterBounds(geometry)
                      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                      .filter(ee.Filter.eq('instrumentMode', 'IW'))
                      .sort('system:time_start', False))
                      
        image = collection.first()
        
        if not image:
            return None
            
        # Get elevation data (SRTM) to mask out steep slopes (radar shadow)
        dem = ee.Image('USGS/SRTMGL1_003')
        slope = ee.Terrain.slope(dem)
        # Terrain is flat if slope < 5 degrees
        flat_terrain = slope.lt(5)
            
        # Water thresholding on VV polarization (water is dark in SAR)
        vv = image.select('VV')
        # Mask out anything that is steep terrain (prevent shadow misclassification)
        water = vv.lt(-14).And(flat_terrain).rename('water')
        
        # ── Step 3: Subtract permanent water bodies (JRC Global Surface Water)
        # This ensures we show FLOOD EXTENT only, not permanent rivers/lakes
        # JRC dataset: 1 = permanent water, 0 = not permanent
        jrc = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
        permanent_water = jrc.select('seasonality').gte(10)  # water for >= 10 months/year
        
        # Flood = SAR water mask AND NOT permanent water
        flood_only = water.And(permanent_water.Not()).rename('flood')
        
        # Calculate area using scale=500m (proven fast, avoids timeout)
        area_image = flood_only.multiply(ee.Image.pixelArea())
        water_area_sq_m = area_image.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=geometry,
            scale=500,
            maxPixels=1e10,
            bestEffort=True
        ).get('flood').getInfo()
        
        if water_area_sq_m is None:
            return None
            
        area_sq_km = float(water_area_sq_m) / 1e6
        return round(area_sq_km, 2)
    except Exception as e:
        print(f"GEE Water Area Error: {e}")
        return None

def get_gee_map_tile(module: str, bbox: list, geojson=None, compare_years: list = None) -> str:
    """
    Returns a dynamic GEE Map Tile URL for the specified analysis module.
    """
    try:
        if geojson and 'geometry' in geojson:
            geometry = ee.Geometry(geojson['geometry'])
        elif geojson and 'features' in geojson and len(geojson['features']) > 0:
            geometry = ee.Geometry(geojson['features'][0]['geometry'])
        else:
            geometry = ee.Geometry.Rectangle(bbox)

        if module == "flood" or module == "water" or module == "flood_compare":
            # SAR Water Mask
            collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                          .filterBounds(geometry)
                          .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                          .filter(ee.Filter.eq('instrumentMode', 'IW')))
            
            # Get elevation data (SRTM) to mask out steep slopes (radar shadow)
            dem = ee.Image('USGS/SRTMGL1_003')
            slope = ee.Terrain.slope(dem)
            flat_terrain = slope.lt(5)
            
            # ── Subtract permanent water (JRC) to show FLOOD EXTENT only ──
            jrc = ee.Image('JRC/GSW1_4/GlobalSurfaceWater')
            permanent_water = jrc.select('seasonality').gte(10)  # >= 10 months/year = permanent
            
            if module == "flood_compare" and compare_years:
                # Dynamic N-Timeline Comparison
                years = sorted(list(set(compare_years))) # Ensure unique and chronological
                
                rgb_layers = []
                for i, year in enumerate(years):
                    if i == 0:
                        color = 'FF0000' # Oldest: Red
                    elif i == len(years) - 1 and len(years) > 1:
                        color = '00FFFF' # Newest: Cyan
                    else:
                        palette = ['FFFF00', '00FF00', 'FF00FF'] # Middle: Yellow, Green, Magenta
                        color = palette[(i - 1) % len(palette)]

                    start_date = f"{year}-01-01"
                    end_date = f"{year}-12-31"
                    
                    year_img = collection.filterDate(start_date, end_date).sort('system:time_start', False).mosaic()
                    year_flood = year_img.select('VV').lt(-14).And(flat_terrain).And(permanent_water.Not()).selfMask()
                    
                    year_rgb = year_flood.visualize(min=1, max=1, palette=[color])
                    rgb_layers.append(year_rgb)
                
                combined = ee.ImageCollection(rgb_layers).mosaic()
                map_id = combined.getMapId()
                return map_id['tile_fetcher'].url_format
            else:
                image = collection.filterDate('2020-01-01', '2026-12-31').sort('system:time_start', False).mosaic()
                flood_mask = image.select('VV').lt(-14).And(flat_terrain).And(permanent_water.Not()).selfMask()
                map_id = flood_mask.getMapId({'min': 1, 'max': 1, 'palette': ['00FFFF']})
                return map_id['tile_fetcher'].url_format
            
        elif module == "agri" or module == "forest":
            # NDVI Heatmap
            collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                          .filterBounds(geometry)
                          .filterDate('2020-01-01', '2026-12-31')
                          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                          .sort('system:time_start', False))
            image = collection.mosaic()
            
            ndvi = image.normalizedDifference(['B8', 'B4'])
            # Mask out non-vegetation to create an organic, realistic overlay instead of a solid bounding box
            ndvi = ndvi.updateMask(ndvi.gt(0.2))
            
            # Professional monochrome green palette
            vis_params = {
                'min': 0.2,
                'max': 0.85,
                'palette': ['#a1d99b', '#74c476', '#31a354', '#006d2c']
            }
            map_id = ndvi.getMapId(vis_params)
            return map_id['tile_fetcher'].url_format

        else:
            # Default True Color (Sentinel-2)
            collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                          .filterBounds(geometry)
                          .filterDate('2024-06-01', '2024-09-30')
                          .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                          .sort('system:time_start', False))
            image = collection.mosaic()
            
            vis_params = {'bands': ['B4', 'B3', 'B2'], 'min': 0, 'max': 3000, 'gamma': 1.4}
            map_id = image.getMapId(vis_params)
            return map_id['tile_fetcher'].url_format

    except Exception as e:
        print(f"GEE Tile Fetch Error: {e}")
        return None
