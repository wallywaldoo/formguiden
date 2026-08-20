"use client";

import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "FK";
}

export function SidebarProfile({
  displayName,
  subtitle,
  className,
  menuSide = "top",
}: {
  displayName: string;
  subtitle?: string;
  className?: string;
  menuSide?: "top" | "bottom";
}) {
  const name = displayName.trim() || "Användare";
  const detail = subtitle?.trim() || "Profil & konto";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "surface-tile flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none active:translate-y-0",
            className,
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-sm font-semibold text-primary">
            {profileInitials(name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.88rem] font-semibold tracking-[-0.02em]">
              {name}
            </span>
            <span className="block truncate text-[0.75rem] text-muted-foreground">
              {detail}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={menuSide} className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">Profil</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/privacy">Konto</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOutAction} className="w-full">
            <button type="submit" className="w-full text-left">
              Logga ut
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
