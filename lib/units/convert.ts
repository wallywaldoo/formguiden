export const ML_PER_FLOZ = 29.5735;
export const LB_PER_KG = 2.20462;

export function volumeToMl(value: number, unit: "ml" | "floz"): number {
  return unit === "floz" ? value * ML_PER_FLOZ : value;
}

export function massToKg(value: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? value / LB_PER_KG : value;
}

export function distanceToMeters(value: number, unit: "km" | "mi"): number {
  return unit === "mi" ? value * 1609.344 : value * 1000;
}

export function kgToMassUnit(kg: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? kg * LB_PER_KG : kg;
}

export function mlToVolumeUnit(ml: number, unit: "ml" | "floz"): number {
  return unit === "floz" ? ml / ML_PER_FLOZ : ml;
}
