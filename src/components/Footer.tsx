import Link from "next/link";
import { Logo } from "@/components/ui";

export function Footer() {
  return (
    <footer className="mt-16 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mt-24 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-7xl rounded-[2rem] bg-brand px-6 py-10 text-white sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-sm">
            <Logo light />
            <p className="mt-4 text-sm text-white/75">
              ERMO introduces families to verified, self-employed carers and keeps payments safe. Carers set their own rates and choose their own work.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 text-sm sm:gap-x-12">
            <Link href="/carers" className="tap text-white/80 hover:text-white">Find a carer</Link>
            <Link href="/become-a-carer" className="tap text-white/80 hover:text-white">Become a carer</Link>
            <Link href="/#how" className="tap text-white/80 hover:text-white">How it works</Link>
            <Link href="/report" className="tap text-white/80 hover:text-white">Report a concern</Link>
          </div>
        </div>
        <p className="mt-10 border-t border-white/20 pt-6 text-xs text-white/60">
          ERMO is an introductory platform and does not provide or supervise care. If someone is in immediate danger, call 999.
        </p>
      </div>
    </footer>
  );
}
