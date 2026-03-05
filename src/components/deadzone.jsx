// src/components/deadzone.jsx
import { useId } from "react";

/**
 * Deadzone (vật cản) marker.
 * - Dùng SVG biển báo nguy hiểm để hiển thị trên grid.
 */
export default function Deadzone({ size = 26, title = "Vật cản / Deadzone" }) {
  const uid = useId();
  const gradId = `dz-grad-${uid}`;
  const glowId = `dz-glow-${uid}`;

  return (
    <div
      title={title}
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        filter: "drop-shadow(0 10px 12px rgba(2,6,23,0.55))",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-label={title}
        role="img"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fde047" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Triangle */}
        <path
          d="M32 6 L60 58 H4 Z"
          fill={`url(#${gradId})`}
          stroke="rgba(2,6,23,0.75)"
          strokeWidth="3"
          filter={`url(#${glowId})`}
        />

        {/* Inner border */}
        <path
          d="M32 12 L54 54 H10 Z"
          fill="rgba(2,6,23,0.08)"
          stroke="rgba(2,6,23,0.25)"
          strokeWidth="2"
        />

        {/* Exclamation */}
        <rect x="29" y="22" width="6" height="20" rx="3" fill="rgba(2,6,23,0.85)" />
        <circle cx="32" cy="49" r="3.2" fill="rgba(2,6,23,0.85)" />
      </svg>
    </div>
  );
}
