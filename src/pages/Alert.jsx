// src/pages/Alert.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, RotateCcw, FlaskConical, Trash2, CheckCircle2 } from "lucide-react";

const cx = (...xs) => xs.filter(Boolean).join(" ");

const buttonClass = (variant = "primary", disabled = false) => {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-sky-500/30";
  const state = disabled ? "opacity-50 cursor-not-allowed" : "hover:-translate-y-[1px] active:translate-y-0";
  const map = {
    primary: "border-sky-400/30 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25",
    ghost: "border-slate-600/40 bg-slate-800/35 text-slate-100 hover:bg-slate-800/55",
    success: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25",
    danger: "border-rose-400/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25",
  };
  return cx(base, state, map[variant] || map.primary);
};


// =========================
// Storage keys (tương thích ngược)
// =========================
const KEYS = {
  // Home.jsx đang set: home_vehicles_state, tripLogs
  vehiclesCandidates: ["realtime_vehicles_state", "home_vehicles_state", "vehicles_state"],
  tripLogsCandidates: ["realtime_tripLogs", "tripLogs", "home_tripLogs"],
  legacyAlertLogs: ["alertLogs"],

  // v2
  ackMap: "alert_ack_v1",
  routeSla: "route_sla_seconds_v1", // { "5,1": 60, ... }
  settings: "alert_settings_v1",
  lastPosMap: "alert_last_pos_v1", // { V1: { posKey, t } }
  fingerprint: "alert_fingerprint_v1", // { fp, t }
  demoAlerts: "alert_demo_v1",
};

// =========================
// Small utils
// =========================
const safeParse = (s, fallback) => {
  try {
    if (s == null) return fallback;
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};
const nowIso = () => new Date().toISOString();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pad2 = (n) => String(n).padStart(2, "0");

const isPos = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(+p[0]) && Number.isFinite(+p[1]);
const posKey = (p) => (isPos(p) ? `${Number(p[0])},${Number(p[1])}` : "");

const parseViDateTime = (s) => {
  // Hỗ trợ:
  // - "05/02/2026, 22:46:08"
  // - "05/02/2026 22:46:08"
  // - "22:46:08" (giả định hôm nay)
  if (!s || typeof s !== "string") return null;

  const str = s.trim();
  const dmy = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const hms = str.match(/(\d{1,2}):(\d{2}):(\d{2})/);

  let dd, mm, yyyy;
  if (dmy) {
    dd = Number(dmy[1]);
    mm = Number(dmy[2]);
    yyyy = Number(dmy[3]);
  } else {
    const today = new Date();
    dd = today.getDate();
    mm = today.getMonth() + 1;
    yyyy = today.getFullYear();
  }

  let hh = 0,
    mi = 0,
    ss = 0;
  if (hms) {
    hh = Number(hms[1]);
    mi = Number(hms[2]);
    ss = Number(hms[3]);
  }

  const dt = new Date(yyyy, mm - 1, dd, hh, mi, ss);
  return Number.isFinite(dt.getTime()) ? dt : null;
};

const formatViTime = (dt) => {
  const d = dt instanceof Date ? dt : new Date(dt);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

const formatViDateTime = (isoOrDate) => {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (!Number.isFinite(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${formatViTime(d)}`;
};

const uniq = (arr) => Array.from(new Set(arr));

const normalizeVehicles = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => normalizeOneVehicle(v)).filter(Boolean);
  if (typeof raw === "object") {
    // { V1: {...}, V2: {...} }
    return Object.values(raw).map((v) => normalizeOneVehicle(v)).filter(Boolean);
  }
  return [];
};

const normalizeOneVehicle = (v) => {
  if (!v || typeof v !== "object") return null;
  const id = v.id || v.vehicleId || v.vehicle_id || v.name;
  if (!id) return null;
  const pos = v.pos || v.position || v.currentPos || v.current_pos;
  const endPos = v.endPos || v.destination || v.end_pos;
  const status = v.status || v.state || "idle";
  return {
    id: String(id),
    pos: isPos(pos) ? [Number(pos[0]), Number(pos[1])] : null,
    endPos: isPos(endPos) ? [Number(endPos[0]), Number(endPos[1])] : null,
    status: String(status),
    path: Array.isArray(v.path) ? v.path : [],
    tripLog: Array.isArray(v.tripLog) ? v.tripLog : Array.isArray(v.trip_path) ? v.trip_path : [],
  };
};

const normalizeTripLogs = (raw) => {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const vehicleId = x.vehicleId || x.vehicle || x.id;
      if (!vehicleId) return null;

      // path có thể là string "1,1 → 2,1" hoặc array [[1,1],[2,1]]
      let pathArr = [];
      if (Array.isArray(x.path)) {
        pathArr = x.path;
      } else if (typeof x.path === "string") {
        pathArr = x.path
          .split("→")
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => {
            const parts = t.split(",").map((p) => p.trim());
            if (parts.length >= 2 && Number.isFinite(+parts[0]) && Number.isFinite(+parts[1])) {
              return [Number(parts[0]), Number(parts[1])];
            }
            // hỗ trợ dạng "1.1"
            const parts2 = t.replace(".", ",").split(",").map((p) => p.trim());
            if (parts2.length >= 2 && Number.isFinite(+parts2[0]) && Number.isFinite(+parts2[1])) {
              return [Number(parts2[0]), Number(parts2[1])];
            }
            return null;
          })
          .filter(Boolean);
      }

      const timeIso = x.timeIso || x.timeISO || x.createdAt || x.created_at || null;
      const timeText = x.time || x.createdTime || x.created_time || "";

      const dt = timeIso ? new Date(timeIso) : parseViDateTime(timeText);
      const startAt = dt && Number.isFinite(dt.getTime()) ? dt.toISOString() : null;

      // route có thể là "1,1 → 5,3" hoặc "1,1 -> 5,3"
      const routeText = x.route || x.tuyen || x.routeName || "";
      const endFromRoute = (() => {
        if (!routeText || typeof routeText !== "string") return null;
        const parts = routeText.split("→").map((t) => t.trim());
        const last = parts[parts.length - 1] || "";
        const xy = last.split(",").map((p) => p.trim());
        if (xy.length >= 2 && Number.isFinite(+xy[0]) && Number.isFinite(+xy[1])) return `${Number(xy[0])},${Number(xy[1])}`;
        return null;
      })();

      return {
        ...x,
        vehicleId: String(vehicleId),
        startAt,
        timeText: timeText || (startAt ? formatViDateTime(startAt) : ""),
        routeText,
        endKey: endFromRoute,
        pathArr,
        pathStr: pathArr.length ? pathArr.map((p) => `${p[0]}.${p[1]}`).join(" → ") : (typeof x.path === "string" ? x.path.replaceAll(",", ".") : ""),
        deliveryId: x.deliveryId || x.tripCode || x.code || null,
      };
    })
    .filter(Boolean);
};

const pickFirstExisting = (keys, fallback) => {
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v != null) return { key: k, value: v };
  }
  return { key: null, value: fallback };
};

const makeAlertId = (type, vehicleId, scopeKey) => `${type}|${vehicleId}|${scopeKey || "-"}`;

const severityMeta = (sev) => {
  if (sev === "critical") return { label: "Nghiêm trọng", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
  if (sev === "warning") return { label: "Cảnh báo", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" };
  return { label: "Thông tin", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" };
};

const typeLabel = (t) => {
  const m = {
    DELIVERY_LATE: "Trễ giao",
    VEHICLE_IDLE: "Xe đứng yên khi đang giao",
    COLLISION_RISK: "Nguy cơ va chạm",
    DATA_STALE: "Dữ liệu không cập nhật",
    ROUTE_CHANGED: "Đổi điểm giao khi đang chạy",
    LEGACY: "Log hệ thống",
  };
  return m[t] || t;
};

// =========================
// Main Page
// =========================
export default function Alert() {
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dataInfo, setDataInfo] = useState({ vehiclesKey: "—", tripKey: "—", vehiclesCount: 0, tripsCount: 0 });


  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsWrapRef = useRef(null);

  const [demoEnabled, setDemoEnabled] = useState(() => {
    const d = safeParse(localStorage.getItem(KEYS.demoAlerts), []);
    return Array.isArray(d) && d.length > 0;
  });

  useEffect(() => {
    const onDown = (e) => {
      if (!actionsWrapRef.current) return;
      if (!actionsWrapRef.current.contains(e.target)) setActionsOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setActionsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);



  const [q, setQ] = useState("");
  const [sev, setSev] = useState("all"); // all|critical|warning|info
  const [status, setStatus] = useState("open"); // open|resolved|all
  const [type, setType] = useState("all"); // all|...

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [scanEverySec, setScanEverySec] = useState(3);
  const [lastScanIso, setLastScanIso] = useState(null);

  const [settings, setSettings] = useState(() => {
    const s = safeParse(localStorage.getItem(KEYS.settings), null);
    return (
      s || {
        fixedSlaSec: 60, // option 2: 1 phút
        enableFixed: true, // option 2
        enablePath: true, // option 1
        enableRoute: true, // option 3
        pathFactor: 1.2, // cho phép trễ nhẹ so với thời gian dự kiến
        idleSec: 20,
        staleSec: 20,
      }
    );
  });

  const [routeSla, setRouteSla] = useState(() => {
    // option 3: SLA theo tuyến/điểm giao (key = "5,1")
    const m = safeParse(localStorage.getItem(KEYS.routeSla), null);
    return (
      m || {
        "5,1": 60,
        "5,2": 60,
        "5,3": 60,
        "5,4": 60,
        "5,5": 60,
      }
    );
  });

  const ackRef = useRef(safeParse(localStorage.getItem(KEYS.ackMap), {}));

  const persistAck = () => {
    localStorage.setItem(KEYS.ackMap, JSON.stringify(ackRef.current || {}));
  };

  const saveSettings = (nextSettings, nextRouteSla) => {
    const s = nextSettings || settings;
    const r = nextRouteSla || routeSla;
    localStorage.setItem(KEYS.settings, JSON.stringify(s));
    localStorage.setItem(KEYS.routeSla, JSON.stringify(r));
  };

  const loadDataAndGenerateAlerts = () => {
    // 1) vehicles
    const vehiclesPick = pickFirstExisting(KEYS.vehiclesCandidates, "[]");
    const vehiclesRaw = safeParse(vehiclesPick.value, []);
    const vehicles = normalizeVehicles(vehiclesRaw);

    // 2) trip logs
    const tripsPick = pickFirstExisting(KEYS.tripLogsCandidates, "[]");
    const tripRaw = safeParse(tripsPick.value, []);
    const tripLogs = normalizeTripLogs(tripRaw);

    // debug: nguồn dữ liệu (giúp biết Alert đang đọc từ Home hay RealTime)
    setDataInfo({
      vehiclesKey: vehiclesPick.key || "—",
      tripKey: tripsPick.key || "—",
      vehiclesCount: vehicles.length,
      tripsCount: tripLogs.length,
    });


    const generated = generateAlerts({
      vehicles,
      tripLogs,
      settings,
      routeSla,
      ackMap: ackRef.current || {},
    });

    // 3) legacy (tương thích ngược)
    const legacy = safeParse(localStorage.getItem(KEYS.legacyAlertLogs[0]), []);
    const legacyAlerts = Array.isArray(legacy)
      ? legacy
          .slice(-300)
          .map((x, idx) => ({
            id: `LEGACY|${idx}|${x?.alertId || idx}`,
            type: "LEGACY",
            severity: "info",
            status: "open",
            createdAt: nowIso(),
            updatedAt: nowIso(),
            vehicleId: x?.vehicleId || "-",
            tripCode: x?.alertId || "-",
            route: "-",
            title: x?.type || "Log",
            description: x?.description || "",
            timeText: x?.time || "",
            meta: { legacy: true },
          }))
      : [];

    // 4) demo (để demo không bị mất khi auto-scan)
    const demoStored = safeParse(localStorage.getItem(KEYS.demoAlerts), []);
    const demoAlerts = Array.isArray(demoStored) ? demoStored : [];
    setDemoEnabled(demoAlerts.length > 0);

    // merge: generated + legacy + demo, keep unique by id
    const merged = [...generated, ...legacyAlerts, ...demoAlerts];
    const byId = new Map();
    for (const a of merged) byId.set(a.id, a);
    const finalList = Array.from(byId.values()).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    setAlerts(finalList);
    setLastScanIso(nowIso());
  };

  useEffect(() => {
    loadDataAndGenerateAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const ms = clamp(Number(scanEverySec) || 3, 1, 30) * 1000;
    const t = setInterval(() => {
      loadDataAndGenerateAlerts();
    }, ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, scanEverySec, settings, routeSla]);

  // =========================
  // Filtering
  // =========================
  const typesList = useMemo(() => {
    const t = alerts.map((a) => a.type);
    return ["all", ...uniq(t)];
  }, [alerts]);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return alerts.filter((a) => {
      if (sev !== "all" && a.severity !== sev) return false;
      if (status !== "all" && a.status !== status) return false;
      if (type !== "all" && a.type !== type) return false;

      if (!keyword) return true;
      const hay = `${a.vehicleId || ""} ${a.tripCode || ""} ${a.route || ""} ${a.title || ""} ${a.description || ""}`
        .toLowerCase()
        .trim();
      return hay.includes(keyword);
    });
  }, [alerts, q, sev, status, type]);

  // =========================
  // Pagination
  // =========================
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    // reset page khi filter thay đổi
    setPage(0);
  }, [q, sev, status, type]);

  // =========================
  // Counters
  // =========================
  const counters = useMemo(() => {
    const open = alerts.filter((a) => a.status === "open");
    const resolved = alerts.filter((a) => a.status === "resolved");
    const critical = open.filter((a) => a.severity === "critical").length;
    const warning = open.filter((a) => a.severity === "warning").length;
    const info = open.filter((a) => a.severity === "info").length;
    return {
      total: alerts.length,
      open: open.length,
      resolved: resolved.length,
      critical,
      warning,
      info,
    };
  }, [alerts]);

  // =========================
  // Actions
  // =========================
  const markResolved = (alertId, resolved) => {
    ackRef.current = ackRef.current || {};
    const prev = ackRef.current[alertId] || {};
    ackRef.current[alertId] = {
      ...prev,
      status: resolved ? "resolved" : "open",
      updatedAt: nowIso(),
      resolvedAt: resolved ? nowIso() : null,
    };
    persistAck();
    loadDataAndGenerateAlerts();
  };

  const clearResolved = () => {
    // Xóa những alert đã xử lý khỏi ack map + list sẽ tự clean ở lần scan
    const next = { ...(ackRef.current || {}) };
    for (const [k, v] of Object.entries(next)) {
      if (v?.status === "resolved") delete next[k];
    }
    ackRef.current = next;
    persistAck();
    loadDataAndGenerateAlerts();
  };

  const clearAllLocal = () => {
    if (!confirm("Xóa toàn bộ cảnh báo (bao gồm trạng thái đã xử lý) trên trình duyệt?")) return;
    localStorage.removeItem(KEYS.ackMap);
    localStorage.removeItem(KEYS.legacyAlertLogs[0]);
    ackRef.current = {};
    setSelected(null);
    loadDataAndGenerateAlerts();
  };
  const createDemo = () => {
    // Toggle demo ON/OFF. Demo sẽ được lưu localStorage để không bị mất khi auto-scan.
    if (demoEnabled) {
      localStorage.removeItem(KEYS.demoAlerts);
      setDemoEnabled(false);
      loadDataAndGenerateAlerts();
      return;
    }
    const demo = makeDemoAlerts();
    localStorage.setItem(KEYS.demoAlerts, JSON.stringify(demo));
    setDemoEnabled(true);
    loadDataAndGenerateAlerts();
  };


  // =========================
  // UI styles
  // =========================
  const shell = {
    marginLeft: 300,
    padding: 32,
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b1220 0%, #0f172a 40%, #0b1220 100%)",
    color: "#e5e7eb",
  };

  const card = {
    background: "rgba(30, 41, 59, 0.65)",
    border: "1px solid rgba(148, 163, 184, 0.18)",
    boxShadow: "0 10px 35px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    borderRadius: 18,
  };

  const btn = (variant = "primary") => {
    const base = {
      padding: "10px 14px",
      borderRadius: 14,
      cursor: "pointer",
      border: "1px solid rgba(148,163,184,0.20)",
      fontWeight: 700,
      fontSize: "0.9rem",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      userSelect: "none",
    };
    if (variant === "danger")
      return { ...base, background: "rgba(239,68,68,0.18)", color: "#fecaca", borderColor: "rgba(239,68,68,0.35)" };
    if (variant === "ghost")
      return { ...base, background: "rgba(148,163,184,0.12)", color: "#e5e7eb" };
    if (variant === "success")
      return { ...base, background: "rgba(34,197,94,0.18)", color: "#bbf7d0", borderColor: "rgba(34,197,94,0.35)" };
    return { ...base, background: "rgba(59,130,246,0.18)", color: "#bfdbfe", borderColor: "rgba(59,130,246,0.35)" };
  };

  return (
<div className="relative w-full max-w-none px-4 sm:px-6 lg:px-8 2xl:px-10 py-8">
  {/* subtle glows */}
  <div className="pointer-events-none absolute -top-24 left-8 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
  <div className="pointer-events-none absolute -bottom-28 left-48 h-72 w-72 rounded-full bg-rose-500/10 blur-3xl" />

  <div className="[@media(min-width:2400px)]:scale-[1.06] [@media(min-width:2400px)]:origin-top-left">
    <div className="rounded-3xl border border-slate-700/40 bg-slate-900/25 p-5 sm:p-6 shadow-[0_20px_70px_-35px_rgba(0,0,0,.85)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-rose-400/30 bg-rose-500/10 shadow-[0_12px_40px_-18px_rgba(244,63,94,.55)]">
              <span className="text-lg">⚠️</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-slate-100">CẢNH BÁO HỆ THỐNG</h1>
              <div className="mt-1 text-sm text-slate-200/70">
                Giám sát trễ giao (SLA), nguy cơ va chạm, dữ liệu đứng yên và các cảnh báo vận hành.
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1 text-xs text-slate-200/60">
            <div>
              Lần quét gần nhất: <span className="font-extrabold text-slate-100">{lastScanIso ? formatViDateTime(lastScanIso) : "—"}</span>
            </div>
            <div>
              Nguồn dữ liệu: <span className="font-extrabold text-slate-100">{dataInfo.vehiclesKey}</span> ({dataInfo.vehiclesCount} xe) ·{" "}
              <span className="font-extrabold text-slate-100">{dataInfo.tripKey}</span> ({dataInfo.tripsCount} chuyến)
            </div>
          </div>
        </div>

        
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <div className="relative" ref={actionsWrapRef}>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-950/25 backdrop-blur-xl transition hover:bg-slate-950/40"
              onClick={() => setActionsOpen((v) => !v)}
              title="Tác vụ"
              aria-label="Tác vụ"
            >
              <Settings2 className="h-5 w-5 text-slate-100/80" />
            </button>

            {actionsOpen ? (
              <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-950/80 backdrop-blur-xl shadow-[0_20px_70px_-35px_rgba(0,0,0,.85)]">
                <button
                  onClick={() => {
                    setActionsOpen(false);
                    loadDataAndGenerateAlerts();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-extrabold text-slate-100/85 transition hover:bg-white/5"
                >
                  <RotateCcw className="h-4 w-4 text-slate-200/70" />
                  Quét lại
                </button>

                <button
                  onClick={() => {
                    setActionsOpen(false);
                    createDemo();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-extrabold text-slate-100/85 transition hover:bg-white/5"
                >
                  <FlaskConical className="h-4 w-4 text-slate-200/70" />
                  {demoEnabled ? "Tắt Demo" : "Demo"}
                </button>

                <button
                  onClick={() => {
                    setActionsOpen(false);
                    clearResolved();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-extrabold text-slate-100/85 transition hover:bg-white/5"
                >
                  <CheckCircle2 className="h-4 w-4 text-slate-200/70" />
                  Xóa đã xử lý
                </button>

                <button
                  onClick={() => {
                    setActionsOpen(false);
                    clearAllLocal();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-extrabold text-rose-100/90 transition hover:bg-white/5"
                >
                  <Trash2 className="h-4 w-4 text-rose-200/70" />
                  Xóa tất cả
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard title="Tổng" value={counters.total} tone="info" />
        <SummaryCard title="Đang mở" value={counters.open} tone="warning" />
        <SummaryCard title="Đã xử lý" value={counters.resolved} tone="success" />
        <SummaryCard title="Nghiêm trọng" value={counters.critical} tone="critical" />
        <SummaryCard title="Cảnh báo" value={counters.warning} tone="warning" />
        <SummaryCard title="Thông tin" value={counters.info} tone="info" />
      </div>

      {/* Filters + Settings */}
      <div className="mt-4 rounded-3xl border border-slate-700/40 bg-slate-950/15 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6 lg:items-end">
          <div className="lg:col-span-2">
            <FieldLabel>Tìm kiếm</FieldLabel>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Xe / mã chuyến / tuyến / nội dung..."
              className="w-full rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 placeholder:text-slate-400 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
            />
          </div>

          <div>
            <FieldLabel>Mức độ</FieldLabel>
            <select
              value={sev}
              onChange={(e) => setSev(e.target.value)}
              className="w-full rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
            >
              <option value="all">Tất cả</option>
              <option value="critical">Nghiêm trọng</option>
              <option value="warning">Cảnh báo</option>
              <option value="info">Thông tin</option>
            </select>
          </div>

          <div>
            <FieldLabel>Trạng thái</FieldLabel>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
            >
              <option value="open">Đang mở</option>
              <option value="resolved">Đã xử lý</option>
              <option value="all">Tất cả</option>
            </select>
          </div>

          <div>
            <FieldLabel>Loại</FieldLabel>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
            >
              {typesList.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "Tất cả" : typeLabel(t)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Tự quét</FieldLabel>
            <label className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-100">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 accent-sky-500"
              />
              {autoRefresh ? "Bật" : "Tắt"}
            </label>
          </div>

          <div>
            <FieldLabel>Chu kỳ (giây)</FieldLabel>
            <input
              value={scanEverySec}
              onChange={(e) => setScanEverySec(e.target.value)}
              type="number"
              min={1}
              max={30}
              className="w-full rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
            />
          </div>
        </div>

        {/* SLA settings */}
        <div className="mt-4 border-t border-slate-700/30 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-black text-slate-100">Thiết lập SLA (áp dụng 1/2/3)</div>
            <button
              className={buttonClass("primary")}
              onClick={() => {
                saveSettings();
                alert("✅ Đã lưu thiết lập SLA");
              }}
            >
              💾 Lưu thiết lập
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* 2) fixed */}
            <div className="rounded-2xl border border-slate-700/40 bg-slate-900/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-black text-slate-100">2) SLA cố định</div>
                <label className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-100">
                  <input
                    type="checkbox"
                    checked={!!settings.enableFixed}
                    onChange={(e) => {
                      const next = { ...settings, enableFixed: e.target.checked };
                      setSettings(next);
                      localStorage.setItem(KEYS.settings, JSON.stringify(next));
                    }}
                    className="h-4 w-4 accent-sky-500"
                  />
                  {settings.enableFixed ? "Bật" : "Tắt"}
                </label>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="text-sm text-slate-200/70">Ngưỡng trễ</div>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={settings.fixedSlaSec}
                  onChange={(e) => {
                    const next = { ...settings, fixedSlaSec: Number(e.target.value || 60) };
                    setSettings(next);
                    localStorage.setItem(KEYS.settings, JSON.stringify(next));
                  }}
                  className="w-28 rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
                />
                <div className="text-sm text-slate-200/70">giây</div>
              </div>

              <div className="mt-2 text-xs text-slate-200/60">
                Theo yêu cầu của bạn: mặc định <span className="font-extrabold text-slate-100">60 giây</span>.
              </div>
            </div>

            {/* 1) path */}
            <div className="rounded-2xl border border-slate-700/40 bg-slate-900/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-black text-slate-100">1) Theo hành trình</div>
                <label className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-100">
                  <input
                    type="checkbox"
                    checked={!!settings.enablePath}
                    onChange={(e) => {
                      const next = { ...settings, enablePath: e.target.checked };
                      setSettings(next);
                      localStorage.setItem(KEYS.settings, JSON.stringify(next));
                    }}
                    className="h-4 w-4 accent-sky-500"
                  />
                  {settings.enablePath ? "Bật" : "Tắt"}
                </label>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="text-sm text-slate-200/70">Hệ số cho phép</div>
                <input
                  type="number"
                  step="0.05"
                  min={1}
                  max={2}
                  value={settings.pathFactor}
                  onChange={(e) => {
                    const next = { ...settings, pathFactor: Number(e.target.value || 1.2) };
                    setSettings(next);
                    localStorage.setItem(KEYS.settings, JSON.stringify(next));
                  }}
                  className="w-28 rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
                />
              </div>

              <div className="mt-2 text-xs text-slate-200/60">
                Trễ nếu thời gian chạy &gt; <span className="font-extrabold text-slate-100">(thời gian dự kiến)</span> × hệ số.
              </div>
            </div>

            {/* 3) route */}
            <div className="rounded-2xl border border-slate-700/40 bg-slate-900/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-black text-slate-100">3) Theo tuyến/điểm giao</div>
                <label className="inline-flex items-center gap-2 text-sm font-extrabold text-slate-100">
                  <input
                    type="checkbox"
                    checked={!!settings.enableRoute}
                    onChange={(e) => {
                      const next = { ...settings, enableRoute: e.target.checked };
                      setSettings(next);
                      localStorage.setItem(KEYS.settings, JSON.stringify(next));
                    }}
                    className="h-4 w-4 accent-sky-500"
                  />
                  {settings.enableRoute ? "Bật" : "Tắt"}
                </label>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.keys(routeSla)
                  .sort()
                  .map((k) => (
                    <div key={k} className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/40 bg-slate-950/20 px-3 py-2">
                      <div className="text-sm font-extrabold text-slate-100">{k.replace(",", ".")}</div>
                      <input
                        type="number"
                        min={10}
                        max={600}
                        value={routeSla[k]}
                        onChange={(e) => {
                          const next = { ...routeSla, [k]: Number(e.target.value || 60) };
                          setRouteSla(next);
                          localStorage.setItem(KEYS.routeSla, JSON.stringify(next));
                        }}
                        className="w-24 rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
                      />
                    </div>
                  ))}
              </div>

              <div className="mt-2 text-xs text-slate-200/60">
                Mỗi điểm giao (ví dụ <span className="font-extrabold text-slate-100">5.1</span>) có SLA riêng. Bạn có thể chỉnh trực tiếp tại đây.
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-700/40 bg-slate-900/20 p-4">
              <div className="font-black text-slate-100">Xe đứng yên</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="text-sm text-slate-200/70">Ngưỡng</div>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={settings.idleSec}
                  onChange={(e) => {
                    const next = { ...settings, idleSec: Number(e.target.value || 20) };
                    setSettings(next);
                    localStorage.setItem(KEYS.settings, JSON.stringify(next));
                  }}
                  className="w-28 rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
                />
                <div className="text-sm text-slate-200/70">giây</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/40 bg-slate-900/20 p-4">
              <div className="font-black text-slate-100">Dữ liệu đứng yên</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="text-sm text-slate-200/70">Ngưỡng</div>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={settings.staleSec}
                  onChange={(e) => {
                    const next = { ...settings, staleSec: Number(e.target.value || 20) };
                    setSettings(next);
                    localStorage.setItem(KEYS.settings, JSON.stringify(next));
                  }}
                  className="w-28 rounded-xl border border-slate-700/50 bg-slate-950/25 px-3 py-2 text-slate-100 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-500/25"
                />
                <div className="text-sm text-slate-200/70">giây</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/40 bg-slate-900/20 p-4">
              <div className="font-black text-slate-100">Mẹo dùng nhanh</div>
              <div className="mt-3 text-sm text-slate-200/70 leading-relaxed">
                - Bấm 1 dòng để xem chi tiết &amp; hành trình.<br />
                - “Đã xử lý” sẽ được lưu ở localStorage.<br />
                - “Demo” giúp bạn xem UI ngay cả khi chưa chạy xe.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-3xl border border-slate-700/40 bg-slate-950/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/30 px-4 py-3">
          <div className="font-black text-slate-100">Danh sách cảnh báo</div>
          <div className="text-xs text-slate-200/70">
            Hiển thị <span className="font-extrabold text-slate-100">{pageItems.length}</span> /{" "}
            <span className="font-extrabold text-slate-100">{filtered.length}</span> (trang {page + 1}/{pageCount})
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="bg-slate-950/25 border-b border-slate-700/30">
                <Th>Mức độ</Th>
                <Th>Loại</Th>
                <Th>Xe</Th>
                <Th>Mã chuyến</Th>
                <Th>Tuyến</Th>
                <Th>Nội dung</Th>
                <Th>Thời gian</Th>
                <Th>Trạng thái</Th>
                <Th>Thao tác</Th>
              </tr>
            </thead>

            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-slate-200/70">
                    Không có cảnh báo phù hợp bộ lọc.
                  </td>
                </tr>
              ) : (
                pageItems.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={cx(
                      "cursor-pointer border-b border-slate-700/20 transition hover:bg-slate-800/20",
                      a.status === "resolved" ? "bg-emerald-500/5" : "bg-transparent"
                    )}
                  >
                    <td className="px-4 py-3">
                      <Badge severity={a.severity} />
                    </td>
                    <td className="px-4 py-3 font-extrabold text-slate-100">{typeLabel(a.type)}</td>
                    <td className="px-4 py-3 text-slate-100">{a.vehicleId}</td>
                    <td className="px-4 py-3 font-extrabold text-sky-200">{a.tripCode || "-"}</td>
                    <td className="px-4 py-3 text-slate-100">{a.route || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="font-black text-slate-100">{a.title}</div>
                      <div className="mt-1 text-slate-200/70 leading-snug">{a.description}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-200/75">{a.timeText || formatViDateTime(a.createdAt)}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {a.status === "open" ? (
                          <button
                            className={buttonClass("success")}
                            onClick={(e) => {
                              e.stopPropagation();
                              markResolved(a.id, true);
                            }}
                          >
                            ✅ Đã xử lý
                          </button>
                        ) : (
                          <button
                            className={buttonClass("ghost")}
                            onClick={(e) => {
                              e.stopPropagation();
                              markResolved(a.id, false);
                            }}
                          >
                            ↩️ Mở lại
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-200/70">{filtered.length === 0 ? "—" : `Tổng ${filtered.length} cảnh báo`}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={buttonClass("ghost", page <= 0)} disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              ◀
            </button>

            <div className="flex flex-wrap gap-2">
              {Array.from({ length: pageCount }, (_, i) => i)
                .slice(Math.max(0, page - 2), Math.min(pageCount, page + 3))
                .map((i) => (
                  <button
                    key={i}
                    className={buttonClass(page === i ? "primary" : "ghost")}
                    onClick={() => setPage(i)}
                  >
                    {i + 1}
                  </button>
                ))}
            </div>

            <button
              className={buttonClass("ghost", page >= pageCount - 1)}
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && <AlertDetailModal alert={selected} onClose={() => setSelected(null)} onResolve={(resolved) => markResolved(selected.id, resolved)} />}
    </div>
  </div>
</div>
);
}

// =========================
// Components
// =========================
function FieldLabel({ children }) {
  return <div className="mb-1 text-xs font-extrabold text-slate-200/70">{children}</div>;
}

function Th({ children }) {
  return <th className="px-4 py-3 text-left text-xs font-extrabold tracking-wide text-slate-200/70">{children}</th>;
}

function SummaryCard({ title, value, tone }) {
  const dot = {
    critical: "bg-rose-400",
    warning: "bg-amber-400",
    info: "bg-sky-400",
    success: "bg-emerald-400",
  };
  const num = {
    critical: "text-rose-100",
    warning: "text-amber-100",
    info: "text-sky-100",
    success: "text-emerald-100",
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 backdrop-blur-xl shadow-[0_18px_55px_-35px_rgba(0,0,0,.85)]">
      <div className="flex items-center justify-between">
        <div className="text-xs font-extrabold text-slate-200/70">{title}</div>
        <span className={cx("inline-block h-2.5 w-2.5 rounded-full", dot[tone] || dot.info)} />
      </div>
      <div className={cx("mt-2 text-3xl font-black", num[tone] || num.info)}>{value}</div>
    </div>
  );
}

function Badge({ severity }) {
  const map = {
    critical: { label: "Nghiêm trọng", cls: "border-rose-400/30 bg-rose-500/10 text-rose-100" },
    warning: { label: "Cảnh báo", cls: "border-amber-400/30 bg-amber-500/10 text-amber-100" },
    info: { label: "Thông tin", cls: "border-sky-400/30 bg-sky-500/10 text-sky-100" },
  };
  const m = map[severity] || map.info;

  return <span className={cx("inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-extrabold", m.cls)}>{m.label}</span>;
}

function StatusPill({ status }) {
  const isResolved = status === "resolved";
  return (
    <span
      className={cx(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-extrabold",
        isResolved ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-amber-400/30 bg-amber-500/10 text-amber-100"
      )}
    >
      {isResolved ? "Đã xử lý" : "Đang mở"}
    </span>
  );
}

function AlertDetailModal({ alert, onClose, onResolve }) {
  const [scale, setScale] = useState(1);

  const meta = alert?.meta || {};
  const pathStr = meta.pathStr || meta.path || alert?.meta?.pathStr || "";
  const rules = Array.isArray(meta.rulesTriggered) ? meta.rulesTriggered : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[min(980px,96vw)] overflow-hidden rounded-3xl border border-slate-700/40 bg-slate-950/70 shadow-[0_30px_90px_-40px_rgba(0,0,0,.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-700/30 px-5 py-4">
          <div>
            <div className="flex items-center gap-3">
              <Badge severity={alert.severity} />
              <div className="text-lg font-black text-slate-100">{typeLabel(alert.type)}</div>
            </div>
            <div className="mt-2 text-sm text-slate-200/70">
              <span className="font-extrabold text-slate-100">{alert.vehicleId}</span> • {alert.tripCode || "-"} • {alert.route || "-"}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {alert.status === "open" ? (
              <button className={buttonClass("success")} onClick={() => onResolve(true)}>
                ✅ Đã xử lý
              </button>
            ) : (
              <button className={buttonClass("primary")} onClick={() => onResolve(false)}>
                ↩️ Mở lại
              </button>
            )}

            <button className={buttonClass("ghost")} onClick={onClose}>
              ✖ Đóng
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="text-base font-black text-slate-100">{alert.title}</div>
              <div className="mt-2 text-sm text-slate-200/75 leading-relaxed">{alert.description}</div>

              {rules.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-black text-slate-100">Rule kích hoạt</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rules.map((r) => (
                      <span key={r} className="inline-flex rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-1 text-xs font-extrabold text-sky-100">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!!pathStr && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-black text-slate-100">Hành trình</div>
                    <div className="flex flex-wrap gap-2">
                      <button className={buttonClass("ghost")} onClick={() => setScale((s) => clamp(Number(s) - 0.15, 0.6, 2.2))}>
                        ➖ Thu nhỏ
                      </button>
                      <button className={buttonClass("ghost")} onClick={() => setScale(1)}>
                        🔁 100%
                      </button>
                      <button className={buttonClass("ghost")} onClick={() => setScale((s) => clamp(Number(s) + 0.15, 0.6, 2.2))}>
                        ➕ Phóng to
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 max-h-72 overflow-auto rounded-2xl border border-slate-700/40 bg-slate-950/25 p-3">
                    <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", whiteSpace: "nowrap" }} className="font-extrabold text-slate-100">
                      {pathStr}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="text-sm font-black text-slate-100">Thông tin</div>
              <div className="mt-3 grid gap-2">
                <InfoRow k="Thời gian tạo" v={alert.timeText || formatViDateTime(alert.createdAt)} />
                <InfoRow k="Cập nhật" v={alert.updatedAt ? formatViDateTime(alert.updatedAt) : "—"} />
                <InfoRow k="Trạng thái" v={alert.status === "open" ? "Đang mở" : "Đã xử lý"} />
                {meta?.elapsedSec != null && <InfoRow k="Thời gian chạy" v={`${Math.round(meta.elapsedSec)}s`} />}
                {meta?.slaFixedSec != null && <InfoRow k="SLA cố định" v={`${meta.slaFixedSec}s`} />}
                {meta?.slaRouteSec != null && <InfoRow k="SLA theo điểm giao" v={`${meta.slaRouteSec}s`} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ k, v }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-700/40 bg-slate-950/25 px-3 py-2">
      <div className="text-xs font-extrabold text-slate-200/70">{k}</div>
      <div className="text-right text-xs font-black text-slate-100">{v}</div>
    </div>
  );
}

// =========================
// Alert generation rules
// =========================
function generateAlerts({ vehicles, tripLogs, settings, routeSla, ackMap }) {
  const now = new Date();
  const nowMs = now.getTime();

  // ackMap: { alertId: {status, updatedAt,...} }
  const getAck = (id) => (ackMap && ackMap[id] ? ackMap[id] : null);

  // active trip for vehicle: latest trip log (by startAt) for vehicle
  const latestTripByVehicle = new Map();
  for (const t of tripLogs) {
    const key = t.vehicleId;
    const ts = t.startAt ? new Date(t.startAt).getTime() : 0;
    const cur = latestTripByVehicle.get(key);
    if (!cur || ts > (cur._ts || 0)) latestTripByVehicle.set(key, { ...t, _ts: ts });
  }

  // helper: compute ETA from vehicle.tripLog / trip.pathArr
  const etaFrom = (v, trip) => {
    const arr = Array.isArray(v?.tripLog) && v.tripLog.length ? v.tripLog : Array.isArray(trip?.pathArr) && trip.pathArr.length ? trip.pathArr : null;
    if (!arr) return null;
    // Home tick 1s/step
    return Math.max(1, arr.length - 1);
  };

  const startAtFrom = (trip) => {
    if (!trip) return null;
    if (trip.startAt) return new Date(trip.startAt);
    const dt = parseViDateTime(trip.timeText || trip.time || "");
    return dt;
  };

  // 1) LATE (SLA) alerts
  const out = [];

  for (const v of vehicles) {
    const isMoving = String(v.status).toLowerCase() === "moving";
    if (!isMoving) continue;

    const trip = latestTripByVehicle.get(v.id);
    const startDt = startAtFrom(trip);
    if (!startDt || !Number.isFinite(startDt.getTime())) continue;

    const elapsedSec = Math.max(0, (nowMs - startDt.getTime()) / 1000);

    const destKey = (() => {
      if (v.endPos) return posKey(v.endPos);
      if (trip?.endKey) return trip.endKey;
      // parse routeText fallback
      if (trip?.routeText) {
        const parts = String(trip.routeText).split("→").map((x) => x.trim());
        const last = parts[parts.length - 1] || "";
        const xy = last.split(",").map((x) => x.trim());
        if (xy.length >= 2 && Number.isFinite(+xy[0]) && Number.isFinite(+xy[1])) return `${Number(xy[0])},${Number(xy[1])}`;
      }
      return null;
    })();

    const routeText = (() => {
      if (trip?.routeText) return trip.routeText;
      if (destKey) return `→ ${destKey.replace(",", ".")}`;
      return "-";
    })();

    const etaPathSec = etaFrom(v, trip);
    const slaFixedSec = Number(settings.fixedSlaSec) || 60;
    const pathFactor = Number(settings.pathFactor) || 1.2;
    const slaRouteSec = destKey && routeSla && routeSla[destKey] ? Number(routeSla[destKey]) : null;

    const rulesTriggered = [];
    if (settings.enableFixed && elapsedSec > slaFixedSec) rulesTriggered.push(`SLA cố định ${slaFixedSec}s`);
    if (settings.enablePath && etaPathSec != null && elapsedSec > etaPathSec * pathFactor)
      rulesTriggered.push(`Theo hành trình (×${pathFactor})`);
    if (settings.enableRoute && slaRouteSec != null && elapsedSec > slaRouteSec) rulesTriggered.push(`Theo điểm giao ${destKey.replace(",", ".")} (${slaRouteSec}s)`);

    if (rulesTriggered.length > 0) {
      const over = Math.max(
        settings.enableFixed ? elapsedSec - slaFixedSec : 0,
        settings.enableRoute && slaRouteSec != null ? elapsedSec - slaRouteSec : 0,
        settings.enablePath && etaPathSec != null ? elapsedSec - etaPathSec * pathFactor : 0
      );

      const severity = over > 30 ? "critical" : "warning";
      const deliveryId = trip?.deliveryId || trip?.deliveryCode || null;
      const tripCode = deliveryId || `DH-${v.id}-${formatViTime(startDt)}`;

      const id = makeAlertId("DELIVERY_LATE", v.id, tripCode);
      const ack = getAck(id);
      const status = ack?.status || "open";

      out.push({
        id,
        type: "DELIVERY_LATE",
        severity,
        status,
        createdAt: startDt.toISOString(),
        updatedAt: ack?.updatedAt || startDt.toISOString(),
        vehicleId: v.id,
        tripCode,
        route: routeText,
        title: "Cảnh báo trễ giao",
        description: `Xe đang giao nhưng vượt ngưỡng SLA. Đã chạy ~${Math.round(elapsedSec)}s.`,
        timeText: trip?.timeText || formatViDateTime(startDt),
        meta: {
          rulesTriggered,
          elapsedSec,
          slaFixedSec,
          slaRouteSec,
          pathStr: trip?.pathStr || (Array.isArray(v.tripLog) ? v.tripLog.map((p) => `${p[0]}.${p[1]}`).join(" → ") : ""),
        },
      });
    }

    // 2) ROUTE_CHANGED (nếu endPos thay đổi so với route log)
    if (trip?.endKey && v.endPos && posKey(v.endPos) !== trip.endKey) {
      const id = makeAlertId("ROUTE_CHANGED", v.id, `${trip?.deliveryId || "trip"}`);
      const ack = getAck(id);
      out.push({
        id,
        type: "ROUTE_CHANGED",
        severity: "info",
        status: ack?.status || "open",
        createdAt: now.toISOString(),
        updatedAt: ack?.updatedAt || now.toISOString(),
        vehicleId: v.id,
        tripCode: trip?.deliveryId || "-",
        route: `${trip.endKey.replace(",", ".")} → ${posKey(v.endPos).replace(",", ".")}`,
        title: "Điểm giao bị thay đổi khi xe đang chạy",
        description: "Hệ thống phát hiện điểm giao hiện tại khác với điểm giao lúc khởi tạo chuyến.",
        timeText: formatViDateTime(now),
        meta: {},
      });
    }
  }

  // 3) VEHICLE_IDLE (moving nhưng đứng yên)
  try {
    const lastPosMap = safeParse(localStorage.getItem(KEYS.lastPosMap), {});
    const nextPosMap = { ...(lastPosMap || {}) };
    const idleSec = Number(settings.idleSec) || 20;

    for (const v of vehicles) {
      const isMoving = String(v.status).toLowerCase() === "moving";
      if (!isMoving || !v.pos) continue;

      const k = v.id;
      const curKey = posKey(v.pos);
      const prev = nextPosMap[k];
      const tNow = nowMs;

      if (!prev) {
        nextPosMap[k] = { posKey: curKey, t: tNow };
        continue;
      }

      if (prev.posKey !== curKey) {
        nextPosMap[k] = { posKey: curKey, t: tNow };
        continue;
      }

      const dtSec = (tNow - (prev.t || tNow)) / 1000;
      if (dtSec >= idleSec) {
        const id = makeAlertId("VEHICLE_IDLE", v.id, curKey);
        const ack = getAck(id);
        out.push({
          id,
          type: "VEHICLE_IDLE",
          severity: dtSec > idleSec + 20 ? "warning" : "info",
          status: ack?.status || "open",
          createdAt: new Date(prev.t || tNow).toISOString(),
          updatedAt: ack?.updatedAt || now.toISOString(),
          vehicleId: v.id,
          tripCode: "-",
          route: curKey.replace(",", "."),
          title: "Xe đứng yên khi đang giao",
          description: `Xe đang ở trạng thái 'moving' nhưng không đổi vị trí trong ~${Math.round(dtSec)}s.`,
          timeText: formatViDateTime(prev.t || now),
          meta: { elapsedSec: dtSec },
        });
      }
    }

    localStorage.setItem(KEYS.lastPosMap, JSON.stringify(nextPosMap));
  } catch {
    // ignore
  }

  // 4) COLLISION_RISK (2 xe cùng vị trí hoặc cùng next step)
  const moving = vehicles.filter((v) => String(v.status).toLowerCase() === "moving" && v.pos);
  for (let i = 0; i < moving.length; i++) {
    for (let j = i + 1; j < moving.length; j++) {
      const a = moving[i];
      const b = moving[j];
      const aPos = posKey(a.pos);
      const bPos = posKey(b.pos);
      if (!aPos || !bPos) continue;

      // same current pos => critical
      if (aPos === bPos) {
        const id = makeAlertId("COLLISION_RISK", `${a.id}+${b.id}`, aPos);
        const ack = getAck(id);
        out.push({
          id,
          type: "COLLISION_RISK",
          severity: "critical",
          status: ack?.status || "open",
          createdAt: now.toISOString(),
          updatedAt: ack?.updatedAt || now.toISOString(),
          vehicleId: `${a.id}, ${b.id}`,
          tripCode: "-",
          route: aPos.replace(",", "."),
          title: "Hai xe đang trùng vị trí",
          description: "Nguy cơ va chạm cao: 2 xe đang ở cùng một ô trên bản đồ.",
          timeText: formatViDateTime(now),
          meta: {},
        });
        continue;
      }

      // same next step => warning
      const aNext = Array.isArray(a.path) && a.path.length ? posKey(a.path[0]) : null;
      const bNext = Array.isArray(b.path) && b.path.length ? posKey(b.path[0]) : null;
      if (aNext && bNext && aNext === bNext) {
        const id = makeAlertId("COLLISION_RISK", `${a.id}+${b.id}`, aNext);
        const ack = getAck(id);
        out.push({
          id,
          type: "COLLISION_RISK",
          severity: "warning",
          status: ack?.status || "open",
          createdAt: now.toISOString(),
          updatedAt: ack?.updatedAt || now.toISOString(),
          vehicleId: `${a.id}, ${b.id}`,
          tripCode: "-",
          route: aNext.replace(",", "."),
          title: "Hai xe sắp vào cùng một vị trí",
          description: "Nguy cơ giao cắt: 2 xe có bước tiếp theo trùng nhau.",
          timeText: formatViDateTime(now),
          meta: {},
        });
      }
    }
  }

  // 5) DATA_STALE (dữ liệu vehicles không đổi quá lâu trong khi có xe chạy)
  try {
    const movingCount = vehicles.filter((v) => String(v.status).toLowerCase() === "moving").length;
    if (movingCount > 0) {
      const fp = JSON.stringify(
        vehicles.map((v) => ({
          id: v.id,
          pos: v.pos,
          status: v.status,
          endPos: v.endPos,
          pathLen: Array.isArray(v.path) ? v.path.length : 0,
        }))
      );
      const prev = safeParse(localStorage.getItem(KEYS.fingerprint), null);
      const staleSec = Number(settings.staleSec) || 20;

      if (prev?.fp === fp) {
        const dtSec = (nowMs - (prev.t || nowMs)) / 1000;
        if (dtSec >= staleSec) {
          const id = makeAlertId("DATA_STALE", "SYSTEM", "vehicles");
          const ack = getAck(id);
          out.push({
            id,
            type: "DATA_STALE",
            severity: dtSec > staleSec + 20 ? "warning" : "info",
            status: ack?.status || "open",
            createdAt: new Date(prev.t || nowMs).toISOString(),
            updatedAt: ack?.updatedAt || now.toISOString(),
            vehicleId: "HỆ THỐNG",
            tripCode: "-",
            route: "-",
            title: "Dữ liệu không cập nhật",
            description: `Trong khi có xe đang chạy, dữ liệu vị trí không thay đổi ~${Math.round(dtSec)}s (có thể mất sync/tab treo).`,
            timeText: formatViDateTime(prev.t || now),
            meta: { elapsedSec: dtSec },
          });
        }
      } else {
        localStorage.setItem(KEYS.fingerprint, JSON.stringify({ fp, t: nowMs }));
      }
    }
  } catch {
    // ignore
  }

  // apply ack statuses (so resolve persists even if regenerated)
  return out.map((a) => {
    const ack = getAck(a.id);
    if (!ack) return a;
    return {
      ...a,
      status: ack.status || a.status,
      updatedAt: ack.updatedAt || a.updatedAt,
    };
  });
}

// =========================
// Demo alerts
// =========================
function makeDemoAlerts() {
  const base = new Date();
  const mk = (minsAgo) => new Date(base.getTime() - minsAgo * 60 * 1000).toISOString();
  return [
    {
      id: "DEMO|late|V1|DH0001",
      type: "DELIVERY_LATE",
      severity: "critical",
      status: "open",
      createdAt: mk(6),
      updatedAt: mk(6),
      vehicleId: "V1",
      tripCode: "DH0001-20260205-224608",
      route: "1.1 → 5.1",
      title: "Cảnh báo trễ giao",
      description: "Xe V1 vượt SLA cố định 60s và SLA theo điểm giao (5.1).",
      timeText: formatViDateTime(mk(6)),
      meta: { rulesTriggered: ["SLA cố định 60s", "Theo điểm giao 5.1 (60s)"], pathStr: "1.1 → 2.1 → 3.1 → 4.1 → 5.1 → 4.1 → 3.1 → 2.1 → 1.1" },
    },
    {
      id: "DEMO|collision|V2+V3|2.3",
      type: "COLLISION_RISK",
      severity: "warning",
      status: "open",
      createdAt: mk(2),
      updatedAt: mk(2),
      vehicleId: "V2, V3",
      tripCode: "-",
      route: "2.3",
      title: "Hai xe sắp vào cùng một vị trí",
      description: "Nguy cơ giao cắt: bước tiếp theo trùng nhau.",
      timeText: formatViDateTime(mk(2)),
      meta: {},
    },
    {
      id: "DEMO|idle|V4|3.2",
      type: "VEHICLE_IDLE",
      severity: "info",
      status: "open",
      createdAt: mk(4),
      updatedAt: mk(4),
      vehicleId: "V4",
      tripCode: "-",
      route: "3.2",
      title: "Xe đứng yên khi đang giao",
      description: "Xe V4 không đổi vị trí trong 25s.",
      timeText: formatViDateTime(mk(4)),
      meta: { elapsedSec: 25 },
    },
    {
      id: "DEMO|stale|SYS|vehicles",
      type: "DATA_STALE",
      severity: "warning",
      status: "open",
      createdAt: mk(8),
      updatedAt: mk(8),
      vehicleId: "HỆ THỐNG",
      tripCode: "-",
      route: "-",
      title: "Dữ liệu không cập nhật",
      description: "Dữ liệu vị trí đứng yên trong khi có xe chạy (mất sync/tab treo).",
      timeText: formatViDateTime(mk(8)),
      meta: {},
    },
  ];
}
