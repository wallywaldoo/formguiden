"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function EnsureGarminDetail({
  activityId,
  shouldFetch,
}: {
  activityId: string;
  shouldFetch: boolean;
}) {
  const router = useRouter();
  const startedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchDetail() {
    if (loading) return;
    setLoading(true);
    setMessage("Hämtar karta och detaljer från Garmin...");
    try {
      const response = await fetch(`/api/garmin/activity/${activityId}/detail`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Detaljhämtningen misslyckades.");
      }
      setMessage("Garmin-detaljer hämtade.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Detaljhämtningen misslyckades.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!shouldFetch || startedRef.current) return;
    startedRef.current = true;
    void fetchDetail();
  }, [shouldFetch]);

  if (!shouldFetch && !message) {
    return null;
  }

  return (
    <div className="rounded-[1.4rem] border border-white/50 bg-white/45 px-4 py-3 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message ?? "Garmin-detaljer kan hämtas för det här passet."}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void fetchDetail()}
          disabled={loading}
          className="border-primary/18 bg-primary/10 shadow-none"
        >
          {loading ? "Hämtar..." : "Hämta Garmin-detaljer"}
        </Button>
      </div>
    </div>
  );
}
