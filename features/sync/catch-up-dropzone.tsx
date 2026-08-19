"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  isLikelyGarminFile,
  uploadGarminFiles,
} from "@/features/sync/upload-garmin-files";
import { cn } from "@/lib/utils";

const FILE_ACCEPT =
  ".fit,.tcx,.gpx,.csv,.zip,.db,.json,application/zip,application/gpx+xml,text/csv,application/json";

function filesFromList(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.size > 0);
}

export function CatchUpDropzone({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact";
  className?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const ingest = useCallback(
    async (incoming: File[]) => {
      const files = incoming.filter(isLikelyGarminFile);
      if (files.length === 0) {
        setError("Släpp FIT, TCX, GPX, CSV eller ZIP från Garmin Connect.");
        return;
      }
      setBusy(true);
      setError(null);
      setProgress(8);
      toast("Hämtar in passet…");
      try {
        const result = await uploadGarminFiles(files);
        setProgress(100);
        toast.success("Filerna är inne. Formkurvan läser klockan.");
        router.push(`/import/${result.importId}`);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Uppladdningen misslyckades.";
        setError(message);
        toast.error(message);
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  return (
    <div className={cn("space-y-4", className)}>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setHover(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(event) => {
          event.preventDefault();
          setHover(false);
          void ingest(filesFromList(event.dataTransfer.files));
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-[1.75rem] border border-dashed px-6 text-center transition-colors",
          variant === "full" ? "min-h-56 gap-3 py-12" : "min-h-28 gap-2 py-6",
          hover || busy
            ? "border-primary/50 bg-white/82"
            : "border-white/55 bg-white/52",
        )}
        data-catch-up-dropzone="true"
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          multiple
          disabled={busy}
          accept={FILE_ACCEPT}
          onChange={(event) => {
            const files = filesFromList(event.target.files);
            event.target.value = "";
            void ingest(files);
          }}
        />
        <p
          className={cn(
            "font-medium tracking-tight",
            variant === "full" ? "text-xl" : "text-base",
          )}
        >
          {busy ? "Hämtar in…" : "Släpp passet här"}
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          FIT, TCX, GPX, CSV eller ZIP. Max 25 MiB per fil. Dubbletter hoppas
          över, så du kan släppa samma vecka flera gånger.
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Laddar upp…" : "Välj filer"}
        </Button>
      </div>
      {progress != null ? <Progress value={progress} /> : null}
    </div>
  );
}
