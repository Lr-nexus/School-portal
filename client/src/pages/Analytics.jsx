import { useEffect, useState } from 'react';
import {
  FiUsers, FiUserCheck, FiLayers, FiHeart, FiTrendingUp,
  FiDollarSign, FiCheckSquare, FiAward, FiAlertCircle, FiRefreshCw
} from 'react-icons/fi';
import { api } from '../api/api';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Loader from '../components/Loader';

const formatNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');

/* Simple horizontal bar */
function Bar({ value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="analytics-bar">
      <div className="analytics-bar__fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api('/analytics/overview');
      setData(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) return <Loader />;
  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      </div>
    );
  }

  const maxClassAvg = Math.max(...data.classAverages.map((c) => Number(c.average) || 0), 1);
  const maxTop = Math.max(...data.topStudents.map((s) => Number(s.average) || 0), 1);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="School performance across academics, fees, and attendance"
      >
        <button className="btn btn--ghost" onClick={load}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {/* ---------------- Top counts ---------------- */}
      <div className="stats-grid">
        <StatCard label="Students" value={data.counts.students} color="#2563eb" />
        <StatCard label="Teachers" value={data.counts.teachers} color="#7c3aed" />
        <StatCard label="Classes"  value={data.counts.classes}  color="#0891b2" />
        <StatCard label="Parents"  value={data.counts.parents}  color="#d97706" />
      </div>

      <div className="stats-grid">
        <StatCard
          label="Fees Collected"
          value={formatNaira(data.fees.paid)}
          hint={`${data.fees.rate}% of ${formatNaira(data.fees.billed)}`}
          color="#16a34a"
        />
        <StatCard
          label="Outstanding"
          value={formatNaira(data.fees.outstanding)}
          color="#dc2626"
        />
        <StatCard
          label="Attendance"
          value={`${data.attendance.rate}%`}
          hint={`${data.attendance.present} / ${data.attendance.total} marks`}
          color={data.attendance.rate >= 80 ? '#16a34a' : data.attendance.rate >= 60 ? '#f59e0b' : '#dc2626'}
        />
        <StatCard
          label="Quiz Attempts"
          value={data.counts.submissions}
          hint={`${data.counts.quizzes} quizzes`}
          color="#7c3aed"
        />
      </div>

      {/* ---------------- Class averages ---------------- */}
      <div className="card">
        <h3><FiTrendingUp size={16} /> Average Score by Class</h3>
        {data.classAverages.length === 0 && <p className="muted">No results yet.</p>}
        {data.classAverages.map((c) => (
          <div className="analytics-row" key={c.className}>
            <div className="analytics-row__label">
              <strong>{c.className}</strong>
              <span className="muted">{c.students} students</span>
            </div>
            <Bar value={Number(c.average)} max={maxClassAvg} />
            <div className="analytics-row__value">{c.average}%</div>
          </div>
        ))}
      </div>

      {/* ---------------- Fee collection by class ---------------- */}
      <div className="card">
        <h3><FiDollarSign size={16} /> Fee Collection by Class</h3>
        {data.feeByClass.map((c) => (
          <div className="analytics-row" key={c.className}>
            <div className="analytics-row__label">
              <strong>{c.className}</strong>
              <span className="muted">{formatNaira(c.paid)} of {formatNaira(c.billed)}</span>
            </div>
            <Bar
              value={c.collected}
              max={100}
              color={
                c.collected >= 80 ? 'var(--green)' :
                c.collected >= 50 ? 'var(--amber)' :
                'var(--red)'
              }
            />
            <div className="analytics-row__value">{c.collected}%</div>
          </div>
        ))}
      </div>

      {/* ---------------- Quiz performance by class ---------------- */}
      {data.quizPerClass.length > 0 && (
        <div className="card">
          <h3><FiCheckSquare size={16} /> Quiz Performance by Class</h3>
          {data.quizPerClass.map((q) => (
            <div className="analytics-row" key={q.className}>
              <div className="analytics-row__label">
                <strong>{q.className}</strong>
                <span className="muted">{q.submissions} attempts</span>
              </div>
              <Bar value={Number(q.average)} max={100} />
              <div className="analytics-row__value">{q.average}%</div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Top students ---------------- */}
      <div className="card">
        <h3><FiAward size={16} /> Top 10 Students</h3>
        {data.topStudents.length === 0 && <p className="muted">Not enough results yet.</p>}
        {data.topStudents.map((s, i) => (
          <div className="analytics-row" key={s.id}>
            <div className="analytics-row__label">
              <span className="analytics-row__rank">#{i + 1}</span>
              <div>
                <strong>{s.name}</strong>
                <span className="muted">{s.className} · {s.subjects} subjects</span>
              </div>
            </div>
            <Bar value={Number(s.average)} max={maxTop} color="var(--accent)" />
            <div className="analytics-row__value">{s.average}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}