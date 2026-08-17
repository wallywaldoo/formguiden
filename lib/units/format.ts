export function formatDistanceKm(meters: number, unit: "km" | "mi"): string {
  const value = unit === "mi" ? meters / 1609.344 : meters / 1000;
  const digits = value >= 10 ? 1 : 2;
  const formatted = value.toLocaleString("sv-SE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${formatted} ${unit}`;
}

export function formatElevation(meters: number, unit: "m" | "ft"): string {
  const value = unit === "ft" ? meters * 3.28084 : meters;
  return `${Math.round(value)} ${unit}`;
}

export function formatMassKg(kg: number, unit: "kg" | "lb"): string {
  const value = unit === "lb" ? kg * 2.20462 : kg;
  const formatted = value.toLocaleString("sv-SE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${formatted} ${unit}`;
}

export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  return `${hours.toLocaleString("sv-SE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} h`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

export function formatVolumeMl(ml: number, unit: "ml" | "floz"): string {
  const value = unit === "floz" ? ml / 29.5735 : ml;
  const formatted = value.toLocaleString("sv-SE", {
    maximumFractionDigits: unit === "floz" ? 1 : 0,
  });
  return `${formatted} ${unit === "floz" ? "fl oz" : "ml"}`;
}
