"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  isLikelyGarminFile,
  uploadGarminFiles,
} from "@/features/sync/upload-garmin-files";

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

export function DashboardDropCatch({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dragDepth = 0;

    function onEnter(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      dragDepth += 1;
      setActive(true);
    }

    function onOver(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
    }

    function onLeave(event: DragEvent) {
      if (!hasFiles(event)) {
        return;
      }
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        setActive(false);
      }
    }

    async function onDrop(event: DragEvent) {
      if (
        event.defaultPrevented ||
        (event.target instanceof Element &&
          event.target.closest("[data-catch-up-dropzone]"))
      ) {
        return;
      }
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      dragDepth = 0;
      setActive(false);
      const files = Array.from(event.dataTransfer?.files ?? []).filter(
        isLikelyGarminFile,
      );
      if (files.length === 0) {
        toast.error("Släpp FIT, TCX, GPX, CSV eller ZIP.");
        return;
      }
      setBusy(true);
      toast("Hämtar in passet…");
      try {
        const result = await uploadGarminFiles(files);
        toast.success("Filerna är inne.");
        router.push(`/import/${result.importId}`);
      } catch (caught) {
        toast.error(
          caught instanceof Error
            ? caught.message
            : "Uppladdningen misslyckades.",
        );
      } finally {
        setBusy(false);
      }
    }

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [router]);

  return (
    <>
      {children}
      {active || busy ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="max-w-sm rounded-3xl border bg-card px-8 py-10 text-center shadow-lg">
            <p className="text-2xl font-semibold tracking-tight">
              {busy ? "Hämtar in…" : "Släpp. Vi tar det härifrån."}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Ingen Garmin-inloggning. Bara filen du själv exporterat.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
