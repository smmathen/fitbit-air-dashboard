# Fitbit Air · Google Health Dashboard

A React web dashboard for your Fitbit Air data via the Google Health API v4.

## Features

- **Steps** — daily bar chart with 7/14/30 day range
- **Heart Rate** — intraday area chart for today
- **Sleep** — stacked bar (deep / REM / light), sleep score
- **HRV** — daily resting heart rate variability (RMSSD)
- **SpO2** — blood oxygen percentage trend
- **Active Minutes** — daily goal tracking (30 min threshold highlighted)
- **Resting HR** — daily resting heart rate trend

## Setup

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Health API**: APIs & Services → Enable APIs → search "Google Health API"
4. Create OAuth credentials: Credentials → Create Credentials → OAuth Client ID
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:3000` (dev) + your prod domain

### 2. Configure

```bash
cp .env.example .env
# Edit .env and add your client ID
```

`.env`:
```
VITE_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
```

### 3. Install & Run

```bash
npm install
npm run dev
# Open http://localhost:3000
```

### 4. Build for production

```bash
npm run build
# Deploy the dist/ folder to Vercel, Netlify, Cloudflare Pages, etc.
```

## API Reference

- [Google Health API docs](https://developers.google.com/health)
- [Data types reference](https://developers.google.com/health/data-types)
- [Scopes](https://developers.google.com/health/scopes)

## Project Structure

```
src/
  lib/healthApi.js      # OAuth + all API fetch functions
  hooks/useHealthData.js # React hooks for data fetching
  pages/
    LoginPage.jsx        # Google sign-in
    Dashboard.jsx        # Main dashboard with charts
  components/
    StatCard.jsx          # Summary metric cards
  styles.css             # Dark industrial theme
```

## Extending

To add a new data type:
1. Add a fetch function in `lib/healthApi.js` using `apiFetch()`
2. Add it to the `Promise.allSettled` array in `hooks/useHealthData.js`
3. Parse and chart it in `pages/Dashboard.jsx`

Available data types: `steps`, `heart-rate`, `sleep`, `distance`, `calories-in-heart-rate-zone`,
`active-minutes`, `active-zone-minutes`, `daily-heart-rate-variability`, `daily-resting-heart-rate`,
`oxygen-saturation`, `daily-oxygen-saturation`, `respiratory-rate`, `exercise`, `floors`, `sedentary-period`
