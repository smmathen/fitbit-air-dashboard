import { parseSleepSessions } from './sleepUtils';
import { parseWorkouts } from './workoutUtils';

function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function civilDateStr(civilTime) {
  const d = civilTime?.date;
  if (!d) return null;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function dateFromPayload(payload) {
  const d = payload?.date;
  if (!d) return null;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function parseRollupMap(apiResp, field) {
  const map = new Map();
  if (!apiResp?.rollupDataPoints) return map;
  for (const pt of apiResp.rollupDataPoints) {
    const dateStr = civilDateStr(pt.civilStartTime);
    const payload = pt[field] || Object.values(pt).find(v => v && typeof v === 'object' && !v.date);
    const value = Number(payload?.countSum ?? payload?.minutesSum ?? payload?.average ?? payload?.distanceSum);
    if (dateStr && !Number.isNaN(value)) map.set(dateStr, value);
  }
  return map;
}

function parseDailySummaryMap(apiResp, field) {
  const map = new Map();
  if (!apiResp?.dataPoints) return map;
  for (const pt of apiResp.dataPoints) {
    const payload = pt[field] || pt[Object.keys(pt).find(k => !['name', 'dataSource'].includes(k))];
    if (!payload) continue;
    const dateStr = dateFromPayload(payload);
    const value = Number(
      payload.averageHeartRateVariabilityMilliseconds
      ?? payload.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds
      ?? payload.beatsPerMinute
      ?? payload.rmssd,
    );
    if (dateStr && !Number.isNaN(value)) map.set(dateStr, value);
  }
  return map;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function median(arr) {
  const sorted = arr.filter(v => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(arr) {
  const valid = arr.filter(v => v != null && !Number.isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function scoreSleep(session) {
  if (!session) return null;
  const hours = session.duration / 60;
  let durScore = 100;
  if (hours < 5) durScore = 35;
  else if (hours < 6) durScore = 55;
  else if (hours < 7) durScore = 75;
  else if (hours > 9.5) durScore = 80;

  const effScore = session.efficiency ?? 70;
  const restorative = session.duration > 0
    ? ((session.deep + session.rem) / session.duration) * 100
    : 0;
  const restScore = clamp(restorative * 2.5, 0, 100);
  return Math.round(durScore * 0.4 + effScore * 0.35 + restScore * 0.25);
}

function scoreHrv(value, baseline) {
  if (value == null || baseline == null || baseline <= 0) return null;
  return clamp(Math.round((value / baseline) * 100), 0, 100);
}

function scoreRhr(value, baseline) {
  if (value == null || baseline == null) return null;
  return clamp(Math.round(75 + (baseline - value) * 4), 0, 100);
}

function workoutLoadForDate(workouts, dateStr) {
  return workouts
    .filter(w => w.dateStr === dateStr)
    .reduce((sum, w) => sum + (w.durationMin || 0) + (w.activeZoneMin || 0) * 2 + (w.calories || 0) / 15, 0);
}

function scoreRecovery(load, maxLoad) {
  if (load <= 0) return 95;
  if (maxLoad <= 0) return 80;
  return clamp(Math.round(100 - (load / maxLoad) * 75), 15, 100);
}

function weightedReadiness(scores) {
  const parts = [
    { v: scores.sleepScore, w: 0.35 },
    { v: scores.hrvScore, w: 0.25 },
    { v: scores.rhrScore, w: 0.20 },
    { v: scores.recoveryScore, w: 0.20 },
  ].filter(p => p.v != null);

  if (!parts.length) return null;
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  return Math.round(parts.reduce((s, p) => s + p.v * (p.w / totalW), 0));
}

/** Build readiness scores, correlations, and period comparisons from raw API data */
export function buildInsights(rawData) {
  const sessions = parseSleepSessions(rawData?.sleep);
  const workouts = parseWorkouts(rawData?.exercise);
  const hrvMap = parseDailySummaryMap(rawData?.hrv, 'dailyHeartRateVariability');
  const rhrMap = parseDailySummaryMap(rawData?.rhr, 'dailyRestingHeartRate');
  const stepsMap = parseRollupMap(rawData?.steps, 'steps');
  const activeMap = parseRollupMap(rawData?.activeMinutes, 'activeMinutes');

  const sleepByDate = new Map();
  for (const s of sessions) {
    if (s.isNap) continue;
    const existing = sleepByDate.get(s.dateStr);
    if (!existing || s.duration > existing.duration) sleepByDate.set(s.dateStr, s);
  }

  const dates = [...new Set([
    ...sleepByDate.keys(),
    ...hrvMap.keys(),
    ...rhrMap.keys(),
  ])].sort();

  const hrvBaseline = median([...hrvMap.values()]);
  const rhrBaseline = median([...rhrMap.values()]);
  const maxLoad = Math.max(1, ...dates.map(d => workoutLoadForDate(workouts, addDays(d, -1))));

  const daily = dates.map((dateStr) => {
    const sleep = sleepByDate.get(dateStr);
    const prevDate = addDays(dateStr, -1);
    const prevLoad = workoutLoadForDate(workouts, prevDate);

    const sleepScore = scoreSleep(sleep);
    const hrvScore = scoreHrv(hrvMap.get(dateStr), hrvBaseline);
    const rhrScore = scoreRhr(rhrMap.get(dateStr), rhrBaseline);
    const recoveryScore = scoreRecovery(prevLoad, maxLoad);
    const readiness = weightedReadiness({ sleepScore, hrvScore, rhrScore, recoveryScore });

    return {
      dateStr,
      dateLabel: new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      readiness,
      sleepScore,
      hrvScore,
      rhrScore,
      recoveryScore,
      hrv: hrvMap.get(dateStr) ?? null,
      rhr: rhrMap.get(dateStr) ?? null,
      sleepMin: sleep?.duration ?? null,
      sleepEfficiency: sleep?.efficiency ?? null,
      deepRemPct: sleep?.duration
        ? Math.round(((sleep.deep + sleep.rem) / sleep.duration) * 100)
        : null,
      prevWorkoutLoad: prevLoad,
      hadWorkoutYesterday: prevLoad > 15,
    };
  });

  const correlationRows = [...sleepByDate.entries()].map(([dateStr, sleep]) => {
    const prevDate = addDays(dateStr, -1);
    const load = workoutLoadForDate(workouts, prevDate);
    return {
      dateStr,
      hadWorkout: load > 15,
      sleepMin: sleep.duration,
      efficiency: sleep.efficiency,
      deepRem: sleep.duration ? ((sleep.deep + sleep.rem) / sleep.duration) * 100 : null,
      hrv: hrvMap.get(dateStr) ?? null,
    };
  });

  const afterWorkout = correlationRows.filter(r => r.hadWorkout);
  const restDays = correlationRows.filter(r => !r.hadWorkout);

  const correlation = {
    afterWorkout: {
      count: afterWorkout.length,
      avgSleep: avg(afterWorkout.map(r => r.sleepMin)),
      avgEfficiency: avg(afterWorkout.map(r => r.efficiency)),
      avgDeepRem: avg(afterWorkout.map(r => r.deepRem)),
      avgHrv: avg(afterWorkout.map(r => r.hrv)),
    },
    restDays: {
      count: restDays.length,
      avgSleep: avg(restDays.map(r => r.sleepMin)),
      avgEfficiency: avg(restDays.map(r => r.efficiency)),
      avgDeepRem: avg(restDays.map(r => r.deepRem)),
      avgHrv: avg(restDays.map(r => r.hrv)),
    },
  };

  const mid = Math.floor(daily.length / 2);
  const priorHalf = daily.slice(0, mid);
  const recentHalf = daily.slice(mid);

  const wow = {
    priorLabel: priorHalf.length
      ? `${priorHalf[0].dateLabel} – ${priorHalf[priorHalf.length - 1].dateLabel}`
      : '',
    recentLabel: recentHalf.length
      ? `${recentHalf[0].dateLabel} – ${recentHalf[recentHalf.length - 1].dateLabel}`
      : '',
    metrics: [
      { key: 'readiness', label: 'Readiness', prior: avg(priorHalf.map(d => d.readiness)), recent: avg(recentHalf.map(d => d.readiness)), unit: '', higherBetter: true },
      { key: 'sleepMin', label: 'Sleep', prior: avg(priorHalf.map(d => d.sleepMin)), recent: avg(recentHalf.map(d => d.sleepMin)), unit: 'min', higherBetter: true, format: v => `${Math.floor(v / 60)}h ${Math.round(v % 60)}m` },
      { key: 'hrv', label: 'HRV', prior: avg(priorHalf.map(d => d.hrv)), recent: avg(recentHalf.map(d => d.hrv)), unit: 'ms', higherBetter: true },
      { key: 'rhr', label: 'Resting HR', prior: avg(priorHalf.map(d => d.rhr)), recent: avg(recentHalf.map(d => d.rhr)), unit: 'bpm', higherBetter: false },
      { key: 'steps', label: 'Steps', prior: avg([...stepsMap.entries()].filter(([d]) => priorHalf.some(p => p.dateStr === d)).map(([, v]) => v)), recent: avg([...stepsMap.entries()].filter(([d]) => recentHalf.some(p => p.dateStr === d)).map(([, v]) => v)), unit: '', higherBetter: true, format: v => Math.round(v).toLocaleString() },
      { key: 'activeMin', label: 'Active min', prior: avg([...activeMap.entries()].filter(([d]) => priorHalf.some(p => p.dateStr === d)).map(([, v]) => v)), recent: avg([...activeMap.entries()].filter(([d]) => recentHalf.some(p => p.dateStr === d)).map(([, v]) => v)), unit: 'min', higherBetter: true },
    ].filter(m => m.prior != null && m.recent != null),
  };

  const workoutSleepPairs = correlationRows
    .filter(r => r.hadWorkout)
    .slice(-8)
    .reverse()
    .map((r) => {
      const prevDate = addDays(r.dateStr, -1);
      const dayWorkouts = workouts.filter(w => w.dateStr === prevDate);
      return {
        dateLabel: new Date(`${r.dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        workouts: dayWorkouts.length
          ? dayWorkouts.map(w => `${w.icon} ${w.name} (${w.durationLabel})`).join(' · ')
          : 'Workout',
        sleepMin: r.sleepMin,
        efficiency: r.efficiency,
        hrv: r.hrv,
      };
    });

  const insightText = buildInsightText(correlation);

  return {
    today: daily[daily.length - 1] ?? null,
    daily: daily.filter(d => d.readiness != null),
    correlation,
    insightText,
    wow,
    workoutSleepPairs,
    hrvBaseline,
    rhrBaseline,
  };
}

function buildInsightText(correlation) {
  const { afterWorkout, restDays } = correlation;
  if (afterWorkout.count < 2 || restDays.count < 2) {
    return 'Need more nights with and without prior-day workouts to surface patterns. Keep syncing data over the next week.';
  }

  const parts = [];
  const hrvDelta = afterWorkout.avgHrv != null && restDays.avgHrv != null
    ? afterWorkout.avgHrv - restDays.avgHrv
    : null;
  const sleepDelta = afterWorkout.avgSleep != null && restDays.avgSleep != null
    ? afterWorkout.avgSleep - restDays.avgSleep
    : null;
  const effDelta = afterWorkout.avgEfficiency != null && restDays.avgEfficiency != null
    ? afterWorkout.avgEfficiency - restDays.avgEfficiency
    : null;

  if (hrvDelta != null) {
    if (hrvDelta < -3) parts.push(`HRV runs ${Math.abs(Math.round(hrvDelta))} ms lower after workout days — prioritize recovery.`);
    else if (hrvDelta > 3) parts.push(`HRV is ${Math.round(hrvDelta)} ms higher after workout days — your body may respond well to training load.`);
  }
  if (sleepDelta != null) {
    if (sleepDelta < -15) parts.push(`You sleep ~${Math.abs(Math.round(sleepDelta))} min less following workouts.`);
    else if (sleepDelta > 15) parts.push(`You sleep ~${Math.round(sleepDelta)} min more following workouts.`);
  }
  if (effDelta != null && Math.abs(effDelta) >= 3) {
    parts.push(`Sleep efficiency is ${effDelta > 0 ? 'higher' : 'lower'} by ${Math.abs(Math.round(effDelta))}% after workout days.`);
  }

  return parts.length ? parts.join(' ') : 'No strong workout-to-sleep patterns detected in this period — that can be a good sign of balanced recovery.';
}

export function readinessLabel(score) {
  if (score == null) return { label: 'No data', color: '#64748b' };
  if (score >= 85) return { label: 'Optimal', color: '#10b981' };
  if (score >= 70) return { label: 'Good', color: '#3b82f6' };
  if (score >= 55) return { label: 'Moderate', color: '#f59e0b' };
  return { label: 'Recovery needed', color: '#ef4444' };
}

export function pctChange(prior, recent, higherBetter = true) {
  if (prior == null || recent == null || prior === 0) return null;
  const raw = ((recent - prior) / prior) * 100;
  const improved = higherBetter ? raw > 0 : raw < 0;
  return { pct: Math.round(raw), improved };
}
