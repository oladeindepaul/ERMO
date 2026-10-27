import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMe, homeFor } from "@/lib/auth";
import { firstName } from "@/lib/format";
import { chooseRole } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Heart, User } from "@/components/Icons";

export const metadata: Metadata = { title: "Welcome" };

// One-time choice for people who signed up with Google, where there was no form to pick a role on.
export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.onboarded_at || me.role === "admin") redirect(homeFor(me.role));
  const sp = await searchParams;
  const preset = sp.role === "carer" ? "carer" : "client";

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 sm:pt-16">
      <div className="text-center">
        <p className="eyebrow">{"{ Welcome to ERMO }"}</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Hi {firstName(me.full_name)}, how will you use ERMO?</h1>
        <p className="mt-3 text-slate">You only need to choose once.</p>
      </div>
      <ActionForm action={chooseRole} submit="Continue" submitClass="btn mx-auto flex w-full max-w-xs" className="mt-10 space-y-6">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">I want to</legend>
          <Choice value="client" checked={preset === "client"} icon={<Heart className="size-6" />} title="Find care" sub="For me or someone I look after" />
          <Choice value="carer" checked={preset === "carer"} icon={<User className="size-6" />} title="Offer care" sub="I'm a self-employed carer" />
        </fieldset>
      </ActionForm>
    </div>
  );
}

function Choice({ value, checked, icon, title, sub }: { value: string; checked: boolean; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name="role" value={value} defaultChecked={checked} className="peer sr-only" required />
      <span className="card flex h-full flex-col gap-3 border-2 border-transparent p-6 transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
        <span className="grid size-12 place-items-center rounded-full bg-brand text-white">{icon}</span>
        <span className="text-xl font-medium">{title}</span>
        <span className="text-sm text-slate">{sub}</span>
      </span>
    </label>
  );
}
