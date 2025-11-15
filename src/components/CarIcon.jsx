// CarIcon.jsx
export default function CarIcon({ color = "#FFC107" }) {
  return (
    <div>
      <svg width="100" height="70" viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="15" width="80" height="40" rx="10" fill={color} stroke="#000" strokeWidth="2"/>
        <rect x="18" y="20" width="64" height="30" rx="6" fill="#ffffff" opacity="0.9"/>
        <rect x="70" y="20" width="18" height="28" rx="4" fill={color} opacity="0.9"/>
        <circle cx="25" cy="58" r="10" fill="#222"/>
        <circle cx="75" cy="58" r="10" fill="#222"/>
        <circle cx="25" cy="58" r="5" fill="#444"/>
        <circle cx="75" cy="58" r="5" fill="#444"/>
        <text x="50" y="40" fontSize="10" fill="#000" fontWeight="bold" textAnchor="middle">
          LINE
        </text>
      </svg>
    </div>
  );
}