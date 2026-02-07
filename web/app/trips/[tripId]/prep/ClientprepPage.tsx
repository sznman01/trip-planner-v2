"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTripsStore, type Trip } from "@/lib/store/trips";

type SegTab = "prep" | "members";
type ChecklistTag = "general" | "important";

type CurrencyCode =
  | "JPY"
  | "HKD"
  | "TWD"
  | "KRW"
  | "THB"
  | "SGD"
  | "USD"
  | "GBP"
  | "EUR"
  | "CHF";

const SUPPORTED: CurrencyCode[] = [
  "JPY",
  "HKD",
  "TWD",
  "KRW",
  "THB",
  "SGD",
  "USD",
  "GBP",
  "EUR",
  "CHF",
];

type ChecklistItemX = {
  id: string;
  name: string;
  subtitle?: string;
  date?: string; // YYYY-MM-DD
  group: string;
  tag: ChecklistTag;
  completed: boolean;
};

type Gender = "male" | "female";

type PaymentX = {
  id: string;
  // 兼容你 store 舊 schema：amount 仍然存在（HKD），同時保留原幣資料（extra fields）
  amount: number; // HKD
  originalAmount: number;
  originalCurrency: CurrencyCode;
  amountHKD: number;
  description: string;
  date: string; // YYYY-MM-DD
};

type MemberX = {
  id: string;
  name: string;
  role?: string;
  gender: Gender;
  payments: PaymentX[];
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatCurrencyHKD(n: number) {
  if (!Number.isFinite(n)) return "HK$0";
  return `HK$${Math.round(n).toLocaleString("en-US")}`;
}
function formatCurrency2(n: number) {
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function clampNumber(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// ===== FX cache (localStorage) =====
type FxCache = Record<string, { rate: number; asOf: number }>;
const FXCACHEKEY = "fxcachev1";
const FXTTLMS = 30 * 60 * 1000;

function readFxCache(): FxCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FXCACHEKEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as FxCache;
  } catch {
    return {};
  }
}
function writeFxCache(next: FxCache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FXCACHEKEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}
function fxPairKey(from: string, to: string) {
  return `${from}_${to}`;
}
function getCachedRate(from: CurrencyCode, to: CurrencyCode) {
  if (from === to) return { rate: 1, stale: false, asOf: 0 };
  const cache = readFxCache();
  const hit = cache[fxPairKey(from, to)];
  if (!hit || !Number.isFinite(hit.rate)) return null;
  const age = Date.now() - (hit.asOf || 0);
  return { rate: hit.rate, stale: age > FXTTLMS, asOf: hit.asOf || 0 };
}
async function fetchLiveRate(
  from: CurrencyCode,
  to: CurrencyCode,
  signal?: AbortSignal
): Promise<{ rate: number; asOf: number }> {
  const FROM = from.toUpperCase() as CurrencyCode;
  const TO = to.toUpperCase() as CurrencyCode;

  if (FROM === TO) return { rate: 1, asOf: Date.now() };

  const url =
    `https://api.frankfurter.app/latest` +
    `?from=${encodeURIComponent(FROM)}` +
    `&to=${encodeURIComponent(TO)}`;

  const res = await fetch(url, { method: "GET", cache: "no-store", signal });
  if (!res.ok) throw new Error("fx_upstream_failed");

  const data = (await res.json()) as {
    rates?: Record<string, number>;
    date?: string;
    base?: string;
  };

  const rate = Number(data?.rates?.[TO]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("fx_bad_rate");

  const asOf = Date.now();

  // 仍然用你原本嘅 localStorage cache（30分鐘 TTL）
  const cache = readFxCache();
  cache[fxPairKey(FROM, TO)] = { rate, asOf };
  writeFxCache(cache);

  return { rate, asOf };
}


// ===== UI helpers =====
function tagLabel(tag: ChecklistTag) {
  return tag === "important" ? "重要" : "一般";
}
function tagClass(tag: ChecklistTag) {
  return tag === "important"
    ? "bg-pink-100 text-pink-700 border-pink-200"
    : "bg-amber-100 text-amber-800 border-amber-200";
}
function settlementClass(amount: number) {
  if (amount > 0) return "text-emerald-600";
  if (amount < 0) return "text-pink-600";
  return "text-gray-400";
}
function settlementText(amount: number) {
  if (amount > 0) return formatCurrencyHKD(amount);
  if (amount < 0) return formatCurrencyHKD(Math.abs(amount));
  return "-";
}

function ModalShell(props: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const { open, title, children, onClose } = props;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 text-center text-xl font-bold text-gray-900">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function PrepMembersPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params?.tripId;

  const trips = useTripsStore((s) => s.trips);
const upsertTrip = useTripsStore((s) => s.upsertTrip);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const trip = useMemo(() => {
    if (!tripId) return null;
    return (trips || []).find((t) => t.id === tripId) || null;
  }, [trips, tripId]);

  const tripCurrency = useMemo<CurrencyCode>(() => {
    const c = (trip as any)?.currencyCode;
    return (SUPPORTED.includes(c) ? c : "JPY") as CurrencyCode;
  }, [trip]);

  // ===== Local editable state (sync back to store) =====
  const loadedRef = useRef(false);

  const [tab, setTab] = useState<SegTab>("prep");

  const [checklist, setChecklist] = useState<ChecklistItemX[]>([]);
  const [members, setMembers] = useState<MemberX[]>([]);

  // Init from trip once
  useEffect(() => {
    if (!mounted) return;
    if (!trip) return;

    if (loadedRef.current) return;
    loadedRef.current = true;

    const rawChecklist = Array.isArray((trip as any).checklist) ? (trip as any).checklist : [];
    const rawMembers = Array.isArray((trip as any).members) ? (trip as any).members : [];

    const normalizedChecklist: ChecklistItemX[] = rawChecklist
      .filter(Boolean)
      .map((x: any) => ({
        id: typeof x?.id === "string" ? x.id : uid("chk"),
        name: typeof x?.name === "string" ? x.name : "",
        subtitle: typeof x?.subtitle === "string" ? x.subtitle : "",
        date: typeof x?.date === "string" ? x.date : "",
        group: typeof x?.group === "string" ? x.group : "",
        tag: x?.tag === "important" ? "important" : "general",
        completed: Boolean(x?.completed),
      }))
      .filter((x: ChecklistItemX): x is ChecklistItemX => Boolean(x.name && x.group));


    const normalizePayment = (p: any): PaymentX | null => {
      const description = typeof p?.description === "string" ? p.description : "";
      const date = typeof p?.date === "string" ? p.date : todayISO();

      const originalCurrency =
        SUPPORTED.includes(p?.originalCurrency) ? (p.originalCurrency as CurrencyCode) : "HKD";
      const originalAmount = clampNumber(Number(p?.originalAmount), 0, 1_000_000_000);

      // 兼容：舊資料可能只有 amount（HKD）
      const amountHKD =
        Number.isFinite(Number(p?.amountHKD))
          ? clampNumber(Number(p.amountHKD), 0, 1_000_000_000)
          : clampNumber(Number(p?.amount), 0, 1_000_000_000);

      if (!description || amountHKD <= 0) return null;

      return {
        id: typeof p?.id === "string" ? p.id : uid("pay"),
        amount: amountHKD,
        originalAmount: originalAmount > 0 ? originalAmount : amountHKD,
        originalCurrency,
        amountHKD,
        description,
        date,
      };
    };

    const normalizedMembers: MemberX[] = rawMembers
      .filter(Boolean)
      .map((m: any) => ({
        id: typeof m?.id === "string" ? m.id : uid("mem"),
        name: typeof m?.name === "string" ? m.name : "",
        role: typeof m?.role === "string" ? m.role : "",
        gender: m?.gender === "female" ? "female" : "male",
        payments: Array.isArray(m?.payments) ? m.payments.map(normalizePayment).filter(Boolean) : [],
      }))
      .filter((m: MemberX) => Boolean(m.name));


    setChecklist(normalizedChecklist);
    setMembers(normalizedMembers);
  }, [mounted, trip]);

  const lastSavedRef = useRef<string>("");

  // Sync back to trip store when changed (avoid infinite loop)
useEffect(() => {
  if (!mounted) return;
  if (!tripId) return;
  if (!loadedRef.current) return;

  const snapshot = JSON.stringify({ checklist, members });
  if (snapshot === lastSavedRef.current) return;
  lastSavedRef.current = snapshot;

  const current = useTripsStore.getState().trips.find((t) => t.id === tripId);
  if (!current) return;

  upsertTrip({
    ...current,
    checklist: checklist as any,
    members: members as any,
  });
}, [mounted, tripId, checklist, members, upsertTrip]);


  // ===== Derived checklist =====
  const pendingChecklistCount = useMemo(
    () => checklist.filter((i) => !i.completed).length,
    [checklist]
  );
  const completedChecklistCount = useMemo(
    () => checklist.filter((i) => i.completed).length,
    [checklist]
  );

  const checklistGroups = useMemo(() => {
    const groups = Array.from(new Set(checklist.map((i) => i.group).filter(Boolean)));
    const preferred = ["證件", "交通", "住宿", "網絡", "藥品", "行李", "購物", "提醒", "其他"];
    const score = (g: string) => {
      const hit = preferred.findIndex((k) => g.includes(k));
      return hit === -1 ? 999 : hit;
    };
    return groups.sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sa - sb;
      return a.localeCompare(b, "zh-HK");
    });
  }, [checklist]);

  const checklistByGroup = useMemo(() => {
    const map = new Map<string, ChecklistItemX[]>();
    for (const g of checklistGroups) map.set(g, []);
    for (const item of checklist) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    for (const [g, items] of map.entries()) {
      map.set(
        g,
        items.slice().sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return a.name.localeCompare(b.name, "zh-HK");
        })
      );
    }
    return map;
  }, [checklist, checklistGroups]);

  // ===== Derived members settlement (HKD) =====
  const totalMembersCount = useMemo(() => members.length, [members]);

  const getMemberTotalPaymentHKD = (m: MemberX) =>
    (m.payments || []).reduce((sum, p) => {
      const hkd = Number.isFinite(p?.amountHKD) ? Number(p.amountHKD) : Number(p?.amount) || 0;
      return sum + (Number.isFinite(hkd) ? hkd : 0);
    }, 0);

  const totalPaymentsHKD = useMemo(
    () => members.reduce((sum, m) => sum + getMemberTotalPaymentHKD(m), 0),
    [members]
  );

  const perPersonShareHKD = useMemo(() => {
    const count = totalMembersCount;
    if (count <= 0) return 0;
    return totalPaymentsHKD / count;
  }, [totalPaymentsHKD, totalMembersCount]);

  const getSettlementAmountHKD = (m: MemberX) => getMemberTotalPaymentHKD(m) - perPersonShareHKD;

  const creditorName = useMemo(() => {
    if (members.length === 0) return "";
    let maxPositive = -Infinity;
    let creditor: string | null = null;
    for (const m of members) {
      const amt = getSettlementAmountHKD(m);
      if (amt > maxPositive) {
        maxPositive = amt;
        creditor = m.name;
      }
    }
    return creditor ?? "";
  }, [members, perPersonShareHKD]);

  const settlementSummary = useMemo(() => {
    if (members.length < 2) return "";
    const lines: string[] = [];
    for (const m of members) {
      const amt = getSettlementAmountHKD(m);
      if (amt < 0 && creditorName) {
        lines.push(`${m.name} → ${formatCurrencyHKD(Math.abs(amt))} → ${creditorName}`);
      }
    }
    return lines.length ? lines.join("；") : "";
  }, [members, creditorName, perPersonShareHKD]);

  // ===== UI state: checklist modal =====
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [activeChecklistMenuId, setActiveChecklistMenuId] = useState<string | null>(null);
  const [checklistDraft, setChecklistDraft] = useState<{
    name: string;
    subtitle: string;
    date: string;
    group: string;
    tag: ChecklistTag;
  }>({ name: "", subtitle: "", date: "", group: "", tag: "general" });

  const openChecklistCreate = () => {
    setEditingChecklistId(null);
    setChecklistDraft({ name: "", subtitle: "", date: "", group: "", tag: "general" });
    setShowChecklistModal(true);
    setActiveChecklistMenuId(null);
  };

  const openChecklistEdit = (item: ChecklistItemX) => {
    setEditingChecklistId(item.id);
    setChecklistDraft({
      name: item.name,
      subtitle: item.subtitle ?? "",
      date: item.date ?? "",
      group: item.group,
      tag: item.tag,
    });
    setShowChecklistModal(true);
    setActiveChecklistMenuId(null);
  };

  const toggleChecklistCompleted = (id: string) => {
    setChecklist((prev) => prev.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i)));
  };

  const deleteChecklistItem = (id: string) => {
    if (!confirm("確定刪除？")) return;
    setChecklist((prev) => prev.filter((i) => i.id !== id));
    setActiveChecklistMenuId(null);
  };

  const saveChecklistItem = () => {
    const name = checklistDraft.name.trim();
    const group = checklistDraft.group.trim();
    if (!name || !group) {
      alert("請填寫項目名稱及分組");
      return;
    }

    if (editingChecklistId) {
      setChecklist((prev) =>
        prev.map((i) =>
          i.id === editingChecklistId
            ? {
                ...i,
                name,
                subtitle: checklistDraft.subtitle.trim(),
                date: checklistDraft.date,
                group,
                tag: checklistDraft.tag,
              }
            : i
        )
      );
    } else {
      const newItem: ChecklistItemX = {
        id: uid("chk"),
        name,
        subtitle: checklistDraft.subtitle.trim(),
        date: checklistDraft.date,
        group,
        tag: checklistDraft.tag,
        completed: false,
      };
      setChecklist((prev) => [...prev, newItem]);
    }

    setShowChecklistModal(false);
    setEditingChecklistId(null);
    setChecklistDraft({ name: "", subtitle: "", date: "", group: "", tag: "general" });
  };

  // ===== UI state: member modal =====
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [activeMemberMenuId, setActiveMemberMenuId] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState<{ name: string; role: string; gender: Gender }>({
    name: "",
    role: "",
    gender: "male",
  });

  const openMemberCreate = () => {
    setEditingMemberId(null);
    setMemberDraft({ name: "", role: "", gender: "male" });
    setShowMemberModal(true);
    setActiveMemberMenuId(null);
  };

  const openMemberEdit = (m: MemberX) => {
    setEditingMemberId(m.id);
    setMemberDraft({ name: m.name, role: m.role ?? "", gender: m.gender });
    setShowMemberModal(true);
    setActiveMemberMenuId(null);
  };

  const saveMember = () => {
    const name = memberDraft.name.trim();
    if (!name) {
      alert("請填寫成員姓名");
      return;
    }
    if (!editingMemberId && members.length >= 10) {
      alert("最多 10 位成員");
      return;
    }

    if (editingMemberId) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMemberId
            ? { ...m, name, role: memberDraft.role.trim(), gender: memberDraft.gender }
            : m
        )
      );
    } else {
      const newMember: MemberX = {
        id: uid("mem"),
        name,
        role: memberDraft.role.trim(),
        gender: memberDraft.gender,
        payments: [],
      };
      setMembers((prev) => [...prev, newMember]);
    }

    setShowMemberModal(false);
    setEditingMemberId(null);
    setMemberDraft({ name: "", role: "", gender: "male" });
  };

  const deleteMember = (id: string) => {
    if (!confirm("確定刪除？")) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setActiveMemberMenuId(null);
  };

  // ===== Payment modal (live FX) =====
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetMemberId, setPaymentTargetMemberId] = useState<string | null>(null);

  const [paymentDraft, setPaymentDraft] = useState<{
    originalAmount: number;
    originalCurrency: CurrencyCode;
    description: string;
    date: string;
  }>({
    originalAmount: 0,
    originalCurrency: "JPY",
    description: "",
    date: todayISO(),
  });

  const [fxToHKD, setFxToHKD] = useState<{ rate: number; asOf: number; source: "live" | "cache" }>(
    { rate: 1, asOf: 0, source: "cache" }
  );
  const [fxStatus, setFxStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  const openPaymentCreate = (memberId: string) => {
    setPaymentTargetMemberId(memberId);
    setPaymentDraft({
      originalAmount: 0,
      originalCurrency: tripCurrency,
      description: "",
      date: todayISO(),
    });
    setShowPaymentModal(true);
    setActiveMemberMenuId(null);
  };

  // Load FX when modal open or currency changed
  useEffect(() => {
    if (!mounted) return;
    if (!showPaymentModal) return;

    const from = paymentDraft.originalCurrency;
    const to: CurrencyCode = "HKD";

    if (from === "HKD") {
      setFxToHKD({ rate: 1, asOf: Date.now(), source: "cache" });
      setFxStatus("ok");
      return;
    }

    const cached = getCachedRate(from, to);
    if (cached) {
      setFxToHKD({ rate: cached.rate, asOf: cached.asOf, source: "cache" });
      setFxStatus("ok");
    }

    const ac = new AbortController();
    setFxStatus("loading");

    fetchLiveRate(from, to, ac.signal)
      .then((r) => {
        setFxToHKD({ rate: r.rate, asOf: r.asOf, source: "live" });
        setFxStatus("ok");
      })
      .catch(() => {
        if (cached) setFxStatus("ok");
        else setFxStatus("error");
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, showPaymentModal, paymentDraft.originalCurrency]);

  const paymentHKD = useMemo(() => {
    const amt = Number(paymentDraft.originalAmount);
    if (!Number.isFinite(amt) || amt <= 0) return 0;
    const rate = Number(fxToHKD.rate);
    if (!Number.isFinite(rate) || rate <= 0) return 0;
    return amt * rate;
  }, [paymentDraft.originalAmount, fxToHKD.rate]);

  const savePayment = () => {
    const memberId = paymentTargetMemberId;
    if (!memberId) return;

    const originalAmount = Number(paymentDraft.originalAmount);
    const originalCurrency = paymentDraft.originalCurrency;
    const description = paymentDraft.description.trim();
    const date = paymentDraft.date || todayISO();

    if (!Number.isFinite(originalAmount) || originalAmount <= 0 || !description) {
      alert("請填寫金額及描述");
      return;
    }

    const rate = originalCurrency === "HKD" ? 1 : Number(fxToHKD.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      alert("匯率取得失敗，請稍後再試");
      return;
    }

    const amountHKD = originalAmount * rate;

    const p: PaymentX = {
      id: uid("pay"),
      originalAmount,
      originalCurrency,
      amountHKD,
      amount: amountHKD, // 兼容舊 schema
      description,
      date,
    };

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, payments: [...(m.payments || []), p] } : m))
    );

    setShowPaymentModal(false);
    setPaymentTargetMemberId(null);
    setPaymentDraft({ originalAmount: 0, originalCurrency: "JPY", description: "", date: todayISO() });
  };

  const editingMember = useMemo(() => {
    if (!editingMemberId) return null;
    return members.find((m) => m.id === editingMemberId) ?? null;
  }, [editingMemberId, members]);

  // ===== Render guards =====
  if (!mounted) {
    return <main className="p-4 pb-24 text-sm text-gray-500">Loading…</main>;
  }

  if (!tripId) {
    return <main className="p-4 pb-24 text-sm text-gray-500">TripId 無效。</main>;
  }

  if (!trip) {
    return <main className="p-4 pb-24 text-sm text-gray-500">未找到此行程。</main>;
  }

  return (
    <main className="p-4 pb-24">
      <h1 className="text-lg font-bold text-gray-900">出發前準備</h1>

      {/* Segmented Tabs */}
      <div className="mt-3 grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-sm">
        <button
          className={`rounded-lg py-2 ${tab === "prep" ? "bg-white font-semibold text-gray-900" : "text-gray-500"}`}
          onClick={() => setTab("prep")}
          type="button"
        >
          Checklist
        </button>
        <button
          className={`rounded-lg py-2 ${tab === "members" ? "bg-white font-semibold text-gray-900" : "text-gray-500"}`}
          onClick={() => setTab("members")}
          type="button"
        >
          Members
        </button>
      </div>

      {/* ===== Prep tab ===== */}
      {tab === "prep" ? (
        <section className="mt-4">
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-pink-500 to-rose-500 p-4 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold">出發前檢查清單</div>
                <div className="mt-1 text-xs/5 opacity-90">按一下方格即可完成／取消。</div>
              </div>
              <button
                type="button"
                onClick={openChecklistCreate}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-rose-600 shadow-sm hover:bg-rose-50"
              >
                + 新增
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/90 p-3 text-gray-900">
                <div className="text-xs text-gray-600">未完成</div>
                <div className="mt-1 text-2xl font-extrabold">{pendingChecklistCount}</div>
              </div>
              <div className="rounded-xl bg-white/90 p-3 text-gray-900">
                <div className="text-xs text-gray-600">已完成</div>
                <div className="mt-1 text-2xl font-extrabold">{completedChecklistCount}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-5">
            {checklistGroups.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
                暫時未有清單，按「新增」開始。
              </div>
            ) : (
              checklistGroups.map((group) => {
                const items = checklistByGroup.get(group) ?? [];
                return (
                  <div key={group}>
                    <div className="mb-2 px-1 text-sm font-bold text-gray-700">
                      {group}{" "}
                      <span className="ml-1 text-xs font-normal text-gray-400">{items.length}</span>
                    </div>

                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-400 shadow-sm">
                        空
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="relative flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => toggleChecklistCompleted(item.id)}
                              className={`h-6 w-6 shrink-0 rounded-md border-2 ${
                                item.completed
                                  ? "border-rose-500 bg-rose-500 text-white"
                                  : "border-gray-200 bg-gray-50 text-transparent"
                              }`}
                              aria-label="Toggle completed"
                            >
                              ✓
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`truncate text-sm font-semibold ${
                                    item.completed ? "text-gray-400 line-through" : "text-gray-900"
                                  }`}
                                >
                                  {item.name}
                                </div>
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${tagClass(
                                    item.tag
                                  )}`}
                                >
                                  {tagLabel(item.tag)}
                                </span>
                              </div>
                              {item.subtitle ? (
                                <div className="truncate text-xs text-gray-500">{item.subtitle}</div>
                              ) : null}
                              {item.date ? (
                                <div className="mt-0.5 text-[11px] text-gray-400">{item.date}</div>
                              ) : null}
                            </div>

                            <div className="relative shrink-0">
                              <button
                                type="button"
                                className="rounded-lg px-2 py-1 text-lg leading-none text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                                onClick={() =>
                                  setActiveChecklistMenuId((cur) => (cur === item.id ? null : item.id))
                                }
                                aria-label="Menu"
                              >
                                …
                              </button>

                              {activeChecklistMenuId === item.id ? (
                                <div className="absolute right-0 top-9 z-10 w-32 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                                  <button
                                    type="button"
                                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                    onClick={() => openChecklistEdit(item)}
                                  >
                                    編輯
                                  </button>
                                  <button
                                    type="button"
                                    className="block w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-gray-50"
                                    onClick={() => deleteChecklistItem(item.id)}
                                  >
                                    刪除
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Checklist Modal */}
          <ModalShell
            open={showChecklistModal}
            title={editingChecklistId ? "編輯清單" : "新增清單"}
            onClose={() => {
              setShowChecklistModal(false);
              setEditingChecklistId(null);
            }}
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">項目</label>
                <input
                  value={checklistDraft.name}
                  onChange={(e) => setChecklistDraft((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="SIM 卡 / 護照 / 轉插..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">備註</label>
                <input
                  value={checklistDraft.subtitle}
                  onChange={(e) => setChecklistDraft((s) => ({ ...s, subtitle: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="例如：出發前 2 天買"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">日期</label>
                <input
                  type="date"
                  value={checklistDraft.date}
                  onChange={(e) => setChecklistDraft((s) => ({ ...s, date: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">分組</label>
                <input
                  list="checklist-groups"
                  value={checklistDraft.group}
                  onChange={(e) => setChecklistDraft((s) => ({ ...s, group: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="證件 / 交通 / 行李..."
                />
                <datalist id="checklist-groups">
                  {checklistGroups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">標籤</label>
                <select
                  value={checklistDraft.tag}
                  onChange={(e) =>
                    setChecklistDraft((s) => ({ ...s, tag: e.target.value as ChecklistTag }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                >
                  <option value="general">一般</option>
                  <option value="important">重要</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveChecklistItem}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-600"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChecklistModal(false);
                    setEditingChecklistId(null);
                  }}
                  className="flex-1 rounded-xl bg-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          </ModalShell>
        </section>
      ) : null}

      {/* ===== Members tab ===== */}
      {tab === "members" ? (
        <section className="mt-4">
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-pink-500 to-rose-500 p-4 text-white shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold">成員結算（HKD）</div>
                <div className="mt-1 text-xs/5 opacity-90">
                  可用原幣輸入，系統會即時換算為 HKD 並保存。
                </div>
              </div>
              <button
                type="button"
                onClick={openMemberCreate}
                disabled={members.length >= 10}
                className={`rounded-full bg-white px-3 py-1.5 text-sm font-bold text-rose-600 shadow-sm hover:bg-rose-50 ${
                  members.length >= 10 ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                + 新增
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/90 p-3 text-gray-900">
                <div className="text-xs text-gray-600">成員數</div>
                <div className="mt-1 text-2xl font-extrabold">{totalMembersCount}</div>
              </div>
              <div className="rounded-xl bg-white/90 p-3 text-gray-900">
                <div className="text-xs text-gray-600">總付款（HKD）</div>
                <div className="mt-1 text-2xl font-extrabold">{formatCurrencyHKD(totalPaymentsHKD)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {members.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
                暫時未有成員。
              </div>
            ) : (
              members.map((m) => {
                const total = getMemberTotalPaymentHKD(m);
                return (
                  <div
                    key={m.id}
                    className="relative flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-lg">
                      {m.gender === "male" ? "👨" : "👩"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900">{m.name}</div>
                      <div className="text-xs text-gray-500">
                        {m.role ? `${m.role} · ` : ""}
                        {formatCurrencyHKD(total)}
                      </div>
                    </div>

                    <div className="relative shrink-0">
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-lg leading-none text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                        onClick={() => setActiveMemberMenuId((cur) => (cur === m.id ? null : m.id))}
                        aria-label="Menu"
                      >
                        …
                      </button>

                      {activeMemberMenuId === m.id ? (
                        <div className="absolute right-0 top-9 z-10 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => openMemberEdit(m)}
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => openPaymentCreate(m.id)}
                          >
                            新增付款
                          </button>
                          <button
                            type="button"
                            className="block w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-gray-50"
                            onClick={() => deleteMember(m.id)}
                          >
                            刪除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Settlement */}
          {members.length >= 2 ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-bold text-gray-700">結算</div>
              <div className="mt-1 text-xs text-gray-500">
                總付款 {formatCurrencyHKD(totalPaymentsHKD)}，每人平均 {formatCurrencyHKD(perPersonShareHKD)}
              </div>

              <div className="mt-3 space-y-2">
                {members.map((m) => {
                  const settle = getSettlementAmountHKD(m);
                  return (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900">{m.name}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {formatCurrencyHKD(getMemberTotalPaymentHKD(m))}
                        </span>
                      </div>
                      <div className={`font-semibold ${settlementClass(settle)}`}>
                        {settlementText(settle)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {settlementSummary ? (
                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-700">
                  {settlementSummary}
                </div>
              ) : null}

              {creditorName ? (
                <div className="mt-2 text-[11px] text-gray-400">收款方傾向：{creditorName}</div>
              ) : null}
            </div>
          ) : null}

          {/* Member Modal */}
          <ModalShell
            open={showMemberModal}
            title={editingMemberId ? "編輯成員" : "新增成員"}
            onClose={() => {
              setShowMemberModal(false);
              setEditingMemberId(null);
            }}
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">姓名</label>
                <input
                  value={memberDraft.name}
                  onChange={(e) => setMemberDraft((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="例如：阿明"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">角色（可選）</label>
                <input
                  value={memberDraft.role}
                  onChange={(e) => setMemberDraft((s) => ({ ...s, role: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="例如：房費主付 / 司機"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">性別</label>
                <select
                  value={memberDraft.gender}
                  onChange={(e) => setMemberDraft((s) => ({ ...s, gender: e.target.value as Gender }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                >
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>

              {editingMember && editingMember.payments.length > 0 ? (
                <div className="pt-1">
                  <div className="mb-2 text-sm font-semibold text-gray-700">付款記錄</div>
                  <div className="max-h-48 space-y-2 overflow-auto pr-1">
                    {editingMember.payments
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((p) => (
                        <div
                          key={p.id}
                          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 truncate text-gray-700">
                              {p.date} · {p.description}
                            </div>
                            <div className="shrink-0 font-semibold text-rose-600">
                              {formatCurrencyHKD(p.amountHKD)}
                            </div>
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {p.originalCurrency} {formatCurrency2(p.originalAmount)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveMember}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-600"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMemberModal(false);
                    setEditingMemberId(null);
                  }}
                  className="flex-1 rounded-xl bg-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          </ModalShell>

          {/* Payment Modal (Live FX) */}
          <ModalShell
            open={showPaymentModal}
            title="新增付款（即時匯率）"
            onClose={() => {
              setShowPaymentModal(false);
              setPaymentTargetMemberId(null);
            }}
          >
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">原幣</label>
                <select
                  value={paymentDraft.originalCurrency}
                  onChange={(e) =>
                    setPaymentDraft((s) => ({ ...s, originalCurrency: e.target.value as CurrencyCode }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                >
                  {SUPPORTED.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">金額</label>
                <input
                  type="number"
                  value={paymentDraft.originalAmount}
                  onChange={(e) =>
                    setPaymentDraft((s) => ({ ...s, originalAmount: Number(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="15000"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    HKD{" "}
                    {fxStatus === "loading"
                      ? "（更新中…）"
                      : fxStatus === "error"
                        ? "（匯率失敗）"
                        : `1 ${paymentDraft.originalCurrency} = ${formatCurrency2(fxToHKD.rate)} HKD`}
                  </span>
                  <span className="text-[11px]">
                    {fxStatus === "ok" ? (fxToHKD.source === "live" ? "Live" : "Cache") : ""}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">HKD（自動換算）</label>
                <input
                  value={paymentHKD ? formatCurrency2(paymentHKD) : ""}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-600 outline-none"
                  placeholder="—"
                />
                {fxToHKD.asOf > 0 ? (
                  <div className="mt-1 text-[11px] text-gray-400">
                    更新時間：{new Date(fxToHKD.asOf).toLocaleString("zh-HK")}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">描述</label>
                <input
                  value={paymentDraft.description}
                  onChange={(e) => setPaymentDraft((s) => ({ ...s, description: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  placeholder="JR Pass / 酒店訂金..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">日期</label>
                <input
                  type="date"
                  value={paymentDraft.date}
                  onChange={(e) => setPaymentDraft((s) => ({ ...s, date: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={savePayment}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-600"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentTargetMemberId(null);
                  }}
                  className="flex-1 rounded-xl bg-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          </ModalShell>
        </section>
      ) : null}
    </main>
  );
}