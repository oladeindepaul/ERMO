import { PillLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-24 text-center">
      <p className="numeral text-[9rem]">404</p>
      <h1 className="display text-4xl">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-slate">It may have moved, or you may not have access to it.</p>
      <div className="mt-8 flex justify-center">
        <PillLink href="/">Back to home</PillLink>
      </div>
    </div>
  );
}
