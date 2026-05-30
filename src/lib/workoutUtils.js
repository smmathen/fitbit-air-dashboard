const TYPE_LABELS = {
  RUNNING: 'Running',
  WALKING: 'Walking',
  BIKING: 'Biking',
  SWIMMING: 'Swimming',
  HIKING: 'Hiking',
  YOGA: 'Yoga',
  PILATES: 'Pilates',
  WORKOUT: 'Workout',
  HIIT: 'HIIT',
  WEIGHTLIFTING: 'Weightlifting',
  STRENGTH_TRAINING: 'Strength Training',
  OTHER: 'Other',
};

const TYPE_ICONS = {
  RUNNING: '🏃',
  WALKING: '🚶',
  BIKING: '🚴',
  SWIMMING: '🏊',
  HIKING: '🥾',
  YOGA: '🧘',
  PILATES: '🧘',
  HIIT: '🔥',
  WEIGHTLIFTING: '🏋️',
  STRENGTH_TRAINING: '🏋️',
  WORKOUT: '💪',
  OTHER: '⚡',
};

function num(v) {
  return v != null ? Number(v) : null;
}

function parseDurationSeconds(str) {
  if (!str) return 0;
  const m = String(str).match(/^([\d.]+)s$/);
  return m ? parseFloat(m[1]) : 0;
}

function formatDurationMin(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDistanceKm(mm) {
  if (mm == null || mm <= 0) return null;
  const km = mm / 1_000_000;
  return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(mm / 1000)} m`;
}

/** Parse exercise API response into workout objects */
export function parseWorkouts(apiResp) {
  if (!apiResp?.dataPoints) return [];

  return apiResp.dataPoints
    .map((pt, i) => {
      const ex = pt.exercise;
      if (!ex) return null;

      const metrics = ex.metricsSummary || {};
      const type = ex.exerciseType || 'OTHER';
      const startTime = ex.interval?.startTime;
      const endTime = ex.interval?.endTime;
      const dateStr = startTime?.split('T')[0];
      const durationSec = parseDurationSeconds(ex.activeDuration)
        || (startTime && endTime
          ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
          : 0);

      return {
        id: pt.name || `workout-${i}`,
        name: ex.displayName || TYPE_LABELS[type] || 'Workout',
        type,
        typeLabel: TYPE_LABELS[type] || type.replace(/_/g, ' '),
        icon: TYPE_ICONS[type] || '💪',
        startTime,
        endTime,
        dateStr,
        dateLabel: startTime
          ? new Date(startTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : '—',
        timeLabel: startTime
          ? new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          : '—',
        durationMin: Math.round(durationSec / 60),
        durationLabel: formatDurationMin(durationSec / 60),
        calories: num(metrics.caloriesKcal),
        distanceMm: num(metrics.distanceMillimeters),
        distanceLabel: formatDistanceKm(num(metrics.distanceMillimeters)),
        avgHR: num(metrics.averageHeartRateBeatsPerMinute),
        steps: num(metrics.steps),
        elevationM: metrics.elevationGainMillimeters != null
          ? Math.round(metrics.elevationGainMillimeters / 1000)
          : null,
        activeZoneMin: num(metrics.activeZoneMinutes),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
}

/** Aggregate stats for the workout list header */
export function workoutSummary(workouts) {
  return workouts.reduce(
    (acc, w) => ({
      count: acc.count + 1,
      durationMin: acc.durationMin + (w.durationMin || 0),
      calories: acc.calories + (w.calories || 0),
      distanceKm: acc.distanceKm + (w.distanceMm ? w.distanceMm / 1_000_000 : 0),
      activeZoneMin: acc.activeZoneMin + (w.activeZoneMin || 0),
    }),
    { count: 0, durationMin: 0, calories: 0, distanceKm: 0, activeZoneMin: 0 },
  );
}

export { formatDurationMin };
