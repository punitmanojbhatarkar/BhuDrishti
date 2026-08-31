import ee
import os

import json

# Initialize Earth Engine with the service account
try:
    with open('gee_key.json', 'r') as f:
        key_data = json.load(f)
        client_email = key_data.get('client_email')
        
    credentials = ee.ServiceAccountCredentials(
        client_email, 
        'gee_key.json'
    )
    ee.Initialize(credentials)
    print("Earth Engine Initialized Successfully!")
except FileNotFoundError:
    print("Earth Engine init failed: gee_key.json not found in backend folder.")
except Exception as e:
    print(f"Earth Engine init failed: {e}")

def calculate_real_ndvi(bbox, geojson=None):
    """
    Calculates the mean NDVI for the latest cloud-free Sentinel-2 image in the bbox or geojson region.
    bbox format: [min_lon, min_lat, max_lon, max_lat]
    """
    try:
        if geojson:
            geometry = ee.Geometry(geojson['geometry'])
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
        mean_ndvi = ndvi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=geometry,
            scale=10,
            maxPixels=1e13
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
        if geojson:
            geometry = ee.Geometry(geojson['geometry'])
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
            
        # Very basic water thresholding on VV polarization (water is dark in SAR)
        vv = image.select('VV')
        water = vv.lt(-16).rename('water') # Threshold -16 dB
        
        # Calculate area
        area_image = water.multiply(ee.Image.pixelArea())
        water_area_sq_m = area_image.reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=geometry,
            scale=10,
            maxPixels=1e13
        ).get('water').getInfo()
        
        if water_area_sq_m is None:
            return None
            
        area_sq_km = float(water_area_sq_m) / 1e6
        return round(area_sq_km, 2)
    except Exception as e:
        print(f"GEE Water Area Error: {e}")
        return None

def get_gee_map_tile(module: str, bbox: list, geojson=None) -> str:
    """
    Returns a dynamic GEE Map Tile URL for the specified analysis module.
    """
    try:
        if geojson:
            geometry = ee.Geometry(geojson['geometry'])
        else:
            geometry = ee.Geometry.Rectangle(bbox)

        if module == "flood" or module == "water":
            # SAR Water Mask
            collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                          .filterBounds(geometry)
                          .filterDate('2024-06-01', '2024-09-30')
                          .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                          .filter(ee.Filter.eq('instrumentMode', 'IW'))
                          .sort('system:time_start', False))
            image = collection.mosaic()
            
            # Water mask (VV < -16 dB)
            water = image.select('VV').lt(-16).selfMask()
            
            # Create a visualization mapping
            map_id = water.getMapId({'min': 1, 'max': 1, 'palette': ['00FFFF']})
            return map_id['tile_fetcher'].url_format
            
        elif module == "agri" or module == "forest":
            # NDVI Heatmap
            collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                          .filterBounds(geometry)
                          .filterDate('2024-06-01', '2024-09-30')
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
