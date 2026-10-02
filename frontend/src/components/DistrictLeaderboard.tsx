"use client";
import { useState, useEffect } from "react";
import { Trophy, Medal, Star, MapPin, Activity, X } from "lucide-react";

interface LeaderboardProps {
  onClose: () => void;
}

export default function DistrictLeaderboard({ onClose }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<"districts" | "volunteers">("districts");
  const [districts, setDistricts] = useState<any[]>([]);
  const [volunteers, setVolunteers] = useState<any[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/api/v1/leaderboard`);
        if (response.ok) {
          const data = await response.json();
          setDistricts(data.districts || []);
          setVolunteers(data.volunteers || []);
        }
      } catch (e) {
        console.error("Failed to fetch leaderboard");
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="panel-in" style={{
      position: "absolute", top: 60, left: 20, zIndex: 1000,
      width: 380, maxHeight: "calc(100vh - 100px)",
      background: "var(--bg-panel)", border: "1px solid var(--border)",
      borderRadius: 16, backdropFilter: "blur(24px)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      display: "flex", flexDirection: "column", overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        background: "linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)",
        borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)"
          }}>
            <Trophy size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", fontFamily: "'Space Grotesk', sans-serif" }}>
              Gamification Hub
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: 0.5 }}>
              LIVE REGIONAL STANDINGS
            </div>
          </div>
        </div>
        <button className="btn-icon" onClick={onClose} style={{ alignSelf: "flex-start" }}>
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "12px 20px 0", gap: 8, borderBottom: "1px solid var(--border)" }}>
        <button 
          onClick={() => setActiveTab("districts")}
          style={{
            flex: 1, padding: "8px 0", background: "transparent", border: "none",
            borderBottom: activeTab === "districts" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "districts" ? "var(--text-1)" : "var(--text-2)",
            fontSize: 13, fontWeight: activeTab === "districts" ? 600 : 500,
            cursor: "pointer", transition: "all 0.2s"
          }}
        >
          Districts
        </button>
        <button 
          onClick={() => setActiveTab("volunteers")}
          style={{
            flex: 1, padding: "8px 0", background: "transparent", border: "none",
            borderBottom: activeTab === "volunteers" ? "2px solid var(--accent)" : "2px solid transparent",
            color: activeTab === "volunteers" ? "var(--text-1)" : "var(--text-2)",
            fontSize: 13, fontWeight: activeTab === "volunteers" ? 600 : 500,
            cursor: "pointer", transition: "all 0.2s"
          }}
        >
          Top Volunteers
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "16px 20px", overflowY: "auto" }}>
        
        {activeTab === "districts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {districts.length === 0 && <div style={{color:"var(--text-2)", fontSize:12, textAlign:"center"}}>No district data yet. Upload photos to start tracking!</div>}
            {districts.map((d, i) => (
              <div key={d.name} style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-mid)",
                borderRadius: 12, padding: 12,
                display: "flex", alignItems: "center", gap: 12,
                position: "relative", overflow: "hidden"
              }}>
                {i === 0 && <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 4, background: "#f59e0b" }} />}
                
                <div style={{ 
                  width: 28, height: 28, borderRadius: "50%", 
                  background: i < 3 ? "rgba(245, 158, 11, 0.1)" : "var(--bg-hover)",
                  color: i < 3 ? "#f59e0b" : "var(--text-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700
                }}>
                  #{d.rank}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 6 }}>
                    {d.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, display: "flex", gap: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MapPin size={10} /> {d.coverage} Cover</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Activity size={10} /> {d.reports} Rpts</span>
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{d.points.toLocaleString()}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: d.trend.startsWith("+") ? "#22c55e" : "#ef4444" }}>
                    {d.trend}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "volunteers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ 
              background: "rgba(56, 189, 248, 0.1)", border: "1px dashed rgba(56, 189, 248, 0.3)",
              borderRadius: 8, padding: 10, fontSize: 12, color: "var(--text-2)",
              textAlign: "center", marginBottom: 4
            }}>
              Earn points by uploading validated field imagery and confirming AI insights.
            </div>

            {volunteers.length === 0 && <div style={{color:"var(--text-2)", fontSize:12, textAlign:"center", marginTop:10}}>No volunteers yet. Be the first to upload!</div>}
            {volunteers.map((v) => (
              <div key={v.name} style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-mid)",
                borderRadius: 12, padding: 12,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ fontSize: 24 }}>{v.badge}</div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
                    {v.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    {v.role}
                  </div>
                </div>

                <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 6 }}>
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{v.points}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
