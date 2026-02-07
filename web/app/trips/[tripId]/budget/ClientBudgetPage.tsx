"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { useTripsStore } from "@/lib/store/trips";
import { CategoryDonut } from "./CategoryDonut";

type ExpenseCategory = "food" | "attraction" | "shopping" | "transport" | "other";

type Expense = {
  title: string;
  category: ExpenseCategory;
  originalAmount: number; // local currency
  amountHKD: number; // converted to HKD
  originalCurrency: string; // e.g. CHF
  date: string; // yyyy-mm-dd
  notes?: string;
};

type CurrencyRate = { code: string; symbol: string; rate: number };

// Match your index.html idea: 1 LOCAL = rate HKD (example: 1 CHF = 8.8 HKD)
const currencyRates: Record<string, CurrencyRate> = {
  JPY: { code: "JPY", symbol: "¥", rate: 0.052 },
  HKD: { code: "HKD", symbol: "$", rate: 1 },
  "NT TWD": { code: "TWD", symbol: "NT$", rate: 0.25 },
  KRW: { code: "KRW", symbol: "₩", rate: 0.0055 },
  THB: { code: "THB", symbol: "฿", rate: 0.2 },
  SGD: { code: "SGD", symbol: "S$", rate: 5.5 },
  USD: { code: "USD", symbol: "$", rate: 7.8 },
  GBP: { code: "GBP", symbol: "£", rate: 9.8 },
  EUR: { code: "EUR", symbol: "€", rate: 8.5 },
  CHF: { code: "CHF", symbol: "CHF", rate: 8.8 },
};

type TripLike = {
  id: string;
  title?: string;

  location?: string; // (舊)你之前可能用 location 存幣種；新版本你有 currencyCode 都得
  currencyCode?: string; // (新)

  totalBudget?: number; // HKD
  expenses?: Expense[];
};

type FxLatestResponse = {
  amount?: number;
  base?: string;
  date?: string;
  rates?: Record<string, number>;
  error?: string;
};

function deepClone<T>(value: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (globalThis as any)?.structuredClone as undefined | ((v: unknown) => unknown);
  if (typeof sc === "function") return sc(value) as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatCurrency(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeCurrencyKey(raw?: string) {
  const s = (raw ?? "").toUpperCase().trim();

  if (s.includes("CHF")) return "CHF";
  if (s.includes("TWD")) return "NT TWD";
  if (s.includes("JPY")) return "JPY";
  if (s.includes("HKD")) return "HKD";
  if (s.includes("KRW")) return "KRW";
  if (s.includes("THB")) return "THB";
  if (s.includes("SGD")) return "SGD";
  if (s.includes("USD")) return "USD";
  if (s.includes("GBP")) return "GBP";
  if (s.includes("EUR")) return "EUR";

  return "HKD";
}

function getCategoryLabel(category: ExpenseCategory) {
  const labels: Record<ExpenseCategory, string> = {
    food: "餐飲",
    attraction: "觀光",
    shopping: "購物",
    transport: "交通",
    other: "其他",
  };
  return labels[category] ?? category;
}

function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
}) {
  if (!props.open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close modal overlay"
        className="absolute inset-0 bg-black/40"
        onClick={props.onClose}
        type="button"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={[
            "w-full rounded-3xl border border-slate-200 bg-white shadow-xl",
            "max-h-[85vh] overflow-y-auto",
            props.maxWidthClassName ?? "max-w-md",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{props.title}</h2>
              <p className="mt-1 text-xs text-slate-500">資料會儲存在本地（LocalStorage persist）。</p>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              關閉
            </button>
          </div>

          <div className="px-6 py-5">{props.children}</div>
        </div>
      </div>
    </div>
  );
}

export default function ClientBudgetPage() {
  const params = useParams();
  const tripId =
    typeof params?.tripId === "string"
      ? params.tripId
      : Array.isArray(params?.tripId)
        ? params.tripId[0]
        : "";

  // avoid zustand infinite loop: select separately
  const trips = useTripsStore((s) => s.trips);
  const upsertTrip = useTripsStore((s) => s.upsertTrip);

  const trip = useMemo(() => {
    if (!tripId) return undefined;
    return (trips as TripLike[]).find((t) => t.id === tripId);
  }, [trips, tripId]);

  const expenses = useMemo(() => (Array.isArray(trip?.expenses) ? trip!.expenses! : []), [trip]);

  // 兼容：優先用 currencyCode，冇就用 location（你舊設計可能係咁存）
  const currencyKey = useMemo(() => {
    return normalizeCurrencyKey(
      (trip as TripLike | undefined)?.currencyCode ?? (trip as TripLike | undefined)?.location
    );
  }, [trip]);

  const rateObj = currencyRates[currencyKey] ?? currencyRates.HKD;

  // localCode: 真正 3-letter code（TWD/CHF/JPY...）
  const localCode = rateObj.code;

  // fallbackRate：API 失敗時仍然可用
  const fallbackRate = rateObj.rate;

  // exchangeRate: 1 LOCAL = rate HKD
  const [exchangeRate, setExchangeRate] = useState<number>(localCode === "HKD" ? 1 : fallbackRate);
  const [rateDate, setRateDate] = useState<string>("");
  const [rateStatus, setRateStatus] = useState<"idle" | "loading" | "live" | "fallback">("idle");

  useEffect(() => {
    let cancelled = false;

    async function loadFx() {
      if (!localCode || localCode === "HKD") {
        setExchangeRate(1);
        setRateDate(new Date().toISOString().split("T")[0] ?? "");
        setRateStatus("live");
        return;
      }

      setRateStatus("loading");

      try {
        // 用你現成：app/api/fx/latest/route.ts
        // 取 1 LOCAL = ? HKD，所以 base=LOCAL，symbols=HKD
        const res = await fetch(`/api/fx/latest?base=${encodeURIComponent(localCode)}&symbols=HKD`, {
          cache: "no-store",
        });

        const data = (await res.json()) as FxLatestResponse;

        if (cancelled) return;

        const r = Number(data?.rates?.HKD);
        if (Number.isFinite(r) && r > 0) {
          setExchangeRate(r);
          setRateDate(String(data?.date ?? ""));
          setRateStatus("live");
          return;
        }

        // API 有回 error / 或者找唔到 rate，就 fallback
        setExchangeRate(fallbackRate);
        setRateDate("");
        setRateStatus("fallback");
      } catch {
        if (cancelled) return;
        setExchangeRate(fallbackRate);
        setRateDate("");
        setRateStatus("fallback");
      }
    }

    loadFx();

    return () => {
      cancelled = true;
    };
    // fallbackRate 會跟住 currencyKey 變，確保切換旅程時 fallback 都更新
  }, [localCode, fallbackRate]);

  const totalBudgetHKD = trip?.totalBudget ?? 0;

  const totalExpenseHKD = useMemo(
    () => expenses.reduce((sum, exp) => sum + (exp?.amountHKD ?? 0), 0),
    [expenses]
  );

  const remainingHKD = totalBudgetHKD - totalExpenseHKD;

  function hkDToLocal(amountHKD: number) {
    if (!Number.isFinite(amountHKD)) return 0;
    if (!exchangeRate) return 0;
    return amountHKD / exchangeRate;
  }

  function localToHKD(amountLocal: number) {
    if (!Number.isFinite(amountLocal)) return 0;
    return amountLocal * exchangeRate;
  }

  const budgetPercentage = totalBudgetHKD > 0 ? Math.min((totalExpenseHKD / totalBudgetHKD) * 100, 100) : 0;

  // Converter widget (LOCAL -> HKD)
  const [currencyAmountLocal, setCurrencyAmountLocal] = useState<number>(0);
  const convertedHKD = useMemo(() => localToHKD(currencyAmountLocal), [currencyAmountLocal, exchangeRate]);

  // Filter
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | "">("");

  const filtered = useMemo(() => {
    const indexed = expenses.map((exp, idx) => ({ exp, idx }));
    if (!selectedCategory) return indexed;
    return indexed.filter((x) => x.exp.category === selectedCategory);
  }, [expenses, selectedCategory]);

  // Modals
  const [setBudgetOpen, setSetBudgetOpen] = useState(false);
  const [budgetInputHKD, setBudgetInputHKD] = useState<number>(totalBudgetHKD);

  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<{
    title: string;
    category: ExpenseCategory | "";
    originalAmountLocal: number;
    date: string;
    notes: string;
  }>({
    title: "",
    category: "",
    originalAmountLocal: 0,
    date: new Date().toISOString().split("T")[0]!,
    notes: "",
  });

  const expenseConversionHKD = useMemo(
    () => localToHKD(expenseForm.originalAmountLocal || 0),
    [expenseForm.originalAmountLocal, exchangeRate]
  );

  function commitTrip(next: TripLike) {
    upsertTrip(next as never);
  }

  function saveBudgetHKD() {
    if (!trip) return;
    if (!Number.isFinite(budgetInputHKD) || budgetInputHKD <= 0) {
      alert("請輸入有效總預算（HKD，大於 0）。");
      return;
    }
    commitTrip({ ...(trip as object), totalBudget: budgetInputHKD } as TripLike);
    setSetBudgetOpen(false);
  }

  function openAddExpense() {
    setExpenseForm({
      title: "",
      category: "",
      originalAmountLocal: 0,
      date: new Date().toISOString().split("T")[0]!,
      notes: "",
    });
    setAddExpenseOpen(true);
  }

  function saveExpense() {
    if (!trip) return;

    if (!expenseForm.title.trim() || !expenseForm.category || expenseForm.originalAmountLocal <= 0) {
      alert("請填寫：項目、類別、金額（大於 0）。");
      return;
    }

    const nextExpenses = deepClone(expenses);
    const newExpense: Expense = {
      title: expenseForm.title.trim(),
      category: expenseForm.category as ExpenseCategory,
      originalAmount: expenseForm.originalAmountLocal,
      amountHKD: expenseConversionHKD,
      originalCurrency: localCode,
      date: expenseForm.date,
      notes: expenseForm.notes?.trim(),
    };

    nextExpenses.push(newExpense);
    commitTrip({ ...(trip as object), expenses: nextExpenses } as TripLike);
    setAddExpenseOpen(false);
  }

  function deleteExpense(idx: number) {
    if (!trip) return;
    if (!confirm("確定要刪除呢筆支出？")) return;
    const next = deepClone(expenses);
    next.splice(idx, 1);
    commitTrip({ ...(trip as object), expenses: next } as TripLike);
  }

  if (!tripId) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">tripId 無效</h1>
          <p className="mt-2 text-sm text-slate-600">請確認路由係 /trips/[tripId]/budget。</p>
          <div className="mt-4"></div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">找不到旅程</h1>
          <p className="mt-2 text-sm text-slate-600">呢個 tripId 可能唔存在，或者資料未載入完成。</p>
          <div className="mt-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-xl font-semibold text-slate-900">預算追蹤</h1>
          </div>

          <p className="mt-2 truncate text-sm text-slate-600">
            {trip.title ? `旅程：${trip.title}` : `Trip ID：${trip.id}`} · 當地貨幣：{localCode}
          </p>

          <p className="mt-1 truncate text-xs text-slate-500">
            匯率：1 {localCode} = {exchangeRate} HKD
            {rateDate ? `（${rateDate}）` : ""}
            {rateStatus === "loading" ? "（更新中…）" : null}
            {rateStatus === "fallback" ? "（使用預設匯率）" : null}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setBudgetInputHKD(totalBudgetHKD || 0);
            setSetBudgetOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Settings2 className="h-4 w-4" />
          設定預算
        </button>
      </div>

      {/* Converter */}
      <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-800">貨幣轉換器（當地 → HKD）</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={currencyAmountLocal}
              onChange={(e) => setCurrencyAmountLocal(Number(e.target.value))}
              type="number"
              placeholder="0"
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
            <span className="text-xs font-semibold text-slate-600 min-w-12 text-right">{localCode}</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={formatCurrency(convertedHKD)}
              readOnly
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-600"
            />
            <span className="text-xs font-semibold text-slate-600 min-w-12 text-right">HKD</span>
          </div>

          <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
            1 {localCode} = {exchangeRate} HKD
          </div>
        </div>
      </div>

      {/* Budget card */}
      <div className="mb-4 overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
        <div className="bg-gradient-to-r from-[#BC002D] to-[#E24A6A] p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-xs opacity-90">總預算（HKD）</div>
              <div className="mt-1 text-xl font-semibold">{formatCurrency(totalBudgetHKD)}</div>
              <div className="mt-1 text-xs opacity-90">
                約 {localCode} {formatCurrency(hkDToLocal(totalBudgetHKD))}
              </div>
            </div>
            <div className="flex-1 text-right">
              <div className="text-xs opacity-90">已花費（HKD）</div>
              <div className="mt-1 text-xl font-semibold">{formatCurrency(totalExpenseHKD)}</div>
              <div className="mt-1 text-xs opacity-90">
                約 {localCode} {formatCurrency(hkDToLocal(totalExpenseHKD))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/30">
              <div className="h-2 rounded-full bg-white/80" style={{ width: `${budgetPercentage}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs opacity-90">
              <span>使用率</span>
              <span>{budgetPercentage.toFixed(1)}%</span>
            </div>
          </div>

          <div className="mt-4 border-t border-white/20 pt-4">
            <div className="text-xs opacity-90">剩餘預算（HKD）</div>
            <div className={["mt-1 text-2xl font-semibold", remainingHKD < 0 ? "text-yellow-100" : "text-white"].join(" ")}>
              {formatCurrency(remainingHKD)}
            </div>
            <div className="mt-1 text-xs opacity-90">
              約 {localCode} {formatCurrency(hkDToLocal(remainingHKD))}
            </div>
            {remainingHKD < 0 ? <div className="mt-1 text-xs opacity-95">已超支</div> : null}
          </div>
        </div>
      </div>

      {/* Category distribution (Donut) */}
      <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">類別支出分佈</div>
            <div className="mt-1 text-xs text-slate-500">滑過圓環可查看每類金額與佔比</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">已花費（HKD）</div>
            <div className="text-sm font-semibold text-slate-900">{formatCurrency(totalExpenseHKD)}</div>
          </div>
        </div>

        <div className="mt-4">
          <CategoryDonut expenses={expenses} />
        </div>
      </div>

      {/* Expense header */}
      <div className="mb-3 flex items-center gap-2">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as ExpenseCategory | "")}
          className="flex-1 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
        >
          <option value="">全部類別</option>
          <option value="food">餐飲</option>
          <option value="attraction">觀光</option>
          <option value="shopping">購物</option>
          <option value="transport">交通</option>
          <option value="other">其他</option>
        </select>

        <button
          type="button"
          onClick={openAddExpense}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#BC002D] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          新增支出
        </button>
      </div>

      {/* Expense list */}
      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(({ exp, idx }) => (
            <div key={`exp-${idx}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900 truncate">{exp.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {getCategoryLabel(exp.category)} · {exp.date}
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    {exp.originalCurrency} {formatCurrency(exp.originalAmount)} <span className="text-slate-300">|</span>{" "}
                    HKD {formatCurrency(exp.amountHKD)}
                  </div>
                  {exp.notes ? <div className="mt-2 text-xs text-slate-600">{exp.notes}</div> : null}
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-base font-semibold text-[#BC002D]">{formatCurrency(exp.amountHKD)}</div>
                    <div className="text-xs text-slate-500">HKD</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteExpense(idx)}
                    className="rounded-2xl p-2 text-slate-500 hover:bg-slate-50"
                    aria-label="刪除支出"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="text-4xl">💸</div>
          <p className="mt-3 text-sm font-semibold text-slate-700">暫時未有支出紀錄</p>
          <p className="mt-1 text-sm text-slate-500">按「新增支出」開始記錄。</p>
        </div>
      )}

      {/* Set budget modal (HKD) */}
      <Modal open={setBudgetOpen} title="設定總預算（HKD）" onClose={() => setSetBudgetOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">總預算（HKD）</label>
            <input
              type="number"
              value={budgetInputHKD}
              onChange={(e) => setBudgetInputHKD(Number(e.target.value))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="10000"
            />
            <p className="mt-2 text-xs text-slate-500">
              參考：約 {localCode} {formatCurrency(hkDToLocal(budgetInputHKD || 0))}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={saveBudgetHKD}
              className="flex-1 rounded-2xl bg-[#BC002D] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
            >
              儲存
            </button>
            <button
              type="button"
              onClick={() => setSetBudgetOpen(false)}
              className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:opacity-90"
            >
              取消
            </button>
          </div>
        </div>
      </Modal>

      {/* Add expense modal (LOCAL input) */}
      <Modal open={addExpenseOpen} title={`新增支出（輸入 ${localCode}）`} onClose={() => setAddExpenseOpen(false)}>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">項目</label>
            <input
              value={expenseForm.title}
              onChange={(e) => setExpenseForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="例如：餐廳 / 車費 / 手信"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">類別</label>
            <select
              value={expenseForm.category}
              onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value as ExpenseCategory | "" }))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            >
              <option value="">請選擇</option>
              <option value="food">餐飲</option>
              <option value="attraction">觀光</option>
              <option value="shopping">購物</option>
              <option value="transport">交通</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              金額（<span className="text-[#BC002D] font-semibold">{localCode}</span>）
            </label>
            <input
              type="number"
              value={expenseForm.originalAmountLocal}
              onChange={(e) => setExpenseForm((p) => ({ ...p, originalAmountLocal: Number(e.target.value) }))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="0"
            />
            {expenseForm.originalAmountLocal > 0 ? (
              <div className="mt-2 text-xs text-slate-600">換算（HKD）：{formatCurrency(expenseConversionHKD)}</div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">日期</label>
            <input
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">備註（選填）</label>
            <textarea
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="例如：幾多人、包含乜..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={saveExpense}
              className="flex-1 rounded-2xl bg-[#BC002D] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
            >
              儲存
            </button>
            <button
              type="button"
              onClick={() => setAddExpenseOpen(false)}
              className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:opacity-90"
            >
              取消
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}