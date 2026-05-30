import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useHealthData } from '../hooks/useHealthData';
import StatCard from '../components/StatCard';
import SleepAnalysisPanel from '../components/SleepAnalysisPanel';
import WorkoutPanel from '../components/WorkoutPanel';
import InsightsPanel from '../components/InsightsPanel';
import { revokeToken, formatDate, formatDuration } from '../lib/healthApi';

// ─── Helpers to parse Google Health API response shapes ──────────────────────

function civilDateStr(civilTime) {
  const d = civilTime?.date;
  if (!d) return null;
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function num(v) {
  return v != null ? Number(v) : null;
}

function parseDaily(apiResp, field) {
  if (apiResp?.rollupDataPoints) {
    return apiResp.rollupDataPoints.map((pt) => {
      const dateStr = civilDateStr(pt.civilStartTime);
      const payload = pt[field] || Object.values(pt).find(v => v && typeof v === 'object' && !v.date);
      const value = num(payload?.countSum ?? payload?.minutesSum ?? payload?.average ?? payload?.distanceSum);
      return { date: formatDate(dateStr), value };
    }).filter(d => d.value != null);
  }

  if (!apiResp?.dataPoints) return [];
  return apiResp.dataPoints.map((pt) => {
    const payload = pt[field] || pt[Object.keys(pt).find(k => !['name', 'dataSource'].includes(k))];
    const dateStr = payload?.date
      ? `${payload.date.year}-${String(payload.date.month).padStart(2, '0')}-${String(payload.date.day).padStart(2, '0')}`
      : payload?.sampleTime?.physicalTime?.split('T')[0];
    const value = num(payload?.rmssd ?? payload?.percentage ?? payload?.beatsPerMinute ?? payload?.count);
    return { date: formatDate(dateStr), value };
  }).filter(d => d.value != null);
}

function parseSleep(apiResp) {
  if (!apiResp?.dataPoints) return [];
  return apiResp.dataPoints.map((pt) => {
    const sleep = pt.sleep;
    const dateStr = civilDateStr(sleep?.interval?.civilEndTime) || sleep?.interval?.endTime?.split('T')[0];
    const summary = sleep?.summary?.stagesSummary || [];
    const byType = Object.fromEntries(summary.map(s => [s.type, num(s.minutes) || 0]));
    return {
      date: formatDate(dateStr),
      duration: num(sleep?.summary?.minutesAsleep) || 0,
      deep: byType.DEEP || 0,
      rem: byType.REM || 0,
      light: byType.LIGHT || 0,
      score: null,
    };
  }).filter(d => d.duration > 0);
}

function parseHR(apiResp) {
  if (!apiResp?.dataPoints) return [];
  return apiResp.dataPoints.slice(0, 288).map((pt) => {
    const hr = pt.heartRate;
    const time = hr?.sampleTime?.physicalTime || hr?.sampleTime?.civilTime;
    const civil = hr?.sampleTime?.civilTime;
    const label = civil?.time
      ? `${String(civil.time.hours || 0).padStart(2, '0')}:${String(civil.time.minutes || 0).padStart(2, '0')}`
      : new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { time: label, bpm: num(hr?.beatsPerMinute) || 0 };
  }).filter(d => d.bpm > 0);
}

function latest(arr, key = 'value') {
  if (!arr?.length) return null;
  return arr[arr.length - 1]?.[key] ?? null;
}

// ─── Chart tooltip ─────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tt-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="tt-row" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{unit ? ` ${unit}` : ''}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({ onLogout }) {
  const [days, setDays] = useState(7);
  const [view, setView] = useState('overview');
  const { data, loading, error, refetch } = useHealthData(days);

  useEffect(() => { refetch(); }, [days]);

  const steps = parseDaily(data?.steps, 'steps');
  const distance = parseDaily(data?.distance, 'distance');
  const activeMin = parseDaily(data?.activeMinutes, 'activeMinutes');
  const sleep = parseSleep(data?.sleep);
  const hr = parseHR(data?.heartRate);
  const hrv = parseDaily(data?.hrv, 'dailyHeartRateVariability');
  const spo2 = parseDaily(data?.spo2, 'dailyOxygenSaturation');
  const rhr = parseDaily(data?.rhr, 'dailyRestingHeartRate');

  const todaySteps = latest(steps);
  const todayActiveMin = latest(activeMin);
  const todaySleep = sleep[sleep.length - 1];
  const latestHRV = latest(hrv);
  const latestSpO2 = latest(spo2);
  const latestRHR = latest(rhr);

  function handleLogout() {
    revokeToken();
    onLogout();
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-brand">
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <circle cx="12" cy="12" r="11" stroke="var(--accent)" strokeWidth="2"/>
            <path d="M7 12C7 9.2 9.2 7 12 7C14.8 7 17 9.2 17 12" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="2" fill="var(--accent)"/>
          </svg>
          <span>Health Dashboard</span>
        </div>
        <div className="dash-controls">
          <div className="view-tabs">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'insights', label: 'Insights' },
              { id: 'sleep', label: 'Sleep' },
              { id: 'workouts', label: 'Workouts' },
            ].map(tab => (
              <button
                key={tab.id}
                className={view === tab.id ? 'active' : ''}
                onClick={() => setView(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="range-tabs">
            {[7, 14, 30].map(d => (
              <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
                {d}d
              </button>
            ))}
          </div>
          <button className="icon-btn" onClick={refetch} title="Refresh">↻</button>
          <button className="icon-btn logout" onClick={handleLogout} title="Sign out">⏏</button>
        </div>
      </header>

      {error && (
        <div className="banner error">
          API error: {error} · <button onClick={refetch}>Retry</button>
        </div>
      )}
      {loading && <div className="loading-bar" />}

      <main className="dash-main">
        {view === 'overview' && (
          <>
        {/* ── Stat row ── */}
        <section className="stats-row">
          <StatCard icon="👟" label="Steps today" value={todaySteps?.toLocaleString()} color="#3b82f6" />
          <StatCard icon="🏃" label="Active min" value={todayActiveMin} unit="min" color="#10b981" />
          <StatCard icon="😴" label="Sleep" value={todaySleep ? formatDuration(todaySleep.duration) : null} sub={todaySleep?.score ? `Score ${todaySleep.score}` : null} color="#8b5cf6" />
          <StatCard icon="❤️" label="Resting HR" value={latestRHR ? Math.round(latestRHR) : null} unit="bpm" color="#ef4444" />
          <StatCard icon="🌊" label="HRV" value={latestHRV ? Math.round(latestHRV) : null} unit="ms" color="#f59e0b" />
          <StatCard icon="🫁" label="SpO2" value={latestSpO2 ? `${Math.round(latestSpO2)}%` : null} color="#06b6d4" />
        </section>

        {/* ── Steps chart ── */}
        <section className="chart-card wide">
          <h2>Daily Steps</h2>
          {steps.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={steps} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={45} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                <Tooltip content={<CustomTooltip unit="steps" />} />
                <Bar dataKey="value" name="Steps" radius={[4, 4, 0, 0]}>
                  {steps.map((_, i) => (
                    <Cell key={i} fill={i === steps.length - 1 ? 'var(--accent)' : 'var(--bar-muted)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </section>

        {/* ── Heart Rate chart ── */}
        <section className="chart-card wide">
          <h2>Heart Rate (today)</h2>
          {hr.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hr}>
                <defs>
                  <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={35} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip unit="bpm" />} />
                <Area type="monotone" dataKey="bpm" name="Heart Rate" stroke="#ef4444" strokeWidth={1.5} fill="url(#hrGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </section>

        {/* ── Sleep chart ── */}
        <section className="chart-card half">
          <h2>Sleep Duration</h2>
          {sleep.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sleep} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} tickFormatter={v => `${Math.floor(v/60)}h`} />
                <Tooltip formatter={(v) => formatDuration(v)} content={<CustomTooltip />} />
                <Bar dataKey="deep" name="Deep" stackId="a" fill="#312e81" radius={[0,0,0,0]} />
                <Bar dataKey="rem" name="REM" stackId="a" fill="#7c3aed" />
                <Bar dataKey="light" name="Light" stackId="a" fill="#a78bfa" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </section>

        {/* ── HRV chart ── */}
        <section className="chart-card half">
          <h2>Heart Rate Variability</h2>
          {hrv.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={hrv}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip unit="ms" />} />
                <Line type="monotone" dataKey="value" name="HRV" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </section>

        {/* ── SpO2 chart ── */}
        <section className="chart-card half">
          <h2>Blood Oxygen (SpO2)</h2>
          {spo2.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={spo2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={40} domain={[94, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip unit="%" />} />
                <Line type="monotone" dataKey="value" name="SpO2" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </section>

        {/* ── Active Minutes ── */}
        <section className="chart-card half">
          <h2>Active Minutes</h2>
          {activeMin.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activeMin} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip unit="min" />} />
                <Bar dataKey="value" name="Active min" radius={[4,4,0,0]}>
                  {activeMin.map((d, i) => (
                    <Cell key={i} fill={d.value >= 30 ? '#10b981' : '#6ee7b7'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState />}
        </section>
          </>
        )}

        {view === 'insights' && (
          <div className="panel-view">
            <InsightsPanel rawData={data} />
          </div>
        )}

        {view === 'sleep' && (
          <div className="panel-view">
            <SleepAnalysisPanel sleepRaw={data?.sleep} />
          </div>
        )}

        {view === 'workouts' && (
          <div className="panel-view">
            <WorkoutPanel exerciseRaw={data?.exercise} />
          </div>
        )}

      </main>

      <footer className="dash-footer">
        Data via <a href="https://developers.google.com/health" target="_blank" rel="noopener">Google Health API v4</a>
        {data?.fetchedAt && ` · Updated ${data.fetchedAt.toLocaleTimeString()}`}
      </footer>
    </div>
  );
}

function EmptyState() {
  return <div className="empty-state">No data for this period</div>;
}
