"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { GarminUploadButton } from "@/features/sync/garmin-upload-button";
import type { GarminSyncStatus } from "@/lib/garmin/status";
import { userFacingGarminError } from "@/lib/garmin/session";

const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;
const SESSION_STORAGE_KEY = "fk:last-garmin-auto-sync-at";

type SyncScope = "recent" | "full" | "details";

export function GarminSyncPanel({
  initialStatus,
  variant = "full",
}: {
  initialStatus: GarminSyncStatus;
  variant?: "full" | "compact";
}) {
  const router = useRouter();
  const hasAttemptedAutoSync = useRef(false);
  const hasResumedFullSync = useRef(false);
  const hasResumedDetailBackfill = useRef(false);
  const [status, setStatus] = useState(initialStatus);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isStale = useMemo(() => {
    if (!status.lastSuccessAt) return true;
    return (
      Date.now() - new Date(status.lastSuccessAt).getTime() >
      AUTO_SYNC_INTERVAL_MS
    );
  }, [status.lastSuccessAt]);

  async function runSyncRequest(trigger: "manual" | "auto", scope: SyncScope) {
    const response = await fetch("/api/garmin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        days: scope === "full" ? 3650 : 14,
        trigger,
        scope,
      }),
    });
    const payload = (await response.json().catch(() => null)) as {
      syncedAt?: string;
      activitiesUpserted?: number;
      healthDaysUpserted?: number;
      weightEntriesUpserted?: number;
      days?: number;
      errors?: string[];
      error?: string;
      fullSync?: GarminSyncStatus["fullSync"];
      detailBackfill?: GarminSyncStatus["detailBackfill"];
      remaining?: number;
      done?: boolean;
    } | null;

    if (!response.ok) {
      throw new Error(
        userFacingGarminError(payload?.error ?? "Syncen misslyckades."),
      );
    }

    return payload;
  }

  async function triggerSync(
    trigger: "manual" | "auto",
    scope: SyncScope = "recent",
  ) {
    if (isSyncing || !status.connected) return;

    setIsSyncing(true);
    setMessage(
      trigger === "auto"
        ? "Hämtar nytt från Garmin Connect..."
        : scope === "full"
          ? "Hämtar all historik från Garmin Connect..."
          : null,
    );

    try {
      let payload = await runSyncRequest(trigger, scope);
      const healthPayload = payload;
      let syncedAt = payload?.syncedAt ?? new Date().toISOString();
      let fullSync = payload?.fullSync ?? null;
      let detailBackfill = payload?.detailBackfill ?? status.detailBackfill;

      while (scope === "full" && fullSync && !fullSync.done) {
        setMessage(
          `Hämtar historik... ${Math.round((fullSync.completedDays / fullSync.totalDays) * 100)}% klart`,
        );
        payload = await runSyncRequest(trigger, scope);
        syncedAt = payload?.syncedAt ?? syncedAt;
        fullSync = payload?.fullSync ?? fullSync;
      }

      if (scope === "recent") {
        setMessage("Hämtar karta och statistik för senaste passen...");
        payload = await runSyncRequest(trigger, "details");
        detailBackfill = payload?.detailBackfill ?? detailBackfill;
      }

      while (scope === "details" && detailBackfill && !detailBackfill.done) {
        setMessage(
          `Hämtar passdetaljer... ${detailBackfill.hydrated} klara, ${detailBackfill.remaining} kvar`,
        );
        payload = await runSyncRequest(trigger, "details");
        detailBackfill = payload?.detailBackfill ?? detailBackfill;
      }

      const resultPayload = scope === "recent" ? healthPayload : payload;
      const errorCount = resultPayload?.errors?.length ?? 0;
      const nextStatus: GarminSyncStatus = {
        connected: true,
        configurationError: null,
        lastSyncAt: syncedAt,
        lastSuccessAt: syncedAt,
        lastError: resultPayload?.errors?.[0] ?? null,
        lastTrigger: trigger,
        lastResult: {
          days: resultPayload?.days ?? 14,
          activitiesUpserted: resultPayload?.activitiesUpserted ?? 0,
          healthDaysUpserted: resultPayload?.healthDaysUpserted ?? 0,
          weightEntriesUpserted: resultPayload?.weightEntriesUpserted ?? 0,
          errors: errorCount,
        },
        fullSync,
        detailBackfill,
      };
      const resultSummary = nextStatus.lastResult;
      setStatus(nextStatus);
      const successMessage =
        scope === "full"
          ? "Historikhämtningen är klar."
          : scope === "details"
            ? "Passdetaljerna är uppdaterade."
            : errorCount > 0
              ? "Syncen nådde Garmin men hälsodata missades. Försök igen."
              : resultSummary &&
                  (resultSummary.activitiesUpserted > 0 ||
                    resultSummary.healthDaysUpserted > 0 ||
                    resultSummary.weightEntriesUpserted > 0)
                ? "Garmin-data uppdaterad."
                : "Ingen ny Garmin-data hittades just nu.";
      setMessage(successMessage);
      sessionStorage.setItem(SESSION_STORAGE_KEY, syncedAt);
      if (variant === "compact" && trigger === "manual") {
        if (errorCount > 0) toast.error(successMessage);
        else toast.success(successMessage);
      }
      router.refresh();
    } catch (error) {
      const err = userFacingGarminError(
        error instanceof Error ? error.message : "Syncen misslyckades.",
      );
      setStatus((current) => ({
        ...current,
        lastSyncAt: new Date().toISOString(),
        lastError: err,
        lastTrigger: trigger,
      }));
      setMessage(err);
      if (variant === "compact" && trigger === "manual") {
        toast.error(err);
      }
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    if (!status.connected || !isStale || hasAttemptedAutoSync.current) return;
    hasAttemptedAutoSync.current = true;

    const lastAutoSyncAt = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (
      lastAutoSyncAt &&
      Date.now() - new Date(lastAutoSyncAt).getTime() < AUTO_SYNC_INTERVAL_MS
    ) {
      return;
    }

    void triggerSync("auto");
  }, [isStale, status.connected]);

  useEffect(() => {
    if (variant !== "full") return;
    if (
      !status.connected ||
      !status.fullSync ||
      status.fullSync.done ||
      isSyncing ||
      hasResumedFullSync.current
    ) {
      return;
    }

    hasResumedFullSync.current = true;
    setMessage(
      `Återupptar historikhämtning... ${Math.round((status.fullSync.completedDays / status.fullSync.totalDays) * 100)}% klart`,
    );
    void triggerSync("manual", "full");
  }, [isSyncing, status.connected, status.fullSync, variant]);

  useEffect(() => {
    if (variant !== "full") return;
    if (
      !status.connected ||
      !status.detailBackfill ||
      status.detailBackfill.done ||
      isSyncing ||
      hasResumedDetailBackfill.current
    ) {
      return;
    }

    hasResumedDetailBackfill.current = true;
    setMessage(
      `Återupptar passdetaljer... ${status.detailBackfill.remaining} kvar`,
    );
    void triggerSync("auto", "details");
  }, [isSyncing, status.connected, status.detailBackfill, variant]);

  if (variant === "compact") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          onClick={() => void triggerSync("manual")}
          disabled={!status.connected || isSyncing}
          size="sm"
          variant="outline"
          title={status.configurationError ?? undefined}
          className="h-10 min-h-10 rounded-full border-primary/8 bg-primary/3 shadow-none active:translate-y-0 md:h-8 md:min-h-8"
        >
          <RefreshCw
            className={isSyncing ? "size-3.5 animate-spin" : "size-3.5"}
          />
          {isSyncing ? "Syncar…" : status.connected ? "Synca" : "Garmin"}
        </Button>
        <GarminUploadButton />
      </div>
    );
  }

  return (
    <Card className="gap-4 border-white/50 py-4">
      <div className="flex items-center justify-between gap-3 px-5">
        <div className="min-w-0">
          <CardTitle className="text-[0.95rem]">Garmin</CardTitle>
          <p className="mt-0.5 text-[0.8rem] text-muted-foreground">
            {status.configurationError
              ? "Session ogiltig"
              : !status.connected
                ? "Inte konfigurerat"
                : status.lastSuccessAt
                  ? `Senast ${new Date(status.lastSuccessAt).toLocaleString("sv-SE")}`
                  : "Ingen hämtning ännu"}
          </p>
        </div>
        <Button
          onClick={() => void triggerSync("manual")}
          disabled={!status.connected || isSyncing}
          size="sm"
          className="shrink-0 shadow-none"
        >
          <RefreshCw className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "Syncar..." : "Synca"}
        </Button>
      </div>
      <CardContent className="space-y-3 px-5">
        {status.lastResult ? (
          <div className="glass-panel-soft ambient-divider grid grid-cols-3 gap-2 rounded-[1.25rem] border p-3">
            <div>
              <p className="text-[0.75rem] text-muted-foreground">Pass</p>
              <p className="text-[1rem] font-semibold">
                {status.lastResult.activitiesUpserted}
              </p>
            </div>
            <div>
              <p className="text-[0.75rem] text-muted-foreground">Hälsodagar</p>
              <p className="text-[1rem] font-semibold">
                {status.lastResult.healthDaysUpserted}
              </p>
            </div>
            <div>
              <p className="text-[0.75rem] text-muted-foreground">Vikt</p>
              <p className="text-[1rem] font-semibold">
                {status.lastResult.weightEntriesUpserted}
              </p>
            </div>
          </div>
        ) : null}

        {status.detailBackfill ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[0.8rem] text-muted-foreground">
              <span>Passdetaljer</span>
              <span>
                {status.detailBackfill.done
                  ? "Klart"
                  : `${status.detailBackfill.remaining} kvar`}
              </span>
            </div>
          </div>
        ) : null}

        {status.fullSync ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[0.8rem] text-muted-foreground">
              <span>Historik</span>
              <span>
                {Math.round(
                  (status.fullSync.completedDays / status.fullSync.totalDays) *
                    100,
                )}
                %
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/55">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${(status.fullSync.completedDays / status.fullSync.totalDays) * 100}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {status.configurationError ? (
          <p className="text-[0.8rem] text-muted-foreground">
            {status.configurationError}
          </p>
        ) : message || status.lastError ? (
          <p className="text-[0.8rem] text-muted-foreground">
            {message ?? status.lastError}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => void triggerSync("manual", "full")}
            disabled={!status.connected || isSyncing}
            variant="outline"
            className="border-primary/18 bg-primary/10 shadow-none"
          >
            Historik
          </Button>
          <Button
            onClick={() => void triggerSync("manual", "details")}
            disabled={!status.connected || isSyncing}
            variant="outline"
            className="border-primary/18 bg-primary/10 shadow-none"
          >
            Passdetaljer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
