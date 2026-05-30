import { useMemo } from 'react';
import { parseWorkouts, workoutSummary, formatDurationMin } from '../lib/workoutUtils';

function EmptyState() {
  return <div className="empty-state">No workouts logged for this period</div>;
}

function WorkoutCard({ workout }) {
  return (
    <article className="workout-card">
      <div className="workout-icon">{workout.icon}</div>
      <div className="workout-body">
        <div className="workout-header">
          <h3>{workout.name}</h3>
          <span className="workout-type">{workout.typeLabel}</span>
        </div>
        <div className="workout-meta">
          <span>{workout.dateLabel}</span>
          <span>·</span>
          <span>{workout.timeLabel}</span>
        </div>
        <div className="workout-metrics">
          <span className="workout-metric primary">{workout.durationLabel}</span>
          {workout.calories != null && (
            <span className="workout-metric">{Math.round(workout.calories)} cal</span>
          )}
          {workout.distanceLabel && (
            <span className="workout-metric">{workout.distanceLabel}</span>
          )}
          {workout.avgHR != null && (
            <span className="workout-metric">{Math.round(workout.avgHR)} avg bpm</span>
          )}
          {workout.steps != null && workout.steps > 0 && (
            <span className="workout-metric">{Math.round(workout.steps).toLocaleString()} steps</span>
          )}
          {workout.elevationM != null && workout.elevationM > 0 && (
            <span className="workout-metric">↑ {workout.elevationM} m</span>
          )}
          {workout.activeZoneMin != null && workout.activeZoneMin > 0 && (
            <span className="workout-metric">{Math.round(workout.activeZoneMin)} AZM</span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function WorkoutPanel({ exerciseRaw }) {
  const workouts = useMemo(() => parseWorkouts(exerciseRaw), [exerciseRaw]);
  const summary = useMemo(() => workoutSummary(workouts), [workouts]);

  if (!workouts.length) return <EmptyState />;

  return (
    <div className="workout-panel">
      <section className="workout-summary-row">
        <div className="workout-summary-stat">
          <span className="workout-summary-val">{summary.count}</span>
          <span className="workout-summary-label">Workouts</span>
        </div>
        <div className="workout-summary-stat">
          <span className="workout-summary-val">{formatDurationMin(summary.durationMin)}</span>
          <span className="workout-summary-label">Active time</span>
        </div>
        <div className="workout-summary-stat">
          <span className="workout-summary-val">{Math.round(summary.calories).toLocaleString()}</span>
          <span className="workout-summary-label">Calories</span>
        </div>
        <div className="workout-summary-stat">
          <span className="workout-summary-val">
            {summary.distanceKm >= 1
              ? `${summary.distanceKm.toFixed(1)} km`
              : summary.distanceKm > 0
                ? `${Math.round(summary.distanceKm * 1000)} m`
                : '—'}
          </span>
          <span className="workout-summary-label">Distance</span>
        </div>
      </section>

      <section className="workout-list">
        {workouts.map(w => (
          <WorkoutCard key={w.id} workout={w} />
        ))}
      </section>
    </div>
  );
}
