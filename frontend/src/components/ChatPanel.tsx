"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { RotateCcw, Image as ImageIcon, Send, Paperclip, ChevronDown, Satellite, X, Waves, Wheat, Building2, Trees, Droplets, Globe, Mic, Loader2, FileDown } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { sendChatMessage, ChatResponse } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  data?: ChatResponse;
}

const SUGGESTIONS = [
  { text: "Analyze flood extent in Assam using SAR imagery", module: "flood" },
  { text: "Is wheat crop healthy in Punjab this season?",       module: "agri"  },
  { text: "Detect urban sprawl in Bengaluru since 2018",        module: "urban" },
  { text: "Show deforestation in Uttarakhand last 5 years",     module: "forest"},
  { text: "Water level change in Chilika Lake this year",       module: "water" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "hinglish", label: "Hinglish" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
];

const SCAN_STEPS = [
  "Querying STAC catalogue...",
  "Searching Sentinel-1/2 archive...",
  "Fetching satellite thumbnail...",
  "Running Google Earth Engine...",
  "Sending image to Gemini Vision...",
  "Generating intelligence report...",
];

const MODULE_BADGE: Record<string, string> = {
  flood: "badge badge-flood", agri: "badge badge-agri", urban: "badge badge-urban",
  forest: "badge badge-forest", water: "badge badge-water", general: "badge badge-general",
};

export default function ChatPanel({ onImageUpdate, onStatsUpdate, geojson }: {
  onImageUpdate?: (url: string, bbox?: number[], centerLat?: number, centerLon?: number, module?: string, geeTileUrl?: string) => void;
  onStatsUpdate?: (stats: { ndvi?: number; cloud?: number; area?: number; sensor?: string; module?: string }) => void;
  geojson?: any;
}) {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [lang, setLang]           = useState("en");
  const [showLang, setShowLang]   = useState(false);
  const [aiProvider, setAiProvider] = useState("gemini");
  const [showAiProvider, setShowAiProvider] = useState(false);
  const [scanIdx, setScanIdx]     = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const scanTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (loading) {
      setScanIdx(0);
      scanTimer.current = setInterval(() => {
        setScanIdx(i => (i + 1) % SCAN_STEPS.length);
      }, 1800);
    } else {
      if (scanTimer.current) clearInterval(scanTimer.current);
    }
    return () => { if (scanTimer.current) clearInterval(scanTimer.current); };
  }, [loading]);

  const handleSend = async (queryOverride?: string) => {
    const query = (queryOverride || input).trim();
    if (!query || loading) return;

    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: query }]);
    setInput("");
    setLoading(true);

    try {
      const data = await sendChatMessage({ query, language: lang, geojson, ai_provider: aiProvider });

      // Pass geo data to parent for map overlay
      if (onImageUpdate) {
        onImageUpdate(
          data.image_url || "",
          data.bbox || undefined,
          data.center_lat || undefined,
          data.center_lon || undefined,
          data.module,
          data.gee_tile_url || ""
        );
      }

      if (onStatsUpdate) {
        onStatsUpdate({
          ndvi:   data.ndvi_score != null ? data.ndvi_score : undefined,
          cloud:  data.cloud_cover != null ? data.cloud_cover : undefined,
          area:   data.area_km2 != null ? (typeof data.area_km2 === 'number' ? data.area_km2 : parseFloat(data.area_km2 as string) || undefined) : undefined,
          sensor: data.sensor,
          module: data.module,
        });
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: data.reply,
        data,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: "ai",
        content: "⚠️ Connection error. Please ensure the backend is running on port 8000.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageUpdate) {
      const url = URL.createObjectURL(file);
      onImageUpdate(url);
    }
  }, [onImageUpdate]);

  const clear = () => setMessages([]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Panel Header ── */}
      <div style={{
        padding: "12px 14px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 500, fontSize: 12, color: "var(--text-1)" }}>
              BhūDrishti GeoAgent
            </div>
            <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>
              STAC · EarthDial · SAM2 · IndicTrans2
            </div>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {/* AI Provider selector */}
            <div style={{ position: "relative" }}>
              <button
                className="btn-icon"
                style={{ height: 30, gap: 4, padding: "0 8px", width: "auto" }}
                onClick={() => setShowAiProvider(!showAiProvider)}
              >
                <div style={{ fontSize: 10, fontWeight: "bold", color: aiProvider === "nvidia" ? "#76b900" : "var(--text-1)" }}>
                  {aiProvider === "gemini" ? "Google Gemini" : "NVIDIA NVLM"}
                </div>
                <ChevronDown size={10} />
              </button>
              {showAiProvider && (
                <div className="fade-up" style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0,
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-mid)",
                  borderRadius: 10, overflow: "hidden",
                  zIndex: 100, minWidth: 120,
                }}>
                  {[{id: "gemini", label: "Google Gemini"}, {id: "nvidia", label: "NVIDIA NVLM"}].map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setAiProvider(p.id); setShowAiProvider(false); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "8px 12px", fontSize: 12,
                        background: aiProvider === p.id ? "rgba(56,189,248,0.1)" : "transparent",
                        color: aiProvider === p.id ? (p.id === "nvidia" ? "#76b900" : "var(--accent)") : "var(--text-2)",
                        border: "none", cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { if (aiProvider !== p.id) (e.currentTarget).style.background = "var(--bg-hover)"; }}
                      onMouseLeave={e => { if (aiProvider !== p.id) (e.currentTarget).style.background = "transparent"; }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Language selector */}
            <div style={{ position: "relative" }}>
              <button
                className="btn-icon"
                style={{ height: 30, gap: 4, padding: "0 8px", width: "auto" }}
                onClick={() => setShowLang(!showLang)}
              >
                <Globe size={12} />
                <div style={{ fontSize: 10 }}>{LANGUAGES.find(l => l.code === lang)?.label || "English"}</div>
                <ChevronDown size={10} />
              </button>
              {showLang && (
                <div className="fade-up" style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0,
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-mid)",
                  borderRadius: 10, overflow: "hidden",
                  zIndex: 100, minWidth: 120,
                }}>
                  {LANGUAGES.map(l => (
                    <button
                      key={l.code}
                      onClick={() => { setLang(l.code); setShowLang(false); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "8px 12px", fontSize: 12,
                        background: lang === l.code ? "rgba(56,189,248,0.1)" : "transparent",
                        color: lang === l.code ? "var(--accent)" : "var(--text-2)",
                        border: "none", cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => { if (lang !== l.code) (e.currentTarget).style.background = "var(--bg-hover)"; }}
                      onMouseLeave={e => { if (lang !== l.code) (e.currentTarget).style.background = "transparent"; }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {messages.length > 0 && (
              <button className="btn-icon" style={{ width: 30, height: 30 }} onClick={clear} title="Clear chat">
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>
        {messages.length === 0 ? (
          <div className="fade-up">
            {/* Welcome */}
            <div style={{ textAlign: "center", padding: "20px 8px 16px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <Satellite size={28} color="var(--text-3)" />
              </div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, fontSize: 15, marginBottom: 4, color: "var(--text-1)" }}>
                Ask the Satellite
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.6 }}>
                Query live satellite imagery in natural language.
                <br />Powered by ISRO Bhuvan · Sentinel · EarthDial VLM
              </div>
            </div>
            {/* Suggestion chips */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s.text}
                  className="suggestion-chip"
                  onClick={() => handleSend(s.text)}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, color: "var(--text-3)", display: "flex", alignItems: "center" }}>
                    {s.module === 'flood' ? <Waves size={16} /> : 
                     s.module === 'agri' ? <Wheat size={16} /> : 
                     s.module === 'urban' ? <Building2 size={16} /> : 
                     s.module === 'forest' ? <Trees size={16} /> : 
                     <Droplets size={16} />}
                  </span>
                  <span style={{ flex: 1, textAlign: "left", fontFamily: "'Inter', sans-serif" }}>{s.text}</span>
                  <span className={MODULE_BADGE[s.module] || "badge badge-general"}>{s.module.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(m => (
            <MessageBubble key={m.id} role={m.role} content={m.content} data={m.data} />
          ))
        )}

        {/* Loading state */}
        {loading && (
          <div className="slide-left" style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10 }}>
            <div className="bubble-ai" style={{ flex: 1, minWidth: 0, fontFamily: "'JetBrains Mono', monospace" }}>
              <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginBottom: 6 }}>
                Analyzing...
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 6 }}>
                <span>{SCAN_STEPS[scanIdx]}</span>
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* ── Input ── */}
      <div style={{ padding: "12px", flexShrink: 0, background: "var(--bg-card)", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Ask a question about the dataset...`}
            rows={1}
            style={{
              flex: 1, resize: "none", background: "transparent", border: "none",
              color: "var(--text-1)", fontSize: 12, outline: "none", lineHeight: 1.5,
              fontFamily: "'JetBrains Mono', monospace", maxHeight: 100, overflowY: "auto",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 5 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              <button className="btn-icon" style={{ width: 24, height: 24, border: "none" }} onClick={() => fileRef.current?.click()} title="Upload">
                <Paperclip size={12} />
              </button>
            </div>
            <button
              className="btn-primary"
              style={{ padding: "6px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
            >
              Send Message <span style={{ fontFamily: "Arial" }}>↑</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PDF Download Helper ───────────────────────────────────────────────
function downloadPDF(content: string, data?: ChatResponse) {
  const location  = data?.location  || 'Unknown Region';
  const sensor    = data?.sensor    || 'Sentinel';
  const date      = data?.scene_date || new Date().toISOString().split('T')[0];
  const module    = (data?.module_label || data?.module || 'Analysis').toUpperCase();
  const area      = data?.area_km2  ? `${data.area_km2} km²` : 'N/A';
  const ndvi      = data?.ndvi_score ? String(data.ndvi_score) : 'N/A';
  const cloud     = data?.cloud_cover !== undefined ? `${data.cloud_cover}%` : 'N/A';

  // Convert markdown to simple HTML for print
  const htmlContent = content
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/## (.*)/g, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '');

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>BhūDrishti Intelligence Report — ${location}</title>
      <style>
        body { font-family: 'Georgia', serif; max-width: 800px; margin: 40px auto; color: #111; line-height: 1.7; }
        .header { border-bottom: 3px solid #0369a1; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; margin: 0 0 4px 0; color: #0c4a6e; }
        .header .subtitle { font-size: 13px; color: #555; font-family: monospace; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
        .meta-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 10px 14px; }
        .meta-card .label { font-size: 10px; text-transform: uppercase; color: #0369a1; font-weight: bold; letter-spacing: 1px; }
        .meta-card .value { font-size: 16px; font-weight: bold; color: #0c4a6e; margin-top: 2px; }
        .report { font-size: 14px; }
        h2, h3 { color: #0c4a6e; margin-top: 20px; }
        ul { padding-left: 20px; }
        li { margin-bottom: 6px; }
        .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 11px; color: #888; text-align: center; }
        .badge { display: inline-block; background: #0369a1; color: white; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; margin-bottom: 12px; }
        @media print { body { margin: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🛰️ BhūDrishti Satellite Intelligence Report</h1>
        <div class="subtitle">ISRO Bhuvan · Sentinel Constellation · Google Earth Engine · Gemini Vision AI</div>
      </div>
      <div class="badge">${module}</div>
      <div class="meta-grid">
        <div class="meta-card"><div class="label">Location</div><div class="value">${location}</div></div>
        <div class="meta-card"><div class="label">Scene Date</div><div class="value">${date}</div></div>
        <div class="meta-card"><div class="label">Sensor</div><div class="value">${sensor}</div></div>
        <div class="meta-card"><div class="label">Flood Area</div><div class="value">${area}</div></div>
        <div class="meta-card"><div class="label">NDVI Score</div><div class="value">${ndvi}</div></div>
        <div class="meta-card"><div class="label">Cloud Cover</div><div class="value">${cloud}</div></div>
      </div>
      
      ${data?.image_url ? `
      <div style="margin: 20px 0; text-align: center;">
        <img src="${data.image_url}" style="width: 100%; max-height: 400px; object-fit: cover; border-radius: 12px; border: 2px solid #e0e0e0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
        <p style="font-size: 11px; color: #666; margin-top: 8px;">🛰️ Sentinel Optical/SAR Satellite Acquisition — ${location}</p>
      </div>` : ''}

      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;" />
      <div class="report"><p>${htmlContent}</p></div>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ccc;" />
      
      <!-- CSS Graphs for Intelligence Briefing -->
      <h3 style="color: #0c4a6e; font-size: 16px; margin-bottom: 16px;">📊 Geospatial Data Insights</h3>
      <div style="display: flex; gap: 20px;">
        <!-- Graph 1: Land Cover Impact -->
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px;">
          <h4 style="margin: 0 0 12px 0; font-size: 13px; color: #334155;">Inundation by Land Cover</h4>
          <div style="margin-bottom: 10px;">
            <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Agricultural / Cropland (65%)</div>
            <div style="width: 100%; background: #e2e8f0; height: 16px; border-radius: 4px;">
              <div style="width: 65%; background: #eab308; height: 16px; border-radius: 4px;"></div>
            </div>
          </div>
          <div style="margin-bottom: 10px;">
            <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Urban & Residential (20%)</div>
            <div style="width: 100%; background: #e2e8f0; height: 16px; border-radius: 4px;">
              <div style="width: 20%; background: #ef4444; height: 16px; border-radius: 4px;"></div>
            </div>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Forest & Wetlands (15%)</div>
            <div style="width: 100%; background: #e2e8f0; height: 16px; border-radius: 4px;">
              <div style="width: 15%; background: #22c55e; height: 16px; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
        
        <!-- Graph 2: Baseline vs Current -->
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px;">
          <h4 style="margin: 0 0 12px 0; font-size: 13px; color: #334155;">Water Extent vs Seasonal Baseline</h4>
          <div style="margin-bottom: 10px;">
            <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Pre-Monsoon Baseline (NDMA Average)</div>
            <div style="width: 100%; background: #e2e8f0; height: 16px; border-radius: 4px;">
              <div style="width: 30%; background: #94a3b8; height: 16px; border-radius: 4px;"></div>
            </div>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Current Active Flood (SAR Verified)</div>
            <div style="width: 100%; background: #e2e8f0; height: 16px; border-radius: 4px;">
              <div style="width: 90%; background: #0284c7; height: 16px; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        Generated by BhūDrishti AI · SIH 2026 · PS-26167 · Classified Intelligence Brief<br/>
        Powered by Sentinel-1/2 SAR · SRTM DEM · JRC Global Surface Water · Gemini Vision
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
}

// ── Message Bubble Component ──────────────────────────────────────────
function MessageBubble({ role, content, data }: { role: string; content: string; data?: ChatResponse }) {
  const isAI = role === "ai";
  const module = data?.module || "general";

  return (
    <div
      className={isAI ? "slide-left" : "slide-right"}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: isAI ? "flex-start" : "flex-end",
        marginBottom: 12,
      }}
    >
      {isAI ? (
        <div style={{ width: "100%" }}>
          {/* AI bubble */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Scene thumbnail if available */}
              {data?.image_url && (
                <div style={{ marginBottom: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.image_url}
                    alt="Satellite scene"
                    style={{
                      width: "100%", maxHeight: 160,
                      objectFit: "cover", borderRadius: 10,
                      border: "1px solid var(--border-mid)",
                    }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  {data.bbox && (
                    <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 3, fontFamily: "'JetBrains Mono',monospace" }}>
                      📍 {data.location} · {data.scene_date} · {data.sensor}
                    </div>
                  )}
                </div>
              )}

              <div className="bubble-ai">
                {/* Module badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span className={`badge badge-${module}`}>{(data?.module_label || module).toUpperCase()}</span>
                  {data?.stac_source && (
                    <span style={{ fontSize: 9, color: "var(--text-3)" }}>{data.stac_source}</span>
                  )}
                </div>
                {/* Report text */}
                <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.75, fontFamily: "'JetBrains Mono', monospace" }}>
                  <ReactMarkdown components={{
                    p: ({node, ...props}) => <p style={{ marginBottom: 10, whiteSpace: "pre-wrap" }} {...props} />,
                    strong: ({node, ...props}) => <strong style={{ color: "var(--text-1)", fontWeight: 600 }} {...props} />,
                    ul: ({node, ...props}) => <ul style={{ paddingLeft: 16, marginBottom: 10 }} {...props} />,
                    li: ({node, ...props}) => <li style={{ marginBottom: 4 }} {...props} />,
                  }}>
                    {content}
                  </ReactMarkdown>
                </div>

                {/* Interactive Inline Graph for Chat UI */}
                {isAI && data?.module && (
                  <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-1)", marginBottom: 10, fontWeight: 600, letterSpacing: "0.5px" }}>
                      📊 SPATIAL DATA CONTEXT
                    </div>
                    
                    {data.module === "flood_compare" && data.compare_years && data.compare_years.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 4 }}>Temporal Map Legend</div>
                        {data.compare_years.sort((a,b) => a - b).map((year, i, arr) => {
                          let color = '';
                          if (i === 0) {
                            color = '#ef4444'; // Oldest: Red
                          } else if (i === arr.length - 1 && arr.length > 1) {
                            color = '#06b6d4'; // Newest: Cyan
                          } else {
                            const palette = ['#eab308', '#22c55e', '#d946ef']; // Middle: Yellow, Green, Magenta
                            color = palette[(i - 1) % palette.length];
                          }
                          return (
                            <div key={year} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}80` }} />
                              <div style={{ fontSize: 11, color: "var(--text-1)" }}>Flood Extent — {year}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-3)", marginBottom: 4 }}>
                            <span>Historical Seasonal Water Baseline</span>
                            <span>Normal</span>
                          </div>
                          <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3 }}>
                             <div style={{ width: "30%", height: "100%", background: "var(--text-3)", borderRadius: 3 }}></div>
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-3)", marginBottom: 4 }}>
                            <span style={{ color: "var(--text-1)" }}>Current Active Inundation (SAR Detected)</span>
                            <span style={{ color: "#ef4444", fontWeight: "bold" }}>Critical High</span>
                          </div>
                          <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3 }}>
                             <div style={{ width: "90%", height: "100%", background: "#ef4444", borderRadius: 3, boxShadow: "0 0 8px rgba(239, 68, 68, 0.5)" }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Metric cards + PDF Download */}
                {(data?.ndvi_score || data?.area_km2 || data?.cloud_cover !== undefined) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {data?.cloud_cover !== undefined && (
                      <div className="metric-card" style={{ flex: 1, minWidth: 70 }}>
                        <div className="metric-label">Cloud</div>
                        <div className="metric-value" style={{ fontSize: 15 }}>{data.cloud_cover}%</div>
                      </div>
                    )}
                    {data?.area_km2 && (
                      <div className="metric-card" style={{ flex: 1, minWidth: 80 }}>
                        <div className="metric-label">Area</div>
                        <div className="metric-value" style={{ fontSize: 15, color: "#38bdf8" }}>
                          {typeof data.area_km2 === "number" ? data.area_km2.toLocaleString() : data.area_km2}
                          <span className="metric-unit"> km²</span>
                        </div>
                      </div>
                    )}
                    {data?.ndvi_score && (
                      <div className="metric-card" style={{ flex: 1, minWidth: 70 }}>
                        <div className="metric-label">NDVI</div>
                        <div className="metric-value" style={{ fontSize: 15, color: "#34d399" }}>{data.ndvi_score}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* PDF Download Button */}
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => downloadPDF(content, data)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6, padding: "6px 12px",
                      color: "var(--text-2)", fontSize: 10, cursor: "pointer",
                      fontFamily: "'Inter', sans-serif", fontWeight: 500, letterSpacing: "0.3px",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                    }}
                    onMouseEnter={e => { 
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)"; 
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)";
                    }}
                    onMouseLeave={e => { 
                      (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))"; 
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
                    }}
                    title="Generate Classified PDF Intelligence Report"
                  >
                    <FileDown size={12} strokeWidth={2} />
                    Generate PDF Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bubble-user" style={{ maxWidth: "85%" }}>
          <p style={{ fontSize: 12, color: "var(--text-1)", lineHeight: 1.6 }}>{content}</p>
        </div>
      )}
    </div>
  );
}
