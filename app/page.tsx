import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const authenticated = await getSession();
  redirect(authenticated ? "/overview" : "/login");
}
