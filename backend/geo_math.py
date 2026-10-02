import math

def calculate_view_frustum_polygon(lat: float, lon: float, azimuth: float, distance_m: float = 100.0, fov_degrees: float = 60.0) -> str:
    """
    Calculates a 2D view frustum polygon (a triangle extending from the camera).
    Uses a simple spherical earth approximation. Returns WKT polygon format.
    """
    if lat is None or lon is None or azimuth is None:
        return None
        
    R = 6378137.0 # Earth's radius in meters
    
    # Convert to radians
    lat_rad = math.radians(lat)
    lon_rad = math.radians(lon)
    azimuth_rad = math.radians(azimuth)
    half_fov = math.radians(fov_degrees / 2.0)
    
    left_azimuth = azimuth_rad - half_fov
    right_azimuth = azimuth_rad + half_fov
    
    def get_destination_point(lat_r, lon_r, dist, bearing):
        dest_lat = math.asin(math.sin(lat_r)*math.cos(dist/R) + 
                             math.cos(lat_r)*math.sin(dist/R)*math.cos(bearing))
        dest_lon = lon_r + math.atan2(math.sin(bearing)*math.sin(dist/R)*math.cos(lat_r), 
                                      math.cos(dist/R)-math.sin(lat_r)*math.sin(dest_lat))
        return math.degrees(dest_lat), math.degrees(dest_lon)
        
    left_lat, left_lon = get_destination_point(lat_rad, lon_rad, distance_m, left_azimuth)
    right_lat, right_lon = get_destination_point(lat_rad, lon_rad, distance_m, right_azimuth)
    
    wkt = f"POLYGON(({lon} {lat}, {left_lon} {left_lat}, {right_lon} {right_lat}, {lon} {lat}))"
    return wkt
