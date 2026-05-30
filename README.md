# Fitbit Air · Google Health Dashboard

A local React dashboard for **your own** Fitbit Air data via the [Google Health API v4](https://developers.google.com/health). Clone the repo, add your OAuth credentials, and sign in — each developer sees only their own health data in the browser.

## Features

- **Overview** — steps, distance, heart rate, sleep, HRV, SpO2, active minutes, HR zone calories, active zone minutes, VO2 max, sedentary time
- **Insights** — readiness score, workout → sleep correlation, period comparison
- **Sleep** — hypnogram, stage breakdown, efficiency trend (paginated — full history beyond 25 nights)
- **Workouts** — exercise log with duration, calories, distance, avg HR, active zone minutes (paginated)

Date ranges: 7 / 14 / 30 days.

## Setup for developers

This project is meant to run **locally only**. There is no shared backend or multi-user server — OAuth tokens stay in your browser.

### 1. Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the **Google Health API**
3. Configure the **OAuth consent screen** (add yourself as a test user if the app is unverified)
4. Create an **OAuth Client ID** (Web application)
   - Authorized JavaScript origins: `http://localhost:3000`
5. Copy the client ID (ends in `.apps.googleusercontent.com`)

See [Google Health setup](https://developers.google.com/health/setup) for details.

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` and set your client ID:

```
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

**Security notes:**

- Never commit `.env` (already in `.gitignore`)
- Only put the **public client ID** in `.env` — not a client secret
- Never use `VITE_` for secrets; Vite embeds those in the frontend bundle

### 3. Install and run

One terminal:

```bash
npm install
npm run dev
# Open http://localhost:3000
```

There is **no separate backend**. API calls go through Vite's dev proxy (`/api/health` → `https://health.googleapis.com/v4`) to avoid browser CORS. OAuth and all fetch logic live in the frontend (`src/lib/healthApi.js`).

For a production-style local test after building:

```bash
npm run build
npm run preview
```

`npm run preview` also uses the Vite proxy — static hosting of `dist/` alone will not reach the Health API without adding your own proxy.

Sign in with Google, grant the requested read-only health scopes, and your dashboard will load your synced Fitbit data.

### Troubleshooting

| Issue | Fix |
|-------|-----|
| 403 insufficient scopes | Sign out, revoke access at [Google Account permissions](https://myaccount.google.com/permissions), sign in again |
| Empty charts | Ensure Fitbit has synced to the Fitbit app recently; click ↻ refresh on the dashboard |
| CORS / network errors | Restart `npm run dev` — confirm the Vite dev server is running on port 3000 |
| No data after proxy change | Hard refresh; sign out and back in if the OAuth token expired |

## API reference

- [Google Health API docs](https://developers.google.com/health)
- [Data types](https://developers.google.com/health/data-types)
- [OAuth scopes](https://developers.google.com/health/scopes)

## Project structure

```
vite.config.js            # Dev/preview proxy → health.googleapis.com/v4
src/lib/healthApi.js      # OAuth, pagination, API fetchers
src/hooks/useHealthData.js
src/pages/                # Login, Dashboard (Overview / Insights / Sleep / Workouts)
src/components/
src/lib/                  # insightsUtils, sleepUtils, workoutUtils
```

Local IDE folders (`.cursor/`, `.agents/`) are gitignored — personal Cursor/agent config stays on your machine.

## Extending

To add a data type:

1. Add a fetch function in `src/lib/healthApi.js`
2. Wire it in `src/hooks/useHealthData.js`
3. Parse and chart it in the relevant page or component

For session types (`sleep`, `exercise`) use pagination — the API returns max 25 per page; see `fetchAllDataPoints()` in `healthApi.js`.

Available data types include: `steps`, `heart-rate`, `sleep`, `distance`, `active-minutes`, `active-zone-minutes`, `daily-vo2-max`, `sedentary-period`, `exercise`, `daily-heart-rate-variability`, `daily-resting-heart-rate`, `daily-oxygen-saturation`, and more — see the [data types reference](https://developers.google.com/health/data-types).
