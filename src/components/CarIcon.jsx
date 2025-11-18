// CarIcon.jsx
export default function CarIcon({ color = "#FFC107" }) {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="18" width="70" height="34" rx="8" fill={color} stroke="#000" strokeWidth="2"/>
        <rect x="20" y="22" width="58" height="26" rx="5" fill="#ffffff" opacity="0.85"/>
        <rect x="65" y="22" width="16" height="24" rx="4" fill={color} opacity="0.9"/>
        <circle cx="28" cy="54" r="9" fill="#222"/>
        <circle cx="72" cy="54" r="9" fill="#222"/>
        <text x="50" y="38" fontSize="11" fill="#000" fontWeight="bold" textAnchor="middle">
          LINE
        </text>
      </svg>
    </div>
  );
}