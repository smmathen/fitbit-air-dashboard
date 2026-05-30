const STAGE_COLORS = {
  AWAKE: '#f59e0b',
  LIGHT: '#a78bfa',
  DEEP: '#312e81',
  REM: '#7c3aed',
  RESTLESS: '#64748b',
  ASLEEP: '#818cf8',
};

function num(v) {
  return v != null ? Number(v) : 0;
}

function civilDateStr(civilTime) {
  const d = civilTime?.date;
  if (!d) return null;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function formatClock(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function parseDurationSeconds(str) {
  if (!str) return 0;
  const m = String(str).match(/^([\d.]+)s$/);
  return m ? parseFloat(m[1]) : 0;
}

/** Parse raw sleep API response into rich session objects */
export function parseSleepSessions(apiResp) {
  if (!apiResp?.dataPoints) return [];

  return apiResp.dataPoints
    .map((pt, i) => {
      const sleep = pt.sleep;
      if (!sleep) return null;

      const summary = sleep.summary || {};
      const stagesSummary = summary.stagesSummary || [];
      const byType = Object.fromEntries(stagesSummary.map(s => [s.type, num(s.minutes)]));

      const asleep = num(summary.minutesAsleep);
      const inBed = num(summary.minutesInSleepPeriod);
      const awake = num(summary.minutesAwake);
      const efficiency = inBed > 0 ? Math.round((asleep / inBed) * 100) : null;

      const bedTime = sleep.interval?.startTime;
      const wakeTime = sleep.interval?.endTime;
      const dateStr = civilDateStr(sleep.interval?.civilEndTime) || wakeTime?.split('T')[0];

      const stages = (sleep.stages || []).map((stage) => {
        const startMs = new Date(stage.startTime).getTime();
        const endMs = new Date(stage.endTime).getTime();
        return {
          type: stage.type,
          startMs,
          endMs,
          durationMin: Math.max(0, Math.round((endMs - startMs) / 60000)),
          color: STAGE_COLORS[stage.type] || '#64748b',
        };
      });

      return {
        id: pt.name || `sleep-${i}`,
        dateStr,
        label: dateStr,
        bedTime,
        wakeTime,
        bedTimeLabel: formatClock(bedTime),
        wakeTimeLabel: formatClock(wakeTime),
        duration: asleep,
        inBed,
        awake,
        efficiency,
        timeToFallAsleep: num(summary.minutesToFallAsleep),
        afterWake: num(summary.minutesAfterWakeUp),
        deep: byType.DEEP || 0,
        rem: byType.REM || 0,
        light: byType.LIGHT || 0,
        restless: byType.RESTLESS || 0,
        isNap: sleep.metadata?.nap || false,
        isMain: sleep.metadata?.main !== false,
        hasStages: stages.length > 0,
        stages,
      };
    })
    .filter(Boolean)
    .filter(s => s.duration > 0 || s.inBed > 0)
    .sort((a, b) => (a.dateStr || '').localeCompare(b.dateStr || ''));
}

/** Pick the best session to show for a given night (prefer main sleep over naps) */
export function pickNightSession(sessions, dateStr) {
  const night = sessions.filter(s => s.dateStr === dateStr);
  if (!night.length) return null;
  return night.find(s => s.isMain && !s.isNap) || night.find(s => !s.isNap) || night[0];
}

/** Build hypnogram segments as % width for rendering */
export function buildHypnogram(session) {
  if (!session?.stages?.length) return [];
  const start = session.stages[0].startMs;
  const end = session.stages[session.stages.length - 1].endMs;
  const total = end - start;
  if (total <= 0) return [];

  return session.stages.map((stage) => ({
    ...stage,
    leftPct: ((stage.startMs - start) / total) * 100,
    widthPct: ((stage.endMs - stage.startMs) / total) * 100,
    startLabel: formatClock(new Date(stage.startMs).toISOString()),
    endLabel: formatClock(new Date(stage.endMs).toISOString()),
  }));
}

/** Weekly sleep efficiency trend */
export function sleepEfficiencyTrend(sessions) {
  const byDate = new Map();
  for (const s of sessions) {
    if (s.isNap || s.efficiency == null) continue;
    const existing = byDate.get(s.dateStr);
    if (!existing || s.duration > existing.duration) {
      byDate.set(s.dateStr, s);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, s]) => ({
      date: new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      efficiency: s.efficiency,
      duration: s.duration,
    }));
}

export { STAGE_COLORS };
