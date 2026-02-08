'use client';

export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Plus, MoreHorizontal, Plane, Hotel, Ticket } from 'lucide-react';
import { useTripsStore } from '@/lib/store/trips';
import type { Trip, ActivityType, Geo, DayPlaces } from '@/lib/store/trips'


type ReservationType = 'flight' | 'hotel' | 'ticket';

type FlightReservation = {
  flightNumber: string;
  departureLocation: string;
  arrivalLocation: string;
  departureTime: string; // datetime-local string
  arrivalTime: string; // datetime-local string
  certificate?: string; // base64 dataURL
  notes?: string;
};

type HotelReservation = {
  name: string;
  address: string;
  checkInDate: string; // date string
  checkOutDate: string; // date string
  checkOutTime?: string; // time string
  certificate?: string; // base64 dataURL
  notes?: string;
};

type TicketReservation = {
  name: string;
  date: string; // date string
  time: string; // time string
  certificate?: string; // base64 dataURL
  notes?: string;
};

type Reservations = {
  flights: FlightReservation[];
  hotels: HotelReservation[];
  tickets: TicketReservation[];
};

type TripLike = {
  id: string;
  title?: string;
  reservations?: Partial<Reservations>;
};

function deepClone<T>(value: T): T {
  // structuredClone support fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sc = (globalThis as any)?.structuredClone as undefined | ((v: unknown) => unknown);
  if (typeof sc === 'function') return sc(value) as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureReservations(trip: TripLike): Reservations {
  return {
    flights: Array.isArray(trip.reservations?.flights) ? (trip.reservations!.flights as FlightReservation[]) : [],
    hotels: Array.isArray(trip.reservations?.hotels) ? (trip.reservations!.hotels as HotelReservation[]) : [],
    tickets: Array.isArray(trip.reservations?.tickets) ? (trip.reservations!.tickets as TicketReservation[]) : [],
  };
}

function formatTimeOnly(dateTimeStr?: string) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(dateTimeStr?: string) {
  if (!dateTimeStr) return '';
  const d = new Date(dateTimeStr);
  if (Number.isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${date}`;
}

function airportCode(text?: string) {
  if (!text) return '---';
  return text.substring(0, 3).toUpperCase();
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
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
            'w-full rounded-3xl border border-[var(--border)] bg-white shadow-xl',
            'max-h-[85vh] overflow-y-auto',
            props.maxWidthClassName ?? 'max-w-md',
          ].join(' ')}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">{props.title}</h2>
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

export default function ReservationPage() {
  // Fix #1: useParams instead of props.params (avoid "params is a Promise")
  const params = useParams();
  const tripId = typeof params?.tripId === 'string' ? params.tripId : Array.isArray(params?.tripId) ? params.tripId[0] : '';

  // Fix #2: Zustand selectors must not return new objects each render
  const trips = useTripsStore((s) => s.trips);
  const upsertTrip = useTripsStore((s) => s.upsertTrip);

  const trip = useMemo(() => {
    if (!tripId) return undefined;
    return (trips as TripLike[]).find((t) => t.id === tripId);
  }, [trips, tripId]);

  const reservations = useMemo(() => (trip ? ensureReservations(trip) : null), [trip]);

  const [activeMenu, setActiveMenu] = useState<{ type: ReservationType; idx: number } | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [editing, setEditing] = useState<{ type: ReservationType; idx: number } | null>(null);

  const [flightOpen, setFlightOpen] = useState(false);
  const [hotelOpen, setHotelOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);

  const [flightForm, setFlightForm] = useState<FlightReservation>({
    flightNumber: '',
    departureLocation: '',
    arrivalLocation: '',
    departureTime: '',
    arrivalTime: '',
    certificate: '',
    notes: '',
  });

  const [hotelForm, setHotelForm] = useState<HotelReservation>({
    name: '',
    address: '',
    checkInDate: '',
    checkOutDate: '',
    checkOutTime: '',
    certificate: '',
    notes: '',
  });

  const [ticketForm, setTicketForm] = useState<TicketReservation>({
    name: '',
    date: '',
    time: '',
    certificate: '',
    notes: '',
  });

  function commitReservations(next: Reservations) {
    if (!trip) return;
    const nextTrip = { ...(trip as object), reservations: next } as TripLike;
    upsertTrip(nextTrip as never);
  }

  function openAddFlight() {
    setEditing({ type: 'flight', idx: -1 });
    setFlightForm({
      flightNumber: '',
      departureLocation: '',
      arrivalLocation: '',
      departureTime: '',
      arrivalTime: '',
      certificate: '',
      notes: '',
    });
    setTypePickerOpen(false);
    setFlightOpen(true);
  }

  function openAddHotel() {
    setEditing({ type: 'hotel', idx: -1 });
    setHotelForm({
      name: '',
      address: '',
      checkInDate: '',
      checkOutDate: '',
      checkOutTime: '',
      certificate: '',
      notes: '',
    });
    setTypePickerOpen(false);
    setHotelOpen(true);
  }

  function openAddTicket() {
    setEditing({ type: 'ticket', idx: -1 });
    setTicketForm({
      name: '',
      date: '',
      time: '',
      certificate: '',
      notes: '',
    });
    setTypePickerOpen(false);
    setTicketOpen(true);
  }

  function onEdit(type: ReservationType, idx: number) {
    if (!reservations) return;
    setEditing({ type, idx });

    if (type === 'flight') {
      setFlightForm(deepClone(reservations.flights[idx]));
      setFlightOpen(true);
    } else if (type === 'hotel') {
      setHotelForm(deepClone(reservations.hotels[idx]));
      setHotelOpen(true);
    } else {
      setTicketForm(deepClone(reservations.tickets[idx]));
      setTicketOpen(true);
    }

    setActiveMenu(null);
  }

  function onDelete(type: ReservationType, idx: number) {
    if (!reservations) return;
    if (!confirm('確定要刪除呢個預約？')) return;

    const next = deepClone(reservations);
    if (type === 'flight') next.flights.splice(idx, 1);
    if (type === 'hotel') next.hotels.splice(idx, 1);
    if (type === 'ticket') next.tickets.splice(idx, 1);

    commitReservations(next);
    setActiveMenu(null);
  }

  async function handleCertificateUpload(file: File, type: ReservationType) {
    const dataUrl = await fileToDataUrl(file);
    if (type === 'flight') setFlightForm((p) => ({ ...p, certificate: dataUrl }));
    if (type === 'hotel') setHotelForm((p) => ({ ...p, certificate: dataUrl }));
    if (type === 'ticket') setTicketForm((p) => ({ ...p, certificate: dataUrl }));
  }

  function saveFlight() {
    if (!reservations || !trip) return;

    if (!flightForm.flightNumber || !flightForm.departureLocation || !flightForm.arrivalLocation || !flightForm.departureTime || !flightForm.arrivalTime) {
      alert('請填寫：航班號、出發地、到達地、起飛時間、到達時間。');
      return;
    }

    const next = deepClone(reservations);
    const idx = editing?.type === 'flight' ? editing.idx : -1;
    if (idx >= 0) next.flights[idx] = deepClone(flightForm);
    else next.flights.push(deepClone(flightForm));

    commitReservations(next);
    setFlightOpen(false);
    setEditing(null);
  }

  function saveHotel() {
    if (!reservations || !trip) return;

    if (!hotelForm.name || !hotelForm.address || !hotelForm.checkInDate || !hotelForm.checkOutDate) {
      alert('請填寫：酒店名稱、地址、入住日期、退房日期。');
      return;
    }

    const next = deepClone(reservations);
    const idx = editing?.type === 'hotel' ? editing.idx : -1;
    if (idx >= 0) next.hotels[idx] = deepClone(hotelForm);
    else next.hotels.push(deepClone(hotelForm));

    commitReservations(next);
    setHotelOpen(false);
    setEditing(null);
  }

  function saveTicket() {
    if (!reservations || !trip) return;

    if (!ticketForm.name || !ticketForm.date || !ticketForm.time) {
      alert('請填寫：票券名稱、日期、時間。');
      return;
    }

    const next = deepClone(reservations);
    const idx = editing?.type === 'ticket' ? editing.idx : -1;
    if (idx >= 0) next.tickets[idx] = deepClone(ticketForm);
    else next.tickets.push(deepClone(ticketForm));

    commitReservations(next);
    setTicketOpen(false);
    setEditing(null);
  }

  if (!tripId) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">tripId 無效</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">請確認路由係 /trips/[tripId]/reservation。</p>
          <div className="mt-4">
            
          </div>
        </div>
      </div>
    );
  }

  if (!trip || !reservations) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="rounded-3xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-[var(--foreground)]">找不到旅程</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">呢個 tripId 可能唔存在，或者資料未載入完成。</p>
          <div className="mt-4">
            
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
           
            <h1 className="truncate text-xl font-semibold text-[var(--foreground)]">預約</h1>
          </div>
          <p className="mt-2 text-sm text-[var(--muted)] truncate">{trip.title ? `旅程：${trip.title}` : `Trip ID：${trip.id}`}</p>
        </div>

        <button
          type="button"
          onClick={() => setTypePickerOpen(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#BC002D] text-[var(--primary-foreground)] shadow-sm hover:opacity-95"
          aria-label="新增預約"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Flights */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Plane className="h-4 w-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">航班</h2>
        </div>

        {reservations.flights.length > 0 ? (
          <div className="space-y-3">
            {reservations.flights.map((flight, idx) => {
              const isOpen = activeMenu?.type === 'flight' && activeMenu.idx === idx;

              return (
                <div key={`flight-${idx}`} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-sm">
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#BC002D] to-[#E24A6A] px-4 py-3 text-[var(--primary-foreground)]">
                    <span className="text-[11px] font-semibold tracking-widest">BOARDING PASS</span>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenu((cur) => (cur?.type === 'flight' && cur.idx === idx ? null : { type: 'flight', idx }))
                        }
                        className="rounded-xl p-2 hover:bg-white/15"
                        aria-label="航班選單"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 top-11 z-10 w-40 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg">
                          <button
                            type="button"
                            onClick={() => onEdit('flight', idx)}
                            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete('flight', idx)}
                            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                          >
                            刪除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-3 items-center gap-3">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-[var(--foreground)]">{airportCode(flight.departureLocation)}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{formatTimeOnly(flight.departureTime)}</div>
                      </div>

                      <div className="flex flex-col items-center justify-center">
                        <div className="text-xs text-slate-500">Route</div>
                        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-700">
                          {flight.departureLocation} → {flight.arrivalLocation}
                        </div>
                      </div>

                      <div className="min-w-0 text-right">
                        <div className="text-lg font-semibold text-[var(--foreground)]">{airportCode(flight.arrivalLocation)}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{formatTimeOnly(flight.arrivalTime)}</div>
                      </div>
                    </div>

                    {(flight.notes || flight.certificate) && (
                      <div className="mt-4 space-y-3">
                        {flight.notes ? <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{flight.notes}</div> : null}

                        {flight.certificate ? (
                          <a href={flight.certificate} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-[var(--border)]" title="打開證明圖片">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={flight.certificate} alt={flight.flightNumber} className="w-full object-cover" />
                          </a>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 bg-[#F8F9FA] px-4 py-3 text-xs text-slate-700">
                    <div className="font-mono font-semibold">{flight.flightNumber}</div>
                    <div>{formatDateOnly(flight.departureTime)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-6 text-center text-sm text-slate-500">暫時未有航班預約</div>
        )}
      </section>

      {/* Hotels */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Hotel className="h-4 w-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">酒店</h2>
        </div>

        {reservations.hotels.length > 0 ? (
          <div className="space-y-3">
            {reservations.hotels.map((hotel, idx) => {
              const isOpen = activeMenu?.type === 'hotel' && activeMenu.idx === idx;
              const mapUrl = `https://www.google.com/maps/search/${encodeURIComponent(hotel.name)}`;

              return (
                <div key={`hotel-${idx}`} className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <a href={mapUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold text-[#BC002D] hover:underline">
                        {hotel.name}
                      </a>
                      <p className="mt-1 text-xs text-[var(--muted)]">{hotel.address}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {hotel.checkInDate} → {hotel.checkOutDate}
                        {hotel.checkOutTime ? `（退房 ${hotel.checkOutTime}）` : ''}
                      </p>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenu((cur) => (cur?.type === 'hotel' && cur.idx === idx ? null : { type: 'hotel', idx }))
                        }
                        className="rounded-xl p-2 text-[var(--muted)] hover:bg-slate-50"
                        aria-label="酒店選單"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 top-11 z-10 w-40 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg">
                          <button
                            type="button"
                            onClick={() => onEdit('hotel', idx)}
                            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete('hotel', idx)}
                            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                          >
                            刪除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {(hotel.notes || hotel.certificate) && (
                    <div className="mt-4 space-y-3">
                      {hotel.notes ? <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{hotel.notes}</div> : null}

                      {hotel.certificate ? (
                        <a href={hotel.certificate} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-[var(--border)]" title="打開證明圖片">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={hotel.certificate} alt={hotel.name} className="w-full object-cover" />
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-6 text-center text-sm text-slate-500">暫時未有酒店預約</div>
        )}
      </section>

      {/* Tickets */}
      <section className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-slate-700" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">票券</h2>
        </div>

        {reservations.tickets.length > 0 ? (
          <div className="space-y-3">
            {reservations.tickets.map((ticket, idx) => {
              const isOpen = activeMenu?.type === 'ticket' && activeMenu.idx === idx;

              return (
                <div key={`ticket-${idx}`} className="rounded-3xl border border-[var(--border)] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{ticket.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {ticket.date} {ticket.time}
                      </p>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenu((cur) => (cur?.type === 'ticket' && cur.idx === idx ? null : { type: 'ticket', idx }))
                        }
                        className="rounded-xl p-2 text-[var(--muted)] hover:bg-slate-50"
                        aria-label="票券選單"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {isOpen && (
                        <div className="absolute right-0 top-11 z-10 w-40 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg">
                          <button
                            type="button"
                            onClick={() => onEdit('ticket', idx)}
                            className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete('ticket', idx)}
                            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                          >
                            刪除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {(ticket.notes || ticket.certificate) && (
                    <div className="mt-4 space-y-3">
                      {ticket.notes ? <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{ticket.notes}</div> : null}

                      {ticket.certificate ? (
                        <a href={ticket.certificate} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-[var(--border)]" title="打開證明圖片">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={ticket.certificate} alt={ticket.name} className="w-full object-cover" />
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--border)] bg-white p-6 text-center text-sm text-slate-500">暫時未有票券預約</div>
        )}
      </section>

      {/* Type picker */}
      <Modal open={typePickerOpen} title="新增預約" onClose={() => setTypePickerOpen(false)}>
        <div className="space-y-3">
          <button type="button" onClick={openAddFlight} className="w-full rounded-2xl border border-[var(--border)] bg-white p-4 text-left hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <Plane className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">新增航班</div>
                <div className="mt-1 text-xs text-[var(--muted)]">航班號、起飛/到達、證明圖片</div>
              </div>
            </div>
          </button>

          <button type="button" onClick={openAddHotel} className="w-full rounded-2xl border border-[var(--border)] bg-white p-4 text-left hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <Hotel className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">新增酒店</div>
                <div className="mt-1 text-xs text-[var(--muted)]">地址、入住/退房、證明圖片</div>
              </div>
            </div>
          </button>

          <button type="button" onClick={openAddTicket} className="w-full rounded-2xl border border-[var(--border)] bg-white p-4 text-left hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <Ticket className="h-5 w-5 text-slate-700" />
              <div>
                <div className="text-sm font-semibold text-[var(--foreground)]">新增票券</div>
                <div className="mt-1 text-xs text-[var(--muted)]">日期/時間、證明圖片</div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTypePickerOpen(false)}
            className="w-full rounded-2xl border border-[var(--border)] bg-slate-100 p-4 text-sm font-semibold text-slate-700 hover:opacity-90"
          >
            取消
          </button>
        </div>
      </Modal>

      {/* Flight modal */}
      <Modal
        open={flightOpen}
        title={editing?.type === 'flight' && editing.idx >= 0 ? '編輯航班' : '新增航班'}
        onClose={() => {
          setFlightOpen(false);
          setEditing(null);
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">航班號</label>
            <input
              value={flightForm.flightNumber}
              onChange={(e) => setFlightForm((p) => ({ ...p, flightNumber: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="CX880"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">出發地</label>
            <input
              value={flightForm.departureLocation}
              onChange={(e) => setFlightForm((p) => ({ ...p, departureLocation: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="Hong Kong"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">到達地</label>
            <input
              value={flightForm.arrivalLocation}
              onChange={(e) => setFlightForm((p) => ({ ...p, arrivalLocation: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="Tokyo"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">起飛時間</label>
            <input
              type="datetime-local"
              value={flightForm.departureTime}
              onChange={(e) => setFlightForm((p) => ({ ...p, departureTime: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">到達時間</label>
            <input
              type="datetime-local"
              value={flightForm.arrivalTime}
              onChange={(e) => setFlightForm((p) => ({ ...p, arrivalTime: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">證明圖片（選填）</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await handleCertificateUpload(file, 'flight');
                } catch (err) {
                  console.error(err);
                  alert('讀取圖片失敗，請重試。');
                } finally {
                  e.target.value = '';
                }
              }}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-2 text-sm"
            />
            {flightForm.certificate ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flightForm.certificate} alt="flight certificate preview" className="w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">備註（選填）</label>
            <textarea
              value={flightForm.notes ?? ''}
              onChange={(e) => setFlightForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="例如：行李、座位、登機口..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={saveFlight} className="flex-1 rounded-2xl bg-[#BC002D] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-95">
              儲存
            </button>
            <button
              type="button"
              onClick={() => {
                setFlightOpen(false);
                setEditing(null);
              }}
              className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:opacity-90"
            >
              取消
            </button>
          </div>
        </div>
      </Modal>

      {/* Hotel modal */}
      <Modal
        open={hotelOpen}
        title={editing?.type === 'hotel' && editing.idx >= 0 ? '編輯酒店' : '新增酒店'}
        onClose={() => {
          setHotelOpen(false);
          setEditing(null);
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">酒店名稱</label>
            <input
              value={hotelForm.name}
              onChange={(e) => setHotelForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="Shinjuku Hotel"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">地址</label>
            <input
              value={hotelForm.address}
              onChange={(e) => setHotelForm((p) => ({ ...p, address: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="Tokyo, Japan..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">入住日期</label>
            <input
              type="date"
              value={hotelForm.checkInDate}
              onChange={(e) => setHotelForm((p) => ({ ...p, checkInDate: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">退房日期</label>
            <input
              type="date"
              value={hotelForm.checkOutDate}
              onChange={(e) => setHotelForm((p) => ({ ...p, checkOutDate: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">退房時間（選填）</label>
            <input
              type="time"
              value={hotelForm.checkOutTime ?? ''}
              onChange={(e) => setHotelForm((p) => ({ ...p, checkOutTime: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">證明圖片（選填）</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await handleCertificateUpload(file, 'hotel');
                } catch (err) {
                  console.error(err);
                  alert('讀取圖片失敗，請重試。');
                } finally {
                  e.target.value = '';
                }
              }}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-2 text-sm"
            />
            {hotelForm.certificate ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hotelForm.certificate} alt="hotel certificate preview" className="w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">備註（選填）</label>
            <textarea
              value={hotelForm.notes ?? ''}
              onChange={(e) => setHotelForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="例如：房型、訂單號、特殊要求..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={saveHotel} className="flex-1 rounded-2xl bg-[#BC002D] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-95">
              儲存
            </button>
            <button
              type="button"
              onClick={() => {
                setHotelOpen(false);
                setEditing(null);
              }}
              className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:opacity-90"
            >
              取消
            </button>
          </div>
        </div>
      </Modal>

      {/* Ticket modal */}
      <Modal
        open={ticketOpen}
        title={editing?.type === 'ticket' && editing.idx >= 0 ? '編輯票券' : '新增票券'}
        onClose={() => {
          setTicketOpen(false);
          setEditing(null);
        }}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">票券名稱</label>
            <input
              value={ticketForm.name}
              onChange={(e) => setTicketForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="例如：TeamLab / USJ Express Pass"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">日期</label>
            <input
              type="date"
              value={ticketForm.date}
              onChange={(e) => setTicketForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">時間</label>
            <input
              type="time"
              value={ticketForm.time}
              onChange={(e) => setTicketForm((p) => ({ ...p, time: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">證明圖片（選填）</label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  await handleCertificateUpload(file, 'ticket');
                } catch (err) {
                  console.error(err);
                  alert('讀取圖片失敗，請重試。');
                } finally {
                  e.target.value = '';
                }
              }}
              className="w-full rounded-2xl border border-[var(--border)] bg-white p-2 text-sm"
            />
            {ticketForm.certificate ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ticketForm.certificate} alt="ticket certificate preview" className="w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">備註（選填）</label>
            <textarea
              value={ticketForm.notes ?? ''}
              onChange={(e) => setTicketForm((p) => ({ ...p, notes: e.target.value }))}
              rows={3}
              className="w-full resize-none rounded-2xl border border-[var(--border)] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#BC002D]/20"
              placeholder="例如：入場時間、集合地點..."
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={saveTicket} className="flex-1 rounded-2xl bg-[#BC002D] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-95">
              儲存
            </button>
            <button
              type="button"
              onClick={() => {
                setTicketOpen(false);
                setEditing(null);
              }}
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
