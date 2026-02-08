'use client';

export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, MoreHorizontal, ChevronDown } from 'lucide-react';
import { useTripsStore } from '@/lib/store/trips';

type ShoppingCategory = 'normal' | 'important' | 'snack';
type ShoppingFilter = 'all' | ShoppingCategory;

type ShoppingItem = {
  name: string;
  shop?: string;
  category?: ShoppingCategory; // default normal
  image?: string; // URL/base64
  purchased?: boolean; // default false
};

type TripLike = {
  id: string;
  title?: string;
  shoppingList?: ShoppingItem[];
};

function deepClone<T>(value: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (globalThis as any)?.structuredClone as undefined | ((v: unknown) => unknown);
  if (typeof sc === 'function') return sc(value) as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureShoppingList(trip: TripLike): ShoppingItem[] {
  return Array.isArray(trip.shoppingList) ? trip.shoppingList : [];
}

function tagLabel(category?: ShoppingCategory) {
  if (category === 'important') return '重要';
  if (category === 'snack') return '零食';
  return '一般';
}

function tagClass(category?: ShoppingCategory) {
  if (category === 'important') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (category === 'snack') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-yellow-100 text-yellow-800 border-yellow-200';
}

function filterLabel(filter: ShoppingFilter, total: number) {
  if (filter === 'all') return `全部（${total}）`;
  if (filter === 'important') return '只看：重要';
  if (filter === 'snack') return '只看：零食';
  return '只看：一般';
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
            'w-full rounded-3xl border border-slate-200 bg-white shadow-xl',
            'max-h-[85vh] overflow-y-auto',
            props.maxWidthClassName ?? 'max-w-md',
          ].join(' ')}
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

export default function ShoppingPage() {
  const params = useParams();
  const tripId =
    typeof params?.tripId === 'string'
      ? params.tripId
      : Array.isArray(params?.tripId)
        ? params.tripId[0]
        : '';

  // avoid zustand infinite loop: select primitives separately
  const trips = useTripsStore((s) => s.trips);
  const upsertTrip = useTripsStore((s) => s.upsertTrip);

  const trip = useMemo(() => {
    if (!tripId) return undefined;
    return (trips as TripLike[]).find((t) => t.id === tripId);
  }, [trips, tripId]);

  const shoppingList = useMemo(() => (trip ? ensureShoppingList(trip) : []), [trip]);

  const [filter, setFilter] = useState<ShoppingFilter>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [activeMenuIndex, setActiveMenuIndex] = useState<number>(-1);

  const [formOpen, setFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number>(-1);

  const [form, setForm] = useState<Required<Pick<ShoppingItem, 'name' | 'shop' | 'category' | 'image' | 'purchased'>>>({
    name: '',
    shop: '',
    category: 'normal',
    image: '',
    purchased: false,
  });

  const pendingCount = useMemo(() => shoppingList.filter((i) => !i.purchased).length, [shoppingList]);
  const purchasedCount = useMemo(() => shoppingList.filter((i) => !!i.purchased).length, [shoppingList]);
  const totalCount = shoppingList.length;

  const countByCategory = useMemo(() => {
    const base = { normal: 0, important: 0, snack: 0 } as Record<ShoppingCategory, number>;
    for (const it of shoppingList) {
      const c = (it.category ?? 'normal') as ShoppingCategory;
      if (c in base) base[c] += 1;
    }
    return base;
  }, [shoppingList]);

  const displayList = useMemo(() => {
    if (filter === 'all') return shoppingList;
    return shoppingList.filter((i) => (i.category ?? 'normal') === filter);
  }, [shoppingList, filter]);

  function commitShoppingList(nextList: ShoppingItem[]) {
    if (!trip) return;
    const nextTrip: TripLike = { ...(trip as object), shoppingList: nextList } as TripLike;
    upsertTrip(nextTrip as never);
  }

  function openShoppingForm(item?: ShoppingItem, index: number = -1) {
    if (item) {
      setForm({
        name: item.name ?? '',
        shop: item.shop ?? '',
        category: (item.category ?? 'normal') as ShoppingCategory,
        image: item.image ?? '',
        purchased: !!item.purchased,
      });
      setEditingIndex(index);
    } else {
      setForm({ name: '', shop: '', category: 'normal', image: '', purchased: false });
      setEditingIndex(-1);
    }
    setFormOpen(true);
    setActiveMenuIndex(-1);
  }

  function closeShoppingForm() {
    setFormOpen(false);
    setForm({ name: '', shop: '', category: 'normal', image: '', purchased: false });
    setEditingIndex(-1);
  }

  function saveItem() {
    if (!trip) return;
    if (!form.name.trim()) {
      alert('請填寫：物品名稱。');
      return;
    }

    const next = deepClone(shoppingList);
    const newItem: ShoppingItem = {
      name: form.name.trim(),
      shop: form.shop.trim(),
      category: form.category ?? 'normal',
      image: form.image.trim(),
      purchased: !!form.purchased,
    };

    if (editingIndex >= 0) next.splice(editingIndex, 1, newItem);
    else next.push(newItem);

    commitShoppingList(next);
    closeShoppingForm();
  }

  function deleteItem(index: number) {
    if (!confirm('確定要刪除呢個購物項目？')) return;
    const next = deepClone(shoppingList);
    next.splice(index, 1);
    commitShoppingList(next);
    setActiveMenuIndex(-1);
  }

  function togglePurchased(index: number) {
    const next = deepClone(shoppingList);
    const it = next[index];
    if (!it) return;
    it.purchased = !it.purchased;
    commitShoppingList(next);
  }

  if (!tripId) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">tripId 無效</h1>
          <p className="mt-2 text-sm text-slate-600">請確認路由係 /trips/[tripId]/shopping。</p>
          <div className="mt-4">
            
          </div>
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
          <div className="mt-4">
            
          </div>
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
            <h1 className="truncate text-xl font-semibold text-slate-900">購物清單</h1>
          </div>
          <p className="mt-2 truncate text-sm text-slate-600">{trip.title ? `旅程：${trip.title}` : `Trip ID：${trip.id}`}</p>
        </div>

        <button
          type="button"
          onClick={() => openShoppingForm(undefined, -1)}
          className="inline-flex items-center justify-center rounded-full bg-[#BC002D] text-white shadow-sm hover:opacity-95 h-11 w-11"
          aria-label="新增購物項目"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold text-emerald-800">待買</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{pendingCount}</div>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-semibold text-amber-900">已買</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{purchasedCount}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterDropdown((v) => !v)}
            className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
          >
            <span>{filterLabel(filter, totalCount)}</span>
            <span className="inline-flex items-center gap-2 text-xs text-slate-500">
              <span>
                {filter === 'all'
                  ? ''
                  : `（${displayList.length}/${totalCount}）`}
              </span>
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>

          {showFilterDropdown && (
            <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setFilter('all');
                  setShowFilterDropdown(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>全部</span>
                <span className="text-xs text-slate-500">{totalCount}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilter('normal');
                  setShowFilterDropdown(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>一般</span>
                <span className="text-xs text-slate-500">{countByCategory.normal}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilter('important');
                  setShowFilterDropdown(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>重要</span>
                <span className="text-xs text-slate-500">{countByCategory.important}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilter('snack');
                  setShowFilterDropdown(false);
                }}
                className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>零食</span>
                <span className="text-xs text-slate-500">{countByCategory.snack}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="mt-4">
        {displayList.length > 0 ? (
          <div className="space-y-3">
            {displayList.map((item, idxInDisplay) => {
              // Need real index in original list (because displayList is filtered)
              const realIndex = filter === 'all'
                ? idxInDisplay
                : shoppingList.findIndex((x) => x === item);

              const purchased = !!item.purchased;
              const category = (item.category ?? 'normal') as ShoppingCategory;
              const isMenuOpen = activeMenuIndex === realIndex;

              return (
                <div
                  key={`${item.name}-${realIndex}-${idxInDisplay}`}
                  className="relative rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    {/* checkbox */}
                    <button
                      type="button"
                      onClick={() => togglePurchased(realIndex)}
                      className={[
                        'h-6 w-6 rounded-lg border-2 flex items-center justify-center',
                        purchased ? 'bg-[#BC002D] border-[#BC002D] text-white' : 'bg-white border-slate-200 text-transparent',
                      ].join(' ')}
                      aria-label={purchased ? '標記為未買' : '標記為已買'}
                    >
                      ✓
                    </button>

                    {/* image */}
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-2xl">🛍️</span>
                      )}
                    </div>

                    {/* main */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={['truncate text-sm font-semibold', purchased ? 'line-through text-slate-400' : 'text-slate-900'].join(' ')}>
                          {item.name}
                        </div>
                        <span className={['inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', tagClass(category)].join(' ')}>
                          {tagLabel(category)}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-600">{item.shop || '—'}</div>
                    </div>

                    {/* menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuIndex((cur) => (cur === realIndex ? -1 : realIndex))}
                        className="rounded-xl p-2 text-slate-500 hover:bg-slate-50"
                        aria-label="購物項目選單"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 top-10 z-10 w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                          <button
                            type="button"
                            onClick={() => openShoppingForm(shoppingList[realIndex], realIndex)}
                            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(realIndex)}
                            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                          >
                            刪除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <div className="text-4xl">🛒</div>
            <p className="mt-3 text-sm font-semibold text-slate-700">清單暫時冇嘢</p>
            <p className="mt-1 text-sm text-slate-500">按右上角「＋」新增第一個購物項目。</p>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      <Modal
        open={formOpen}
        title={editingIndex >= 0 ? '編輯購物項目' : '新增購物項目'}
        onClose={closeShoppingForm}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">物品名稱（必填）</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="例如：面膜 / 眼藥水 / 伴手禮"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">店舖（選填）</label>
            <input
              value={form.shop}
              onChange={(e) => setForm((p) => ({ ...p, shop: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="例如：Donki / Loft / 超市"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">分類</label>
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as ShoppingCategory }))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            >
              <option value="normal">一般</option>
              <option value="important">重要</option>
              <option value="snack">零食</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">圖片 URL（選填）</label>
            <input
              value={form.image}
              onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="https://..."
            />
            {form.image ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image} alt="preview" className="w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">已買</div>
              <div className="text-xs text-slate-600">勾選後會顯示刪線</div>
            </div>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, purchased: !p.purchased }))}
              className={[
                'h-9 w-14 rounded-full border transition',
                form.purchased ? 'bg-[#BC002D] border-[#BC002D]' : 'bg-white border-slate-200',
              ].join(' ')}
              aria-label="toggle purchased"
            >
              <span
                className={[
                  'block h-7 w-7 rounded-full bg-white shadow-sm transition translate-x-1',
                  form.purchased ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={saveItem}
              className="flex-1 rounded-2xl bg-[#BC002D] px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
            >
              儲存
            </button>
            <button
              type="button"
              onClick={closeShoppingForm}
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
