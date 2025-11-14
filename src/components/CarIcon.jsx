export default function CarIcon({ color = "#FFC107", direction = "down" }) {
  const rotate =
    direction === "up"
      ? 180
      : direction === "left"
      ? 270
      : direction === "right"
      ? 90
      : 0;

  return (
    <div
      style={{
        transform: `rotate(${rotate}deg)`,
        transition: "transform 0.4s ease-in-out", // mượt hơn
      }}
    >
      <svg
        width="80"
        height="110"
        viewBox="0 0 80 110"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="10"
          y="25"
          width="60"
          height="50"
          rx="8"
          fill={color}
          stroke="#000"
          strokeWidth="2"
        />
        <rect x="15" y="30" width="50" height="40" rx="5" fill="#fff" />
        <rect x="55" y="30" width="15" height="35" rx="3" fill={color} />
        <rect x="8" y="20" width="45" height="12" rx="3" fill="#81C784" />
        <circle cx="22" cy="70" r="11" fill="#222" />
        <circle cx="58" cy="70" r="11" fill="#222" />
        <circle cx="22" cy="70" r="6" fill="#444" />
        <circle cx="58" cy="70" r="6" fill="#444" />
        <text
          x="40"
          y="50"
          fontSize="9"
          fill="#000"
          fontWeight="bold"
          textAnchor="middle"
        >
          LINE
        </text>
      </svg>
    </div>
  );
}
