export const SIGNAL_LABELS: Record<string, string> = {
  sleep_avg_hours: "Medelsömn",
  recent_fast_runs: "Snabba pass (2 dagar)",
  weekly_distance_m: "Veckodistans",
  weekly_distance_goal_m: "Veckomål distans",
  strength_sessions_week: "Styrkepass denna vecka",
  pace_gap_s_per_km: "Tempogap",
  data_completeness: "Datatäckning",
};

export const CONFIDENCE_LABELS: Record<string, string> = {
  low: "Låg",
  medium: "Medel",
  high: "Hög",
};

export const EXPORT_STATUS_LABELS: Record<string, string> = {
  queued: "Köad",
  processing: "Bearbetas",
  ready: "Klar",
  failed: "Misslyckades",
};
