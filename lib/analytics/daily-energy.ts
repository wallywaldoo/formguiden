const SEDENTARY_FACTOR = 1.2;

export type DailyEnergyBalance = {
  maintenanceKcal: number;
  activityKcal: number;
  budgetKcal: number;
  loggedKcal: number;
  remainingKcal: number;
};

export function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim());
  return match?.[1] ?? null;
}

export function ageYearsFromBirthDate(birthDate: string, on: Date): number | null {
  const isoDate = toIsoDate(birthDate);
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  let age = on.getFullYear() - year;
  const monthDiff = on.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < day)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function mifflinStJeorBmr(input: {
  massKg: number;
  heightCm: number;
  ageYears: number;
  sex: string | null;
}): number {
  const base =
    10 * input.massKg + 6.25 * input.heightCm - 5 * input.ageYears;
  if (input.sex === "female") return base - 161;
  if (input.sex === "male") return base + 5;
  return base - 78;
}

export function dailyEnergyBalance(input: {
  massKg: number | null;
  heightCm: number | null;
  birthDate: unknown;
  sex: string | null;
  loggedKcal: number;
  activityKcal: number;
  now: Date;
}): DailyEnergyBalance | null {
  const birthDate = toIsoDate(input.birthDate);
  if (
    input.massKg == null ||
    input.massKg <= 0 ||
    input.heightCm == null ||
    input.heightCm <= 0 ||
    !birthDate
  ) {
    return null;
  }
  const ageYears = ageYearsFromBirthDate(birthDate, input.now);
  if (ageYears == null || ageYears < 15 || ageYears > 100) {
    return null;
  }
  const maintenanceKcal = Math.round(
    mifflinStJeorBmr({
      massKg: input.massKg,
      heightCm: input.heightCm,
      ageYears,
      sex: input.sex,
    }) * SEDENTARY_FACTOR,
  );
  const activityKcal = Math.round(Math.max(0, input.activityKcal));
  const loggedKcal = Math.round(Math.max(0, input.loggedKcal));
  const budgetKcal = maintenanceKcal + activityKcal;
  return {
    maintenanceKcal,
    activityKcal,
    budgetKcal,
    loggedKcal,
    remainingKcal: budgetKcal - loggedKcal,
  };
}
