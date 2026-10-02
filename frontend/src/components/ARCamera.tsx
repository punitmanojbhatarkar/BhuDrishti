"use client";
import { useState, useEffect } from "react";
import { Camera, Compass, Navigation, X, Target, Zap, Layers2 } from "lucide-react";

interface ARCameraProps {
  onClose: () => void;
  onCapture: () => void;
}

export default function ARCamera({ onClose, onCapture }: ARCameraProps) {
  const [pitch, setPitch] = useState(0);
  const [yaw, setYaw] = useState(0);
  const [aligned, setAligned] = useState(false);

  // Simulate gyro sensors for the AR interface
  useEffect(() => {
    const interval = setInterval(() => {
      const newPitch = Math.sin(Date.now() / 1000) * 15;
      const newYaw = Math.cos(Date.now() / 1500) * 20;
      setPitch(newPitch);
      setYaw(newYaw);
      
      // If camera is relatively steady and level, show "ALIGNED"
      if (Math.abs(newPitch) < 5 && Math.abs(newYaw) < 5) {
        setAligned(true);
      } else {
        setAligned(false);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "#000", zIndex: 9999,
      display: "flex", flexDirection: "column", overflow: "hidden"
    }}>
      {/* Fake Camera Feed Background */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80')",
        backgroundSize: "cover", backgroundPosition: "center",
        filter: "brightness(0.7)", zIndex: 1
      }} />

      {/* AR HUD Overlay */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2, pointerEvents: "none" }}>
        
        {/* Crosshairs & Alignment */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: `translate(-50%, -50%) translate(${yaw}px, ${pitch}px)`,
          transition: "transform 0.1s linear"
        }}>
          <Target size={64} color={aligned ? "#22c55e" : "rgba(255,255,255,0.5)"} strokeWidth={1} />
        </div>

        {/* Center fixed crosshair */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <div style={{ width: 4, height: 4, background: "#fff", borderRadius: "50%" }} />
        </div>

        {/* Pitch Ladder */}
        <div style={{ position: "absolute", top: "20%", bottom: "20%", left: "50%", transform: "translateX(-50%)", width: 140, borderLeft: "1px solid rgba(255,255,255,0.2)", borderRight: "1px solid rgba(255,255,255,0.2)" }} />

        {/* Compass / Azimuth */}
        <div style={{
          position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(0,0,0,0.5)", padding: "6px 16px", borderRadius: 20,
          backdropFilter: "blur(10px)", color: "#fff", fontFamily: "monospace"
        }}>
          <Compass size={14} color="#38bdf8" />
          AZIMUTH: {(180 + yaw).toFixed(1)}°
        </div>

        {/* Status Indicators */}
        <div style={{ position: "absolute", top: 100, left: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ color: "#fff", fontFamily: "monospace", fontSize: 11, background: "rgba(0,0,0,0.4)", padding: "4px 8px", borderRadius: 4 }}>
            GPS: 3D FIX (±2m)
          </div>
          <div style={{ color: aligned ? "#22c55e" : "#f59e0b", fontFamily: "monospace", fontSize: 11, background: "rgba(0,0,0,0.4)", padding: "4px 8px", borderRadius: 4 }}>
            TILT: {pitch.toFixed(1)}° {aligned ? "OPTIMAL" : "LEVEL DEVICE"}
          </div>
        </div>

        {/* AI Overlay Box (Simulated) */}
        <div style={{
          position: "absolute", top: "40%", left: "30%", width: 120, height: 80,
          border: "1px dashed rgba(56, 189, 248, 0.8)", background: "rgba(56, 189, 248, 0.1)",
          display: "flex", alignItems: "flex-end", padding: 4
        }}>
          <span style={{ fontSize: 10, color: "#38bdf8", fontFamily: "monospace", background: "rgba(0,0,0,0.5)", padding: "2px 4px" }}>
            CROP_STRESS 88%
          </span>
        </div>
      </div>

      {/* Top Controls */}
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 10 }}>
        <button onClick={onClose} style={{ 
          background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", 
          width: 40, height: 40, borderRadius: "50%", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(10px)"
        }}>
          <X size={20} />
        </button>
      </div>

      {/* Bottom Controls */}
      <div style={{ 
        position: "absolute", bottom: 0, left: 0, right: 0, height: 120,
        background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
        zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 40
      }}>
        <button style={{ 
          background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", 
          width: 50, height: 50, borderRadius: "50%", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(10px)"
        }}>
          <Navigation size={20} />
        </button>

        <input 
          type="file" 
          id="camera-upload" 
          accept="image/*" 
          capture="environment"
          style={{ display: "none" }}
          onChange={async (e) => {
            if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              const formData = new FormData();
              formData.append("file", file);
              
              try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                await fetch(`${apiUrl}/api/v1/images/upload`, {
                  method: 'POST',
                  body: formData
                });
                alert("Real Image Uploaded to PostGIS! YOLOv10 Pipeline Initiated.");
                onCapture(); // close camera
              } catch (err) {
                alert("Failed to upload image. Make sure backend is running.");
              }
            }
          }}
        />

        <button 
          onClick={() => document.getElementById("camera-upload")?.click()}
          style={{ 
            background: aligned ? "#22c55e" : "#fff", border: "4px solid rgba(255,255,255,0.5)", 
            width: 72, height: 72, borderRadius: "50%", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.3s"
          }}
        >
          {aligned ? <Zap size={24} color="#fff" /> : <Camera size={24} color="#000" />}
        </button>

        <button style={{ 
          background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", 
          width: 50, height: 50, borderRadius: "50%", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(10px)"
        }}>
          <Layers2 size={20} />
        </button>
      </div>
    </div>
  );
}
