// src/components/PageSwitchButtons.jsx
import { Link } from "react-router-dom";

export default function PageSwitchButtons() {
  return (
    <div
      style={{
        textAlign: "center",
        margin: "50px 0",
        display: "flex",
        justifyContent: "center",
        gap: "40px",
        flexWrap: "wrap",
      }}
    >
      <Link to="/">
        <button
          style={{
            width: "clamp(180px, 22vw, 260px)",
            aspectRatio: "3 / 1",
            fontSize: "clamp(1rem, 1.4vw, 1.4rem)",
            background: "rgba(96,165,250,0.15)",
            color: "#60a5fa",
            border: "2px solid rgba(96,165,250,0.4)",
            borderRadius: 14,
            fontWeight: "bold",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            boxShadow: "0 0 25px rgba(96,165,250,0.25)",
            transition: "0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.background = "rgba(96,165,250,0.25)")}
          onMouseLeave={(e) => (e.target.style.background = "rgba(96,165,250,0.15)")}
        >
          MÔ PHỎNG
        </button>
      </Link>

      <Link to="/real-time">
        <button
          style={{
            width: "clamp(180px, 22vw, 260px)",
            aspectRatio: "3 / 1",
            fontSize: "clamp(1rem, 1.4vw, 1.4rem)",
            background: "rgba(52,211,153,0.15)",
            color: "#34d399",
            border: "2px solid rgba(52,211,153,0.4)",
            borderRadius: 14,
            fontWeight: "bold",
            cursor: "pointer",
            backdropFilter: "blur(4px)",
            boxShadow: "0 0 25px rgba(52,211,153,0.25)",
            transition: "0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.background = "rgba(52,211,153,0.25)")}
          onMouseLeave={(e) => (e.target.style.background = "rgba(52,211,153,0.15)")}
        >
          CHẠY THỜI GIAN THỰC
        </button>
      </Link>
    </div>
  );
}