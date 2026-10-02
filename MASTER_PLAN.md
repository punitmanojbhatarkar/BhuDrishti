# 🚀 PS-15: Watershed Geospatial Intelligence Platform (Master Plan)

**Problem Statement:** Application of Geospatial Techniques for visualization and analysis to interpret Geo-Coded Images to enhance Watershed Development Outcomes.
**Hackathon:** Smart India Hackathon (SIH) 2026
**Target Architecture:** Deep-Tech, Production-Ready WebGIS + AI Vision + Edge Computing Platform.

> **Philosophy:** Every other team will build a "map with photo pins." We are building a **self-aware, geospatially intelligent system** that converts passive photo documentation into active, predictive, policy-generating infrastructure.

---

## 🏆 1. X-FACTOR / NEXT-GEN CAPABILITIES (Tier 1 - The Core Winning Edge)

*   **⚡ Temporal AI Super-Resolution (ESRGAN):** SRISHTI-DRISHTI is 30m resolution. We implement an ESRGAN (Enhanced Super-Resolution GAN) that upscales the 30m satellite data to pseudo-10m, guided by high-res field image textures. **Nobody else will do this.** This directly addresses the PS's core limitation.
*   **🧠 Autonomous Agentic RAG for Policy Generation:** We integrate an Agentic LLM (Llama 3.1 / Gemini) that monitors the PostGIS database 24/7. When NDVI drops 15% near a damaged check dam, the AI autonomously drafts a formatted "Priority Action Report" in English, Hindi, and the local regional language (e.g., Telugu, Marathi) and emails it to the district administrator.
*   **🛰️ 3D IMU View Frustum on DEM Terrain:** Instead of 2D GPS dots, we tap into the mobile device's IMU (Pitch, Yaw, Roll) and project a geometrically accurate 3D frustum onto a SRTM Digital Elevation Model. We calculate the **exact square meters of terrain** in frame, making every field photo quantifiably precise.
*   **📊 Difference-in-Differences (DiD) Econometric Modeling:** We deploy statistical econometric models in Python to mathematically prove the ROI of government intervention by comparing treated vs. untreated control watersheds over multi-year time series. This converts our tool from "interesting visualization" to **proof of government fund effectiveness.**

---

## 🔥 2. EXTENDED REAL-WORLD FEATURES (Tier 2 - Domain Domination)

*   **🌊 Dynamic Hydrological Flow Simulation (DEM + Tobler's Hiking Function):** When a planner drops a pin on the 3D map, the system uses DEM slope data to simulate **water runoff pathways and accumulation basins** in real time using Tobler's Hiking Function & D8 flow algorithm. The output tells the government **exactly where to build the next check dam** for maximum yield.
*   **🛡️ Anti-Tamper Geo-Hashing (Cryptographic Audit Chain):** A pervasive corruption problem in India's field programs is spoofed GPS or recycled photos. At image capture, we compute `SHA-256(pixel_hash + EXIF_GPS + device_IMEI + timestamp)`. If **any single byte** is altered before upload, the backend flags it as "TAMPERED — AUDIT REQUIRED". Provides bulletproof accountability for crore-level government spending.
*   **📱 WhatsApp / Telegram Citizen Science Bot (Zero-Cost Data Multiplication):** We don't rely only on official field workers. Local farmers send photos of dry rivers or broken structures on WhatsApp. Our bot extracts GPS, runs the YOLOv10 model to verify the content, and auto-plots it on the master dashboard as a "Citizen Report" with a confidence score. **Multiplies data collection by 1000x at zero marginal cost.**
*   **☁️ Monsoon-Proof SAR Fusion (Sentinel-1 Integration):** Optical satellites are blind during India's monsoon. We fuse **Sentinel-1 C-band SAR** data into the pipeline alongside SRISHTI-DRISHTI. SAR penetrates clouds and directly measures soil dielectric constant, giving us real-time soil moisture, flood inundation maps, and waterlogging alerts even in a cyclone.
*   **🏆 District Leaderboards & Gamification (For State Ministers):** A purpose-built Ministerial Dashboard that ranks every district/block based on a composite "Watershed Health Score" (NDVI Trend + Water Conservation + Intervention Effectiveness). This **gamifies** watershed management, forcing local administrators to compete publicly. Political pressure becomes a policy enforcement mechanism.

---

## ⚡ 3. ADDITIONAL HIGH-IMPACT FEATURES (Tier 3 - Maximum Overpower)
These features are technically achievable within the hackathon timeline and will make judges' jaws drop.

*   **🌿 Carbon Sequestration Estimator:** Using NDVI time-series data and biomass conversion formulas (FAO standard), we automatically calculate the estimated **tons of CO₂ sequestered** by each watershed's vegetation recovery. This links watershed management to **India's NDC climate commitments**, making this a tool relevant at the COP level — not just the district level.
*   **🌐 Augmented Reality (AR) Field Mode:** Using WebXR in the mobile browser (no app install required), the field worker can point their phone at the landscape. The screen will overlay real-time NDVI vegetation density data, mark the boundary of the watershed polygon, and show where the nearest intervention structure is — all overlaid on the live camera feed.
*   **💧 Predictive Drought & Water Stress Forecasting (LSTM Neural Network):** We train a Long Short-Term Memory (LSTM) neural network on 5 years of NDWI and soil moisture time-series data per watershed. The model predicts water stress levels **4 weeks into the future**, giving administrators early warning to pre-position water tankers or trigger irrigation protocols.
*   **📡 Federated Learning for Privacy-Preserving Training:** Instead of sending raw village-level images to a central server, we implement a federated learning architecture. Each district processes its own data locally. Only the model gradient updates (not the raw images) are sent to the central server. This ensures **data sovereignty** — politically critical for a government-facing platform.
*   **📍 Automated GCP (Ground Control Point) Extraction from Field Photos:** When a field photo contains a known static object (a road marker, a permanent rock formation, a survey pillar — detected by YOLO), the system automatically extracts its GPS position and uses it as a **Ground Control Point (GCP)** to geometrically correct and orthorectify the satellite imagery in that area, improving spatial accuracy beyond the 30m baseline.
*   **🗺️ LULC Auto-Classification (Segment Anything + SAM 2):** We run Meta's SAM 2 model on the 30m satellite data. Every pixel in the watershed is automatically classified into a thematic category: `[Water Body, Degraded Land, Agricultural Land, Dense Forest, Scrubland, Built-Up Area, Bare Soil]`. This directly fulfills the PS requirement for automated **LULC (Land Use / Land Cover) thematic maps** — done with zero manual GIS digitization.
*   **🌙 Nighttime Light Pollution Overlay (VIIRS DNB Integration):** We integrate NASA's VIIRS Day-Night Band (DNB) data. Overlaying nighttime light data on the watershed map shows correlations between increasing light pollution (urban expansion) and shrinking vegetation cover. This is a novel, visually stunning layer that no other project will have and directly proves urban encroachment impact on watersheds.
*   **📥 Plug-and-Play QGIS Plugin Export:** Instead of forcing all administrators to use our web platform, we will generate a one-click export that creates a fully functional **QGIS Plugin package**. This allows any district-level GIS officer with existing QGIS software to immediately use our AI-computed thematic layers, ensuring maximum real-world adoption without retraining.

---

## 🎯 4. USP SUMMARY TABLE

| # | Feature | Solves Which Real Problem | Difficulty (1-5) | Wow Factor (1-5) |
|---|---|---|---|---|
| 1 | ESRGAN Super-Resolution | 30m resolution is too coarse for micro-structures | 5 | 5 |
| 2 | Agentic LLM Policy Reports | Zero actionable output in existing systems | 4 | 5 |
| 3 | 3D IMU View Frustum | GPS points are inaccurate at 5-15m margin | 4 | 5 |
| 4 | DiD Econometric ROI | Govt can't prove its investment worked | 4 | 4 |
| 5 | SAR Cloud Penetration | Optical satellites blind in monsoon | 3 | 4 |
| 6 | Anti-Tamper Hashing | Corruption / faked field reports | 3 | 4 |
| 7 | Carbon Sequestration Calc | No link to India's climate commitments | 2 | 5 |
| 8 | AR Field Mode (WebXR) | No real-time field guidance for workers | 4 | 5 |
| 9 | LSTM Drought Forecasting | Reactive management vs. proactive planning | 4 | 5 |
| 10 | Federated Learning | Data sovereignty and privacy for villages | 5 | 4 |
| 11 | Auto-GCP Extraction | Satellite imagery geometrically inaccurate | 4 | 4 |
| 12 | SAM 2 LULC Auto-Classification | Manual GIS digitization is slow and expensive | 3 | 5 |
| 13 | VIIRS Nighttime Light Overlay | Novel layer proving urban encroachment | 2 | 5 |
| 14 | Hydrological Flow (D8 Algo) | Guesswork for check dam placement | 3 | 5 |
| 15 | WhatsApp Citizen Bot | Official field workers cover <1% of area | 2 | 4 |
| 16 | District Gamification | No accountability mechanism for admins | 2 | 4 |
| 17 | QGIS Plugin Export | Web-only platforms get abandoned by GIS officers | 2 | 4 |

---

## 📖 5. Official Problem Context & Requirements

### Background
Watershed development plays a vital role in sustainable management of land, water, and natural resources, particularly in rural and semi-arid regions of India. Effective watershed planning and monitoring require accurate spatial information on land use, drainage patterns, vegetation cover, soil moisture, water bodies, and changes occurring over time. Traditional monitoring approaches often rely on field surveys and manual reporting, which are time-consuming, resource-intensive, and limited in spatial coverage.

### Scope of the Study (PS Constraints We Must Fulfill 100%)

| Aspect | Scope | How We Fulfill It |
| :--- | :--- | :--- |
| **Primary Focus** | Visualization and interpretation of geo-coded images | 3D WebGIS with View Frustum + AI Vision Tagging |
| **Main Objective** | Analyse and visualize for improved watershed monitoring | SAM 2 LULC + Temporal Slider + Thematic Maps |
| **Data Sources** | 30m SRISHTI-DRISHTI + Geo-coded images | TiTiler COG Streaming + YOLO Field Image Analysis |
| **Major Techniques** | Thematic mapping, GIS interpretation, RS analysis | NDVI/NDWI Raster Math + PostGIS Spatial Queries |
| **Use of SRISHTI-DRISHTI** | Centralized satellite data source | Direct COG ingestion pipeline for all SRISHTI data |
| **Expected Outputs** | LULC maps, drainage maps, vegetation maps, change detection | Auto-generated by SAM 2 + NDVI/NDWI + DiD model |
| **Beneficiaries** | Planners, govt agencies, researchers, public | Multi-role dashboard: Admin / Field Worker / Minister / Citizen |
| **Scalable Framework** | Replicable across different regions | Docker + COG architecture is region-agnostic by design |

---

## 💎 6. Base Technical USPs (Foundation Layer)
1.  **Mathematical Point-to-Pixel Ground Truthing:** Spatially join high-res field data with 30m SRISHTI-DRISHTI pixels to validate satellite data using field-sourced ground truth.
2.  **Zero-Shot AI Vision Extraction (YOLOv10 + SAM 2):** Fulfills requirement *(b)*. Photos become structured database records with intervention types, confidence scores, and vegetation percentages.
3.  **On-the-Fly COG Streaming (TiTiler):** Fulfills requirement *(g)*. Zero pre-rendering. Infinite scalability. Byte-range reads directly from S3.
4.  **Split-Screen Temporal Change Detection:** Fulfills requirement *(c)*. WebGIS timeline slider comparing NDVI/NDWI raster states before and after interventions.

---

## ✅ 7. Current Status (What is Done)

*   [x] **System Architecture Defined:** Next.js 14 (Frontend), FastAPI (Backend), PostGIS (DB), YOLOv10 + SAM 2 (AI) stack locked.
*   [x] **Infrastructure Scaffolding:** `docker-compose.yml` created with PostGIS, TiTiler, and Redis.
*   [x] **Database Schema Initialized:** `database/schema.sql` written with PostGIS GiST indexes, JSONB AI columns, 3D frustum geometry, and satellite layer metadata tables.
*   [x] **Backend Entrypoint:** `backend/main.py` created for async file upload and AI worker orchestration.

---

## 🚧 8. Development Roadmap (All Phases)

### Phase 1: AI & Data Ingestion Pipeline → *Fulfills Solution (b)*
*   [ ] EXIF & IMU Extraction Module (Python: `exifread`, `Pillow`)
*   [ ] Anti-Tamper SHA-256 Geo-Hash on upload
*   [ ] 3D View Frustum calculation using PostGIS `ST_Project` + SRTM DEM
*   [ ] Celery Worker: YOLOv10 object detection for intervention tagging
*   [ ] Celery Worker: SAM 2 for pixel-level LULC segmentation on satellite data
*   [ ] WhatsApp/Telegram webhook ingestion endpoint

### Phase 2: Geospatial API Layer → *Fulfills Solutions (a) & (g)*
*   [ ] ESRGAN upscaler + COG converter pipeline (`gdal`, `rasterio`)
*   [ ] TiTiler proxy routes for NDVI, NDWI, SAR, and LULC layers
*   [ ] LSTM time-series model training on historical NDWI data
*   [ ] Drought forecast API endpoint
*   [ ] Agentic LLM report generation endpoint (multilingual)
*   [ ] Carbon sequestration calculation API

### Phase 3: WebGIS Frontend → *Fulfills Solutions (c), (d), (e), (f)*
*   [ ] Next.js 14 PWA scaffold (Offline-first)
*   [ ] Deck.gl 3D terrain map with DEM
*   [ ] Temporal NDVI/NDWI slider with split-screen compare
*   [ ] Interactive geo-pins with 3D View Frustum rendering on click
*   [ ] WebXR AR Field Mode (mobile browser overlay)
*   [ ] Hydrological flow simulation layer
*   [ ] VIIRS nighttime light overlay
*   [ ] District Leaderboard / Gamified Minister Dashboard
*   [ ] Econometric ROI (DiD) charts (Recharts/Chart.js)
*   [ ] QGIS Plugin package export button

---

## 🛠️ 9. Final Technical Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router, PWA), Deck.gl (WebGL 3D), Mapbox GL JS, Zustand, Recharts |
| **Backend** | Python 3.12, FastAPI, Celery + Redis |
| **Spatial Math** | Rasterio, Shapely, GDAL, NumPy |
| **AI Vision** | YOLOv10, SAM 2, ESRGAN, OpenCV |
| **Forecasting** | TensorFlow/Keras LSTM, Scikit-learn (DiD) |
| **LLM / Agents** | Llama 3.1 (local) / Gemini API (cloud) |
| **Spatial DB** | PostgreSQL 15 + PostGIS 3.3 |
| **Tile Serving** | TiTiler (Cloud Optimized GeoTIFF streaming) |
| **Object Storage** | MinIO (self-hosted S3) or AWS S3 |
| **Bots** | Telegram Bot API, Meta WhatsApp Cloud API |
| **AR** | WebXR Device API (browser-native, no app install) |
| **Satellite Data** | SRISHTI-DRISHTI (30m optical), Sentinel-1 SAR, SRTM DEM, VIIRS DNB |
