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
                # TRUE BINARY CHANGE MASK (Mandatory PS Requirement)
                years = sorted(list(set(compare_years))) # Ensure unique and chronological
                
                if len(years) >= 2:
                    # Take the oldest and newest years for the change mask
                    year_old = years[0]
                    year_new = years[-1]
                    
                    old_img = collection.filterDate(f"{year_old}-01-01", f"{year_old}-12-31").sort('system:time_start', False).mosaic()
                    old_flood = old_img.select('VV').lt(-14).And(flat_terrain).And(permanent_water.Not())
                    
                    new_img = collection.filterDate(f"{year_new}-01-01", f"{year_new}-12-31").sort('system:time_start', False).mosaic()
                    new_flood = new_img.select('VV').lt(-14).And(flat_terrain).And(permanent_water.Not())
                    
                    # Subtract: +1 (New Flood), -1 (Receded Flood), 0 (No Change)
                    change = new_flood.subtract(old_flood)
                    
                    # Mask out the zeros so only actual changes are rendered
                    change_masked = change.updateMask(change.neq(0))
                    
                    # Palette: -1 (Receded) = Blue, +1 (New Flood) = Red
                    map_id = change_masked.getMapId({
                        'min': -1, 
                        'max': 1, 
                        'palette': ['0000FF', '000000', 'FF0000'] 
                    })
                    return map_id['tile_fetcher'].url_format
                else:
                    # Fallback if only 1 year was provided
                    year = years[0]
                    year_img = collection.filterDate(f"{year}-01-01", f"{year}-12-31").sort('system:time_start', False).mosaic()
                    flood_mask = year_img.select('VV').lt(-14).And(flat_terrain).And(permanent_water.Not()).selfMask()
                    map_id = flood_mask.getMapId({'min': 1, 'max': 1, 'palette': ['00FFFF']})
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

        elif module == "fusion":
            # ── TRUE OPTICAL-SAR FUSION (Mandatory PS Requirement) ──
            # 1. Optical (Sentinel-2)
            s2_collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                             .filterBounds(geometry)
                             .filterDate('2024-01-01', '2026-12-31')
                             .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                             .sort('system:time_start', False))
            s2_img = s2_collection.mosaic()
            
            # 2. SAR (Sentinel-1)
            s1_collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                             .filterBounds(geometry)
                             .filterDate('2024-01-01', '2026-12-31')
                             .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                             .filter(ee.Filter.eq('instrumentMode', 'IW'))
                             .sort('system:time_start', False))
            s1_img = s1_collection.mosaic()
            
            # 3. Co-registration and Fusion (Stacking Tensors)
            # R = S2 NIR (B8) [Highlights Vegetation]
            # G = S1 VV (Radar) [Highlights Structures / Urban / Metal]
            # B = S2 Green (B3) [Highlights Water / Base]
            fused_img = ee.Image.cat([s2_img.select('B8'), s1_img.select('VV'), s2_img.select('B3')])
            
            vis_params = {
                'bands': ['B8', 'VV', 'B3'],
                'min': [0, -25, 0],
                'max': [3000, 0, 2000],
                'gamma': 1.2
            }
            map_id = fused_img.getMapId(vis_params)
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
