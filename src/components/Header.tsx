"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui";
import { Menu } from "@/components/Icons";
import { signOut } from "@/app/actions";

type Role = "client" | "carer" | "admin";

const NAV: Record<Role | "guest", { href: string; label: string }[]> = {
  guest: [
    { href: "/carers", label: "Find a carer" },
    { href: "/#how", label: "How it works" },
    { href: "/become-a-carer", label: "Become a carer" },
  ],
  client: [
    { href: "/carers", label: "Find a carer" },
    { href: "/client", label: "My bookings" },
    { href: "/messages", label: "Messages" },
  ],
  carer: [
    { href: "/carer", label: "Dashboard" },
    { href: "/carer/profile", label: "My profile" },
    { href: "/messages", label: "Messages" },
  ],
  admin: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/carers", label: "Verification" },
    { href: "/admin/disputes", label: "Disputes" },
    { href: "/admin/safeguarding", label: "Safeguarding" },
    { href: "/admin/payments", label: "Ledger" },
    { href: "/admin/users", label: "Users" },
  ],
};

export function Header({ me }: { me: { role: Role; name: string | null } | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = NAV[me?.role ?? "guest"];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 rounded-full bg-white/90 pl-4 pr-2 shadow-[0_1px_0_rgba(13,18,32,0.04)] backdrop-blur">
        <Logo />
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                active(l.href) ? "border-brand bg-brand-soft text-brand-deep" : "border-line text-ink hover:border-brand hover:text-brand"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {me ? (
            <form action={signOut} className="hidden sm:block">
              <button className="btn-ghost h-11">Sign out</button>
            </form>
          ) : (
            <>
              <Link href="/login" className="btn-ghost hidden sm:inline-flex">
                Log in
              </Link>
              <Link href="/login?mode=register" className="btn">
                Get started
              </Link>
            </>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="grid size-11 place-items-center rounded-full border border-line lg:hidden"
            aria-expanded={open}
            aria-label="Menu"
          >
            <Menu />
          </button>
        </div>
      </div>
      {open && (
        <nav className="mx-auto mt-2 max-w-7xl rounded-3xl bg-white p-3 shadow-lg lg:hidden" aria-label="Mobile">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-2xl px-4 py-3 text-base ${active(l.href) ? "bg-brand-soft text-brand-deep" : "hover:bg-mist"}`}
            >
              {l.label}
            </Link>
          ))}
          {me ? (
            <form action={signOut}>
              <button className="block w-full rounded-2xl px-4 py-3 text-left text-base text-slate hover:bg-mist">Sign out</button>
            </form>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-base hover:bg-mist">
              Log in
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
