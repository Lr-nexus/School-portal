import { useEffect, useMemo, useState } from 'react';
import {
  FiCheck, FiX, FiClock, FiSave, FiUsers, FiCalendar,
  FiAlertCircle, FiCheckCircle, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const today = () => new Date().toISOString().split('T')[0];

const STATUSES = [
  { key: 'Present', label: 'Present', icon: FiCheck,        color: 'status-present' },
  { key: 'Late',    label: 'Late',    icon: FiClock,        color: 'status-late' },
  { key: 'Absent',  label: 'Absent',  icon: FiX,            color: 'status-absent' },
  { key: 'Excused', label: 'Excused', icon: FiCheckCircle,  color: 'status-excused' },
];

export default function TeacherAttendance() {
  const { className, loading: profileLoading } = useTeacherProfile();

  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const load = async () => {
    if (!className) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api(`/attendance/class/${encodeURIComponent(className)}?date=${date}`);
      setEntries(data.entries.map((e) => ({
        ...e,
        status: e.status || 'Present',
      })));
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [className, date]);

  const summary = useMemo(() => {
    const counts = { Present: 0, Absent: 0, Late: 0, Excused: 0 };
    entries.forEach((e) => { counts[e.status] = (counts[e.status] || 0) + 1; });
    return counts;
  }, [entries]);

  const setStatus = (studentId, status) =>
    setEntries((prev) =>
      prev.map((e) => (e.studentId === studentId ? { ...e, status } : e))
    );

  const markAll = (status) =>
    setEntries((prev) => prev.map((e) => ({ ...e, status })));

  const save = async () => {
    if (!className || !entries.length) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await api('/attendance', {
        method: 'POST',
        body: JSON.stringify({
          className,
          date,
          entries: entries.map((e) => ({
            studentId: e.studentId,
            status: e.status,
            note: e.note || '',
          })),
        }),
      });
      setMessage(res.message);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  if (profileLoading) return <Loader />;
  if (!className) {
    return (
      <div>
        <PageHeader title="Attendance" subtitle="No class assigned" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> You have no class assigned. Contact the admin.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle={`Mark attendance for ${className}`}
      >
        <button
          className="btn btn--primary"
          onClick={save}
          disabled={saving || !entries.length}
        >
          <FiSave size={16} /> {saving ? 'Saving…' : 'Save Attendance'}
        </button>
      </PageHeader>

      {message && <div className="alert alert--info"><FiCheck size={16} /> {message}</div>}
      {errorMsg && <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>}

      {/* Date picker bar */}
      <div className="card attendance-toolbar">
        <button className="btn btn--ghost btn--sm" onClick={() => shiftDate(-1)}>
          <FiChevronLeft size={14} /> Prev
        </button>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className="attendance-toolbar__date"
        />
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => shiftDate(1)}
          disabled={date >= today()}
        >
          Next <FiChevronRight size={14} />
        </button>

        <div className="attendance-toolbar__spacer" />

        <button className="btn btn--ghost btn--sm" onClick={() => markAll('Present')}>
          Mark all present
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Present" value={summary.Present} color="#16a34a" />
        <StatCard label="Late"    value={summary.Late}    color="#f59e0b" />
        <StatCard label="Absent"  value={summary.Absent}  color="#dc2626" />
        <StatCard label="Excused" value={summary.Excused} color="#2563eb" />
      </div>

      {/* Student list */}
      {loading && <Loader />}
      {!loading && entries.length === 0 && (
        <div className="card empty-state">
          <FiUsers size={32} />
          <p>No students in this class yet.</p>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="card attendance-list">
          {entries.map((e) => (
            <div key={e.studentId} className={`attendance-row status-bg-${e.status.toLowerCase()}`}>
              <div className="attendance-row__info">
                <div className="avatar avatar--sm">{e.name.charAt(0)}</div>
                <div>
                  <strong>{e.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{e.admissionNo}</div>
                </div>
              </div>

              <div className="attendance-row__buttons">
                {STATUSES.map((s) => {
                  const Icon = s.icon;
                  const active = e.status === s.key;
                  return (
                    <button
                      key={s.key}
                      className={`attendance-btn ${active ? `attendance-btn--${s.key.toLowerCase()}` : ''}`}
                      onClick={() => setStatus(e.studentId, s.key)}
                      title={s.label}
                    >
                      <Icon size={14} />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}