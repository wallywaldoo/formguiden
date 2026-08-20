"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Apple,
  ArrowUpFromLine,
  BicepsFlexed,
  Ellipsis,
  Goal,
  HeartPulse,
  LayoutDashboard,
  LockKeyhole,
  MessageCircleHeart,
  PersonStanding,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react";

import { SidebarProfile } from "@/components/navigation/sidebar-profile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/overview", label: "Översikt", icon: LayoutDashboard },
  { href: "/coach", label: "Coach", icon: MessageCircleHeart },
  { href: "/report", label: "Veckorapport", icon: Sparkles },
  { href: "/running", label: "Löpning", icon: Timer },
  { href: "/recovery", label: "Återhämtning", icon: HeartPulse },
  { href: "/import", label: "Importera", icon: ArrowUpFromLine },
];

const secondaryLinks = [
  { href: "/body", label: "Kropp", icon: PersonStanding },
  { href: "/nutrition", label: "Kost", icon: Apple },
  { href: "/strength", label: "Styrka", icon: BicepsFlexed },
  { href: "/goals", label: "Mål", icon: Goal },
  { href: "/settings/profile", label: "Profil", icon: UserRound },
  { href: "/settings/privacy", label: "Konto", icon: LockKeyhole },
];

const tabLinks = [
  { href: "/overview", label: "Översikt", icon: LayoutDashboard },
  { href: "/running", label: "Löpning", icon: Timer },
  { href: "/nutrition", label: "Kost", icon: Apple },
  { href: "/coach", label: "Coach", icon: MessageCircleHeart },
] as const;

const moreLinks = [
  { href: "/report", label: "Veckorapport", icon: Sparkles },
  { href: "/recovery", label: "Återhämtning", icon: HeartPulse },
  { href: "/import", label: "Importera", icon: ArrowUpFromLine },
  { href: "/strength", label: "Styrka", icon: BicepsFlexed },
  { href: "/body", label: "Kropp", icon: PersonStanding },
  { href: "/goals", label: "Mål", icon: Goal },
  { href: "/settings/profile", label: "Profil", icon: UserRound },
  { href: "/settings/privacy", label: "Konto", icon: LockKeyhole },
];

function pathMatches(pathname: string, href: string) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/settings/privacy" &&
      pathname.startsWith("/settings/integrations"))
  );
}

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
  }>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-2">
      <h2 className="panel-title px-0.5">{title}</h2>
      <nav className="flex flex-col gap-0.5">
        {links.map((link) => {
          const active = pathMatches(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-[0.88rem] transition-colors md:min-h-0",
                active
                  ? "bg-white/70 text-foreground"
                  : "text-muted-foreground hover:bg-white/45 hover:text-foreground",
              )}
            >
              <link.icon className="size-4 shrink-0" />
              <span className="font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({
  children,
  displayName,
  profileSubtitle,
}: {
  children: ReactNode;
  displayName: string;
  profileSubtitle?: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreLinks.some((link) => pathMatches(pathname, link.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-3 pb-[calc(var(--app-tabbar)+0.75rem)] pt-[max(0.75rem,env(safe-area-inset-top))] md:px-5 md:pb-6 md:pt-5">
        <aside className="sticky top-5 hidden h-[calc(100svh-2.5rem)] w-[19rem] shrink-0 md:flex">
          <div className="glass-nav ambient-divider flex w-full flex-col rounded-[2rem] border p-4">
            <div className="px-2 pb-3 pt-1">
              <Link href="/overview" className="page-title block">
                Formkurvan
              </Link>
            </div>

            <div className="mt-5 space-y-5 overflow-y-auto px-2 pb-4">
              <NavSection title="Daglig vy" links={primaryLinks} />
              <NavSection title="Detaljer" links={secondaryLinks} />
            </div>

            <div className="mt-auto px-2 pt-3">
              <SidebarProfile
                displayName={displayName}
                subtitle={profileSubtitle}
              />
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-4 pt-1 md:pb-10 md:pt-4">
          <div className="page-shell ambient-divider">{children}</div>
        </main>
      </div>

      <nav
        className="glass-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/40 md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-label="Huvudmeny"
      >
        <div className="flex w-full flex-row flex-nowrap items-stretch px-1 pt-1.5">
          {tabLinks.map((link) => {
            const active = pathMatches(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex min-h-14 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[0.72rem] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <link.icon
                  className="size-6"
                  strokeWidth={active ? 2.3 : 2}
                  aria-hidden
                />
                <span className="max-w-full truncate">{link.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-label="Öppna fler sidor"
            className={cn(
              "flex min-h-14 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[0.72rem] font-medium",
              moreActive || moreOpen ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Ellipsis
              className="size-6"
              strokeWidth={moreActive || moreOpen ? 2.3 : 2}
              aria-hidden
            />
            Mer
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="glass-nav max-h-[min(82dvh,calc(100dvh-var(--app-tabbar)-env(safe-area-inset-top)))] gap-0 rounded-t-[1.6rem] border-white/45 bg-transparent pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <div className="mx-auto mt-1.5 h-1 w-10 rounded-full bg-foreground/15" />
          <SheetHeader className="px-5 pb-2 pt-3">
            <SheetTitle className="page-title">Mer</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4">
            <SidebarProfile
              displayName={displayName}
              subtitle={profileSubtitle}
              menuSide="bottom"
            />
            <nav className="grid grid-cols-2 gap-2">
              {moreLinks.map((link) => {
                const active = pathMatches(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-2xl border border-white/45 bg-white/45 px-3.5 py-3 text-[0.88rem] transition-colors",
                      active
                        ? "bg-white/75 text-foreground"
                        : "text-foreground hover:bg-white/60",
                    )}
                  >
                    <link.icon className="size-4 shrink-0 text-primary" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
