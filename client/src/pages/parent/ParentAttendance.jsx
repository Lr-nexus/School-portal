import { useEffect, useState } from 'react';
import { FiCalendar, FiAlertCircle } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const STATUS_COLORS = {
  Present: 'status-present',
  Absent:  'status-absent',
  Late:    'status-late',
  Excused: 'status-excused',
};

export default function ParentAttendance() {
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api('/parents/me/child/attendance')
      .then(setData)
      .catch((e) => setErrorMsg(e.message));
  }, []);

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Child Attendance" />
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const s = data.summary;

  return (
    <div>
      <PageHeader
        title={`${data.child.name}'s Attendance`}
        subtitle={`${data.child.className}`}
      />

      <div className="stats-grid">
        <StatCard label="Attendance Rate" value={`${s.percentage}%`}
          color={s.percentage >= 80 ? '#16a34a' : s.percentage >= 60 ? '#f59e0b' : '#dc2626'} />
        <StatCard label="Present" value={s.present} color="#16a34a" />
        <StatCard label="Late"    value={s.late}    color="#f59e0b" />
        <StatCard label="Absent"  value={s.absent}  color="#dc2626" />
      </div>

      <div className="card">
        <h3><FiCalendar size={16} /> Recent Records</h3>
        {data.records.length === 0 && <p className="muted">No records yet.</p>}
        {data.records.length > 0 && (
          <table className="table table--striped">
            <thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {data.records.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td><span className={`pill ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span></td>
                  <td className="muted">{r.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}