export const RULE_FORMULA_KEYS: Record<string, string[]> = {
  sleep_debt_limit_intensity: ["sleep_duration_mean", "intensity_fast_run"],
  weekly_volume_behind: ["weekly_run_distance", "weekly_volume_progress"],
  strength_behind_target: ["strength_frequency"],
  pace_gap_review: ["goal_pace_gap"],
  data_completeness_import: ["data_completeness"],
  maintain_consistency: ["weekly_run_distance", "data_completeness"],
};

export const RECOMMENDATION_FORMULAS: Record<string, string> = {
  sleep_duration_mean:
    "Medel sömn per natt = summa(sleep_duration_s) / antal nätter med data.",
  intensity_fast_run:
    "Snabbt pass: avg_pace_s_per_km < måltempo × 0,95 (PACE_FAST_FACTOR).",
  weekly_run_distance:
    "Veckodistans = summa distance_m för löpning/trail/löpband inom ISO-veckan.",
  weekly_volume_progress:
    "Förväntad volym = veckomål × (dagar sedan måndag / 7). Eftersläpning om faktisk < 70 % av förväntad.",
  strength_frequency:
    "Styrkepass = antal sessioner med started_at inom senaste 7 lokala dagar.",
  goal_pace_gap:
    "Tempogap = senaste representativa pass (≥ 5 km) minus måltempo, i s/km.",
  data_completeness:
    "Datatäckning = viktat medel av tillgänglighet för vecka, tempo, sömn, HRV, vilopuls och vikt.",
};

export function formulaLabels(keys: string[]): string[] {
  return keys.map((key) => RECOMMENDATION_FORMULAS[key] ?? key);
}
