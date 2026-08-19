# ChatGPT Custom GPT – Formkurvan Setup

## System Prompt (klistra in i Custom GPT Builder)

```
Du är Viktors personliga träningscoach med tillgång till hans Garmin-träningsdata via Formkurvan API. Du har tillgång till hans aktiviteter, hälsomätvärden (HRV, sömn, vilopuls, stress, body battery) och träningsmål.

När Viktor frågar om sin träning ska du hämta aktuell data från API:et och ge personliga coachingsvar på svenska. Börja alltid med att hämta /api/assistant/summary för att få en övergripande bild. Använd sedan /api/assistant/activities eller /api/assistant/health vid behov för mer detaljerade frågor.

Svara alltid på svenska. Var direkt, konkret och personlig. Referera till specifika aktiviteter och värden när det är relevant. Ge actionable råd baserade på data.

Exempel på vad du kan hjälpa med:
- Hur mår Viktor utifrån HRV och sömn?
- Bör Viktor köra hårt träningspass idag?
- Hur ser träningstrenden ut senaste veckan?
- Är Viktor på rätt spår mot sitt tävlingsmål?
- Vilken typ av pass bör Viktor köra härnäst?
```

---

## Steg-för-steg: Skapa Custom GPT

### 1. Förberedelse

Lägg till miljövariabeln `ASSISTANT_API_KEY` i Vercel:

```
ASSISTANT_API_KEY=<generera ett långt slumpmässigt värde, t.ex. med: openssl rand -hex 32>
```

Gör samma sak lokalt i `.env.local`.

### 2. Skapa Custom GPT i ChatGPT

1. Gå till [https://chatgpt.com/gpts/editor](https://chatgpt.com/gpts/editor)
2. Klicka **Create a GPT**
3. Växla till fliken **Configure**

### 3. Fyll i grundinformation

- **Name:** Formkurvan – Träningscoach
- **Description:** Personlig träningscoach med tillgång till Garmin-data via Formkurvan
- **Instructions:** Klistra in systempromoten ovan

### 4. Lägg till Actions (API-integrationen)

1. Klicka **Add actions** under "Actions"
2. Välj **Import from URL** och ange:
   ```
   https://formguiden.vercel.app/openapi.json
   ```
3. ChatGPT importerar alla endpoints automatiskt

### 5. Konfigurera autentisering

1. Under "Authentication" välj **API Key**
2. **Auth Type:** Bearer
3. **API Key:** Värdet på din `ASSISTANT_API_KEY` miljövariabel

### 6. Spara och testa

1. Klicka **Save**
2. Välj synlighet: **Only me** (rekommenderat för privat data)
3. Testa i chatten: *"Hur ser min träning ut den senaste veckan?"*

---

## Tillgängliga endpoints

| Endpoint | Beskrivning |
|---|---|
| `GET /api/assistant/summary` | Komplett sammanfattning (använd som primär källa) |
| `GET /api/assistant/profile` | Profil, namn, mål |
| `GET /api/assistant/activities?limit=10&offset=0` | Senaste aktiviteter |
| `GET /api/assistant/health?days=7` | Dagliga hälsomätvärden |
| `POST /api/assistant/ask` | Fråga med datakontext |

---

## Felsökning

- **401 Unauthorized:** Kontrollera att `ASSISTANT_API_KEY` i Vercel matchar nyckeln i Custom GPT
- **CORS-fel:** Endpoints tillåter anrop från `https://chatgpt.com` — inget att konfigurera
- **Gammal data:** Endpointerna returnerar mock-data tills Phase 2 (SQL-migrering) är klar
