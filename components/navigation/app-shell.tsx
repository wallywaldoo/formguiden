"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Goal,
  HeartPulse,
  Menu,
  MessageCircleHeart,
  Settings2,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/overview", label: "Översikt", icon: Activity },
  { href: "/coach", label: "Coach", icon: MessageCircleHeart, featured: true },
  { href: "/report", label: "Veckorapport", icon: Sparkles },
  { href: "/running", label: "Löpning", icon: Trophy },
  { href: "/recovery", label: "Återhämtning", icon: HeartPulse },
  { href: "/import", label: "Efter passet", icon: ArrowUpRight },
];

const secondaryLinks = [
  { href: "/body", label: "Kropp", icon: UserRound },
  { href: "/nutrition", label: "Kost", icon: Activity },
  { href: "/strength", label: "Styrka", icon: Sparkles },
  { href: "/goals", label: "Mål", icon: Goal },
  { href: "/settings/profile", label: "Profil", icon: Settings2 },
  { href: "/settings/privacy", label: "Integritet", icon: Settings2 },
  { href: "/settings/integrations", label: "Integrationer", icon: Settings2 },
];

function NavSection({
  title,
  links,
  onNavigate,
}: {
  title: string;
  links: Array<{
    href: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    featured?: boolean;
  }>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-3">
      <p className="px-2 text-[0.7rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {title}
      </p>
      <nav className="flex flex-col gap-1.5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-sm transition-all",
              pathname === link.href || pathname.startsWith(`${link.href}/`)
                ? "glass-panel-soft ambient-divider border-white/60 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_10px_28px_rgba(72,87,120,0.12)]"
                : "border-transparent text-muted-foreground hover:bg-white/50 hover:text-foreground",
              link.featured &&
                !(
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                )
                ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(232,240,255,0.72))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_24px_rgba(88,108,155,0.12)]"
                : null,
            )}
          >
            <span className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl border transition-colors",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "border-white/70 bg-white/70 text-primary"
                    : "border-white/50 bg-white/45 text-muted-foreground group-hover:text-primary",
                )}
              >
                <link.icon className="size-4" />
              </span>
              <span className="font-medium">{link.label}</span>
            </span>
            {link.featured ? (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[0.68rem] font-semibold text-primary">
                Ny
              </span>
            ) : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function AppShell({
  children,
  displayName,
}: {
  children: ReactNode;
  displayName: string;
}) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-white/35 bg-white/45 backdrop-blur-2xl md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <Link href="/overview" className="font-semibold tracking-[-0.03em]">
              Formkurvan
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              Dagens översikt först
            </p>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Öppna meny"
                className="glass-panel-soft border-white/55 bg-white/55"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="glass-nav w-[22rem] border-l border-white/45 bg-transparent"
            >
              <SheetHeader className="px-6 pb-2 pt-6">
                <SheetTitle>Meny</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  Håll koll, logga snabbt och hoppa direkt till Coach.
                </p>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
                <div className="glass-panel-soft ambient-divider rounded-[1.6rem] border p-4">
                  <p className="text-sm font-medium text-foreground">
                    {displayName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ett steg fram, en vy i taget.
                  </p>
                </div>
                <NavSection title="Daglig vy" links={primaryLinks} />
                <NavSection title="Detaljer" links={secondaryLinks} />
                <div className="mt-auto">
                  <SignOutButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-3 pb-6 pt-3 md:px-5 md:pt-5">
        <aside className="sticky top-5 hidden h-[calc(100svh-2.5rem)] w-[19rem] shrink-0 md:flex">
          <div className="glass-nav ambient-divider flex w-full flex-col rounded-[2rem] border p-4">
            <div className="space-y-5 p-2">
              <div className="space-y-2">
                <Link
                  href="/overview"
                  className="block text-[1.35rem] font-semibold tracking-[-0.04em]"
                >
                  Formkurvan
                </Link>
                <p className="max-w-[16rem] text-sm leading-6 text-muted-foreground">
                  Dagens träningsbild, återhämtning och nästa steg i en lugn,
                  snabbskannad vy.
                </p>
              </div>
              <Link
                href="/coach"
                className="glass-panel-soft ambient-divider flex items-start gap-3 rounded-[1.6rem] border p-4 text-left transition-transform hover:-translate-y-0.5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(111,154,255,0.22),rgba(182,207,255,0.5))] text-primary">
                  <MessageCircleHeart className="size-5" />
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-semibold text-foreground">
                    Öppna Coach
                  </span>
                  <span className="block text-sm leading-5 text-muted-foreground">
                    Fråga direkt utifrån senaste pass, återhämtning och mål.
                  </span>
                </span>
              </Link>
            </div>

            <div className="mt-6 space-y-6 overflow-y-auto px-2 pb-4">
              <NavSection title="Daglig vy" links={primaryLinks} />
              <NavSection title="Detaljer" links={secondaryLinks} />
            </div>

            <div className="mt-auto space-y-3 rounded-[1.6rem] border border-white/45 bg-white/45 p-4">
              <div>
                <p className="truncate text-sm font-medium text-foreground">
                  {displayName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Kontinuitet slår intensitet.
                </p>
              </div>
              <SignOutButton />
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-10 pt-3 md:pt-4">{children}</main>
      </div>
    </div>
  );
}
