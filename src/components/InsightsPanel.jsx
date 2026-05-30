import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { buildInsights, readinessLabel, pctChange } from '../lib/insightsUtils';
import { formatDuration } from '../lib/healthApi';

function EmptyState({ message = 'Not enough data yet — sync your Fitbit and check back.' }) {
  return <div className="empty-state">{message}</div>;
}

function ReadinessRing({ score, color }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="readiness-ring">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="readiness-ring-label">
        <span className="readiness-score" style={{ color }}>{score}</span>
        <span className="readiness-unit">/ 100</span>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, color }) {
  if (score == null) return null;
  return (
    <div className="score-bar-row">
      <span className="score-bar-label">{label}</span>
      <div className="score-bar-track">
        <div className="score-bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="score-bar-val">{score}</span>
    </div>
  );
}

function CorrelationChart({ correlation }) {
  const { afterWorkout, restDays } = correlation;
  if (afterWorkout.count < 1 || restDays.count < 1) {
    return <EmptyState message="Need both workout and rest nights to compare" />;
  }

  const data = [
    {
      metric: 'Sleep (min)',
      'After workout': Math.round(afterWorkout.avgSleep || 0),
      'Rest day': Math.round(restDays.avgSleep || 0),
    },
    {
      metric: 'Efficiency %',
      'After workout': Math.round(afterWorkout.avgEfficiency || 0),
      'Rest day': Math.round(restDays.avgEfficiency || 0),
    },
    {
      metric: 'Deep+REM %',
      'After workout': Math.round(afterWorkout.avgDeepRem || 0),
      'Rest day': Math.round(restDays.avgDeepRem || 0),
    },
    {
      metric: 'HRV (ms)',
      'After workout': Math.round(afterWorkout.avgHrv || 0),
      'Rest day': Math.round(restDays.avgHrv || 0),
    },
  ].filter(d => d['After workout'] > 0 || d['Rest day'] > 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={4} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="metric" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={36} />
        <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="After workout" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Rest day" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function WowTable({ wow }) {
  if (!wow.metrics.length) return <EmptyState message="Select 14d or 30d range for period comparison" />;

  return (
    <div className="wow-table">
      <div className="wow-table-head">
        <span>Metric</span>
        <span>{wow.priorLabel}</span>
        <span>{wow.recentLabel}</span>
        <span>Change</span>
      </div>
      {wow.metrics.map(m => {
        const change = pctChange(m.prior, m.recent, m.higherBetter);
        const fmt = m.format || (v => `${Math.round(v)}${m.unit ? ` ${m.unit}` : ''}`);
        return (
          <div key={m.key} className="wow-table-row">
            <span className="wow-metric">{m.label}</span>
            <span>{fmt(m.prior)}</span>
            <span>{fmt(m.recent)}</span>
            <span className={`wow-change ${change?.improved ? 'up' : change ? 'down' : ''}`}>
              {change ? `${change.pct > 0 ? '+' : ''}${change.pct}%` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function InsightsPanel({ rawData }) {
  const insights = useMemo(() => buildInsights(rawData), [rawData]);
  const { today, daily, correlation, insightText, wow, workoutSleepPairs } = insights;

  if (!daily.length && !today) {
    return (
      <div className="insights-panel">
        <EmptyState />
      </div>
    );
  }

  const status = readinessLabel(today?.readiness);

  return (
    <div className="insights-panel">
      {/* Today's readiness */}
      <section className="readiness-hero chart-card wide">
        <div className="readiness-hero-inner">
          <div className="readiness-hero-score">
            {today?.readiness != null ? (
              <ReadinessRing score={today.readiness} color={status.color} />
            ) : (
              <EmptyState message="Insufficient data for today's score" />
            )}
            <div className="readiness-hero-text">
              <h2>Today's Readiness</h2>
              <p className="readiness-status" style={{ color: status.color }}>{status.label}</p>
              <p className="readiness-desc">
                Combines last night's sleep, HRV, resting HR, and yesterday's training load vs your baseline.
              </p>
            </div>
          </div>
          <div className="readiness-breakdown">
            <ScoreBar label="Sleep" score={today?.sleepScore} color="#8b5cf6" />
            <ScoreBar label="HRV" score={today?.hrvScore} color="#f59e0b" />
            <ScoreBar label="Resting HR" score={today?.rhrScore} color="#ef4444" />
            <ScoreBar label="Recovery" score={today?.recoveryScore} color="#10b981" />
          </div>
        </div>
      </section>

      {/* Readiness trend */}
      <section className="chart-card wide">
        <h2>Readiness Trend</h2>
        {daily.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={36} domain={[40, 100]} />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />
              <Line type="monotone" dataKey="readiness" name="Readiness" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState message="Need multiple days for trend" />}
      </section>

      {/* Workout → sleep correlation */}
      <section className="chart-card half">
        <h2>Workout → Sleep</h2>
        <p className="panel-caption">
          Nights after a workout ({correlation.afterWorkout.count}) vs rest days ({correlation.restDays.count})
        </p>
        <CorrelationChart correlation={correlation} />
      </section>

      <section className="chart-card half">
        <h2>What We're Seeing</h2>
        <div className="insight-callout">
          <span className="insight-icon">💡</span>
          <p>{insightText}</p>
        </div>
        {workoutSleepPairs.length > 0 && (
          <div className="workout-sleep-log">
            <h3>Recent workout nights</h3>
            {workoutSleepPairs.map((pair, i) => (
              <div key={i} className="workout-sleep-row">
                <div className="ws-date">{pair.dateLabel}</div>
                <div className="ws-workout">{pair.workouts}</div>
                <div className="ws-stats">
                  {pair.sleepMin != null && <span>{formatDuration(pair.sleepMin)} sleep</span>}
                  {pair.efficiency != null && <span>{pair.efficiency}% eff</span>}
                  {pair.hrv != null && <span>{Math.round(pair.hrv)} ms HRV</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Week over week */}
      <section className="chart-card wide">
        <h2>Period Comparison</h2>
        <p className="panel-caption">First half vs second half of your selected date range</p>
        <WowTable wow={wow} />
      </section>
    </div>
  );
}
