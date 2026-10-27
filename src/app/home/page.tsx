import { redirect } from "next/navigation";
import { getMe, homeFor } from "@/lib/auth";

// After sign-in, send each person to their own area.
export default async function HomeRedirect() {
  const me = await getMe();
  redirect(me ? homeFor(me.role) : "/login");
}
