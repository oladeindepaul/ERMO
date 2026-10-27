"use client";

import { useState } from "react";
import Link from "next/link";
import { requestBooking } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SERVICES, label } from "@/lib/constants";
import { money } from "@/lib/format";

// Estimate only: the database recalculates the real amounts from the carer's current rate.
const CLIENT_FEE = 0.05;

function hoursBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

export function BookingForm({
  carerId,
  services,
  recipients,
  rate,
}: {
  carerId: string;
  services: string[];
  recipients: { id: string; name: string }[];
  rate: number;
}) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
  const hours = hoursBetween(start, end);
  const sub = Math.round(rate * hours);
  const fee = Math.round(sub * CLIENT_FEE);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ActionForm action={requestBooking} submit="Request booking" submitClass="btn w-full">
      <input type="hidden" name="carer" value={carerId} />
      <label className="block">
        <span className="label">Service</span>
        <select name="service" className="field" required>
          {services.map((s) => (
            <option key={s} value={s}>{label(SERVICES, s)}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Date</span>
        <input type="date" name="date" min={today} className="field" required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Start</span>
          <input type="time" name="start" value={start} onChange={(e) => setStart(e.target.value)} className="field" required />
        </label>
        <label className="block">
          <span className="label">End</span>
          <input type="time" name="end" value={end} onChange={(e) => setEnd(e.target.value)} className="field" required />
        </label>
      </div>
      <label className="block">
        <span className="label">Who is the care for?</span>
        <select name="recipient" className="field">
          <option value="">Me</option>
          {recipients.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <span className="hint">
          Arranging for someone else? <Link href="/client#recipients" className="text-brand underline">Add them first</Link>.
        </span>
      </label>
      <label className="block">
        <span className="label">Note for the carer (optional)</span>
        <textarea name="note" rows={2} className="field" placeholder="Access, parking, anything they should know" />
      </label>
      <dl className="space-y-1 rounded-2xl bg-mist p-4 text-sm">
        <div className="flex justify-between"><dt className="text-slate">{hours.toFixed(2).replace(/\.00$/, "")} hrs × {money(rate)}</dt><dd>{money(sub)}</dd></div>
        <div className="flex justify-between"><dt className="text-slate">Service fee (5%)</dt><dd>{money(fee)}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 font-medium"><dt>Held when accepted</dt><dd>{money(sub + fee)}</dd></div>
      </dl>
      <p className="text-xs text-slate">Nothing is held until the carer accepts. Free cancellation more than 48 hours before.</p>
    </ActionForm>
  );
}
