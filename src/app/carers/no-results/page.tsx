import type { Metadata } from "next";
import Link from "next/link";
import { NoMatches } from "@/components/NoMatches";
import { ArrowLeft } from "@/components/Icons";

export const metadata: Metadata = { title: "No carers found" };

// Where /carers sends a search that found nobody.
export default async function NoResultsPage({ searchParams }: PageProps<"/carers/no-results">) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const num = (k: string) => (pick(k) && Number.isFinite(Number(pick(k))) ? Number(pick(k)) : undefined);

  return (
    <div className="mx-auto max-w-7xl px-3 pt-8 sm:px-5">
      <Link href="/carers" className="mb-4 inline-flex items-center gap-2 text-sm text-slate hover:text-brand">
        <ArrowLeft className="size-4" /> Find a carer
      </Link>
      <NoMatches
        search={{ where: pick("where"), lat: num("lat"), lng: num("lng"), service: pick("service"), gender: pick("gender"), day: pick("day") }}
        placeNotFound={pick("unknown") === "1"}
      />
    </div>
  );
}
