import { useEffect, useState } from 'react';
import { FiCalendar, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { api } from '../../api/api';
import { useParentContext } from '../../hooks/useParentContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';
import ChildSelector from '../../components/ChildSelector';

const STATUS_COLORS = {
  Present: 'status-present',
  Absent: 'status-absent',
  Late: 'status-late',
  Excused: 'status-excused',
};

export default function ParentAttendance() {
  const {
    children, activeChild, activeChildId, setActiveChildId, loading,
  } = useParentContext();

  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = async (childId) => {
    if (!childId) return;
    setLoadingData(true);
    setErrorMsg('');
    try {
      const res = await api(`/parents/me/children/${childId}/attendance`);
      setData(res);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (activeChildId) load(activeChildId);
    // eslint-disable-next-line
  }, [activeChildId]);

  if (loading) return <Loader />;
  if (!activeChild) {
    return (
      <div>
        <PageHeader title="Child Attendance" />
        <div className="card empty-state"><p>No child linked.</p></div>
      </div>
    );
  }

  const s = data?.summary || {};

  return (
    <div>
      <PageHeader
        title={`${activeChild.name}'s Attendance`}
        subtitle={activeChild.className}
      >
        <ChildSelector
          children={children}
          value={activeChildId}
          onChange={setActiveChildId}
        />
        <button className="btn btn--ghost" onClick={() => load(activeChildId)}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      )}

      {loadingData && !data && <Loader />}

      {data && (
        <>
          <div className="stats-grid">
            <StatCard
              label="Attendance Rate"
              value={`${s.percentage || 0}%`}
              color={s.percentage >= 80 ? '#16a34a' : s.percentage >= 60 ? '#f59e0b' : '#dc2626'}
            />
            <StatCard label="Present" value={s.present || 0} color="#16a34a" />
            <StatCard label="Late" value={s.late || 0} color="#f59e0b" />
            <StatCard label="Absent" value={s.absent || 0} color="#dc2626" />
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
        </>
      )}
    </div>
  );
}