"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Map, Plane, Wallet, ShoppingBag, ListChecks } from "lucide-react";

export default function BottomTabBar() {
  const pathname = usePathname();
  const params = useParams<{ tripId?: string }>();
  const tripId = params?.tripId;

  if (!tripId || tripId === "undefined") return null;

  const base = `/trips/${tripId}`;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const tabs = [
    { href: `${base}/itinerary`, label: "行程", icon: Map },
    { href: `${base}/reservation`, label: "預約", icon: Plane },
    { href: `${base}/budget`, label: "預算", icon: Wallet },
    { href: `${base}/shopping`, label: "購物", icon: ShoppingBag },
    { href: `${base}/prep`, label: "準備/成員", icon: ListChecks },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-zinc-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(t.href);
          const Icon = t.icon;

          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] ${
                active ? "text-black font-semibold" : "text-gray-500"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              <span className="leading-none">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}