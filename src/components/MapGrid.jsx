// src/components/MapGrid.jsx
import Vehicle from "./Vehicle";

const normalizeId = (id) => String(id || "").trim().toUpperCase();

const ROUTE_PALETTE = [
  "#ff4d4d", // V1 - red
  "#22c55e", // V2 - green
  "#f59e0b", // V3 - amber
  "#a78bfa", // V4 - violet
  "#06b6d4", // V5 - cyan
  "#f472b6", // fallback - pink
];

const colorForVehicle = (id, fallbackIndex = 0) => {
  const nid = normalizeId(id);
  const n = parseInt(nid.replace("V", ""), 10);
  const idx = Number.isFinite(n) ? Math.max(0, n - 1) : fallbackIndex;
  return ROUTE_PALETTE[idx % ROUTE_PALETTE.length];
};

const parsePos = (v) => {
  if (v == null) return null;

  // handle numeric shorthand like 5.1 (Number)
  if (typeof v === "number" && Number.isFinite(v)) {
    const r = Math.floor(v);
    const c = Math.round((v - r) * 10);
    if (Number.isFinite(r) && Number.isFinite(c)) return [r, c];
    return null;
  }

  if (Array.isArray(v) && v.length === 2) {
    const r = Number(v[0]);
    const c = Number(v[1]);
    return Number.isFinite(r) && Number.isFinite(c) ? [r, c] : null;
  }

  if (typeof v === "string") {
    const m = v.trim().match(/(\d+)\D+(\d+)/);
    if (!m) return null;
    const r = Number(m[1]);
    const c = Number(m[2]);
    return Number.isFinite(r) && Number.isFinite(c) ? [r, c] : null;
  }

  if (typeof v === "object") {
    const r = Number(v.r ?? v.row);
    const c = Number(v.c ?? v.col);
    return Number.isFinite(r) && Number.isFinite(c) ? [r, c] : null;
  }

  return null;
};

const samePos = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

const compactPath = (path = []) => {
  if (!Array.isArray(path) || path.length === 0) return [];
  const out = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const prev = out[out.length - 1];
    if (!prev || p[0] !== prev[0] || p[1] !== prev[1]) out.push(p);
  }
  return out;
};

const findBestProgressIndex = (rawRoute, pos, stepIndex) => {
  if (!Array.isArray(rawRoute) || rawRoute.length === 0) return 0;
  const p = parsePos(pos);
  if (!p) return 0;

  const n = rawRoute.length;
  const si = Number.isFinite(stepIndex) ? Math.max(0, Math.min(n - 1, stepIndex)) : null;

  // 1) perfect match at stepIndex
  if (si != null && samePos(rawRoute[si], p)) return si;

  // 2) search around stepIndex (planner may insert/remove waits)
  if (si != null) {
    const W = 10;
    const from = Math.max(0, si - W);
    const to = Math.min(n - 1, si + W);
    for (let i = from; i <= to; i++) if (samePos(rawRoute[i], p)) return i;
  }

  // 3) fallback: last occurrence of current pos
  for (let i = n - 1; i >= 0; i--) if (samePos(rawRoute[i], p)) return i;

  return 0;
};

// Planned route (raw): ưu tiên tripLog (timeline planner, có thể auto-append đường về),
// rồi routeOverlay, rồi fallback [pos,...path]
const getPlannedRouteRaw = (v) => {
  const overlayRaw = Array.isArray(v?.tripLog) ? v.tripLog : Array.isArray(v?.routeOverlay) ? v.routeOverlay : null;
  if (overlayRaw && overlayRaw.length >= 2) {
    return overlayRaw.map(parsePos).filter(Boolean);
  }

  const pos = parsePos(v?.pos);
  const pathRaw = Array.isArray(v?.path) ? v.path : [];
  const path = pathRaw.map(parsePos).filter(Boolean);

  if (pos && path.length > 0) {
    const head = path[0];
    const route = head && samePos(head, pos) ? path : [pos, ...path];
    return route;
  }

  return null;
};

// Remaining route: cắt bỏ các đoạn đã đi qua, chỉ vẽ phần còn lại (đi -> kho, rồi kho -> về bến)
const getRemainingRoute = (v) => {
  const raw = getPlannedRouteRaw(v);
  if (!raw || raw.length < 2) return null;

  const curIdx = findBestProgressIndex(raw, v?.pos, v?.stepIndex ?? 0);
  const endPos = parsePos(v?.endPos);
  const delivered = Boolean(v?.delivered);

  // split point: lần đầu chạm endPos (kho giao)
  let deliveryIdx = -1;
  if (endPos) {
    for (let i = 0; i < raw.length; i++) {
      if (samePos(raw[i], endPos)) {
        deliveryIdx = i;
        break;
      }
    }
  }

  // Khi chưa giao: chỉ show route từ current -> kho (tránh overdraw go+return trùng nhau)
  // Khi đã giao (delivered=true) hoặc đã vượt qua kho: show phần còn lại (route về)
  let sliced = raw.slice(curIdx);
  if (!delivered && deliveryIdx !== -1 && curIdx <= deliveryIdx) {
    sliced = raw.slice(curIdx, deliveryIdx + 1);
  }

  const cp = compactPath(sliced);
  return cp.length >= 2 ? cp : null;
};



// ---- Visual tidy: multi-lane offset per shared segment (đỡ lộn xộn) ----
const segKey = (a, b) => {
  const p = parsePos(a);
  const q = parsePos(b);
  if (!p || !q) return null;
  const s1 = `${p[0]},${p[1]}`;
  const s2 = `${q[0]},${q[1]}`;
  return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
};

const buildSegmentUsers = (vehicles = []) => {
  const map = new Map(); // key -> Set(ids)
  vehicles.forEach((v, idx) => {
    const id = normalizeId(v?.id || `V${idx + 1}`);
    const route = getRemainingRoute(v);
    if (!route || route.length < 2) return;

    for (let i = 1; i < route.length; i++) {
      const k = segKey(route[i - 1], route[i]);
      if (!k) continue;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k).add(id);
    }
  });

  // convert to sorted arrays for deterministic lane ordering
  const out = new Map();
  for (const [k, set] of map.entries()) {
    out.set(k, Array.from(set).sort());
  }
  return out;
};

const perpUnitForSegment = (a, b) => {
  const p = parsePos(a);
  const q = parsePos(b);
  if (!p || !q) return { x: 0, y: 0 };

  const dr = q[0] - p[0];
  const dc = q[1] - p[1];

  // grid moves are usually 4-neighborhood
  if (dc === 0 && dr !== 0) return { x: 1, y: 0 }; // vertical: offset in X
  if (dr === 0 && dc !== 0) return { x: 0, y: 1 }; // horizontal: offset in Y

  // fallback (diagonal): perpendicular normalized
  const dx = dc;
  const dy = -dr;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
};

const laneOffsetVec = (segmentUsers, a, b, vehicleId) => {
  const k = segKey(a, b);
  if (!k) return { x: 0, y: 0 };
  const users = segmentUsers.get(k);
  if (!users || users.length <= 1) return { x: 0, y: 0 };

  const idx = Math.max(0, users.indexOf(vehicleId));
  const n = users.length;

  // Keep lanes close to grid line (tweak here if needed)
  const LANE_SPACING = 1.25; // viewBox units (0..100)
  const lane = (idx - (n - 1) / 2) * LANE_SPACING;

  const perp = perpUnitForSegment(a, b);
  return { x: perp.x * lane, y: perp.y * lane };
};

// Base point: bám sát đường kẻ như bản đầu (match label positions)
const baseXY = (pos) => {
  const p = parsePos(pos);
  if (!p) return { x: 50, y: 50 };
  const [row, col] = p;

  // col 1..5 => x: 2,22,42,62,82
  // row 1..5 => y: 98,78,58,38,18
  return { x: col * 20 - 18, y: (5 - row) * 20 + 18 };
};

const clampPoint = ({ x, y }) => {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const PAD = 1.0;
  return { x: clamp(x, PAD, 100 - PAD), y: clamp(y, PAD, 100 - PAD) };
};

// Style: keep solid V1; others dashed but different pattern/phase so overlap looks clearer
const strokeStyleForVehicle = (id, fallbackIndex = 0) => {
  const nid = normalizeId(id);
  const n = parseInt(nid.replace("V", ""), 10);
  const stroke = colorForVehicle(id, fallbackIndex);

  if (!Number.isFinite(n) || n <= 1) return { stroke, dasharray: null, dashoffset: null };

  const dashByN = {
    2: "10 7",
    3: "6 6",
    4: "14 6",
    5: "4 8",
  };
  const dasharray = dashByN[n] || "10 7";
  const dashoffset = String((n - 2) * 4);
  return { stroke, dasharray, dashoffset };
};

export default function MapGrid({ vehicles = [], v1, v2, showRoutes }) {
  const list = vehicles && vehicles.length > 0 ? vehicles : [v1, v2].filter(Boolean);

  const shouldShowRoutes =
    typeof showRoutes === "boolean"
      ? showRoutes
      : list.some((v) => {
          const r = getRemainingRoute(v);
          return r && r.length >= 2;
        });

  const labels = [
    { text: "1.1", row: 1, line: 2 },
    { text: "1.2", row: 1, line: 3 },
    { text: "1.3", row: 1, line: 4 },
    { text: "1.4", row: 1, line: 5 },
    { text: "1.5", row: 1, line: 6 },

    { text: "2.1", row: 2, line: 2 },
    { text: "2.2", row: 2, line: 3 },
    { text: "2.3", row: 2, line: 4 },
    { text: "2.4", row: 2, line: 5 },
    { text: "2.5", row: 2, line: 6 },

    { text: "3.1", row: 3, line: 2 },
    { text: "3.2", row: 3, line: 3 },
    { text: "3.3", row: 3, line: 4 },
    { text: "3.4", row: 3, line: 5 },
    { text: "3.5", row: 3, line: 6 },

    { text: "4.1", row: 4, line: 2 },
    { text: "4.2", row: 4, line: 3 },
    { text: "4.3", row: 4, line: 4 },
    { text: "4.4", row: 4, line: 5 },
    { text: "4.5", row: 4, line: 6 },

    { text: "5.1", row: 5, line: 2 },
    { text: "5.2", row: 5, line: 3 },
    { text: "5.3", row: 5, line: 4 },
    { text: "5.4", row: 5, line: 5 },
    { text: "5.5", row: 5, line: 6 },
  ];

  // Build once per render: which segments are shared by multiple vehicles
  const segmentUsers = buildSegmentUsers(list);

  return (
    <div
      style={{
        width: "70vw",
        maxWidth: "850px",
        aspectRatio: "1 / 1",
        position: "relative",
        border: "12px solid #1a1a1a",
        background: "linear-gradient(135deg, #2c3e50 0%, #1a1a2f 100%)",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
      }}
    >
      {shouldShowRoutes && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          <defs>
            <clipPath id="routeClip">
              <rect x="0" y="0" width="100" height="100" rx="3" ry="3" />
            </clipPath>
            <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="0.75" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g clipPath="url(#routeClip)">
            {list
              .map((v, idx) => ({ v, idx, id: normalizeId(v?.id || `V${idx + 1}`) }))
              .sort((a, b) => a.id.localeCompare(b.id))
              .map(({ v, idx, id }) => {
                const route = getRemainingRoute(v);
                if (!route || route.length < 2) return null;

                // Per-vertex offset: average of adjacent segment lanes for smoother corners
                const offsets = route.map((p, i) => {
                  const prev = i > 0 ? route[i - 1] : null;
                  const next = i < route.length - 1 ? route[i + 1] : null;

                  const o1 = prev ? laneOffsetVec(segmentUsers, prev, p, id) : { x: 0, y: 0 };
                  const o2 = next ? laneOffsetVec(segmentUsers, p, next, id) : { x: 0, y: 0 };

                  return { x: (o1.x + o2.x) / 2, y: (o1.y + o2.y) / 2 };
                });

                const { stroke, dasharray, dashoffset } = strokeStyleForVehicle(id, idx);

                const pts = route.map((p, i) => {
                  const base = baseXY(p);
                  const off = offsets[i] || { x: 0, y: 0 };
                  const c = clampPoint({ x: base.x + off.x, y: base.y + off.y });
                  return `${c.x},${c.y}`;
                });
                const points = pts.join(" ");

                const startBase = baseXY(route[0]);
                const startOff = offsets[0] || { x: 0, y: 0 };
                const startC = clampPoint({ x: startBase.x + startOff.x, y: startBase.y + startOff.y });
                return (
                  <g key={`route-${id}`}>
                    {/* underlay: same color (no black), low opacity. For dashed routes, underlay is dashed too to avoid "đen". */}
                    <polyline
                      points={points}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={4.0}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.22}
                      strokeDasharray={dasharray || undefined}
                      strokeDashoffset={dashoffset || undefined}
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* main */}
                    <polyline
                      points={points}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={2.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.95}
                      filter="url(#routeGlow)"
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={dasharray || undefined}
                      strokeDashoffset={dashoffset || undefined}
                    />
</g>
                );
              })}
          </g>
        </svg>
      )}

      {/* grid */}
      {Array.from({ length: 5 }, (_, i) =>
        i === 0
          ? null
          : Array.from({ length: 4 }, (_, j) => (
              <div
                key={`${i}-${j}`}
                style={{
                  position: "absolute",
                  left: `${j * 20}%`,
                  top: `${i * 20}%`,
                  width: "20%",
                  height: "20%",
                  border: "2px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.015)",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            ))
      )}

      {/* labels */}
      {labels.map((label, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            left: `${(label.line - 1) * 20 - 18}%`,
            top: `${(5 - label.row) * 20 + 18}%`,
            transform: "translate(-50%, -50%)",
            fontSize: "0.9vw",
            fontWeight: "bold",
            color: "#a5b4fc",
            textShadow: "0 0 12px rgba(0,0,0,0.9)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {label.text}
        </div>
      ))}

      {/* vehicles */}
      {list.map((v, idx) => (
        <Vehicle key={v.id} id={v.id} pos={v.pos} prevPos={v.prevPos} status={v.status} index={idx} />
      ))}
    </div>
  );
}
