-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Watershed Boundaries
CREATE TABLE watersheds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    region VARCHAR(255),
    total_area_sq_km DECIMAL,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_watersheds_geom ON watersheds USING GIST (geom);

-- 2. Field Images (Geo-coded)
CREATE TABLE field_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watershed_id UUID REFERENCES watersheds(id),
    uploader_id VARCHAR(255),
    image_url TEXT NOT NULL,
    capture_timestamp TIMESTAMP WITH TIME ZONE,
    
    -- EXIF & Spatial Data
    geom GEOMETRY(Point, 4326) NOT NULL,
    azimuth DECIMAL, -- Compass bearing (0-360)
    elevation DECIMAL, -- Altitude from GPS
    view_frustum GEOMETRY(Polygon, 4326), -- Calculated polygon of what the camera sees
    
    -- AI Extraction Metadata (JSONB for flexibility with different models)
    ai_insights JSONB,
    confidence_score DECIMAL(3,2), -- Overall AI confidence (0.00 to 1.00)
    
    -- Anti-Tamper Audit Trail
    tamper_hash VARCHAR(64), -- SHA-256 hash
    pixel_hash VARCHAR(64), -- SHA-256 hash
    device_imei VARCHAR(255),
    
    status VARCHAR(50) DEFAULT 'pending_processing',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_field_images_geom ON field_images USING GIST (geom);
CREATE INDEX idx_field_images_ai ON field_images USING GIN (ai_insights);

-- 3. Satellite Data Layers (Metadata for TiTiler/S3)
CREATE TABLE satellite_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watershed_id UUID REFERENCES watersheds(id),
    layer_type VARCHAR(50), -- e.g., 'NDVI', 'NDWI', 'LULC'
    acquisition_date DATE NOT NULL,
    s3_cog_url TEXT NOT NULL, -- Cloud Optimized GeoTIFF URL
    resolution_meters INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
