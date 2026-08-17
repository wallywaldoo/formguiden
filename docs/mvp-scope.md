# MVP scope

This document defines what Formkurvan will and will not ship in the private MVP (Phases 1–5). It does not authorize implementation beyond the current approved phase.

## 1. Private MVP definition

The MVP is a **single-tenant-feeling multi-user web app**: many isolated accounts, one product, no social graph.

It is **not** production-ready for external users until the owner approves the operational plan in Phase 5.

## 2. In scope by area

### Authentication and onboarding

- Sign up with email and password
- Email verification (PKCE)
- Sign in
- Sign out
- Password reset
- Protected application routes via Next.js `proxy.ts`
- Profile: display name, timezone, unit preferences
- Privacy acknowledgement before health data is stored
- Goal onboarding with derived target pace

### User goals

Configurable:

- Target race type (half marathon default; also 5k, 10k, marathon, custom distance)
- Target race date
- Target finish time
- Target pace (calculated, then editable)
- Target body weight
- Weekly running target (distance and/or duration)
- Weekly strength-training target (sessions and/or duration)

### Dashboard

- Today's status
- One primary recommended action
- Recent running volume
- Recovery overview
- Goal progress
- Data completeness
- 7-, 28-, and 90-day trends
- Recent imports
- Quick actions for food, hydration, weight, and strength logging

### Running

When present in an import or manual note:

- Activity type, start time, duration, distance, pace
- Heart rate, cadence, elevation, calories
- Splits and laps
- Training load or perceived effort
- Personal notes

Missing fields remain null. The UI never fabricates them.

### Recovery and health

When present:

- Sleep duration, consistency, stages
- HRV, resting heart rate, stress, Body Battery
- Steps, respiration, blood pressure

Do not assume every Garmin device or export contains every metric.

### Body metrics

- Weight, target weight, body-fat percentage, waist, blood pressure, notes
- Manual entry in MVP; Garmin-derived weight if present in a supported file

### Nutrition and hydration

- Plain-language food description, meal type, time
- Optional calories and macros
- Optional “Estimate with AI” after provider approval
- Hydration: volume, beverage type, time, optional caffeine, notes

### Strength training

- Session date, duration, perceived effort, notes
- Exercises with sets, repetitions, weight, RPE

### Recommendations

- Deterministic, testable rules
- Each recommendation shows action, triggering signals, comparison period, data completeness, confidence, and safety disclaimer
- No causation claims, diagnoses, or medical prescriptions

### Data rights

- Import history and audit trail
- User data export
- Account deletion

## 3. Out of scope for the MVP

| Item                                              | Reason                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| Garmin OAuth / official API                       | Business-only developer program; owner has no company |
| Unofficial Garmin libraries or scraping           | Security, ToS, and product integrity                  |
| Food photos                                       | Explicitly deferred                                   |
| Paid AI provider                                  | Requires cost approval                                |
| Paid queue / Nhost Run / custom domain / Pro plan | Requires cost approval                                |
| Other wearables as first-class sources            | Adapter interface only                                |
| Live GPS tracking                                 | File import and manual logs only                      |
| Social, sharing, coaches viewing athletes         | Isolation requirement                                 |
| Native mobile apps                                | Web first                                             |
| Dark-mode clone of Apple Fitness+ branding        | Inspiration, not copying                              |
| Automated Nhost backups                           | Not included on Starter; manual `pg_dump` in MVP      |

## 4. Phase boundaries

| Phase | Ships                                                                                                                  | Does not ship                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 0     | These documents                                                                                                        | Application code                                         |
| 1     | Next.js, shadcn.io, Nhost Auth, Hasura ownership rules, Storage foundation, onboarding, profile, goals, Vercel preview | Import parsing, dashboards, AI                           |
| 2     | Private upload, FIT/TCX/GPX/CSV/ZIP, preview, duplicates, history                                                      | Trend dashboards                                         |
| 3     | Running, recovery, body, goals, trends                                                                                 | Nutrition AI, recommendations engine UI completeness     |
| 4     | Nutrition, hydration, optional AI (if approved), strength                                                              | Weekly reports, account deletion polish                  |
| 5     | Recommendations, weekly reports, export, deletion, hardening                                                           | External user launch unless operational plan is approved |

## 5. Reference-user happy path (MVP)

1. Sign up and verify email.
2. Acknowledge privacy text.
3. Set timezone `Europe/Stockholm`, metric units.
4. Set half marathon on a chosen date, 1:30 finish, see 4:16 min/km.
5. Set target weight and weekly running/strength targets.
6. Export a few activities from Garmin Connect as FIT (and optionally a small ZIP).
7. Upload, preview, confirm.
8. See today's status, volume, and goal-pace gap.
9. Log breakfast in plain language; optionally estimate macros later if a provider is approved.
10. Log a strength session.
11. Read one explainable recommendation with a disclaimer.

## 6. Quality bar for “done” in a phase

Every phase must include:

- Loading, empty, success, and error states for new screens
- Validation of all external input
- No silent mocks replacing real behaviour
- Sample data clearly labelled if used
- Formatting, lint, TypeScript check, tests, and production build at phase end
- No secrets in code, logs, screenshots, or commits

## 7. What “production-ready” does **not** mean yet

The phrase in the original brief describes the intended engineering quality of the architecture. It does **not** authorize:

- Claiming the Starter project is resilient
- Onboarding people who are not the owner
- Skipping backup/restore tests
- Enabling billable Nhost resources
