export type RunActivityView = {
  id: string;
  activityType: string;
  startedAt: string;
  distanceM: number | null;
  durationS: number | null;
  avgPaceSPerKm: number | null;
  avgHeartRateBpm: number | null;
  elevationGainM: number | null;
  caloriesKcal: number | null;
  notes: string | null;
  detailHydrated: boolean;
};
