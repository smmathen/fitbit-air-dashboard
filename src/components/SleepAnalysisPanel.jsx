import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDuration } from '../lib/healthApi';
import {
  parseSleepSessions,
  pickNightSession,
  buildHypnogram,
  sleepEfficiencyTrend,
  STAGE_COLORS,
} from '../lib/sleepUtils';

function EmptyState({ message = 'No sleep data for this period' }) {
  return <div className="empty-state">{message}</div>;
}

function StageLegend() {
  const stages = ['DEEP', 'REM', 'LIGHT', 'AWAKE'];
  return (
    <div className="stage-legend">
      {stages.map(type => (
        <span key={type} className="legend-item">
          <span className="legend-swatch" style={{ background: STAGE_COLORS[type] }} />
          {type.charAt(0) + type.slice(1).toLowerCase()}
        </span>
      ))}
    </div>
  );
}

function Hypnogram({ session }) {
  const segments = buildHypnogram(session);
  if (!segments.length) return <EmptyState message="No stage data for this night" />;

  return (
    <div className="hypnogram">
      <div className="hypnogram-track">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="hypnogram-seg"
            style={{
              left: `${seg.leftPct}%`,
              width: `${Math.max(seg.widthPct, 0.3)}%`,
              background: seg.color,
            }}
            title={`${seg.type}: ${seg.durationMin} min (${seg.startLabel} – ${seg.endLabel})`}
          />
        ))}
      </div>
      <div className="hypnogram-axis">
        <span>{session.bedTimeLabel}</span>
        <span>{session.wakeTimeLabel}</span>
      </div>
      <StageLegend />
    </div>
  );
}

function StageBreakdown({ session }) {
  const total = session.deep + session.rem + session.light + session.awake;
  if (total <= 0) return null;

  const rows = [
    { label: 'Deep', min: session.deep, color: STAGE_COLORS.DEEP },
    { label: 'REM', min: session.rem, color: STAGE_COLORS.REM },
    { label: 'Light', min: session.light, color: STAGE_COLORS.LIGHT },
    { label: 'Awake', min: session.awake, color: STAGE_COLORS.AWAKE },
  ].filter(r => r.min > 0);

  return (
    <div className="stage-breakdown">
      {rows.map(row => (
        <div key={row.label} className="stage-row">
          <span className="stage-row-label">{row.label}</span>
          <div className="stage-row-bar">
            <div
              className="stage-row-fill"
              style={{ width: `${(row.min / total) * 100}%`, background: row.color }}
            />
          </div>
          <span className="stage-row-val">{formatDuration(row.min)}</span>
          <span className="stage-row-pct">{Math.round((row.min / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function SleepAnalysisPanel({ sleepRaw }) {
  const sessions = useMemo(() => parseSleepSessions(sleepRaw), [sleepRaw]);
  const nights = useMemo(() => {
    const dates = [...new Set(sessions.filter(s => !s.isNap).map(s => s.dateStr))].sort().reverse();
    return dates;
  }, [sessions]);

  const [selectedNight, setSelectedNight] = useState(null);
  const activeNight = selectedNight || nights[0] || null;
  const session = useMemo(
    () => (activeNight ? pickNightSession(sessions, activeNight) : null),
    [sessions, activeNight],
  );
  const trend = useMemo(() => sleepEfficiencyTrend(sessions), [sessions]);

  if (!sessions.length) return <EmptyState />;

  return (
    <div className="sleep-panel">
      <div className="panel-toolbar">
        <div className="night-tabs">
          {nights.slice(0, 14).map(date => (
            <button
              key={date}
              className={activeNight === date ? 'active' : ''}
              onClick={() => setSelectedNight(date)}
            >
              {new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </button>
          ))}
        </div>
      </div>

      {session && (
        <>
          <section className="sleep-stats-row">
            <div className="sleep-stat">
              <span className="sleep-stat-label">Asleep</span>
              <span className="sleep-stat-value">{formatDuration(session.duration)}</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat-label">In bed</span>
              <span className="sleep-stat-value">{formatDuration(session.inBed)}</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat-label">Efficiency</span>
              <span className="sleep-stat-value">{session.efficiency != null ? `${session.efficiency}%` : '—'}</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat-label">Bedtime</span>
              <span className="sleep-stat-value">{session.bedTimeLabel}</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat-label">Wake</span>
              <span className="sleep-stat-value">{session.wakeTimeLabel}</span>
            </div>
            <div className="sleep-stat">
              <span className="sleep-stat-label">Fell asleep</span>
              <span className="sleep-stat-value">{session.timeToFallAsleep ? `${session.timeToFallAsleep}m` : '—'}</span>
            </div>
          </section>

          <section className="chart-card wide">
            <h2>Sleep Stages — {activeNight}</h2>
            <Hypnogram session={session} />
          </section>

          <section className="chart-card half">
            <h2>Stage Breakdown</h2>
            <StageBreakdown session={session} />
          </section>

          <section className="chart-card half">
            <h2>Sleep Efficiency Trend</h2>
            {trend.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={40} domain={[60, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Efficiency']} contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
                  <Line type="monotone" dataKey="efficiency" name="Efficiency" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState message="Need more nights for trend" />}
          </section>
        </>
      )}
    </div>
  );
}
