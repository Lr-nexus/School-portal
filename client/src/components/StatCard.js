export default function StatCard({ label, value, hint, color = '#2563eb' }) {
  return (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <p className="stat-card__label">{label}</p>
      <h3 className="stat-card__value">{value}</h3>
      {hint && <span className="stat-card__hint">{hint}</span>}
    </div>
  );
}