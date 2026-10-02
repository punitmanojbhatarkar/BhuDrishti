# 🛰️ BhūDrishti (भू-दृष्टि)

**SIH 2026 Winner Submission**
An Enterprise-Grade, Offline-First Geo-Intelligence Platform for Watershed Management, Disaster Tracking, and Precision Agriculture.

![BhūDrishti Dashboard](https://img.shields.io/badge/Status-Production_Ready-success)
![Sentinel Hub](https://img.shields.io/badge/Satellite_Data-Live_Sentinel_2-blue)
![Cesium](https://img.shields.io/badge/3D_Engine-CesiumJS-orange)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)

## 🌟 The Problem We Are Solving
Traditional geospatial analysis requires highly trained GIS analysts, expensive proprietary software (ArcGIS), and hours of manual data ingestion. Field officers lack real-time situational awareness, and there is no unified bridge between **ground-truth field data** and **satellite-based remote sensing**.

## 🚀 Our Solution: BhūDrishti
BhūDrishti is a highly polished, fully functional GeoAgent platform that bridges the gap between field officers and space-borne sensors. It offers:

1. **🌍 Live 3D Satellite Streaming:** Integrated directly with the **European Space Agency's Sentinel Hub**, our 3D Cesium globe natively streams 10-meter resolution Sentinel-2 L2A data. With a single click, users can toggle between True Color, False Color, NDVI (Vegetation), Moisture, and Urban indices. No mockups. 100% real data.
2. **🤖 GeoAgent AI (Ask the Satellite):** A multimodal AI chat interface that understands spatial context. Users can ask natural language questions (e.g., *"What is the flood extent in Assam?"*). The AI fetches bounding boxes, calculates NDVI scores, and grounds its answers on the map.
3. **📸 AR Field Camera & Gamification:** A progressive web app (PWA) field mode for ground officers. Photos taken in the field are stamped with EXIF GPS data, pitch/roll, and instantly ingested into a PostGIS database. Gamification (Leaderboards) incentivizes fast and accurate field reporting.
4. **🧠 Offline-First Computer Vision:** The backend supports YOLOv10 and SAM2 for automatic segmentation of field images, turning photos of crops or floods into actionable data points on the map.

---

## 🛠️ Tech Stack Architecture
- **Frontend:** Next.js 14, React, CesiumJS (3D WebGL Globe), Lucide Icons.
- **Backend:** Python FastAPI, Uvicorn, PostGIS (Geospatial PostgreSQL), Redis (Queueing).
- **Data Pipeline:** TiTiler (Dynamic COG rendering), Sentinel Hub API, STAC Catalog.
- **AI Models:** LLaVA / EarthDial / Gemini Vision for spatial reasoning.

---

## 💻 How to Run Locally (For Judges)

### 1. Start the Backend (FastAPI + PostGIS + Redis)
```bash
docker-compose up -d
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

### 3. Experience the Platform
Open your browser and navigate to: `http://localhost:3000`

---

## 🔥 Key Features for the Pitch
*   **"Zero-Fake-Data Guarantee":** Click on the `NDVI` or `False Color` buttons on the map. It fetches real-time WMS tiles from Sentinel Hub instantly.
*   **Downloadable Intelligence Reports:** The AI chat generates highly classified, beautiful PDF reports based on current satellite scans.
*   **Hash-Chained Audit Trails:** Every AI execution trace is visible to the user, ensuring zero hallucinations and enterprise trust.

## 👥 Contributors
Developed for Smart India Hackathon (SIH) 2026.
