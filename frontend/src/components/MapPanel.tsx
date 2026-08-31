"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { Layers, ZoomIn, ZoomOut, Pencil, RotateCcw, Eye, Image as ImageIcon, CloudRain } from "lucide-react";

interface MapPanelProps {
  imageUrl?: string | null;       
  geeTileUrl?: string | null;     
  bbox?: number[] | null;         
  centerLat?: number | null;
  centerLon?: number | null;
  module?: string;
  stats?: { ndvi?: number; cloud?: number; area?: number; sensor?: string; module?: string };
  onDrawComplete?: (geojson: any | null) => void;
}

const INDIA_CENTER: [number, number] = [22.5, 82.0];

type LayerMode = "satellite" | "optical" | "sar";

const MODULE_COLORS: Record<string, string> = {
  flood:   "#38bdf8",
  agri:    "#34d399",
  urban:   "#fbbf24",
  forest:  "#22c55e",
  water:   "#22d3ee",
  general: "#a78bfa",
};

export default function MapPanel({ imageUrl, geeTileUrl, bbox, centerLat, centerLon, module, stats, onDrawComplete }: MapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const overlayRef = useRef<any>(null);
  const baseLayerRef = useRef<any>(null);
  const weatherLayerRef = useRef<any>(null);
  const drawEntityRef = useRef<any>(null);
  const drawHandlerRef = useRef<any>(null);

  const [activeLayer, setActiveLayer] = useState<LayerMode>("satellite");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [showLayers, setShowLayers] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [cesiumReady, setCesiumReady] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<any[]>([]);

  useEffect(() => {
    const checkCesium = setInterval(() => {
      if (typeof window !== 'undefined' && (window as any).Cesium) {
        setCesiumReady(true);
        clearInterval(checkCesium);
      }
    }, 100);
    return () => clearInterval(checkCesium);
  }, []);

  useEffect(() => {
    if (!cesiumReady || !mapContainerRef.current || viewerRef.current) return;
    
    const Cesium = (window as any).Cesium;
    Cesium.Ion.defaultAccessToken = "";

    const arcGisProvider = new Cesium.UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maximumLevel: 18
    });

    const viewer = new Cesium.Viewer(mapContainerRef.current, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      baseLayer: new Cesium.ImageryLayer(arcGisProvider)
    });
    
    // Enable completely free, high-quality 3D terrain via ArcGIS Terrain3D
    Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
      "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
    ).then((provider: any) => {
      if (viewerRef.current) {
        viewerRef.current.terrainProvider = provider;
        viewerRef.current.scene.globe.depthTestAgainstTerrain = true;
      }
    }).catch((err: any) => {
      console.error("Failed to load ArcGIS 3D Terrain", err);
    });
    
    // Disable strict lighting so the map doesn't go pitch black at night
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showWaterEffect = true;
    
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.hueShift = -0.05;
    }
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0001;
    viewer.cesiumWidget.creditContainer.style.display = "none";

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(INDIA_CENTER[1], INDIA_CENTER[0], 5000000.0)
    });

    baseLayerRef.current = viewer.scene.imageryLayers.get(0);
    viewerRef.current = viewer;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lat = parseFloat(Cesium.Math.toDegrees(cartographic.latitude).toFixed(4));
        const lng = parseFloat(Cesium.Math.toDegrees(cartographic.longitude).toFixed(4));
        
        // Directly update the DOM instead of causing React state re-renders 60 times a second
        const coordsEl = document.getElementById("coords-display");
        if (coordsEl) {
          coordsEl.innerText = `${lat}°N ${lng}°E`;
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
  }, [cesiumReady]);

  useEffect(() => {
    if (!viewerRef.current || !cesiumReady) return;
    const Cesium = (window as any).Cesium;
    const viewer = viewerRef.current;

    const applyLayer = (provider: any) => {
      const layers = viewer.scene.imageryLayers;
      if (baseLayerRef.current) {
        layers.remove(baseLayerRef.current);
      }
      baseLayerRef.current = layers.addImageryProvider(provider, 0);
    };

    if (activeLayer === "satellite") {
      applyLayer(new Cesium.UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 18
      }));
    } else {
      fetch(`http://localhost:8000/api/basemap?layer_type=${activeLayer}`)
        .then(res => res.json())
        .then(data => {
          if (data.url) {
            applyLayer(new Cesium.UrlTemplateImageryProvider({
              url: data.url,
              maximumLevel: 18
            }));
          }
        })
        .catch(console.error);
    }
  }, [activeLayer, cesiumReady]);

  useEffect(() => {
    if (!viewerRef.current || !cesiumReady) return;
    const Cesium = (window as any).Cesium;
    const viewer = viewerRef.current;

    if (showWeather) {
      fetch("https://api.rainviewer.com/public/weather-maps.json")
        .then(res => res.json())
        .then(data => {
          if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
            const latestTime = data.radar.past[data.radar.past.length - 1].time;
            const weatherProvider = new Cesium.UrlTemplateImageryProvider({
              url: `https://tilecache.rainviewer.com/v2/radar/${latestTime}/256/{z}/{x}/{y}/2/1_1.png`,
              maximumLevel: 12
            });
            weatherLayerRef.current = viewer.scene.imageryLayers.addImageryProvider(weatherProvider);
            weatherLayerRef.current.alpha = 0.65;
          }
        })
        .catch(console.error);
    } else {
      if (weatherLayerRef.current) {
        viewer.scene.imageryLayers.remove(weatherLayerRef.current);
        weatherLayerRef.current = null;
      }
    }
  }, [showWeather, cesiumReady]);

  // Effect to fly to the bounding box
  useEffect(() => {
    if (!viewerRef.current || !cesiumReady || !bbox) return;
    const Cesium = (window as any).Cesium;
    const viewer = viewerRef.current;
    
    const [minLon, minLat, maxLon, maxLat] = bbox;
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
      duration: 1.5
    });
  }, [bbox, cesiumReady]);

  // Effect to apply the GEE Tile overlay (if available)
  useEffect(() => {
    if (!viewerRef.current || !cesiumReady || !geeTileUrl) return;
    const Cesium = (window as any).Cesium;
    const viewer = viewerRef.current;

    if (overlayRef.current) {
      viewer.scene.imageryLayers.remove(overlayRef.current);
      overlayRef.current = null;
    }

    const provider = new Cesium.UrlTemplateImageryProvider({
      url: geeTileUrl,
      maximumLevel: 18
    });

    overlayRef.current = viewer.scene.imageryLayers.addImageryProvider(provider);
    overlayRef.current.alpha = overlayVisible ? 0.85 : 0.0;
  }, [geeTileUrl, cesiumReady, overlayVisible]);

  const toggleOverlay = useCallback(() => {
    if (overlayRef.current) {
      overlayRef.current.alpha = overlayVisible ? 0.0 : 0.85;
      setOverlayVisible(!overlayVisible);
    }
  }, [overlayVisible]);

  const toggleDraw = useCallback(() => {
    if (!viewerRef.current || !cesiumReady) return;
    const Cesium = (window as any).Cesium;
    const viewer = viewerRef.current;

    if (!drawMode) {
      setDrawMode(true);
      const points: any[] = [];
      const drawHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      drawHandlerRef.current = drawHandler;

      drawHandler.setInputAction((click: any) => {
        const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
        if (cartesian) {
          points.push(cartesian);
          
          if (!drawEntityRef.current) {
            drawEntityRef.current = viewer.entities.add({
              polygon: {
                hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(points), false),
                material: Cesium.Color.fromCssColorString(MODULE_COLORS[module || "general"] || "#38bdf8").withAlpha(0.3),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString(MODULE_COLORS[module || "general"] || "#38bdf8")
              }
            });
          }
          setDrawnPoints([...points]);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    } else {
      setDrawMode(false);
      if (drawHandlerRef.current) {
        drawHandlerRef.current.destroy();
        drawHandlerRef.current = null;
      }
      
      if (drawnPoints.length > 2) {
        const coordsList = drawnPoints.map(pt => {
          const carto = Cesium.Cartographic.fromCartesian(pt);
          return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude)];
        });
        coordsList.push(coordsList[0]);

        const geojson = {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [coordsList]
          }
        };
        if (onDrawComplete) onDrawComplete(geojson);
      } else {
        if (drawEntityRef.current) {
          viewer.entities.remove(drawEntityRef.current);
          drawEntityRef.current = null;
        }
        if (onDrawComplete) onDrawComplete(null);
      }
    }
  }, [drawMode, cesiumReady, drawnPoints, module, onDrawComplete]);

  const resetMap = useCallback(() => {
    if (viewerRef.current && drawEntityRef.current) {
      viewerRef.current.entities.remove(drawEntityRef.current);
      drawEntityRef.current = null;
    }
    if (drawHandlerRef.current) {
      drawHandlerRef.current.destroy();
      drawHandlerRef.current = null;
    }
    setDrawMode(false);
    setDrawnPoints([]);
    if (onDrawComplete) onDrawComplete(null);
  }, [onDrawComplete]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />

      {!cesiumReady && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-2)", background: "rgba(0,0,0,0.8)", zIndex: 1000 }}>
          Initializing 3D Globe...
        </div>
      )}

      {/* --- Zoom Controls (Bottom Left, next to layers) --- */}
      <div style={{
        position: "absolute", bottom: 40, left: 60, zIndex: 10,
        display: "flex", alignItems: "center", background: "var(--bg-panel)", 
        borderRadius: 20, border: "1px solid var(--border-mid)", 
        backdropFilter: "blur(16px)", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
        pointerEvents: "all"
      }}>
        <button 
          title="Zoom Out" 
          style={{ background: "transparent", border: "none", color: "var(--text-1)", padding: "6px 14px", fontSize: 20, cursor: "pointer", transition: "0.2s" }}
          onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
          onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
          onClick={() => {
            const Cesium = (window as any).Cesium;
            const cam = viewerRef.current?.camera;
            if (cam && Cesium) {
              const carto = Cesium.Cartographic.fromCartesian(cam.position);
              carto.height = Math.min(carto.height * 2.0, 20000000);
              cam.flyTo({ destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height), duration: 0.5 });
            }
          }}
        >−</button>
        <div style={{ width: 1, height: 20, background: "var(--border-mid)" }} />
        <button 
          title="Zoom In" 
          style={{ background: "transparent", border: "none", color: "var(--text-1)", padding: "6px 14px", fontSize: 20, cursor: "pointer", transition: "0.2s" }}
          onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
          onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
          onClick={() => {
            const Cesium = (window as any).Cesium;
            const cam = viewerRef.current?.camera;
            if (cam && Cesium) {
              const carto = Cesium.Cartographic.fromCartesian(cam.position);
              carto.height = Math.max(carto.height * 0.5, 100);
              cam.flyTo({ destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height), duration: 0.5 });
            }
          }}
        >+</button>
      </div>

      <div style={{ position: "absolute", top: 16, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none", zIndex: 10 }}>
        <div style={{
          display: "flex", gap: 4,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-mid)",
          borderRadius: 10, padding: "5px 7px",
          backdropFilter: "blur(16px)",
          pointerEvents: "all",
        }}>
          {[
            { label: "True Color", key: "TC" },
            { label: "False Color", key: "FC" },
            { label: "NDVI", key: "NDVI" },
            { label: "SAR VV", key: "SAR" },
            { label: "Urban", key: "URB" },
          ].map((tab) => (
            <button key={tab.key} className={`asset-tab ${tab.key === (module === "flood" ? "SAR" : module === "agri" ? "NDVI" : "TC") ? "active" : ""}`}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-3)" }} />
              {tab.label}
            </button>
          ))}
        </div>

        {stats && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, pointerEvents: "all" }}>
            {stats.cloud !== undefined && (
              <div className="stat-card">
                <div className="stat-label">CLOUD %</div>
                <div className="stat-value">{stats.cloud}%</div>
              </div>
            )}
            {stats.area !== undefined && (
              <div className="stat-card" style={{ borderColor: MODULE_COLORS.flood }}>
                <div className="stat-label">AREA KM²</div>
                <div className="stat-value" style={{ color: MODULE_COLORS.flood }}>
                  {stats.area.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            {stats.ndvi !== undefined && (
              <div className="stat-card" style={{ borderColor: MODULE_COLORS.agri }}>
                <div className="stat-label">AVG NDVI</div>
                <div className="stat-value" style={{ color: MODULE_COLORS.agri }}>
                  {stats.ndvi.toFixed(3)}
                </div>
              </div>
            )}
            {stats.sensor && (
              <div className="stat-card">
                <div className="stat-label">SENSOR</div>
                <div className="stat-value" style={{ fontSize: 13, color: "var(--text-2)" }}>{stats.sensor}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 40, left: 12, zIndex: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <button className={`map-tool ${showWeather ? "active" : ""}`} onClick={() => setShowWeather(!showWeather)} title="Live Weather Radar" style={{ borderRadius: "50%", padding: 10, color: showWeather ? "#38bdf8" : undefined }}>
          <CloudRain size={18} />
        </button>
        <button className={`map-tool ${showLayers ? "active" : ""}`} onClick={() => setShowLayers(!showLayers)} title="Basemap settings" style={{ borderRadius: "50%", padding: 10 }}>
          <Layers size={18} />
        </button>
        
        {showLayers && (
          <div className="fade-up" style={{
            position: "absolute", bottom: 0, left: 45,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-mid)",
            borderRadius: 8, padding: 8, width: 220,
            backdropFilter: "blur(16px)",
            display: "flex", flexDirection: "column", gap: 4
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", padding: "4px 8px", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Basemap Type</div>
            {[
              { id: "satellite", icon: <ImageIcon size={16} />, label: "Map (Standard)" },
              { id: "optical", icon: <ImageIcon size={16} />, label: "Optical (Sentinel-2)" },
              { id: "sar", icon: <Layers size={16} />, label: "SAR (Sentinel-1 VV)" }
            ].map(layer => (
              <button
                key={layer.id}
                onClick={() => { setActiveLayer(layer.id as LayerMode); setShowLayers(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  background: activeLayer === layer.id ? "var(--bg-hover)" : "transparent",
                  color: activeLayer === layer.id ? "var(--text-1)" : "var(--text-2)",
                  border: "none", borderRadius: 6, cursor: "pointer",
                  textAlign: "left", fontSize: 13, transition: "all 0.2s"
                }}
              >
                {layer.icon}
                <span style={{ fontWeight: activeLayer === layer.id ? 500 : 400 }}>{layer.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: 8, zIndex: 10
      }}>
        <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-panel)", borderRadius: 8, border: "1px solid var(--border-mid)", backdropFilter: "blur(16px)", overflow: "hidden" }}>
          <button className={`map-tool ${drawMode ? "active" : ""}`} onClick={toggleDraw} title={drawMode ? "Finish Drawing" : "Draw Region"}>
            <Pencil size={18} />
          </button>
          {drawEntityRef.current && (
            <>
              <div style={{ height: 1, background: "var(--border-mid)" }} />
              <button className="map-tool" onClick={resetMap} title="Reset Region">
                <RotateCcw size={18} />
              </button>
            </>
          )}
        </div>

        {geeTileUrl && (
          <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-panel)", borderRadius: 8, border: "1px solid var(--border-mid)", backdropFilter: "blur(16px)", overflow: "hidden", marginTop: 8 }}>
             <button className={`map-tool ${overlayVisible ? "active" : ""}`} onClick={toggleOverlay} title="Toggle Analysis Overlay">
              <Eye size={18} />
            </button>
          </div>
        )}
      </div>

      <div style={{
        position: "absolute", bottom: 8, left: 12, zIndex: 10,
        fontSize: 10, color: "var(--text-3)", fontFamily: "monospace", display: "flex", gap: 16
      }}>
        <span id="coords-display">Tracking...</span>
        <span>EPSG:4326 · WGS84</span>
      </div>
    </div>
  );
}