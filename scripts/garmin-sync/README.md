# Lokal Garmin-sync

Skriptet körs på **din dator**. Det loggar in mot Garmin Connect med tokenen i `~/.garminconnect` (samma som `garmin-mcp-auth`) och skickar hälsodata plus FIT-filer till Formkurvan. Lösenordet passerar aldrig webbappen.

## Förutsättningar

1. `garmin-mcp-auth` har redan körts en gång på maskinen.
2. En sync-token skapad under Inställningar → Integrationer.
3. `uv` installerat (`~/.local/bin/uv`).

## Konfiguration

```bash
mkdir -p ~/.formkurvan
cat > ~/.formkurvan/garmin-sync.env <<'EOF'
FORMKURVAN_APP_URL=https://formguiden.vercel.app
FORMKURVAN_PAT=din-token-uuid
NHOST_SUBDOMAIN=bptuyirzwytjdwgdzwta
NHOST_REGION=eu-central-1
EOF
chmod 600 ~/.formkurvan/garmin-sync.env
```

## Körning

```bash
cd /path/to/formkurvan
~/.local/bin/uv run --python 3.12 --with garminconnect==0.3.2 --with requests \
  python scripts/garmin-sync/sync.py --days 14
```

Första körningen stannar på förhandsgranskning. Bekräfta den i Efter passet. Därefter auto-committar samma skriptversion.

## launchd (macOS)

Kopiera `com.formkurvan.garmin-sync.plist.example` till `~/Library/LaunchAgents/`, byt sökvägar, sedan:

```bash
launchctl load ~/Library/LaunchAgents/com.formkurvan.garmin-sync.plist
```

En laptop med stängt lock kör inte jobbet. `StartCalendarInterval` plus `caffeinate` i skriptet väcker den bara om strömmen är inkopplad; en maskin som alltid är vaken är mer pålitlig.

## systemd (Linux)

Se `garmin-sync.service.example` och `garmin-sync.timer.example`.
