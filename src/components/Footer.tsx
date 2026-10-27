import Link from "next/link";
import { Logo } from "@/components/ui";

export function Footer() {
  return (
    <footer className="mt-24 px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-7xl rounded-[2rem] bg-brand px-6 py-10 text-white sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-sm">
            <Logo light />
            <p className="mt-4 text-sm text-white/75">
              ERMO introduces families to verified, self-employed carers and keeps payments safe. Carers set their own rates and choose their own work.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <Link href="/carers" className="text-white/80 hover:text-white">Find a carer</Link>
            <Link href="/become-a-carer" className="text-white/80 hover:text-white">Become a carer</Link>
            <Link href="/#how" className="text-white/80 hover:text-white">How it works</Link>
            <Link href="/report" className="text-white/80 hover:text-white">Report a concern</Link>
          </div>
        </div>
        <p className="mt-10 border-t border-white/20 pt-6 text-xs text-white/60">
          ERMO is an introductory platform and does not provide or supervise care. If someone is in immediate danger, call 999.
        </p>
      </div>
    </footer>
  );
}
