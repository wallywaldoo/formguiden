"use client";

import { signOutAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" className="w-full justify-start">
        Logga ut
      </Button>
    </form>
  );
}
