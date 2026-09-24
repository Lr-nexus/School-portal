import { useEffect, useState } from 'react';
import {
  FiCalendar, FiCheck, FiX, FiClock, FiCheckCircle, FiAlertCircle
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const STATUS_COLORS = {
  Present: 'status-present',
  Absent: 'status-absent',
  Late: 'status-late',
  Excused: 'status-excused',
};

export default function StudentAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api('/attendance/me')
      .then(setData)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (errorMsg) {
    return (
      <div>
        <PageHeader title="My Attendance" />
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      </div>
    );
  }

  const s = data.summary || {};

  return (
    <div>
      <PageHeader
        title="My Attendance"
        subtitle="Your attendance record across all terms"
      />

      <div className="stats-grid">
        <StatCard
          label="Attendance Rate"
          value={`${s.percentage || 0}%`}
          color={s.percentage >= 80 ? '#16a34a' : s.percentage >= 60 ? '#f59e0b' : '#dc2626'}
        />
        <StatCard label="Present" value={s.present || 0} color="#16a34a" />
        <StatCard label="Late"    value={s.late || 0}    color="#f59e0b" />
        <StatCard label="Absent"  value={s.absent || 0}  color="#dc2626" />
      </div>

      <div className="card">
        <h3><FiCalendar size={16} /> Recent Records</h3>
        {(data.records || []).length === 0 && (
          <p className="muted">No attendance records yet.</p>
        )}
        {(data.records || []).length > 0 && (
          <table className="table table--striped">
            <thead>
              <tr><th>Date</th><th>Status</th><th>Note</th></tr>
            </thead>
            <tbody>
              {data.records.map((r, i) => (
                <tr key={i}>
                  <td>{r.date}</td>
                  <td>
                    <span className={`pill ${STATUS_COLORS[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </td>
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