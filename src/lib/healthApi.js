/**
 * Google Health API client
 * Docs: https://developers.google.com/health
 * Base URL: https://health.googleapis.com/v4/
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Replace with your Google Cloud OAuth 2.0 Client ID
// 1. Go to https://console.cloud.google.com
// 2. Create a project → Enable "Google Health API"
// 3. Credentials → Create OAuth Client ID (Web application)
// 4. Add your domain to Authorized JavaScript origins
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';

// OAuth scopes — restricted; app verification required for production use
export const SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
].join(' ');

const BASE_URL = '/api/health';
const USER = '/users/me';

// Filter field names differ from endpoint data type names — see API docs
const FILTER_NAMES = {
  'heart-rate': 'heart_rate',
  'daily-heart-rate-variability': 'dailyHeartRateVariability',
  'daily-oxygen-saturation': 'dailyOxygenSaturation',
  'daily-resting-heart-rate': 'dailyRestingHeartRate',
  'daily-vo2-max': 'dailyVo2Max',
  sleep: 'sleep',
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────

let tokenClient = null;
let accessToken = null;

/** Initialize the Google Identity Services library */
export function initGoogleAuth() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.access_token) {
            accessToken = resp.access_token;
            localStorage.setItem('gh_token', accessToken);
            localStorage.setItem('gh_token_exp', Date.now() + resp.expires_in * 1000);
          }
        },
      });
      resolve(tokenClient);
    };
    document.head.appendChild(script);
  });
}

/** Prompt the user to sign in / grant permissions */
export function requestAccessToken() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized. Call initGoogleAuth() first.'));
      return;
    }
    tokenClient.callback = (resp) => {
      if (resp.error) { reject(resp); return; }
      accessToken = resp.access_token;
      localStorage.setItem('gh_token', accessToken);
      localStorage.setItem('gh_token_exp', Date.now() + resp.expires_in * 1000);
      resolve(accessToken);
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export function getStoredToken() {
  const token = localStorage.getItem('gh_token');
  const exp = parseInt(localStorage.getItem('gh_token_exp') || '0', 10);
  if (token && Date.now() < exp) return token;
  return null;
}

export function revokeToken() {
  const token = getStoredToken();
  if (token) window.google?.accounts.oauth2.revoke(token);
  localStorage.removeItem('gh_token');
  localStorage.removeItem('gh_token_exp');
  accessToken = null;
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────

function parseIsoDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day };
}

function nextDay(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

function civilRangeBody(startDate, endDate) {
  return {
    range: {
      start: {
        date: parseIsoDate(startDate),
        time: { hours: 0, minutes: 0, seconds: 0, nanos: 0 },
      },
      end: {
        date: parseIsoDate(endDate),
        time: { hours: 23, minutes: 59, seconds: 59, nanos: 0 },
      },
    },
    windowSizeDays: 1,
  };
}

async function apiRequest(method, path, { params, body } = {}) {
  const token = accessToken || getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, v);
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  const init = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }
  return res.json();
}

function apiGet(path, params) {
  return apiRequest('GET', path, { params });
}

function apiPost(path, body) {
  return apiRequest('POST', path, { body });
}

// ─── DATA FETCHERS ────────────────────────────────────────────────────────────

/**
 * Fetch daily rollup for a data type over a date range
 * @param {string} dataType  e.g. 'steps', 'distance', 'active-minutes'
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate   YYYY-MM-DD
 */
export async function fetchDailyRollup(dataType, startDate, endDate) {
  return apiPost(
    `${USER}/dataTypes/${dataType}/dataPoints:dailyRollUp`,
    civilRangeBody(startDate, endDate),
  );
}

/**
 * List raw data points for a data type with a time filter (single page)
 * @param {string} dataType
 * @param {string} filter  AIP-160 filter expression
 * @param {number} pageSize
 * @param {string} [pageToken]
 */
export async function fetchDataPoints(dataType, filter, pageSize = 500, pageToken) {
  const params = { filter, pageSize };
  if (pageToken) params.pageToken = pageToken;
  return apiGet(`${USER}/dataTypes/${dataType}/dataPoints`, params);
}

/** Safety cap: 40 pages × 25 = 1000 sessions max per query */
const MAX_SESSION_PAGES = 40;

/**
 * Fetch all pages for session/list endpoints (sleep & exercise cap at 25/page)
 * @returns {{ dataPoints: object[] }}
 */
async function fetchAllDataPoints(dataType, filter, pageSize = 25) {
  const dataPoints = [];
  let pageToken;
  let pages = 0;

  do {
    const page = await fetchDataPoints(dataType, filter, pageSize, pageToken);
    if (page?.dataPoints?.length) dataPoints.push(...page.dataPoints);
    pageToken = page?.nextPageToken;
    pages += 1;
  } while (pageToken && pages < MAX_SESSION_PAGES);

  return { dataPoints };
}

function dailySummaryFilter(dataType, startDate, endDate) {
  const name = FILTER_NAMES[dataType];
  const end = nextDay(endDate);
  return `${name}.date >= "${startDate}" AND ${name}.date < "${end}"`;
}

/** Fetch all sleep sessions in range (paginated, 25 per API page) */
export async function fetchSleep(startDate, endDate) {
  const end = nextDay(endDate);
  const filter = `sleep.interval.civil_end_time >= "${startDate}" AND sleep.interval.civil_end_time < "${end}"`;
  return fetchAllDataPoints('sleep', filter, 25);
}

/** Fetch all exercise / workout sessions in range (paginated, 25 per API page) */
export async function fetchExercise(startDate, endDate) {
  const end = nextDay(endDate);
  const filter = `exercise.interval.civil_start_time >= "${startDate}" AND exercise.interval.civil_start_time < "${end}"`;
  return fetchAllDataPoints('exercise', filter, 25);
}

/** Fetch heart rate data (intraday) */
export async function fetchHeartRate(startTime, endTime) {
  const filter = `heart_rate.sample_time.physical_time >= "${startTime}" AND heart_rate.sample_time.physical_time < "${endTime}"`;
  return apiGet(`${USER}/dataTypes/heart-rate/dataPoints`, { filter, pageSize: 1440 });
}

/** Fetch daily HRV */
export async function fetchHRV(startDate, endDate) {
  return fetchDataPoints(
    'daily-heart-rate-variability',
    dailySummaryFilter('daily-heart-rate-variability', startDate, endDate),
  );
}

/** Fetch SpO2 */
export async function fetchSpO2(startDate, endDate) {
  return fetchDataPoints(
    'daily-oxygen-saturation',
    dailySummaryFilter('daily-oxygen-saturation', startDate, endDate),
  );
}

/** Fetch resting heart rate */
export async function fetchRestingHR(startDate, endDate) {
  return fetchDataPoints(
    'daily-resting-heart-rate',
    dailySummaryFilter('daily-resting-heart-rate', startDate, endDate),
  );
}

/** Fetch daily active zone minutes rollup */
export async function fetchActiveZoneMinutes(startDate, endDate) {
  return fetchDailyRollup('active-zone-minutes', startDate, endDate);
}

/** Fetch daily sedentary time rollup */
export async function fetchSedentaryTime(startDate, endDate) {
  return fetchDailyRollup('sedentary-period', startDate, endDate);
}

/** Fetch daily VO2 max (cardio fitness) */
export async function fetchVo2Max(startDate, endDate) {
  return fetchDataPoints(
    'daily-vo2-max',
    dailySummaryFilter('daily-vo2-max', startDate, endDate),
  );
}

/** Fetch user profile */
export async function fetchProfile() {
  return apiGet(`${USER}/profile`);
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
