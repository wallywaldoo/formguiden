#!/usr/bin/env python3
"""Pull Garmin Connect data on this machine and push it to Formkurvan.

Garmin credentials never leave the machine. Formkurvan sees only a PAT and
already-normalised JSON or FIT bytes.

Required env (from ~/.formkurvan/garmin-sync.env or the environment):

  FORMKURVAN_APP_URL
  FORMKURVAN_PAT
  NHOST_SUBDOMAIN
  NHOST_REGION
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import zipfile
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any

SCRIPT_VERSION = "1"
CURSOR_PATH = Path.home() / ".formkurvan" / "garmin-sync-cursor.json"
ENV_PATH = Path.home() / ".formkurvan" / "garmin-sync.env"
TOKEN_DIR = Path.home() / ".garminconnect"


def load_env() -> None:
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Saknad miljövariabel: {name}")
    return value


def utc_from_gmt(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        if value.endswith("Z") or "+" in value[10:] or value.endswith("+00:00"):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            )
        return None
    if isinstance(value, (int, float)):
        seconds = value / 1000 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(seconds, tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    return None


def date_range(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()



def upload_via_ingest(
    app_url: str,
    token: str,
    filename: str,
    data: bytes,
    mime: str,
) -> dict[str, Any]:
    import requests

    response = requests.post(
        f"{app_url.rstrip('/')}/api/ingest/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": (filename, data, mime)},
        timeout=60,
    )
    if response.status_code >= 400:
        raise RuntimeError(
            f"Upload {filename} misslyckades: {response.status_code} {response.text[:300]}"
        )
    result = response.json()
    if not result.get("id"):
        raise RuntimeError(f"Kunde inte ladda upp {filename}.")
    return result


def exchange_pat_for_jwt(subdomain: str, region: str, pat: str) -> str:
    """Exchange a Nhost PAT for a short-lived JWT once per session."""
    import requests

    response = requests.post(
        f"https://{subdomain}.auth.{region}.nhost.run/v1/signin/pat",
        json={"personalAccessToken": pat},
        timeout=30,
    )
    response.raise_for_status()
    jwt = response.json().get("session", {}).get("accessToken")
    if not jwt:
        raise RuntimeError("Nhost svarade utan access token.")
    return jwt


def ingest(app_url: str, token: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    import requests

    response = requests.post(
        f"{app_url.rstrip('/')}{path}",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json=payload or {},
        timeout=45,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"{path} {response.status_code}: {response.text[:300]}")
    return response.json()


def drive_import(app_url: str, pat: str, import_id: str) -> dict[str, Any]:
    retries = 0
    while True:
        try:
            result = ingest(app_url, pat, f"/api/ingest/imports/{import_id}/process")
        except RuntimeError as err:
            if "401" in str(err) and retries < 3:
                retries += 1
                time.sleep(2 ** retries)
                continue
            raise
        retries = 0
        if result.get("status") in {"done", "error"}:
            break
        time.sleep(0.4)
    if result.get("status") == "error":
        raise RuntimeError(result.get("error") or "Bearbetningen misslyckades.")
    return ingest(app_url, pat, f"/api/ingest/imports/{import_id}/finish")


def load_cursor() -> dict[str, Any]:
    if not CURSOR_PATH.exists():
        return {"activityIds": []}
    return json.loads(CURSOR_PATH.read_text(encoding="utf-8"))


def save_cursor(cursor: dict[str, Any]) -> None:
    CURSOR_PATH.parent.mkdir(parents=True, exist_ok=True)
    CURSOR_PATH.write_text(json.dumps(cursor, indent=2), encoding="utf-8")


def collect_health(client: Any, start: date, end: date) -> dict[str, Any]:
    days: list[dict[str, Any]] = []
    for day in date_range(start, end):
        key = day.isoformat()
        stats = client.get_stats(key) or {}
        sleep = (client.get_sleep_data(key) or {}).get("dailySleepDTO") or {}
        hrv = ((client.get_hrv_data(key) or {}) or {}).get("hrvSummary") or {}
        time.sleep(0.25)
        days.append(
            {
                "localDate": key,
                "sleepDurationS": sleep.get("sleepTimeSeconds"),
                "sleepStartAt": utc_from_gmt(sleep.get("sleepStartTimestampGMT")),
                "sleepEndAt": utc_from_gmt(sleep.get("sleepEndTimestampGMT")),
                "sleepLightS": sleep.get("lightSleepSeconds"),
                "sleepDeepS": sleep.get("deepSleepSeconds"),
                "sleepRemS": sleep.get("remSleepSeconds"),
                "sleepAwakeS": sleep.get("awakeSleepSeconds"),
                "hrvRmssdMs": hrv.get("lastNightAvg"),
                "restingHeartRateBpm": stats.get("restingHeartRate")
                or sleep.get("restingHeartRate"),
                "stressAvg": stats.get("averageStressLevel"),
                "bodyBatteryHigh": stats.get("bodyBatteryHighestValue"),
                "bodyBatteryLow": stats.get("bodyBatteryLowestValue"),
                "steps": stats.get("totalSteps"),
                "respirationAvgBrpm": stats.get("avgWakingRespirationValue"),
            }
        )

    weights: list[dict[str, Any]] = []
    weigh_ins = client.get_weigh_ins(start.isoformat(), end.isoformat()) or {}
    for day in weigh_ins.get("dailyWeightSummaries") or []:
        for metric in day.get("allWeightMetrics") or []:
            grams = metric.get("weight")
            measured = utc_from_gmt(metric.get("timestampGMT"))
            if not measured:
                continue
            weights.append(
                {
                    "measuredAt": measured,
                    "massKg": round(grams / 1000, 2) if grams else None,
                    "bodyFatPct": metric.get("bodyFat"),
                }
            )
    return {"dailyHealth": days, "bodyMeasurements": weights}


def extract_fit(archive: bytes) -> bytes | None:
    with zipfile.ZipFile(BytesIO(archive)) as zipped:
        for name in zipped.namelist():
            if name.lower().endswith(".fit"):
                return zipped.read(name)
    return None


def collect_fits(client: Any, start: date, end: date, seen: set[str]) -> list[tuple[str, bytes]]:
    activities = client.get_activities_by_date(start.isoformat(), end.isoformat()) or []
    files: list[tuple[str, bytes]] = []
    for activity in activities:
        activity_id = str(activity.get("activityId") or activity.get("id") or "")
        if not activity_id or activity_id in seen:
            continue
        raw = client.download_activity(
            activity_id, dl_fmt=client.ActivityDownloadFormat.ORIGINAL
        )
        time.sleep(0.4)
        fit = extract_fit(raw) if raw[:2] == b"PK" else raw
        if not fit:
            continue
        files.append((f"{activity_id}.fit", fit))
        seen.add(activity_id)
    return files


CHUNK_DAYS = 30  # max days per health-data batch to avoid server timeouts


def sync_health_chunk(
    app_url: str,
    jwt: str,
    provenance: dict[str, Any],
    client: Any,
    chunk_start: date,
    chunk_end: date,
) -> str:
    """Sync one chunk of health data. Returns result reason string."""
    health = collect_health(client, chunk_start, chunk_end)
    payload = {
        "schemaVersion": 1,
        "provenance": provenance,
        "dailyHealth": health["dailyHealth"],
        "bodyMeasurements": health["bodyMeasurements"],
    }
    health_bytes = json.dumps(payload).encode("utf-8")
    health_file = upload_via_ingest(
        app_url, jwt, "garmin-connect-health.json", health_bytes, "application/json"
    )
    started = ingest(
        app_url,
        jwt,
        "/api/ingest/imports",
        {
            "provider": "garmin-connect",
            "provenance": provenance,
            "files": [
                {
                    "storageFileId": health_file["id"],
                    "filename": "garmin-connect-health.json",
                    "sha256": sha256_hex(health_bytes),
                    "size": len(health_bytes),
                    "mimeType": "application/json",
                }
            ],
        },
    )
    result = drive_import(app_url, jwt, started["importId"])
    return f"{result.get('reason')} (status {result.get('importStatus')})"


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Sync Garmin Connect to Formkurvan")
    parser.add_argument("--days", type=int, default=14)
    args = parser.parse_args()
    if args.days < 1 or args.days > 400:
        print(" --days måste vara 1–400", file=sys.stderr)
        return 4

    app_url = require_env("FORMKURVAN_APP_URL")
    pat = require_env("FORMKURVAN_PAT")
    nhost_subdomain = require_env("NHOST_SUBDOMAIN")
    nhost_region = require_env("NHOST_REGION")

    if not TOKEN_DIR.exists():
        print(
            "Ingen Garmin-token. Kör först: ~/.local/bin/garmin-mcp-auth",
            file=sys.stderr,
        )
        return 1

    from garminconnect import Garmin
    from importlib.metadata import version as pkg_version

    client = Garmin()
    client.login(str(TOKEN_DIR))

    # Exchange PAT for JWT once; reuse it for all ingest API calls to avoid
    # repeated Nhost auth round-trips that can be throttled under load.
    jwt = exchange_pat_for_jwt(nhost_subdomain, nhost_region, pat)

    engine_version = pkg_version("garminconnect")
    provenance = {
        "engine": "python-garminconnect",
        "engineVersion": engine_version,
        "scriptVersion": SCRIPT_VERSION,
    }

    end = date.today()
    start = end - timedelta(days=args.days - 1)
    cursor = load_cursor()
    seen = {str(item) for item in cursor.get("activityIds", [])}

    # Split into CHUNK_DAYS blocks so each upload stays within server timeouts.
    chunk_end = end
    while chunk_end >= start:
        chunk_start = max(start, chunk_end - timedelta(days=CHUNK_DAYS - 1))
        print(f"Hälsodata {chunk_start}–{chunk_end}…")
        try:
            result = sync_health_chunk(app_url, jwt, provenance, client, chunk_start, chunk_end)
            print(f"  → {result}")
        except Exception as err:
            print(f"  Fel: {err}", file=sys.stderr)
        chunk_end = chunk_start - timedelta(days=1)

    fits = collect_fits(client, start, end, seen)
    if fits:
        uploaded = []
        for name, data in fits:
            stored = upload_via_ingest(
                app_url, jwt, name, data, "application/octet-stream"
            )
            uploaded.append(
                {
                    "storageFileId": stored["id"],
                    "filename": name,
                    "sha256": sha256_hex(data),
                    "size": len(data),
                    "mimeType": "application/octet-stream",
                }
            )
        started_fit = ingest(
            app_url,
            jwt,
            "/api/ingest/imports",
            {
                "provider": "garmin-file",
                "provenance": provenance,
                "files": uploaded,
            },
        )
        fit_result = drive_import(app_url, jwt, started_fit["importId"])
        print(
            f"Pass: {len(fits)} filer · {fit_result.get('reason')} "
            f"(status {fit_result.get('importStatus')})"
        )
        cursor["activityIds"] = sorted(seen)[-500:]
    else:
        print("Inga nya pass.")

    cursor["lastHealthDate"] = end.isoformat()
    save_cursor(cursor)

    print(
        "\nKlar. Gå till Formkurvan → Efter passet för att bekräfta importerna."
        "\nNästa körning med samma skriptversion auto-committar."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as error:  # noqa: BLE001 — CLI boundary
        print(error, file=sys.stderr)
        raise SystemExit(3)
