export default function StatCard({ icon, label, value, unit, sub, color, trend }) {
  return (
    <div className="stat-card" style={{ '--card-accent': color }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {value ?? <span className="stat-null">—</span>}
          {unit && value != null && <span className="stat-unit"> {unit}</span>}
        </div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
      {trend != null && (
        <div className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}
