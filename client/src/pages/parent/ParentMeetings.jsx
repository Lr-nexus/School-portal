import { useEffect, useMemo, useState } from 'react';
import {
  FiClock, FiPlus, FiX, FiAlertCircle, FiCheckCircle, FiCalendar,
  FiUser, FiMail, FiRefreshCw, FiCheck, FiMessageCircle,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useParentContext } from '../../hooks/useParentContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';
import ChildSelector from '../../components/ChildSelector';

const STATUS_META = {
  pending:     { label: 'Pending',     color: 'var(--amber)',  bg: 'rgba(245,158,11,.12)' },
  accepted:    { label: 'Confirmed',   color: 'var(--green)',  bg: 'rgba(22,163,74,.12)' },
  declined:    { label: 'Declined',    color: 'var(--red)',    bg: 'rgba(220,38,38,.12)' },
  rescheduled: { label: 'Rescheduled', color: 'var(--accent)', bg: 'rgba(37,99,235,.12)' },
  completed:   { label: 'Completed',   color: 'var(--muted)',  bg: 'rgba(100,116,139,.12)' },
  cancelled:   { label: 'Cancelled',   color: 'var(--muted)',  bg: 'rgba(100,116,139,.12)' },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ParentMeetings() {
  const {
    children, activeChild, activeChildId, setActiveChildId, loading,
  } = useParentContext();
  const toast = useToast();

  const [meetings, setMeetings] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState('upcoming');
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoadingData(true);
    try {
      const [m, t] = await Promise.all([
        api('/parents/me/meetings'),
        activeChildId
          ? api(`/parents/me/children/${activeChildId}/teachers`).catch(() => [])
          : Promise.resolve([]),
      ]);
      setMeetings(m);
      setTeachers(t);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [activeChildId]);

  const filtered = useMemo(() => {
    const now = todayISO();
    if (tab === 'upcoming') {
      return meetings.filter((m) =>
        ['pending', 'accepted', 'rescheduled'].includes(m.status) &&
        (m.status === 'pending' || (m.scheduledDate && m.scheduledDate >= now))
      );
    }
    if (tab === 'past') {
      return meetings.filter((m) =>
        m.status === 'completed' ||
        ['declined', 'cancelled'].includes(m.status) ||
        (m.scheduledDate && m.scheduledDate < now)
      );
    }
    return meetings;
  }, [meetings, tab]);

  const summary = useMemo(() => {
    const now = todayISO();
    return {
      total: meetings.length,
      pending: meetings.filter((m) => m.status === 'pending').length,
      upcoming: meetings.filter(
        (m) =>
          ['accepted', 'rescheduled'].includes(m.status) &&
          m.scheduledDate && m.scheduledDate >= now
      ).length,
      completed: meetings.filter((m) => m.status === 'completed').length,
    };
  }, [meetings]);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this meeting request?')) return;
    try {
      await api(`/parents/me/meetings/${id}/cancel`, { method: 'PATCH' });
      toast.success('Meeting cancelled');
      await load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <Loader />;
  if (!activeChild) {
    return (
      <div>
        <PageHeader title="Teacher Meetings" />
        <div className="card empty-state"><p>No child linked.</p></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Teacher Meetings"
        subtitle="Request one-on-one time with your child's teachers"
      >
        <ChildSelector
          children={children}
          value={activeChildId}
          onChange={setActiveChildId}
        />
        <button className="btn btn--ghost" onClick={load}>
          <FiRefreshCw size={16} /> Refresh
        </button>
        <button
          className="btn btn--primary"
          onClick={() => setShowForm(true)}
          disabled={!teachers.length}
        >
          <FiPlus size={16} /> Request Meeting
        </button>
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      )}

      <div className="stats-grid">
        <StatCard label="Total Requests" value={summary.total} color="#2563eb" />
        <StatCard label="Awaiting Reply" value={summary.pending} color="#f59e0b" />
        <StatCard label="Upcoming" value={summary.upcoming} color="#16a34a" />
        <StatCard label="Completed" value={summary.completed} color="#7c3aed" />
      </div>

      <div className="tabs">
        {[
          { key: 'upcoming', label: 'Upcoming', count: summary.pending + summary.upcoming },
          { key: 'past', label: 'Past' },
          { key: 'all', label: 'All', count: meetings.length },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? 'tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} {t.count !== undefined && `(${t.count})`}
          </button>
        ))}
      </div>

      {loadingData && meetings.length === 0 && <Loader />}

      {!loadingData && filtered.length === 0 && (
        <div className="card empty-state">
          <FiClock size={32} />
          <p>
            {meetings.length === 0
              ? 'No meetings requested yet.'
              : 'Nothing here in this tab.'}
          </p>
          {meetings.length === 0 && teachers.length > 0 && (
            <button
              className="btn btn--primary"
              style={{ marginTop: 12 }}
              onClick={() => setShowForm(true)}
            >
              <FiPlus size={16} /> Request your first meeting
            </button>
          )}
        </div>
      )}

      <div className="meeting-list">
        {filtered.map((m) => {
          const meta = STATUS_META[m.status] || STATUS_META.pending;
          const showScheduled = ['accepted', 'rescheduled', 'completed'].includes(m.status);

          return (
            <div className="meeting-card" key={m.id}>
              <div className="meeting-card__head">
                <div className="meeting-card__title">
                  <h3>{m.topic}</h3>
                  <span
                    className="meeting-status"
                    style={{ color: meta.color, background: meta.bg }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="meeting-card__meta">
                  <span><FiUser size={11} /> {m.student.name} · {m.student.className}</span>
                  <span><FiClock size={11} /> Requested {m.createdAt.split('T')[0]}</span>
                </div>
              </div>

              <div className="meeting-card__body">
                <div className="meeting-card__row">
                  <span className="meeting-card__label">Teacher</span>
                  <span><strong>{m.teacher.name}</strong></span>
                </div>
                <div className="meeting-card__row">
                  <span className="meeting-card__label">Requested for</span>
                  <span>
                    {m.preferredDate} · {m.preferredTime} ({m.durationMinutes} min)
                  </span>
                </div>
                {showScheduled && (
                  <div className="meeting-card__row">
                    <span className="meeting-card__label">Scheduled for</span>
                    <span className="meeting-card__highlight">
                      {m.scheduledDate} · {m.scheduledTime}
                    </span>
                  </div>
                )}
                {m.message && (
                  <div className="meeting-card__row meeting-card__row--stack">
                    <span className="meeting-card__label">Your message</span>
                    <p className="meeting-card__note">{m.message}</p>
                  </div>
                )}
                {m.teacherResponse && (
                  <div className="meeting-card__row meeting-card__row--stack">
                    <span className="meeting-card__label">Teacher response</span>
                    <p className="meeting-card__note meeting-card__note--reply">
                      <FiMessageCircle size={11} /> {m.teacherResponse}
                    </p>
                  </div>
                )}
                {m.completedNotes && (
                  <div className="meeting-card__row meeting-card__row--stack">
                    <span className="meeting-card__label">Meeting notes</span>
                    <p className="meeting-card__note meeting-card__note--reply">
                      {m.completedNotes}
                    </p>
                  </div>
                )}
              </div>

              {['pending', 'accepted', 'rescheduled'].includes(m.status) && (
                <div className="meeting-card__actions">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => cancel(m.id)}
                  >
                    <FiX size={14} /> Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <RequestMeetingModal
          child={activeChild}
          teachers={teachers}
          onClose={() => setShowForm(false)}
          onSent={async () => {
            toast.success('Meeting request sent');
            setShowForm(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function RequestMeetingModal({ child, teachers, onClose, onSent }) {
  const [form, setForm] = useState({
    teacherId: teachers[0]?.id || '',
    topic: '',
    message: '',
    preferredDate: todayISO(),
    preferredTime: '10:00',
    durationMinutes: 20,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.teacherId) return setErr('Pick a teacher');
    if (!form.topic.trim()) return setErr('Give the meeting a topic');

    setBusy(true);
    try {
      await api('/parents/me/meetings', {
        method: 'POST',
        body: JSON.stringify({
          teacherId: Number(form.teacherId),
          studentId: child.id,
          topic: form.topic.trim(),
          message: form.message.trim(),
          preferredDate: form.preferredDate,
          preferredTime: form.preferredTime,
          durationMinutes: Number(form.durationMinutes) || 20,
        }),
      });
      await onSent();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3><FiClock size={18} /> Request a Meeting</h3>
            <p className="muted">With {child.name}'s teachers · {child.className}</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            <FiX size={16} />
          </button>
        </div>

        {err && <div className="alert alert--error">{err}</div>}

        <form onSubmit={submit}>
          <label>
            Teacher *
            <select
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              required
              disabled={busy}
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.role === 'form_teacher' ? 'Form Teacher' : 'Subject Teacher'}
                  {t.subjects?.length ? ` (${t.subjects.slice(0, 2).join(', ')})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label>
            Topic *
            <input
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="e.g. Discuss recent Maths progress"
              required
              disabled={busy}
            />
          </label>

          <label>
            Message (optional)
            <textarea
              rows="3"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Anything specific you'd like to discuss?"
              disabled={busy}
            />
          </label>

          <div className="form-grid">
            <label>
              Preferred date *
              <input
                type="date"
                value={form.preferredDate}
                min={todayISO()}
                onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                required
                disabled={busy}
              />
            </label>
            <label>
              Preferred time *
              <input
                type="time"
                value={form.preferredTime}
                onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                required
                disabled={busy}
              />
            </label>
            <label>
              Duration (minutes)
              <select
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                disabled={busy}
              >
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
              </select>
            </label>
          </div>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={busy}>
              <FiCheck size={16} /> {busy ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}