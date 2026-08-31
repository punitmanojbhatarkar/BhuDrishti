"use client";
import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Satellite, Globe2, ChevronRight, ChevronLeft, Layers2, Database, Cpu, Sun, Moon, Waves, Wheat, Building2, Trees, Droplets } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

const MapPanel = dynamic(() => import("@/components/MapPanel"), { ssr: false });

interface SatStats {
  ndvi?: number;
  cloud?: number;
  area?: number;
  sensor?: string;
  module?: string;
}

interface SatData {
  imageUrl?: string | null;
  geeTileUrl?: string | null;
  bbox?: number[] | null;
  centerLat?: number | null;
  centerLon?: number | null;
  module?: string;
}

const NAV_MODULES = [
  { icon: <Waves size={14} />, label: "DisasterWatch", module: "flood" },
  { icon: <Wheat size={14} />, label: "AgroVision",    module: "agri"  },
  { icon: <Building2 size={14} />, label: "UrbanPulse",   module: "urban" },
  { icon: <Trees size={14} />, label: "ForestGuard",  module: "forest"},
  { icon: <Droplets size={14} />, label: "WaterWatch",   module: "water" },
];

const DATA_SOURCES = [
  { name: "ISRO Bhuvan WMS",         icon: <Database size={14} />, status: "Live" },
  { name: "Sentinel-1 SAR (ESA)",     icon: <Satellite size={14} />, status: "Live" },
  { name: "Sentinel-2 Optical (ESA)", icon: <Satellite size={14} />, status: "Live" },
  { name: "AWS Earth Search STAC",    icon: <Database size={14} />, status: "Live" },
  { name: "MS Planetary Computer",    icon: <Globe2 size={14} />, status: "Live" },
  { name: "Google Earth Engine",      icon: <Globe2 size={14} />, status: "Live" },
];

const AI_MODELS = [
  { name: "Gemini 3.7 Flash",  tag: "Vision",   badge: "badge-flood" },
  { name: "EarthDial VLM",     tag: "RS-VQA",   badge: "badge-agri" },
  { name: "SAM2 (Meta)",       tag: "Segment",  badge: "badge-sar" },
  { name: "IndicTrans2",       tag: "Translate",badge: "badge-water" },
  { name: "GEE (NDVI/SAR)",    tag: "Compute",  badge: "badge-forest" },
];

export default function HomePage() {
  const [satData, setSatData]   = useState<SatData>({});
  const [stats, setStats]       = useState<SatStats>({});
  const [chatOpen, setChatOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const handleImageUpdate = useCallback((url: string, bbox?: number[], centerLat?: number, centerLon?: number, module?: string, geeTileUrl?: string) => {
    setSatData({ imageUrl: url, geeTileUrl, bbox, centerLat, centerLon, module });
  }, []);

  const handleStatsUpdate = useCallback((s: SatStats) => {
    setStats(s);
    if (s.module) setActiveModule(s.module);
  }, []);

  const handleDrawComplete = useCallback((geo: any) => {
    setGeojson(geo);
  }, []);

  return (
    <div data-theme={theme} style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", background: "var(--bg-deep)", overflow: "hidden", transition: "background 0.3s ease" }}>

      {/* ── TOP NAVBAR ── */}
      <nav style={{
        height: 48, flexShrink: 0,
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center",
        padding: "0 16px", gap: 12, zIndex: 2000,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 4,
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Satellite size={14} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 14, color: "var(--text-1)" }}>
              BhūDrishti
            </div>
            <div style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: "0.4px" }}>भूदृष्टि · Satellite Intelligence</div>
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: "var(--border)", flexShrink: 0 }} />

        {/* Module Tabs */}
        <div style={{ display: "flex", gap: 4, flex: 1, overflowX: "auto" }}>
          {NAV_MODULES.map(m => (
            <button
              key={m.label}
              onClick={() => setActiveModule(activeModule === m.module ? null : m.module)}
              style={{
                background: activeModule === m.module ? "var(--bg-card)" : "transparent",
                border: `1px solid ${activeModule === m.module ? "var(--border-mid)" : "transparent"}`,
                borderRadius: 4, padding: "4px 11px",
                fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
                color: activeModule === m.module ? "var(--text-1)" : "var(--text-2)",
                transition: "all 0.18s",
                display: "flex", alignItems: "center", gap: 5,
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 500,
              }}
              onMouseEnter={e => { if (activeModule !== m.module) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; }}
              onMouseLeave={e => { if (activeModule !== m.module) (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
            >
              <span>{m.icon}</span> {m.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div className="status-live hide-on-mobile" style={{ borderRadius: 4, background: "transparent", border: "1px solid var(--border)", padding: "4px 9px", fontFamily: "'JetBrains Mono', monospace" }}>
            <span className="status-dot" style={{ background: "var(--accent)" }} />
            <span style={{ fontSize: 10, color: "var(--text-2)", fontWeight: 500 }}>Live APIs</span>
          </div>
          <div className="hide-on-mobile" style={{
            background: "transparent", border: "1px solid var(--border)",
            borderRadius: 4, padding: "4px 9px",
            fontSize: 10, color: "var(--text-3)",
            display: "flex", alignItems: "center", gap: 4, fontFamily: "'JetBrains Mono', monospace"
          }}>
            <Globe2 size={10} color="var(--text-3)" />
            SIH 2026 · PS-26167
          </div>

          {/* Theme toggle */}
          <button
            className="btn-icon"
            style={{ width: 28, height: 28, fontSize: 10 }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          {/* Info panel toggle */}
          <button
            className="btn-icon hide-on-mobile"
            style={{ width: 28, height: 28, fontSize: 10 }}
            onClick={() => setInfoOpen(!infoOpen)}
            title="Data sources & models"
          >
            <Database size={13} />
          </button>

          {/* Chat toggle */}
          <button
            className="btn-primary"
            style={{ padding: "4px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}
            onClick={() => setChatOpen(!chatOpen)}
          >
            <Satellite size={12} />
            {chatOpen ? "Hide" : "Ask Satellite"}
            {chatOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>
      </nav>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Map takes full space */}
        <MapPanel
          imageUrl={satData.imageUrl}
          geeTileUrl={satData.geeTileUrl}
          bbox={satData.bbox}
          centerLat={satData.centerLat}
          centerLon={satData.centerLon}
          module={satData.module || activeModule || undefined}
          stats={stats}
          onDrawComplete={handleDrawComplete}
        />

        {/* ── Floating Chat Panel (right side) ── */}
        {chatOpen && (
          <div className="panel-in chat-panel-container">
            <ChatPanel
              onImageUpdate={handleImageUpdate}
              onStatsUpdate={handleStatsUpdate}
              geojson={geojson}
            />
          </div>
        )}

        {/* ── Floating Info Panel (left side) ── */}
        {infoOpen && (
          <div className="panel-in info-panel-container">
            <div style={{ padding: "14px 14px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
                <Database size={13} color="var(--accent)" />
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif" }}>Data Sources</span>
              </div>
            </div>
            <div style={{ padding: 10, overflowY: "auto", height: "calc(100% - 44px)" }}>
              <div style={{ marginBottom: 8 }}>
                {DATA_SOURCES.map(s => (
                  <div key={s.name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "7px 10px", marginBottom: 4,
                    background: "var(--bg-card)", borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 13 }}>{s.icon}</span>
                      <span style={{ fontSize: 11, color: "var(--text-2)" }}>{s.name}</span>
                    </div>
                    <span style={{ fontSize: 9, color: "var(--accent-green)", fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-green)", display: "inline-block" }} />
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", marginBottom: 7, marginTop: 12, display: "flex", alignItems: "center", gap: 5 }}>
                <Cpu size={10} /> AI MODELS
              </div>
              {AI_MODELS.map(m => (
                <div key={m.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "7px 10px", marginBottom: 4,
                  background: "var(--bg-card)", borderRadius: 8,
                  border: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>{m.name}</span>
                  <span className={`badge ${m.badge}`}>{m.tag}</span>
                </div>
              ))}

              <div style={{ marginTop: 14, padding: "10px", background: "var(--bg-hover)", border: "1px solid var(--border-mid)", borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 10, textAlign: "center", letterSpacing: "1px" }}>DATA PIPELINE</div>
                <div style={{ fontSize: 10, color: "var(--accent)", lineHeight: 1.8, fontFamily: "'JetBrains Mono', monospace" }}>
                  Query → STAC Search → GEE Compute → Gemini Vision → Geo-overlay
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
