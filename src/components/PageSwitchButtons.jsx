// src/components/PageSwitchButtons.jsx
import { Link } from "react-router-dom";

export default function PageSwitchButtons() {
  const baseBg = "rgba(96,165,250,0.15)";
  const hoverBg = "rgba(96,165,250,0.25)";

  const btnStyle = {
    width: "clamp(180px, 22vw, 260px)",
    aspectRatio: "3 / 1",
    fontSize: "clamp(1rem, 1.4vw, 1.4rem)",
    background: baseBg,
    color: "#60a5fa",
    border: "2px solid rgba(96,165,250,0.4)",
    borderRadius: 14,
    fontWeight: "bold",
    cursor: "pointer",
    backdropFilter: "blur(4px)",
    boxShadow: "0 0 25px rgba(96,165,250,0.25)",
    transition: "0.2s",
  };

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
          style={btnStyle}
          onMouseEnter={(e) => (e.target.style.background = hoverBg)}
          onMouseLeave={(e) => (e.target.style.background = baseBg)}
        >
          MÔ PHỎNG
        </button>
      </Link>

      <Link to="/real-time">
        <button
          style={btnStyle}
          onMouseEnter={(e) => (e.target.style.background = hoverBg)}
          onMouseLeave={(e) => (e.target.style.background = baseBg)}
        >
          CHẠY THỜI GIAN THỰC
        </button>
      </Link>
    </div>
  );
}
