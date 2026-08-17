export const IMPORT_STATUS_LABEL: Record<string, string> = {
  uploaded: "Uppladdad",
  queued: "Köad",
  processing: "Bearbetas",
  preview_ready: "Redo att bekräfta",
  partial: "Delvis",
  failed: "Misslyckad",
  committed: "Sparad",
  abandoned: "Avbruten",
};

export const FILE_STATUS_LABEL: Record<string, string> = {
  pending: "Väntar",
  processing: "Bearbetas",
  previewed: "Förhandsvisad",
  duplicate: "Dubblett",
  failed: "Misslyckad",
  committed: "Sparad",
};

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  run: "Löpning",
  trail_run: "Traillöpning",
  treadmill: "Löpband",
  walk: "Promenad",
  hike: "Vandring",
  cycle: "Cykel",
  strength: "Styrka",
  other: "Övrigt",
};
