"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Watch } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type GarminSyncStatus = {
  connected: boolean;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastTrigger: "manual" | "auto" | null;
  lastResult: {
    days: number;
    activitiesUpserted: number;
    healthDaysUpserted: number;
    weightEntriesUpserted: number;
    errors: number;
  } | null;
  fullSync: {
    totalDays: number;
    completedDays: number;
    chunkDays: number;
    lastChunkStart?: string;
    lastChunkEnd?: string;
    done: boolean;
  } | null;
};

const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;
const SESSION_STORAGE_KEY = "fk:last-garmin-auto-sync-at";

type SyncScope = "recent" | "full";

export function GarminSyncPanel({
  initialStatus,
}: {
  initialStatus: GarminSyncStatus;
}) {
  const router = useRouter();
  const hasAttemptedAutoSync = useRef(false);
  const [status, setStatus] = useState(initialStatus);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isStale = useMemo(() => {
    if (!status.lastSuccessAt) return true;
    return Date.now() - new Date(status.lastSuccessAt).getTime() > AUTO_SYNC_INTERVAL_MS;
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
    const payload = (await response.json().catch(() => null)) as
      | {
          syncedAt?: string;
          activitiesUpserted?: number;
          healthDaysUpserted?: number;
          weightEntriesUpserted?: number;
          days?: number;
          errors?: string[];
          error?: string;
          fullSync?: GarminSyncStatus["fullSync"];
        }
      | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? "Syncen misslyckades.");
    }

    return payload;
  }

  async function triggerSync(trigger: "manual" | "auto", scope: SyncScope = "recent") {
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
      let syncedAt = payload?.syncedAt ?? new Date().toISOString();
      let fullSync = payload?.fullSync ?? null;

      while (scope === "full" && fullSync && !fullSync.done) {
        setMessage(
          `Hämtar historik... ${Math.round((fullSync.completedDays / fullSync.totalDays) * 100)}% klart`,
        );
        payload = await runSyncRequest(trigger, scope);
        syncedAt = payload?.syncedAt ?? syncedAt;
        fullSync = payload?.fullSync ?? fullSync;
      }

      const nextStatus: GarminSyncStatus = {
        connected: true,
        lastSyncAt: syncedAt,
        lastSuccessAt: syncedAt,
        lastError: payload?.errors?.[0] ?? null,
        lastTrigger: trigger,
        lastResult: {
          days: payload?.days ?? 14,
          activitiesUpserted: payload?.activitiesUpserted ?? 0,
          healthDaysUpserted: payload?.healthDaysUpserted ?? 0,
          weightEntriesUpserted: payload?.weightEntriesUpserted ?? 0,
          errors: payload?.errors?.length ?? 0,
        },
        fullSync,
      };
      const resultSummary = nextStatus.lastResult;
      setStatus(nextStatus);
      setMessage(
        scope === "full"
          ? "Historikhämtningen är klar."
          : resultSummary &&
              (resultSummary.activitiesUpserted > 0 ||
                resultSummary.healthDaysUpserted > 0 ||
                resultSummary.weightEntriesUpserted > 0)
            ? "Garmin-data uppdaterad."
            : "Ingen ny Garmin-data hittades just nu.",
      );
      sessionStorage.setItem(SESSION_STORAGE_KEY, syncedAt);
      router.refresh();
    } catch (error) {
      const err = error instanceof Error ? error.message : "Syncen misslyckades.";
      setStatus((current) => ({
        ...current,
        lastSyncAt: new Date().toISOString(),
        lastError: err,
        lastTrigger: trigger,
      }));
      setMessage(err);
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

  return (
    <Card className="glass-panel ambient-divider border-white/50">
      <CardHeader className="gap-3 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Watch className="size-5" />
          </span>
          <div>
            <CardTitle className="text-[1.05rem]">Garmin Connect</CardTitle>
            <CardDescription>
              Hämta nytt med ett tryck eller låt översikten hålla sig uppdaterad.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-1">
          <p className="text-[0.92rem] font-medium text-foreground">
            {status.connected ? "Anslutning redo" : "Garmin är inte konfigurerat"}
          </p>
          <p className="text-[0.88rem] leading-6 text-muted-foreground">
            {status.lastSuccessAt
              ? `Senast lyckad hämtning ${new Date(status.lastSuccessAt).toLocaleString("sv-SE")}.`
              : "Ingen hämtning har körts ännu från appen."}
          </p>
        </div>

        {status.lastResult ? (
          <div className="glass-panel-soft ambient-divider grid grid-cols-3 gap-2 rounded-[1.25rem] border p-3">
            <div>
              <p className="text-[0.75rem] text-muted-foreground">Pass</p>
              <p className="text-[1rem] font-semibold">{status.lastResult.activitiesUpserted}</p>
            </div>
            <div>
              <p className="text-[0.75rem] text-muted-foreground">Hälsodagar</p>
              <p className="text-[1rem] font-semibold">{status.lastResult.healthDaysUpserted}</p>
            </div>
            <div>
              <p className="text-[0.75rem] text-muted-foreground">Vikt</p>
              <p className="text-[1rem] font-semibold">{status.lastResult.weightEntriesUpserted}</p>
            </div>
          </div>
        ) : null}

        {status.fullSync ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[0.8rem] text-muted-foreground">
              <span>Historik</span>
              <span>
                {Math.round(
                  (status.fullSync.completedDays / status.fullSync.totalDays) * 100,
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

        <div className="space-y-1">
          <p className="text-[0.88rem] leading-6 text-muted-foreground">
            {message
              ? message
              : status.lastError
                ? `Senaste fel: ${status.lastError}`
                : isStale
                  ? "Översikten försöker själv hämta nytt när datan blivit gammal."
                  : "Datan är nyligen uppdaterad och behöver inte hämtas igen just nu."}
          </p>
        </div>

        <div className="grid gap-2">
          <Button
            onClick={() => void triggerSync("manual")}
            disabled={!status.connected || isSyncing}
            className="w-full shadow-none"
          >
            <RefreshCw className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncar nu..." : "Synca nu"}
          </Button>
          <Button
            onClick={() => void triggerSync("manual", "full")}
            disabled={!status.connected || isSyncing}
            variant="outline"
            className="w-full border-white/55 bg-white/58 shadow-none"
          >
            Hämta all historik
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
