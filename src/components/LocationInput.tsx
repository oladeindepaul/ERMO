"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Place } from "@/lib/places";
import { Pin } from "@/components/Icons";

// Type-to-search UK places and postcodes. Submits the text as `name`, plus hidden lat, lng, area
// and postcode once a suggestion is picked. Free text without a pick is resolved on the server.
export function LocationInput({
  name = "where",
  defaultValue = "",
  defaultLat,
  defaultLng,
  defaultArea,
  defaultPostcode,
  placeholder = "Town, city or postcode",
  label,
  showUseMyLocation = false,
  className = "",
}: {
  name?: string;
  defaultValue?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  defaultArea?: string | null;
  defaultPostcode?: string | null;
  placeholder?: string;
  label?: string;
  showUseMyLocation?: boolean;
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState(defaultValue);
  const [picked, setPicked] = useState<Pick<Place, "lat" | "lng" | "area" | "postcode"> | null>(
    defaultLat != null && defaultLng != null
      ? { lat: defaultLat, lng: defaultLng, area: defaultArea ?? defaultValue, postcode: defaultPostcode ?? undefined }
      : null,
  );
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const setByUs = useRef(defaultValue); // text we filled in ourselves, which shouldn't trigger a search

  useEffect(() => {
    if (text === setByUs.current) return;
    const q = text.trim();
    if (q.length < 2) return; // the list is hidden below 2 characters
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const list = (await res.json()) as Place[];
        setResults(list);
        setActive(list.length ? 0 : -1);
        setOpen(true);
      } catch {
        // aborted or offline: keep the typed text, the server resolves it on submit
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(p: Place) {
    setByUs.current = p.label;
    setText(p.label);
    setPicked({ lat: p.lat, lng: p.lng, area: p.area, postcode: p.postcode });
    setOpen(false);
    setNote("");
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setNote("Your browser can't share location.");
    setLocating(true);
    setNote("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/places?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const [p] = (await res.json()) as Place[];
          if (p) choose(p);
          else setNote("We couldn't find a UK postcode near you.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setNote("Location permission was declined. Type a town or postcode instead.");
      },
      { timeout: 10000 },
    );
  }

  const listId = `${id}-list`;

  return (
    <div ref={wrap} className={`relative ${className}`}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <div className="relative">
        <Pin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate" />
        <input
          id={id}
          name={name}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPicked(null);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !results.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % results.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + results.length) % results.length);
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
          className="field pl-11 pr-10"
        />
        {loading && <span className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-brand-soft border-t-brand" aria-hidden />}
      </div>
      <input type="hidden" name="lat" value={picked?.lat ?? ""} />
      <input type="hidden" name="lng" value={picked?.lng ?? ""} />
      <input type="hidden" name="area" value={picked?.area ?? ""} />
      <input type="hidden" name="postcode" value={picked?.postcode ?? ""} />

      {open && text.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-3xl border border-line bg-white p-1.5 shadow-xl">
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate">No UK places found. Try a postcode.</li>
          ) : (
            results.map((p, i) => (
              <li
                key={`${p.label}-${p.sub}`}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 ${i === active ? "bg-brand-soft" : ""}`}
              >
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${i === active ? "bg-brand text-white" : "bg-mist text-slate"}`}>
                  <Pin className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.label}</span>
                  <span className="block truncate text-xs text-slate">{p.sub}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {showUseMyLocation && (
        <button type="button" onClick={useMyLocation} disabled={locating} className="tap mt-1 text-sm text-brand hover:underline disabled:opacity-60">
          {locating ? "Finding you…" : "Use my current location"}
        </button>
      )}
      {note && <p className="hint">{note}</p>}
    </div>
  );
}
