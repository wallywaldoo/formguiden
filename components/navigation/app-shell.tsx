"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

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

const links = [
  { href: "/overview", label: "Översikt" },
  { href: "/coach", label: "Coach" },
  { href: "/report", label: "Veckorapport" },
  { href: "/running", label: "Löpning" },
  { href: "/recovery", label: "Återhämtning" },
  { href: "/body", label: "Kropp" },
  { href: "/nutrition", label: "Kost" },
  { href: "/strength", label: "Styrka" },
  { href: "/goals", label: "Mål" },
  { href: "/import", label: "Efter passet" },
  { href: "/settings/profile", label: "Profil" },
  { href: "/settings/privacy", label: "Integritet" },
  { href: "/settings/integrations", label: "Integrationer" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          className={cn(
            "rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === link.href || pathname.startsWith(`${link.href}/`)
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppShell({
  children,
  displayName,
}: {
  children: React.ReactNode;
  displayName: string;
}) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-sm md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/overview" className="font-semibold">
            Formkurvan
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Öppna meny">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Meny</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-6 px-4">
                <NavLinks />
                <SignOutButton />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-svh w-56 shrink-0 border-r px-4 py-8 md:flex md:flex-col md:justify-between">
          <div className="space-y-8">
            <Link href="/overview" className="block px-3 text-lg font-semibold">
              Formkurvan
            </Link>
            <NavLinks />
          </div>
          <div className="space-y-2 px-3">
            <p className="truncate text-sm text-muted-foreground">
              {displayName}
            </p>
            <SignOutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
