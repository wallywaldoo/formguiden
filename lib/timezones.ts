export function listTimeZones(): string[] {
  const supported =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? Intl.supportedValuesOf("timeZone")
      : ["Europe/Stockholm", "UTC"];
  const preferred = "Europe/Stockholm";
  return [preferred, ...supported.filter((zone) => zone !== preferred)];
}
