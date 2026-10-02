from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
from db import Base
import uuid
from datetime import datetime

class Watershed(Base):
    __tablename__ = "watersheds"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    region = Column(String)
    total_area_sq_km = Column(Float)
    geom = Column(Geometry('POLYGON', srid=4326), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class FieldImage(Base):
    __tablename__ = "field_images"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    watershed_id = Column(UUID(as_uuid=True), ForeignKey("watersheds.id"))
    uploader_id = Column(String)
    image_url = Column(String, nullable=False)
    capture_timestamp = Column(DateTime(timezone=True))
    
    # EXIF & Spatial Data
    geom = Column(Geometry('POINT', srid=4326), nullable=False)
    azimuth = Column(Float)
    elevation = Column(Float)
    view_frustum = Column(Geometry('POLYGON', srid=4326))
    
    # AI Metadata
    ai_insights = Column(JSON)
    confidence_score = Column(Float)
    
    status = Column(String, default="pending_processing")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
