import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Truck,
  MapPin,
  Clock,
  X,
  ChevronRight,
  BadgeCheck,
  AlertTriangle,
  Route,
  CarFront,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  Trash2,
  RotateCcw,
} from "lucide-react";

/**
 * Statistics.jsx (updated)
 * - Chuyển "Quản lý chuyến đi" + "Nhật ký hành trình" từ Inventory.jsx sang đây.
 * - Dữ liệu lấy ổn định từ Home.jsx + RealTime.jsx (localStorage):
 *   + tripLogs
 *   + home_vehicles_state, realtime_vehicles_state (để xác định xe đang moving)
 *   + home_logs, realtime_logs
 * - Biển số xe lưu ở localStorage: vehicle_plates_v1
 */

const LS = {
  TRIP_LOGS: "tripLogs",
  HOME_VEHICLES: "home_vehicles_state",
  REALTIME_VEHICLES: "realtime_vehicles_state",
  HOME_LOGS: "home_logs",
  REALTIME_LOGS: "realtime_logs",
  VEHICLE_PLATES: "vehicle_plates_v1",
};

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function pad2(n) {
  const x = Number(n) || 0;
  return String(x).padStart(2, "0");
}
function fmtTimeKey(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "UNKNOWN";
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}
function formatTime(isoOrText) {
  if (!isoOrText) return "";
  const d = new Date(isoOrText);
  if (!isNaN(d.getTime())) return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return String(isoOrText);
}
function tryParseViDateTime(txt) {
  if (!txt) return null;
  const s = String(txt).trim();

  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;

  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (m) {
    const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
    const hh = Number(m[4]), mi = Number(m[5]), ss = Number(m[6] || 0);
    const d = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    return isNaN(d.getTime()) ? null : d;
  }

  m = s.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?.*?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const hh = Number(m[1]), mi = Number(m[2]), ss = Number(m[3] || 0);
    const dd = Number(m[4]), mm = Number(m[5]), yyyy = Number(m[6]);
    const d = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function normalizeDotsFromAnyCoord(s) {
  if (!s) return "";
  const t = String(s).trim().replace(/\s+/g, "");
  const parts = t.replace(".", ",").split(",").filter(Boolean);
  if (parts.length >= 2 && isFinite(Number(parts[0])) && isFinite(Number(parts[1]))) {
    return `${Number(parts[0])}.${Number(parts[1])}`;
  }
  return String(s).trim();
}
function normalizePathText(pathText) {
  if (!pathText) return "";
  const raw = String(pathText).split("→").map((x) => x.trim()).filter(Boolean);
  if (raw.length === 0) return String(pathText);
  return raw.map(normalizeDotsFromAnyCoord).join(" → ");
}
function splitRoute(routeText) {
  const t = normalizePathText(routeText || "");
  const parts = t.split("→").map((x) => x.trim()).filter(Boolean);
  return {
    from: parts[0] || "—",
    to: parts[1] || "—",
    text: t || "—",
  };
}
function parsePathNodes(pathText) {
  const t = String(pathText || "");
  const nodes = t.split("→").map((x) => x.trim()).filter(Boolean);
  return nodes.map((n) => normalizeDotsFromAnyCoord(n)).filter(Boolean);
}
function badgeForStatus(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("hoàn") || s.includes("done") || s.includes("delivered")) {
    return { label: status || "Hoàn thành", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30", icon: BadgeCheck };
  }
  if (s.includes("trễ") || s.includes("late") || s.includes("cảnh")) {
    return { label: status || "Cảnh báo trễ", cls: "bg-amber-500/15 text-amber-200 border-amber-500/30", icon: AlertTriangle };
  }
  return { label: status || "Đang giao", cls: "bg-sky-500/15 text-sky-200 border-sky-500/30", icon: Truck };
}

// ------------------------ Export helpers ------------------------
// (escapeHtml đã được khai báo phía trên)

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke để tránh 1 số browser revoke quá sớm làm file tải bị lỗi
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

function buildExcelHtml({ columns, rows, sheetName = "Trips" }) {
  // HTML-based .xls export (Excel mở trực tiếp).
  // Dùng UTF-8 meta + BOM để Excel đọc tiếng Việt chuẩn.
  const headerCells = (Array.isArray(columns) ? columns : [])
    .map((c) => `<th style="padding:6px 8px; background:#f3f4f6; font-weight:700;">${escapeHtml(c)}</th>`)
    .join("");

  const bodyRows = (Array.isArray(rows) ? rows : [])
    .map((r) => {
      const tds = (Array.isArray(r) ? r : [])
        .map((cell) => {
          // Force TEXT để tránh Excel auto-format (mã chuyến bị scientific notation, mất số 0 đầu...)
          const v = escapeHtml(cell);
          return `<td style="padding:6px 8px; mso-number-format:'\\@'; white-space:pre-wrap;">${v}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("\n");

  return (
    "\ufeff" +
    `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <!--[if gte mso 9]>
    <xml>
      <x:ExcelWorkbook>
        <x:ExcelWorksheets>
          <x:ExcelWorksheet>
            <x:Name>${escapeHtml(sheetName)}</x:Name>
            <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
          </x:ExcelWorksheet>
        </x:ExcelWorksheets>
      </x:ExcelWorkbook>
    </xml>
    <![endif]-->
  </head>
  <body>
    <table border="1" style="border-collapse:collapse; font-family: Arial, sans-serif; font-size:12px;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body>
</html>`
  );
}

// ------------------------ Modal Shell ------------------------
function Modal({ open, title, onClose, children, footer, maxWidth = "max-w-3xl" }) {
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    setTimeout(() => closeBtnRef.current?.focus?.(), 50);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onMouseDown={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={cn("w-full rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl backdrop-blur-xl", maxWidth)}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="min-w-0">
              <div className="text-base font-semibold text-white">{title}</div>
              <div className="text-xs text-white/50">Nhấn Esc để đóng</div>
            </div>
            <button
              ref={closeBtnRef}
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-white/80 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? <div className="px-5 py-4 border-t border-white/10">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function Statistics() {
  const [tripLogs, setTripLogs] = useState([]);
  const [vehiclePlates, setVehiclePlates] = useState({});

  const [homeVehicles, setHomeVehicles] = useState([]);
  const [rtVehicles, setRtVehicles] = useState([]);

  const [homeLogs, setHomeLogs] = useState([]);
  const [rtLogs, setRtLogs] = useState([]);

  const [searchTrip, setSearchTrip] = useState("");

  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [journeyModalOpen, setJourneyModalOpen] = useState(false);
  const [journeyTitle, setJourneyTitle] = useState("");
  const [journeyText, setJourneyText] = useState("");
  const [journeyMeta, setJourneyMeta] = useState(null);
  const [zoom, setZoom] = useState(1);

  // Init & poll sync (ổn định trong cùng tab)
  useEffect(() => {
    const readAll = () => {
      setTripLogs(safeParse(localStorage.getItem(LS.TRIP_LOGS), []));
      setVehiclePlates(safeParse(localStorage.getItem(LS.VEHICLE_PLATES), {}));
      setHomeVehicles(safeParse(localStorage.getItem(LS.HOME_VEHICLES), []));
      setRtVehicles(safeParse(localStorage.getItem(LS.REALTIME_VEHICLES), []));
      setHomeLogs(safeParse(localStorage.getItem(LS.HOME_LOGS), []));
      setRtLogs(safeParse(localStorage.getItem(LS.REALTIME_LOGS), []));
    };

    readAll();
    const t = setInterval(readAll, 700);

    const onStorage = (e) => {
      if (!e?.key) return;
      if (e.key === LS.TRIP_LOGS) setTripLogs(safeParse(e.newValue, []));
      if (e.key === LS.VEHICLE_PLATES) setVehiclePlates(safeParse(e.newValue, {}));
      if (e.key === LS.HOME_VEHICLES) setHomeVehicles(safeParse(e.newValue, []));
      if (e.key === LS.REALTIME_VEHICLES) setRtVehicles(safeParse(e.newValue, []));
      if (e.key === LS.HOME_LOGS) setHomeLogs(safeParse(e.newValue, []));
      if (e.key === LS.REALTIME_LOGS) setRtLogs(safeParse(e.newValue, []));
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(t);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LS.VEHICLE_PLATES, JSON.stringify(vehiclePlates));
  }, [vehiclePlates]);

  const movingSet = useMemo(() => {
    const set = new Set();
    const addFrom = (arr) => {
      (Array.isArray(arr) ? arr : []).forEach((v) => {
        const s = String(v?.status || "").toLowerCase();
        // Home.jsx có thể dùng 'waiting' cho giai đoạn delayTicks -> vẫn tính là đang chạy chuyến
        if (s === "moving" || s === "waiting") set.add(v?.id);
      });
    };
    addFrom(homeVehicles);
    addFrom(rtVehicles);
    return set;
  }, [homeVehicles, rtVehicles]);

  const mergedLogs = useMemo(() => {
    const a = Array.isArray(rtLogs) ? rtLogs : [];
    const b = Array.isArray(homeLogs) ? homeLogs : [];
    const normalized = [...b, ...a].filter(Boolean);
    return normalized.slice(-250);
  }, [homeLogs, rtLogs]);

  const normalizedTrips = useMemo(() => {
    const raw = Array.isArray(tripLogs) ? tripLogs : [];

    const mapped = raw
      .map((e, idx) => {
        const vehicleId = e?.vehicleId || e?.vehicle_id || e?.id || e?.vehicle || "VX";
        const timeIso = e?.timeIso || e?.timeISO || e?.time_iso || e?.createdAtIso || e?.createdAt;
        const dt = timeIso ? new Date(timeIso) : tryParseViDateTime(e?.time);
        const dtOk = dt && !isNaN(dt.getTime()) ? dt : null;

        const timeKey = fmtTimeKey(dtOk || new Date());
        const deliveryId = e?.deliveryId || e?.tripId || e?.code || `LOG${idx + 1}`;

        const routeText = normalizePathText(e?.route || e?.tuyen || "");
        const r = splitRoute(routeText);
        const pathText = normalizePathText(e?.path || e?.hanhTrinh || e?.journey || "");

        const tripCode = `${deliveryId}-${timeKey}`;

        return {
          _idx: idx,
          tripCode,
          deliveryId,
          vehicleId,
          vehiclePlate: vehiclePlates?.[vehicleId] || "",
          routeText: r.text,
          from: r.from,
          to: r.to,
          journeyText: pathText,
          createdAtIso: dtOk ? dtOk.toISOString() : null,
          createdAtLabel: dtOk ? dtOk.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : (e?.time || ""),
          raw: e,
        };
      })
      .filter((x) => x.vehicleId);

    const latestByVehicle = {};
    mapped.forEach((t) => {
      const key = t.vehicleId;
      const cur = latestByVehicle[key];
      const a = t.createdAtIso ? new Date(t.createdAtIso).getTime() : -1;
      const b = cur?.createdAtIso ? new Date(cur.createdAtIso).getTime() : -1;
      if (!cur) latestByVehicle[key] = t;
      else if (a > b) latestByVehicle[key] = t;
      else if (a === b && t._idx > cur._idx) latestByVehicle[key] = t;
    });

    const now = Date.now();

    const withStatus = mapped.map((t) => {
      const isLatest = latestByVehicle[t.vehicleId]?.tripCode === t.tripCode;
      const isMoving = movingSet.has(t.vehicleId);

      let status = "Hoàn thành";
      if (isLatest) {
        if (isMoving) {
          const nodes = parsePathNodes(t.journeyText || "");
          const planned = Math.max(0, nodes.length - 1);
          const startedMs = t.createdAtIso ? new Date(t.createdAtIso).getTime() : null;
          const elapsed = startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : null;

          const threshold = planned > 0 ? Math.floor(planned * 1.5 + 15) : 60;
          status = elapsed !== null && elapsed > threshold ? "Cảnh báo trễ" : "Đang giao";
        } else {
          status = "Hoàn thành";
        }
      }
      return { ...t, status };
    });

    withStatus.sort((a, b) => {
      const ta = a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0;
      const tb = b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0;
      return tb - ta;
    });

    return withStatus;
  }, [tripLogs, vehiclePlates, movingSet]);

  const filteredTrips = useMemo(() => {
    const q = (searchTrip || "").trim().toLowerCase();
    if (!q) return normalizedTrips;
    return normalizedTrips.filter((t) => {
      const plate = (t.vehiclePlate || "").toLowerCase();
      const vid = (t.vehicleId || "").toLowerCase();
      const code = (t.tripCode || "").toLowerCase();
      const did = (t.deliveryId || "").toLowerCase();
      return code.includes(q) || did.includes(q) || vid.includes(q) || plate.includes(q);
    });
  }, [normalizedTrips, searchTrip]);

  const openJourney = (trip) => {
    if (!trip) return;
    const title = `Hành trình • ${trip.vehicleId}${trip.vehiclePlate ? ` (${trip.vehiclePlate})` : ""}`;
    setJourneyTitle(title);
    setJourneyText(trip.journeyText || "Chưa có dữ liệu hành trình.");
    setJourneyMeta({
      tripCode: trip.tripCode,
      routeText: trip.routeText,
      createdAt: trip.createdAtLabel,
      status: trip.status,
    });
    setZoom(1);
    setJourneyModalOpen(true);
  };

  const parseJourneyFromLogLine = (line) => {
    const s = String(line || "");
    const m = s.match(/^\s*\[[^\]]+\]\s*Xe\s+([A-Za-z0-9_-]+)\s*:\s*(.+)\s*$/i);
    if (!m) return null;
    return { vehicleId: m[1], journey: m[2] };
  };

  const openJourneyFromLog = (line) => {
    const parsed = parseJourneyFromLogLine(line);
    if (!parsed) return;
    setJourneyTitle(`Hành trình • ${parsed.vehicleId}`);
    setJourneyText(normalizePathText(parsed.journey));
    setJourneyMeta({
      tripCode: "—",
      routeText: "—",
      createdAt: "—",
      status: "—",
    });
    setZoom(1);
    setJourneyModalOpen(true);
  };

  const deleteTrip = (t) => {
    if (!t) return;
    const raw = safeParse(localStorage.getItem(LS.TRIP_LOGS), []);
    const next = (Array.isArray(raw) ? raw : []).filter((_, idx) => idx !== t._idx);
    localStorage.setItem(LS.TRIP_LOGS, JSON.stringify(next));
    setTripLogs(next);
  };

  const clearTrips = () => {
    if (!confirm("Xóa toàn bộ tripLogs?")) return;
    localStorage.setItem(LS.TRIP_LOGS, JSON.stringify([]));
    setTripLogs([]);
  };

  // const exportTripsToExcel = () => {
  //   const rows = (Array.isArray(filteredTrips) ? filteredTrips : []).map((t) => {
  //     const xe = t.vehiclePlate ? `${t.vehicleId} (${t.vehiclePlate})` : t.vehicleId;
  //     const time = t.createdAtLabel || formatTime(t.createdAtIso) || "";
  //     return [
  //       t.tripCode || "",
  //       xe || "",
  //       t.routeText || "",
  //       t.journeyText || "",
  //       t.status || "",
  //       time,
  //     ];
  //   });

  //   if (!rows.length) {
  //     alert("Không có dữ liệu để xuất Excel. Hãy chạy xe ở Home/RealTime để tạo tripLogs.");
  //     return;
  //   }

  //   const columns = [
  //     "Mã chuyến (realtime)",
  //     "Xe",
  //     "Tuyến",
  //     "Hành trình",
  //     "Trạng thái",
  //     "Thời gian",
  //   ];

  //   const html = buildExcelHtml({
  //     columns,
  //     rows,
  //     sheetName: "TripLogs",
  //   });

  //   const filename = `tripLogs_${fmtTimeKey(new Date())}.xls`;
  //   const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  //   downloadBlob(blob, filename);
  // };

  // ------------------------ Export Excel ------------------------
  // Gồm các cột:
  //  Mã chuyến (realtime) | Xe | Tuyến | Hành trình | Trạng thái | Thời gian
  // Xuất file Excel dạng .xls (HTML) => KHÔNG cần cài thêm package, Excel mở được.
  // (Nếu bạn nhất định cần .xlsx chuẩn, mình có thể gửi patch dùng SheetJS/XLSX, nhưng cần npm i xlsx)
  const exportTripsToExcel = () => {
    const cols = [
      "Mã chuyến (realtime)",
      "Xe",
      "Tuyến",
      "Hành trình",
      "Trạng thái",
      "Thời gian",
    ];

    const rows = (Array.isArray(filteredTrips) ? filteredTrips : []).map((t) => [
      t.tripCode || "",
      t.vehiclePlate ? `${t.vehicleId} (${t.vehiclePlate})` : (t.vehicleId || ""),
      t.routeText && t.routeText !== "—" ? t.routeText : `${t.from || "—"} → ${t.to || "—"}`,
      t.journeyText || "",
      t.status || "",
      t.createdAtLabel || formatTime(t.createdAtIso) || "",
    ]);

    if (rows.length === 0) {
      alert("Không có dữ liệu để xuất. Hãy chạy xe ở Home/RealTime để có tripLogs.");
      return;
    }

    const html = buildExcelHtml({ columns: cols, rows, sheetName: "Trips" });
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const filename = `tripLogs_${fmtTimeKey(new Date())}.xls`;
    downloadBlob(blob, filename);
  };

  // ------------------------ Render ------------------------
  return (
    <div className="relative min-h-screen text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />

      {/*
        UI fix for zoom-out (vd: 50%) & bám lề trái:
        - Bỏ mx-auto + max-w-7xl để nội dung không bị "lọt thỏm" ở giữa.
        - Khi viewport cực rộng (thường gặp khi user zoom ~50%), scale nhẹ nội dung để dễ đọc hơn.
      */}
      <div className="relative w-full max-w-none px-4 sm:px-6 lg:px-8 2xl:px-10 py-8">
        <div className="[@media(min-width:2400px)]:scale-[1.12] [@media(min-width:2400px)]:origin-top-left">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <span>Logistics</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-white/80">Statistics</span>
            </div>

            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">THỐNG KÊ & NHẬT KÝ</h1>
            <p className="mt-2 text-white/60">
              Quản lý chuyến đi + nhật ký hành trình (đồng bộ realtime từ Home.jsx / RealTime.jsx)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
            <button
              onClick={exportTripsToExcel}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15 transition"
              title="Xuất danh sách chuyến đi ra Excel (.xls)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Xuất Excel
            </button>
            <button
              onClick={clearTrips}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 hover:bg-rose-500/15 transition"
              title="Xóa toàn bộ tripLogs"
            >
              <RotateCcw className="w-4 h-4" />
              Reset tripLogs
            </button>
          </div>
        </div>

        {/* Trip Management */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)] overflow-hidden">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between border-b border-white/10">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Route className="w-4 h-4" />
                <span className="font-semibold text-white">Quản lý chuyến đi</span>
              </div>
              <div className="mt-1 text-xs text-white/50">
                "Tuyến" + "Hành trình" + "Trạng thái" được đồng bộ từ Home.jsx / RealTime.jsx
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative w-full sm:w-[360px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  value={searchTrip}
                  onChange={(e) => setSearchTrip(e.target.value)}
                  placeholder="Tìm theo mã chuyến / xe / biển số..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/40 pl-10 pr-3 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20 focus:bg-slate-950/55 transition"
                />
              </div>

              <button
                onClick={() => setVehicleModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-3 text-sm font-semibold text-white/85 transition"
              >
                <CarFront className="w-4 h-4" />
                Biển số xe
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="min-w-[1120px] w-full">
              <thead className="sticky top-0 bg-slate-950/55 backdrop-blur-xl">
                <tr className="text-left text-xs uppercase tracking-wider text-white/50">
                  <th className="px-5 py-4">Mã chuyến (realtime)</th>
                  <th className="px-5 py-4">Xe</th>
                  <th className="px-5 py-4">Tuyến</th>
                  <th className="px-5 py-4">Hành trình</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4">Thời gian</th>
                  <th className="px-5 py-4 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-white/50">
                      Không có dữ liệu chuyến đi. (Hãy chạy xe ở Home/RealTime để có tripLogs)
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((t) => {
                    const b = badgeForStatus(t.status);
                    const Icon = b.icon;
                    const route = splitRoute(t.routeText);
                    const journeyPreview = t.journeyText ? t.journeyText : "Chưa có dữ liệu";

                    return (
                      <tr key={`${t.tripCode}-${t._idx}`} className="border-t border-white/10 hover:bg-white/5 transition">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">{t.tripCode}</div>
                          <div className="mt-1 text-xs text-white/45">
                            ID: <span className="text-white/70 font-semibold">{t.deliveryId}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm">
                            <Truck className="w-4 h-4 text-white/60" />
                            <span className="text-white/90 font-semibold">{t.vehicleId}</span>
                            {t.vehiclePlate ? <span className="text-xs text-white/60">({t.vehiclePlate})</span> : null}
                          </div>
                          <div className="mt-1 text-xs text-white/45">* Không dùng tài xế (hệ thống tự động)</div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm text-white/85">{route.from}</div>
                          <div className="mt-1 text-xs text-white/50">→ {route.to}</div>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() => openJourney(t)}
                            className="group inline-flex items-center gap-2 text-left text-sm text-white/80 hover:text-white transition"
                            title="Nhấp để phóng to hành trình"
                          >
                            <MapPin className="w-4 h-4 text-white/50 group-hover:text-white/70" />
                            <span className="truncate max-w-[360px]">{journeyPreview}</span>
                          </button>
                          <div className="mt-1 text-xs text-white/45">Node: {parsePathNodes(t.journeyText || "").length || 0}</div>
                        </td>

                        <td className="px-5 py-4">
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs", b.cls)}>
                            <Icon className="w-3.5 h-3.5" />
                            {b.label}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-sm text-white/70">
                          <span className="inline-flex items-center gap-2">
                            <Clock className="w-4 h-4 text-white/40" />
                            {t.createdAtLabel || formatTime(t.createdAtIso)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openJourney(t)}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/85 transition"
                            >
                              <Route className="w-4 h-4" />
                              Xem (zoom)
                            </button>
                            <button
                              onClick={() => deleteTrip(t)}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/15 px-3 py-2.5 text-sm font-semibold text-rose-100 transition"
                              title="Xóa chuyến này khỏi tripLogs"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-white/10 text-xs text-white/45">
            Tip: Có thể tìm nhanh theo <span className="text-white/70 font-semibold">V1</span>,{" "}
            <span className="text-white/70 font-semibold">DH0001</span> hoặc biển số xe.
          </div>
        </div>

        {/* Logs Section */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)] overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <MapPin className="w-4 h-4" />
              <span className="font-semibold text-white">Nhật ký hành trình</span>
            </div>
            <div className="mt-1 text-xs text-white/50">
              Lấy từ <span className="text-white/70 font-semibold">home_logs</span> +{" "}
              <span className="text-white/70 font-semibold">realtime_logs</span>. Dòng nào có "Xe Vx:" có thể nhấp để zoom.
            </div>
          </div>

          <div className="p-5">
            {mergedLogs.length === 0 ? (
              <div className="text-white/55 text-sm">Chưa có log. Hãy chạy xe ở Home/RealTime.</div>
            ) : (
              <div className="space-y-2">
                {mergedLogs
                  .slice()
                  .reverse()
                  .slice(0, 120)
                  .map((line, idx) => {
                    const canOpen = !!parseJourneyFromLogLine(line);
                    return (
                      <button
                        key={`${idx}-${String(line).slice(0, 12)}`}
                        onClick={() => (canOpen ? openJourneyFromLog(line) : null)}
                        className={cn(
                          "w-full text-left rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm transition",
                          canOpen ? "hover:bg-slate-950/45" : "opacity-70 cursor-default"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 text-white/80">
                            <span className="truncate block">{String(line)}</span>
                          </div>
                          {canOpen ? (
                            <span className="shrink-0 inline-flex items-center gap-1 text-xs text-white/50">
                              <ZoomIn className="w-3.5 h-3.5" /> zoom
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Vehicle Plates Modal */}
        <Modal
          open={vehicleModalOpen}
          title="Cài đặt biển số xe (tùy chọn)"
          onClose={() => setVehicleModalOpen(false)}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/50">
                Lưu ở localStorage: <span className="text-white/70">{LS.VEHICLE_PLATES}</span>
              </div>
              <button
                onClick={() => setVehicleModalOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 transition"
              >
                Đóng
              </button>
            </div>
          }
        >
          <div className="text-sm text-white/70">
            Bạn có thể nhập <span className="text-white/90 font-semibold">tên xe</span> (V1/V2/...) hoặc{" "}
            <span className="text-white/90 font-semibold">biển số</span>. Không cần tài xế.
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from(
              new Set(
                [
                  ...normalizedTrips.map((t) => t.vehicleId),
                  ...(Array.isArray(homeVehicles) ? homeVehicles.map((v) => v.id) : []),
                  ...(Array.isArray(rtVehicles) ? rtVehicles.map((v) => v.id) : []),
                ].filter(Boolean)
              )
            )
              .sort()
              .map((vid) => (
                <div key={vid} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-white/60" />
                      <div className="text-sm font-semibold text-white">{vid}</div>
                    </div>
                    <input
                      value={vehiclePlates?.[vid] || ""}
                      onChange={(e) => setVehiclePlates((p) => ({ ...p, [vid]: e.target.value }))}
                      placeholder="Nhập biển số (vd: 51A-12345)"
                      className="w-44 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
                    />
                  </div>
                </div>
              ))}
          </div>
        </Modal>

        {/* Journey Modal */}
        <Modal
          open={journeyModalOpen}
          title={journeyTitle || "Hành trình"}
          onClose={() => setJourneyModalOpen(false)}
          maxWidth="max-w-4xl"
          footer={
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="text-xs text-white/50">
                {journeyMeta?.tripCode ? (
                  <>
                    Mã chuyến: <span className="text-white/70">{journeyMeta.tripCode}</span>
                    {" · "}
                    Tuyến: <span className="text-white/70">{journeyMeta.routeText || "—"}</span>
                    {" · "}
                    Trạng thái: <span className="text-white/70">{journeyMeta.status || "—"}</span>
                  </>
                ) : (
                  "—"
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(2)))}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm font-semibold text-white/85 transition"
                >
                  <ZoomOut className="w-4 h-4" />
                  Thu nhỏ
                </button>
                <button
                  onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(2)))}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm font-semibold text-white/85 transition"
                >
                  <ZoomIn className="w-4 h-4" />
                  Phóng to
                </button>
                <button
                  onClick={() => setJourneyModalOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          }
        >
          <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 overflow-x-auto">
            <div className="text-xs text-white/50">
              {journeyMeta?.createdAt ? (
                <span className="inline-flex items-center gap-2">
                  <Clock className="w-4 h-4" /> {journeyMeta.createdAt}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Clock className="w-4 h-4" /> —
                </span>
              )}
            </div>

            <div className="mt-4">
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: "left top" }}
                className="inline-block"
              >
                <div className="text-2xl md:text-3xl font-bold tracking-tight text-white whitespace-nowrap">
                  {journeyText || "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-white/45">Tip: nếu hành trình dài, bạn có thể kéo ngang để xem hết.</div>
          </div>
        </Modal>
        </div>
      </div>
    </div>
  );
}
