import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Formkurvan",
  description: "Kör. Dela. Formkurvan tar hand om resten.",
  appleWebApp: {
    capable: true,
    title: "Formkurvan",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="sv"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full bg-background text-foreground">
        {/* THESIS: Formkurvan should feel like a focused recovery-and-training cockpit, not a generic dashboard grid.
            OWN-WORLD: Frosted mineral glass, cool daylight gradients, luminous blue accents, rounded plates, and soft depth that stays crisp under dense data.
            STORY: The athlete lands on one calm overview, understands current status within seconds, then moves directly into coach, logging, or catch-up work.
            FIRST VIEWPORT: A sticky glass shell frames the app while the overview opens with a compact heading band, a dominant daily summary plate, and adjacent quick-action surfaces.
            FORM: Replacement app-world, overview-first operate surface, seed key user-directed-liquid-glass-overview.
            FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
