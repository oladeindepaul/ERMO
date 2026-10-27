"use client";

import { useState, useTransition } from "react";
import { checkIn } from "@/app/actions";

// Records time and, if the carer allows it, location. This is the factual attendance record (PRD 7.4).
export function CheckInButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function go() {
    setError("");
    const send = (lat: number | null, lng: number | null) =>
      start(async () => {
        const res = await checkIn(id, lat, lng);
        if (res?.error) setError(res.error);
      });
    if (!navigator.geolocation) return send(null, null);
    navigator.geolocation.getCurrentPosition(
      (p) => send(p.coords.latitude, p.coords.longitude),
      () => send(null, null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div>
      <button onClick={go} disabled={pending} className="btn w-full sm:w-auto">
        {pending ? "Checking in…" : "Check in"}
      </button>
      <p className="hint">We record the time and, if you allow it, your location.</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
