"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  isLikelyGarminFile,
  uploadGarminFiles,
} from "@/features/sync/upload-garmin-files";

const FILE_ACCEPT =
  ".fit,.tcx,.gpx,.csv,.zip,.db,.json,application/zip,application/gpx+xml,text/csv,application/json";

export function GarminUploadButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function ingest(list: FileList | null) {
    const files = Array.from(list ?? []).filter(isLikelyGarminFile);
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
        caught instanceof Error ? caught.message : "Uppladdningen misslyckades.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        disabled={busy}
        accept={FILE_ACCEPT}
        onChange={(event) => void ingest(event.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        className="h-10 min-h-10 rounded-full border-primary/8 bg-primary/3 shadow-none md:h-8 md:min-h-8"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        {busy ? "Laddar…" : "Ladda upp"}
      </Button>
    </>
  );
}
