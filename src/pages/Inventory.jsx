import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Settings2,
  RotateCcw,
  Plus,
  Trash2,
  Package,
  MapPin,
  Eye,
} from "lucide-react";

/**
 * Inventory.jsx (v5)
 *
 * Update theo yêu cầu mới:
 * - Giữ UI/format như hiện tại, nhưng làm trang "đầy" hơn (ít khoảng trống, card to hơn).
 * - Tạo hàng: không render card riêng bên ngoài. Hàng sẽ tự động nằm trong đúng nhóm kho (Điện tử, Thực phẩm lạnh...).
 * - Mỗi kho có nút "Xem hàng" để xem danh sách chi tiết (Laptop, Điện thoại, ...).
 * - Chỉ tiêu bên ngoài = tổng chỉ tiêu của các hàng bên trong.
 * - Tồn kho bên ngoài = tổng tồn kho của các hàng bên trong.
 *
 * Đồng bộ dữ liệu:
 * - Home.jsx / RealTime.jsx vẫn ghi tổng theo vị trí: localStorage "warehouse_stock".
 * - Inventory sẽ duy trì danh sách item theo kho trong localStorage "inventory_goods_v1".
 * - Nếu có tồn kho tổng nhưng chưa có item cụ thể, sẽ đẩy phần chênh vào item hệ thống "Khác".
 *
 * Keys:
 * - STOCK: "warehouse_stock" (tổng theo 5.1 -> 5.5)
 * - TARGETS: "warehouse_targets_v2" (tổng chỉ tiêu theo 5.1 -> 5.5)
 * - GOODS: "inventory_goods_v1" (item theo kho)
 * - WAREHOUSES: "inventory_warehouses_v1" (đổi tên / ẩn kho)
 */

const LS = {
  TARGETS: "warehouse_targets_v2",
  STOCK: "warehouse_stock",
  GOODS: "inventory_goods_v1",
  WAREHOUSES: "inventory_warehouses_v1",
};

const DEFAULT_WAREHOUSES = [
  { id: 1, key: "5,1", name: "Điện tử", location: "Kho 5,1", dot: "bg-blue-400" },
  { id: 2, key: "5,2", name: "Thực phẩm lạnh", location: "Kho 5,2", dot: "bg-fuchsia-400" },
  { id: 3, key: "5,3", name: "Hải sản", location: "Kho 5,3", dot: "bg-amber-400" },
  { id: 4, key: "5,4", name: "Nông sản", location: "Kho 5,4", dot: "bg-emerald-400" },
  { id: 5, key: "5,5", name: "Thủy hải sản", location: "Kho 5,5", dot: "bg-sky-400" },
];

const POSITION_KEYS = DEFAULT_WAREHOUSES.map((w) => w.key);

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function ensureSeedWarehouses() {
  const wh = safeParse(localStorage.getItem(LS.WAREHOUSES), null);
  if (!Array.isArray(wh) || wh.length === 0) {
    localStorage.setItem(LS.WAREHOUSES, JSON.stringify(DEFAULT_WAREHOUSES));
    return DEFAULT_WAREHOUSES;
  }
  return wh;
}

function normalizeTargets(warehouses, targets) {
  const w = Array.isArray(warehouses) ? warehouses : [];
  const t = targets && typeof targets === "object" ? targets : {};
  const next = {};
  w.forEach((wh) => {
    const v = Number(t?.[wh.key]);
    next[wh.key] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
    // nếu thiếu key thì mặc định 0
    if (t?.[wh.key] == null) next[wh.key] = 0;
  });
  return next;
}

function ensureSeedTargets(warehouses) {
  const existing = safeParse(localStorage.getItem(LS.TARGETS), null);
  const base = Array.isArray(warehouses) && warehouses.length ? warehouses : DEFAULT_WAREHOUSES;
  if (!existing) {
    const init = Object.fromEntries(base.map((w) => [w.key, 0]));
    localStorage.setItem(LS.TARGETS, JSON.stringify(init));
    return init;
  }
  const normalized = normalizeTargets(base, existing);
  localStorage.setItem(LS.TARGETS, JSON.stringify(normalized));
  return normalized;
}


const MIGRATE = {
  DEFAULT_ZERO_V1: "inventory_default_zero_migrated_v1",
};

// Reset legacy defaults (=3) về 0 khi CHƯA tạo hàng (không có item non-system)
function maybeMigrateLegacyDefaultsToZero(rawGoods) {
  try {
    const already = localStorage.getItem(MIGRATE.DEFAULT_ZERO_V1);
    if (already === "1") return;

    const arr = Array.isArray(rawGoods) ? rawGoods : [];
    const hasUserGoods = arr.some((g) => !g?.system && !String(g?.id || "").startsWith("SYS_"));
    if (hasUserGoods) {
      localStorage.setItem(MIGRATE.DEFAULT_ZERO_V1, "1");
      return;
    }

    const stock = normalizeStock(safeParse(localStorage.getItem(LS.STOCK), {}));
    const targets = safeParse(localStorage.getItem(LS.TARGETS), null);

    // only migrate when ALL keys are exactly 3 (pattern của bản cũ)
    const allStock3 = POSITION_KEYS.every((k) => Number(stock?.[k]) === 3);
    const normTargets = normalizeTargets(DEFAULT_WAREHOUSES, targets || {});
    const allTargets3 = POSITION_KEYS.every((k) => Number(normTargets?.[k]) === 3);

    if (allStock3) {
      const zeroStock = Object.fromEntries(POSITION_KEYS.map((k) => [k, 0]));
      localStorage.setItem(LS.STOCK, JSON.stringify(zeroStock));
    }
    if (allTargets3) {
      const zeroTargets = Object.fromEntries(POSITION_KEYS.map((k) => [k, 0]));
      localStorage.setItem(LS.TARGETS, JSON.stringify(zeroTargets));
    }

    localStorage.setItem(MIGRATE.DEFAULT_ZERO_V1, "1");
  } catch {
    // ignore
  }
}

function normalizeStock(stock) {
  const s = stock && typeof stock === "object" ? stock : {};
  const next = {};
  POSITION_KEYS.forEach((k) => {
    const v = Number(s?.[k]);
    next[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  });
  return next;
}

function migrateGoods(rawGoods) {
  const arr = Array.isArray(rawGoods) ? rawGoods : [];
  return arr
    .map((g) => {
      const key = typeof g?.warehouseKey === "string" ? g.warehouseKey : POSITION_KEYS[0];
      const qty = Number(g?.qty);
      const target = Number(g?.target);
      const isSystem = Boolean(g?.system) || String(g?.id || "").startsWith("SYS_");

      const positionDetail =
        typeof g?.positionDetail === "string"
          ? g.positionDetail
          : typeof g?.position === "string"
          ? g.position
          : "";

      return {
        id: g?.id || `G${Date.now()}`,
        name: typeof g?.name === "string" ? g.name : "",
        warehouseKey: POSITION_KEYS.includes(key) ? key : POSITION_KEYS[0],
        positionDetail,
        qty: Number.isFinite(qty) && qty >= 0 ? Math.floor(qty) : 0,
        target: Number.isFinite(target) && target >= 0 ? Math.floor(target) : 0,
        system: isSystem,
        createdAtIso: g?.createdAtIso || new Date().toISOString(),
      };
    })
    .filter((g) => g && g.warehouseKey);
}

function sumByKey(goods, key, field, opts = {}) {
  const { includeSystem = true } = opts;
  return (Array.isArray(goods) ? goods : []).reduce((sum, g) => {
    if (g.warehouseKey !== key) return sum;
    if (!includeSystem && g.system) return sum;
    return sum + (Number(g?.[field]) || 0);
  }, 0);
}

function ensureSystemItems(goods, stockTotals, targetTotals) {
  const list = Array.isArray(goods) ? [...goods] : [];

  POSITION_KEYS.forEach((key) => {
    const totalStock = Number(stockTotals?.[key] || 0);
    const totalTarget = Number(targetTotals?.[key] || 0);

    const nonSysStock = sumByKey(list, key, "qty", { includeSystem: false });
    const nonSysTarget = sumByKey(list, key, "target", { includeSystem: false });

    const desiredStock = Math.max(totalStock, nonSysStock);
    const desiredTarget = Math.max(totalTarget, nonSysTarget);

    const sysQty = Math.max(0, desiredStock - nonSysStock);
    const sysTarget = Math.max(0, desiredTarget - nonSysTarget);

    const sysId = `SYS_${key}`;
    const idx = list.findIndex((g) => g.id === sysId);
    const sysObj = {
      id: sysId,
      name: "Khác",
      warehouseKey: key,
      positionDetail: "",
      qty: sysQty,
      target: sysTarget,
      system: true,
      createdAtIso: new Date().toISOString(),
    };

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...sysObj, createdAtIso: list[idx]?.createdAtIso || sysObj.createdAtIso };
    } else {
      list.push(sysObj);
    }

    // nếu totals nhỏ hơn nonSys -> sẽ ép totals tăng lên (để khớp rule tổng = sum items)
    if (desiredStock !== totalStock || desiredTarget !== totalTarget) {
      // caller sẽ tự persist totals nếu cần
    }
  });

  return list;
}

function totalsFromGoods(goods) {
  const stockTotals = Object.fromEntries(POSITION_KEYS.map((k) => [k, 0]));
  const targetTotals = Object.fromEntries(POSITION_KEYS.map((k) => [k, 0]));

  (Array.isArray(goods) ? goods : []).forEach((g) => {
    const key = g.warehouseKey;
    if (!POSITION_KEYS.includes(key)) return;
    stockTotals[key] += Number(g?.qty) || 0;
    targetTotals[key] += Number(g?.target) || 0;
  });

  // normalize integers
  POSITION_KEYS.forEach((k) => {
    stockTotals[k] = Math.max(0, Math.floor(Number(stockTotals[k] || 0)));
    targetTotals[k] = Math.max(0, Math.floor(Number(targetTotals[k] || 0)));
  });

  return { stockTotals, targetTotals };
}

// ------------------------ Modal Shell ------------------------
function Modal({ open, title, onClose, children, footer, maxWidth = "max-w-4xl" }) {
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
              ✕
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? <div className="px-5 py-4 border-t border-white/10">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [warehouses, setWarehouses] = useState(DEFAULT_WAREHOUSES);
  const [targets, setTargets] = useState({});
  const [stock, setStock] = useState({});
  const [goods, setGoods] = useState([]);

  // Draft tạo item
  const [draft, setDraft] = useState({
    name: "",
    warehouseKey: POSITION_KEYS[0] || "5,1",
    positionDetail: "",
    qty: 0,
    target: 0,
  });

  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewKey, setViewKey] = useState(null); // mở modal xem hàng theo kho

  const settingsWrapRef = useRef(null);
  const stripRef = useRef(null);

  const lastStockStrRef = useRef("");
  const lastTargetsStrRef = useRef("");

  const persistAll = (nextGoods) => {
    const { stockTotals, targetTotals } = totalsFromGoods(nextGoods);

    // persist
    try {
      localStorage.setItem(LS.GOODS, JSON.stringify(nextGoods));
      localStorage.setItem(LS.STOCK, JSON.stringify(stockTotals));
      localStorage.setItem(LS.TARGETS, JSON.stringify(targetTotals));
    } catch {
      // ignore
    }

    lastStockStrRef.current = localStorage.getItem(LS.STOCK) || "";
    lastTargetsStrRef.current = localStorage.getItem(LS.TARGETS) || "";

    setGoods(nextGoods);
    setStock(stockTotals);
    setTargets(targetTotals);
  };

  const reconcileFromStockTargets = (nextStock, nextTargets) => {
    setGoods((prev) => {
      const base = Array.isArray(prev) ? [...prev] : [];
      const normalizedStock = normalizeStock(nextStock);
      const normalizedTargets = normalizeTargets(warehouses, nextTargets);

      const withSys = ensureSystemItems(base, normalizedStock, normalizedTargets);

      // nếu totals bị ép tăng (do nonSys > totals), sync lại totals
      const { stockTotals, targetTotals } = totalsFromGoods(withSys);

      try {
        localStorage.setItem(LS.GOODS, JSON.stringify(withSys));
        localStorage.setItem(LS.STOCK, JSON.stringify(stockTotals));
        localStorage.setItem(LS.TARGETS, JSON.stringify(targetTotals));
      } catch {}

      lastStockStrRef.current = localStorage.getItem(LS.STOCK) || "";
      lastTargetsStrRef.current = localStorage.getItem(LS.TARGETS) || "";

      setStock(stockTotals);
      setTargets(targetTotals);
      return withSys;
    });
  };

  useEffect(() => {
    // seed warehouses + targets
    const seededWh = ensureSeedWarehouses();
    const wh = safeParse(localStorage.getItem(LS.WAREHOUSES), seededWh);
    const whFinal = Array.isArray(wh) && wh.length ? wh : DEFAULT_WAREHOUSES;
    setWarehouses(whFinal);

    const tgt = ensureSeedTargets(whFinal);

    const stockStr = localStorage.getItem(LS.STOCK) || "";
    const targetsStr = localStorage.getItem(LS.TARGETS) || "";
    lastStockStrRef.current = stockStr;
    lastTargetsStrRef.current = targetsStr;

    const st = normalizeStock(safeParse(stockStr, {}));
    const tt = normalizeTargets(whFinal, safeParse(targetsStr, tgt));

    // load goods + ensure system items
    const rawGoods = safeParse(localStorage.getItem(LS.GOODS), []);
    const migrated = migrateGoods(rawGoods);
    // migration: đưa tồn kho + chỉ tiêu mặc định cũ (=3) về 0 khi chưa tạo hàng
    maybeMigrateLegacyDefaultsToZero(migrated);

    // re-read sau migration (nếu có)
    const stockStr2 = localStorage.getItem(LS.STOCK) || "";
    const targetsStr2 = localStorage.getItem(LS.TARGETS) || "";
    const st2 = normalizeStock(safeParse(stockStr2, {}));
    const tt2 = normalizeTargets(whFinal, safeParse(targetsStr2, tgt));

    const withSys = ensureSystemItems(migrated, st2, tt2);

    // persist normalized
    const { stockTotals, targetTotals } = totalsFromGoods(withSys);
    try {
      localStorage.setItem(LS.GOODS, JSON.stringify(withSys));
      localStorage.setItem(LS.STOCK, JSON.stringify(stockTotals));
      localStorage.setItem(LS.TARGETS, JSON.stringify(targetTotals));
    } catch {}

    lastStockStrRef.current = localStorage.getItem(LS.STOCK) || "";
    lastTargetsStrRef.current = localStorage.getItem(LS.TARGETS) || "";

    setGoods(withSys);
    setStock(stockTotals);
    setTargets(targetTotals);

    // polling: theo dõi stock/targets (Home/Realtime cập nhật)
    const tick = () => {
      const s = localStorage.getItem(LS.STOCK) || "";
      if (s !== lastStockStrRef.current) {
        lastStockStrRef.current = s;
        const nextStock = normalizeStock(safeParse(s, {}));
        // reconcile system qty theo totals mới
        reconcileFromStockTargets(nextStock, targets);
      }

      const t = localStorage.getItem(LS.TARGETS) || "";
      if (t !== lastTargetsStrRef.current) {
        lastTargetsStrRef.current = t;
        const nextTargets = normalizeTargets(warehouses, safeParse(t, {}));
        reconcileFromStockTargets(stock, nextTargets);
      }
    };

    const timer = setInterval(tick, 900);

    const onStorage = (e) => {
      if (!e?.key) return;
      if (e.key === LS.WAREHOUSES) {
        const nextWh = safeParse(e.newValue, DEFAULT_WAREHOUSES);
        setWarehouses(Array.isArray(nextWh) && nextWh.length ? nextWh : DEFAULT_WAREHOUSES);
      }
      if (e.key === LS.STOCK) {
        lastStockStrRef.current = e.newValue || "";
        const nextStock = normalizeStock(safeParse(e.newValue, {}));
        reconcileFromStockTargets(nextStock, targets);
      }
      if (e.key === LS.TARGETS) {
        lastTargetsStrRef.current = e.newValue || "";
        const nextTargets = normalizeTargets(warehouses, safeParse(e.newValue, {}));
        reconcileFromStockTargets(stock, nextTargets);
      }
      if (e.key === LS.GOODS) {
        const migrated2 = migrateGoods(safeParse(e.newValue, []));
        const withSys2 = ensureSystemItems(migrated2, stock, targets);
        const { stockTotals, targetTotals } = totalsFromGoods(withSys2);
        setGoods(withSys2);
        setStock(stockTotals);
        setTargets(targetTotals);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDocMouseDown = (e) => {
      if (settingsWrapRef.current?.contains?.(e.target)) return;
      setSettingsOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  const totalStock = useMemo(() => {
    return (Array.isArray(warehouses) ? warehouses : []).reduce((sum, w) => sum + (Number(stock?.[w.key]) || 0), 0);
  }, [stock, warehouses]);

  const totalTarget = useMemo(() => {
    return (Array.isArray(warehouses) ? warehouses : []).reduce((sum, w) => sum + (Number(targets?.[w.key]) || 0), 0);
  }, [targets, warehouses]);

  const overallPct = useMemo(() => {
    const t = totalTarget || 0;
    if (t <= 0) return 0;
    const p = (totalStock / t) * 100;
    return Math.max(0, Math.min(100, p));
  }, [totalStock, totalTarget]);

  const resetStock = () => {
    if (!confirm("Reset tồn kho về 0? (sẽ ghi lại warehouse_stock và hàng bên trong)") ) return;
    // reset system item + item qty = 0
    const nextGoods = (Array.isArray(goods) ? goods : []).map((g) => ({ ...g, qty: 0 }));
    persistAll(nextGoods);
  };

  const updateWarehouse = (key, patch) => {
    setWarehouses((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const next = arr.map((w) => (w.key === key ? { ...w, ...patch } : w));
      try { localStorage.setItem(LS.WAREHOUSES, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const removeWarehouse = (key) => {
    if (!confirm("Xóa kho này khỏi màn hình? (Chỉ ẩn UI; dữ liệu tồn kho vẫn còn trong localStorage)")) return;
    setWarehouses((prev) => {
      const next = (Array.isArray(prev) ? prev.filter((w) => w.key !== key) : []);
      try { localStorage.setItem(LS.WAREHOUSES, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const restoreDefaultWarehouses = () => {
    if (!confirm("Khôi phục lại 5 kho mặc định?")) return;
    setWarehouses(DEFAULT_WAREHOUSES);
    try { localStorage.setItem(LS.WAREHOUSES, JSON.stringify(DEFAULT_WAREHOUSES)); } catch {}
  };

  const scrollStrip = (dir) => {
    const el = stripRef.current;
    if (!el) return;
    const step = Math.max(320, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const whNameByKey = useMemo(() => {
    const map = new Map((Array.isArray(warehouses) ? warehouses : []).map((w) => [w.key, w.name]));
    return (key) => map.get(key) || key.replace(",", ".");
  }, [warehouses]);

  const confirmCreateItem = () => {
    const name = (draft?.name || "").trim();
    const key = draft?.warehouseKey || (POSITION_KEYS[0] || "5,1");
    const posDetail = (draft?.positionDetail || "").trim();
    const qty = Math.max(0, Math.floor(Number(draft?.qty || 0)));
    const target = Math.max(0, Math.floor(Number(draft?.target || 0)));

    if (!name) {
      alert("Vui lòng nhập Tên hàng trước khi tạo.");
      return;
    }

    if (!confirm("Bạn có xác nhận tạo hàng?")) return;

    const id = `G${Date.now()}`;
    const item = {
      id,
      name,
      warehouseKey: POSITION_KEYS.includes(key) ? key : POSITION_KEYS[0],
      positionDetail: posDetail,
      qty,
      target,
      system: false,
      createdAtIso: new Date().toISOString(),
    };

    const nextGoods = ensureSystemItems([...(Array.isArray(goods) ? goods : []), item], stock, targets);
    persistAll(nextGoods);

    // clear form (giữ lại kho để nhập nhanh)
    setDraft((prev) => ({
      ...(prev || {}),
      name: "",
      positionDetail: "",
      qty: 0,
      target: 0,
    }));

    // mở xem hàng đúng nhóm vừa tạo
    setViewKey(item.warehouseKey);

    setTimeout(() => {
      try {
        stripRef.current?.scrollTo({ left: stripRef.current.scrollWidth, behavior: "smooth" });
      } catch {}
    }, 30);
  };

  const updateGoods = (id, patch) => {
    const base = Array.isArray(goods) ? goods : [];
    const next = base.map((g) => (g.id === id ? { ...g, ...patch } : g));

    const item = next.find((x) => x.id === id);
    const isSystem = Boolean(item?.system) || String(id || "").startsWith("SYS_");

    // Nếu đang chỉnh mục hệ thống "Khác" (tồn kho/chỉ tiêu) thì coi đó là đang chỉnh TỔNG kho
    // => dùng totalsFromGoods(next) làm nguồn sự thật để không bị ensureSystemItems "giật" lại.
    if (isSystem && (patch?.qty != null || patch?.target != null)) {
      const { stockTotals, targetTotals } = totalsFromGoods(next);
      const fixed = ensureSystemItems(next, stockTotals, targetTotals);
      persistAll(fixed);
      return;
    }

    // Bình thường: giữ tổng kho theo LS.STOCK/LS.TARGETS, chỉ adjust SYS để khớp
    const fixed = ensureSystemItems(next, stock, targets);
    persistAll(fixed);
  };

  const removeGoods = (id) => {
    const arr = Array.isArray(goods) ? goods : [];
    const item = arr.find((x) => x.id === id);
    if (!item) return;
    if (item.system) {
      alert("Không thể xóa mục hệ thống 'Khác'.");
      return;
    }
    if (!confirm("Xóa hàng này? (Tồn kho/chỉ tiêu của hàng sẽ chuyển vào mục 'Khác')")) return;

    const sysId = `SYS_${item.warehouseKey}`;
    const next = arr
      .map((g) => {
        if (g.id !== sysId) return g;
        return {
          ...g,
          qty: Math.max(0, Math.floor(Number(g.qty || 0) + Number(item.qty || 0))),
          target: Math.max(0, Math.floor(Number(g.target || 0) + Number(item.target || 0))),
        };
      })
      .filter((g) => g.id !== id);

    const fixed = ensureSystemItems(next, stock, targets);
    persistAll(fixed);
  };

  const setTotalTargetForKey = (key, value) => {
    const v = Math.max(0, Math.floor(Number(value || 0)));
    // set tổng chỉ tiêu = v bằng cách điều chỉnh SYS target
    const nonSys = sumByKey(goods, key, "target", { includeSystem: false });
    const sysId = `SYS_${key}`;
    const sysTarget = Math.max(0, v - nonSys);
    updateGoods(sysId, { target: sysTarget });
  };

  // ====================== VIEW MODAL DATA ======================
  const viewedWarehouse = useMemo(() => {
    if (!viewKey) return null;
    return (Array.isArray(warehouses) ? warehouses : []).find((w) => w.key === viewKey) || null;
  }, [viewKey, warehouses]);

  const goodsInView = useMemo(() => {
    if (!viewKey) return [];
    const list = (Array.isArray(goods) ? goods : []).filter((g) => g.warehouseKey === viewKey);
    // sort: non-system first, then system
    return list.sort((a, b) => {
      if (a.system === b.system) return String(a.name || "").localeCompare(String(b.name || ""));
      return a.system ? 1 : -1;
    });
  }, [goods, viewKey]);

  const viewTotals = useMemo(() => {
    if (!viewKey) return { qty: 0, target: 0 };
    return {
      qty: sumByKey(goods, viewKey, "qty", { includeSystem: true }),
      target: sumByKey(goods, viewKey, "target", { includeSystem: true }),
    };
  }, [goods, viewKey]);

  // ------------------------ Render ------------------------
  return (
    <div className="relative min-h-screen text-white">
      <style>{`
        .hide-scrollbar::-webkit-scrollbar{display:none}
        .hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}

        /* Warehouse hover 3D (strong) */
        .warehouseCard{
          position:relative;
          transform-style:preserve-3d;
          will-change:transform, box-shadow, filter;
          transform:perspective(1200px) translateZ(0);
          transition:
            transform 260ms cubic-bezier(0.2,0.8,0.2,1),
            box-shadow 260ms cubic-bezier(0.2,0.8,0.2,1),
            filter 260ms cubic-bezier(0.2,0.8,0.2,1);
          backface-visibility:hidden;
        }

        .warehouseCard::before{
          content:"";
          position:absolute;
          inset:-1px;
          border-radius:26px;
          background:linear-gradient(135deg, rgba(56,189,248,0.35), rgba(59,130,246,0.22), rgba(217,70,239,0.28));
          opacity:0;
          filter:blur(10px);
          transform:translateZ(-1px);
          transition:opacity 260ms cubic-bezier(0.2,0.8,0.2,1);
          pointer-events:none;
        }

        .warehouseCard::after{
          content:"";
          position:absolute;
          left:16px;
          right:16px;
          bottom:-14px;
          height:22px;
          border-radius:999px;
          background:radial-gradient(closest-side, rgba(0,0,0,0.55), rgba(0,0,0,0));
          opacity:0;
          filter:blur(10px);
          transform:translateZ(-2px);
          transition:opacity 260ms cubic-bezier(0.2,0.8,0.2,1);
          pointer-events:none;
        }

.warehouseCard:hover{
  transform: translateY(-10px) translateZ(28px) rotateX(6deg) rotateY(-10deg) scale(1.03);
  box-shadow: 0 18px 40px -18px rgba(0,0,0,.45);
}

.warehouseCard:hover::before{ opacity: .22; }
.warehouseCard:hover::after { opacity: .28; filter: blur(14px); }

        .warehouseCard:active{
          transform:perspective(1200px) translateY(-10px) translateZ(36px) rotateX(7deg) rotateY(-12deg) scale(1.035);
        }
      `}</style>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />

      {/*
        NOTE (UI to hơn):
        - bỏ max-w-7xl để tránh bị "lọt thỏm" khi zoom.
        - tăng card width 320.
      */}
      <div className="relative mx-auto w-full max-w-none px-6 md:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <span>Logistics</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-white/80">Quản lý kho</span>
            </div>

            <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">QUẢN LÝ KHO HÀNG</h1>
            <p className="mt-2 text-white/60">Đồng bộ tồn kho từ Home.jsx / RealTime.jsx (localStorage)</p>

            {/* Overall progress */}
            <div className="mt-5 w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-white/70">
                  Tổng tồn kho: <span className="text-white font-semibold">{totalStock}</span> /{" "}
                  <span className="text-white/80">{totalTarget}</span>
                </div>
                <div className="text-xs text-white/50">{Math.round(overallPct)}%</div>
              </div>
              <div className="mt-3 h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400/80 via-blue-500/80 to-fuchsia-500/80"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Gear menu */}
          <div className="flex justify-end">
            <div className="relative" ref={settingsWrapRef}>
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className="inline-flex items-center justify-center w-11 h-11 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
                title="Cài đặt"
                aria-label="Open settings"
              >
                <Settings2 className="w-5 h-5 text-white/80" />
              </button>

              {settingsOpen ? (
                <div className="absolute right-0 mt-3 w-64 rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      setTargetModalOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/85 hover:bg-white/5 transition"
                  >
                    <Settings2 className="w-4 h-4 text-white/70" />
                    Cài đặt chỉ tiêu
                  </button>
                  <button
                    onClick={() => {
                      setSettingsOpen(false);
                      resetStock();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/85 hover:bg-white/5 transition"
                  >
                    <RotateCcw className="w-4 h-4 text-white/70" />
                    Reset tồn kho
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Cards strip */}
        <div className="mt-8 relative">
          {/* Arrows */}
          <button
            onClick={() => scrollStrip(-1)}
            className="inline-flex absolute left-0 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-10 h-10 rounded-2xl border border-white/10 bg-slate-950/40 hover:bg-slate-950/60 backdrop-blur-xl transition"
            aria-label="Scroll left"
            title="Xem bên trái"
          >
            <ChevronLeft className="w-5 h-5 text-white/80" />
          </button>
          <button
            onClick={() => scrollStrip(1)}
            className="inline-flex absolute right-0 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-10 h-10 rounded-2xl border border-white/10 bg-slate-950/40 hover:bg-slate-950/60 backdrop-blur-xl transition"
            aria-label="Scroll right"
            title="Xem bên phải"
          >
            <ChevronRight className="w-5 h-5 text-white/80" />
          </button>

          <div ref={stripRef} className="hide-scrollbar flex gap-4 overflow-x-auto scroll-smooth px-12 py-1">
            {/* Warehouse cards */}
            {(Array.isArray(warehouses) ? warehouses : []).map((w) => {
              const qty = Number(stock?.[w.key] || 0);
              const t = Number(targets?.[w.key] || 0);
              const pct = t > 0 ? Math.max(0, Math.min(100, (qty / t) * 100)) : 0;

              return (
                <div
                  key={w.key}
                  className={cn(
                    "warehouseCard min-w-[320px] max-w-[320px] rounded-3xl border border-white/10 bg-slate-950/35 p-5 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-white/10 border border-white/10 text-sm font-bold">
                        {w.id}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{w.name}</div>
                        <div className="mt-0.5 text-xs text-white/60 flex items-center gap-2">
                          <span className={cn("inline-block w-2 h-2 rounded-full", w.dot)} />
                          {w.location}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-white/60 rounded-2xl border border-white/10 bg-white/5 px-2 py-1">
                      {w.key.replace(",", ".")}
                    </div>
                  </div>

                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <div className="text-xs text-white/60">Tồn kho</div>
                      <div className="text-3xl font-bold text-white">{qty}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/60">Chỉ tiêu</div>
                      <div className="text-sm font-semibold text-white/80">{t > 0 ? t : "—"}</div>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-white/30" style={{ width: `${pct}%` }} />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-white/60">Tiến độ: {Math.round(pct)}%</div>
                    <button
                      onClick={() => setViewKey(w.key)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition"
                      title="Xem hàng trong kho"
                    >
                      <Eye className="w-4 h-4" />
                      Xem hàng
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Card tạo hàng (thêm item vào đúng kho) */}
            <div className="min-w-[320px] max-w-[320px] rounded-3xl border border-white/10 bg-slate-950/35 p-5 backdrop-blur-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.65)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/20">
                    <Plus className="w-4 h-4 text-emerald-100" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">Tạo hàng</div>
                    <div className="mt-0.5 text-xs text-white/60">Thêm vào đúng nhóm kho</div>
                  </div>
                </div>
                <div className="shrink-0 text-xs text-white/60 rounded-2xl border border-white/10 bg-white/5 px-2 py-1">NEW</div>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <div className="text-xs text-white/55 mb-1">Loại kho (5.1 → 5.5)</div>
                  <select
                    value={draft?.warehouseKey}
                    onChange={(e) => setDraft((p) => ({ ...(p || {}), warehouseKey: e.target.value }))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
                  >
                    {POSITION_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k.replace(",", ".")} · {whNameByKey(k)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs text-white/55 mb-1">Tên hàng</div>
                  <input
                    value={draft?.name || ""}
                    onChange={(e) => setDraft((prev) => ({ ...(prev || {}), name: e.target.value }))}
                    placeholder="Ví dụ: Laptop / Điện thoại / Cá hồi..."
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <div className="text-xs text-white/55 mb-1">Vị trí chi tiết (tuỳ chọn)</div>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                    <input
                      value={draft?.positionDetail || ""}
                      onChange={(e) => setDraft((prev) => ({ ...(prev || {}), positionDetail: e.target.value }))}
                      placeholder="Ví dụ: Kệ A1 / Ô B3..."
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/45 pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/55 mb-1">Tồn kho (ban đầu)</div>
                    <input
                      type="number"
                      min={0}
                      value={Number(draft?.qty || 0)}
                      onChange={(e) => setDraft((p) => ({ ...(p || {}), qty: e.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-white/55 mb-1">Chỉ tiêu</div>
                    <input
                      type="number"
                      min={0}
                      value={Number(draft?.target || 0)}
                      onChange={(e) => setDraft((p) => ({ ...(p || {}), target: e.target.value }))}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <button
                  onClick={confirmCreateItem}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/15 transition"
                >
                  <Plus className="w-4 h-4" />
                  Xác nhận tạo hàng
                </button>

                <div className="text-xs text-white/45">
                  Mẹo: Nếu Home/RealTime nhập cargo dạng <span className="text-white/70">"10 Laptop"</span> thì sẽ cộng đúng vào item.
                </div>
              </div>
            </div>

            {/* Hint card */}
            <div className="min-w-[320px] max-w-[320px] rounded-3xl border border-dashed border-white/15 bg-white/5 p-5 backdrop-blur-xl">
              <div className="text-sm font-semibold text-white/85">Mẹo</div>
              <div className="mt-2 text-sm text-white/60">Nếu card bị tràn, dùng mũi tên để kéo ngang. (Mobile có thể kéo tay)</div>
            </div>
          </div>
        </div>

        {/* View Items Modal */}
        <Modal
          open={Boolean(viewKey)}
          title={`Xem hàng • ${viewedWarehouse?.name || (viewKey ? viewKey.replace(",", ".") : "")}`}
          onClose={() => setViewKey(null)}
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="text-xs text-white/50">
                Tổng: <span className="text-white/70">{viewTotals.qty}</span> /{" "}
                <span className="text-white/70">{viewTotals.target}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (viewKey) setDraft((p) => ({ ...(p || {}), warehouseKey: viewKey }));
                    setViewKey(null);
                    // (tuỳ chọn) nếu bạn muốn scroll tới card "Tạo hàng" thì có thể thêm ref ở đây
                  }}
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/15 hover:bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-50 transition"
                >
                  Tạo hàng
                </button>
                <button
                  onClick={() => setViewKey(null)}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          }
        >
          {goodsInView.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Chưa có hàng nào trong kho này.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {goodsInView.map((g) => (
                <div key={g.id} className={cn("rounded-3xl border border-white/10 p-4", g.system ? "bg-white/5" : "bg-slate-950/35")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-4 h-4 text-white/60" />
                      <input
                        value={g.name || ""}
                        disabled={g.system}
                        onChange={(e) => updateGoods(g.id, { name: e.target.value })}
                        placeholder="Tên hàng..."
                        className={cn(
                          "min-w-0 w-full bg-transparent text-sm font-semibold text-white outline-none border-b border-transparent focus:border-white/20",
                          g.system ? "opacity-80" : ""
                        )}
                      />
                      {g.system ? (
                        <span className="ml-2 text-[11px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/60">Hệ thống</span>
                      ) : null}
                    </div>
                    <button
                      onClick={() => removeGoods(g.id)}
                      className={cn(
                        "inline-flex items-center justify-center w-9 h-9 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition",
                        g.system ? "opacity-40 cursor-not-allowed" : ""
                      )}
                      title={g.system ? "Không thể xóa" : "Xóa hàng"}
                      aria-label="Delete goods"
                      disabled={g.system}
                    >
                      <Trash2 className="w-4 h-4 text-white/70" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-white/55 mb-1">Vị trí chi tiết (tuỳ chọn)</div>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                        <input
                          value={g.positionDetail || ""}
                          onChange={(e) => updateGoods(g.id, { positionDetail: e.target.value })}
                          placeholder="Ví dụ: Kệ A1 / Ô B3..."
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/45 pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-white/55 mb-1">Tồn kho</div>
                        <input
                          type="number"
                          min={0}
                          value={Number(g.qty || 0)}
                          onChange={(e) => updateGoods(g.id, { qty: e.target.value })}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-white/55 mb-1">Chỉ tiêu</div>
                        <input
                          type="number"
                          min={0}
                          value={Number(g.target || 0)}
                          onChange={(e) => updateGoods(g.id, { target: e.target.value })}
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2.5 text-sm text-white outline-none focus:border-white/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-white/45">
                    ID: <span className="text-white/70">{g.id}</span>
                    {" · "}
                    <span className="text-white/60">{g.warehouseKey?.replace(",", ".")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>

        {/* Targets + Warehouses Modal */}
        <Modal
          open={targetModalOpen}
          title="Cài đặt chỉ tiêu (và đổi tên / xóa kho)"
          onClose={() => setTargetModalOpen(false)}
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="text-xs text-white/50">
                Chỉ tiêu lưu ở localStorage: <span className="text-white/70">{LS.TARGETS}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={restoreDefaultWarehouses}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 transition"
                  title="Khôi phục 5 kho mặc định"
                >
                  Khôi phục mặc định
                </button>
                <button
                  onClick={() => setTargetModalOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Array.isArray(warehouses) ? warehouses : []).map((w) => (
              <div key={w.key} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/50 mb-1">Tên kho</div>
                    <input
                      value={w.name || ""}
                      onChange={(e) => updateWarehouse(w.key, { name: e.target.value })}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                    />
                    <div className="mt-2 text-xs text-white/50">Vị trí: {w.key.replace(",", ".")} · {w.location}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => removeWarehouse(w.key)}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
                      title="Xóa kho khỏi màn hình"
                      aria-label="Remove warehouse"
                    >
                      <Trash2 className="w-4 h-4 text-white/70" />
                    </button>

                    <div className="text-xs text-white/50">Chỉ tiêu (tổng)</div>
                    <input
                      type="number"
                      min={0}
                      value={targets?.[w.key] ?? 0}
                      onChange={(e) => setTotalTargetForKey(w.key, e.target.value)}
                      className="w-28 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {Array.isArray(warehouses) && warehouses.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Hiện chưa có kho nào. Bấm <span className="text-white font-semibold">Khôi phục mặc định</span> để tạo lại 5 kho 5.1 → 5.5.
            </div>
          ) : null}
        </Modal>
      </div>
    </div>
  );
}
