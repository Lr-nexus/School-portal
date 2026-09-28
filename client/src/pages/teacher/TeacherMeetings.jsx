import { useEffect, useMemo, useState } from 'react';
import {
  FiClock, FiX, FiAlertCircle, FiCheck, FiCalendar,
  FiUser, FiMail, FiPhone, FiRefreshCw, FiMessageCircle,
  FiEdit3, FiCheckCircle, FiCornerDownRight,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const STATUS_META = {
  pending:     { label: 'Pending',     color: 'var(--amber)',  bg: 'rgba(245,158,11,.12)' },
  accepted:    { label: 'Accepted',    color: 'var(--green)',  bg: 'rgba(22,163,74,.12)' },
  declined:    { label: 'Declined',    color: 'var(--red)',    bg: 'rgba(220,38,38,.12)' },
  rescheduled: { label: 'Rescheduled', color: 'var(--accent)', bg: 'rgba(37,99,235,.12)' },
  completed:   { label: 'Completed',   color: 'var(--muted)',  bg: 'rgba(100,116,139,.12)' },
  cancelled:   { label: 'Cancelled',   color: 'var(--muted)',  bg: 'rgba(100,116,139,.12)' },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function TeacherMeetings() {
  const toast = useToast();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState('pending');
  const [action, setAction] = useState(null);

  const load = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api('/teachers/me/meetings');
      setMeetings(data);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const now = todayISO();
    return {
      pending: meetings.filter((m) => m.status === 'pending').length,
      upcoming: meetings.filter(
        (m) =>
          ['accepted', 'rescheduled'].includes(m.status) &&
          m.scheduledDate && m.scheduledDate >= now
      ).length,
      completed: meetings.filter((m) => m.status === 'completed').length,
      total: meetings.length,
    };
  }, [meetings]);

  const filtered = useMemo(() => {
    const now = todayISO();
    if (tab === 'pending') return meetings.filter((m) => m.status === 'pending');
    if (tab === 'upcoming') {
      return meetings.filter(
        (m) =>
          ['accepted', 'rescheduled'].includes(m.status) &&
          m.scheduledDate && m.scheduledDate >= now
      );
    }
    if (tab === 'past') {
      return meetings.filter(
        (m) =>
          m.status === 'completed' ||
          ['declined', 'cancelled'].includes(m.status) ||
          (m.scheduledDate && m.scheduledDate < now)
      );
    }
    return meetings;
  }, [meetings, tab]);

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Parent Meetings"
        subtitle="Accept, decline, or reschedule meeting requests from parents"
      >
        <button className="btn btn--ghost" onClick={load}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      )}

      <div className="stats-grid">
        <StatCard label="Awaiting Reply" value={summary.pending} color="#f59e0b" />
        <StatCard label="Upcoming" value={summary.upcoming} color="#16a34a" />
        <StatCard label="Completed" value={summary.completed} color="#7c3aed" />
        <StatCard label="Total Requests" value={summary.total} color="#2563eb" />
      </div>

      <div className="tabs">
        {[
          { key: 'pending', label: 'Pending', count: summary.pending },
          { key: 'upcoming', label: 'Upcoming', count: summary.upcoming },
          { key: 'past', label: 'Past' },
          { key: 'all', label: 'All', count: summary.total },
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

      {filtered.length === 0 && (
        <div className="card empty-state">
          <FiClock size={32} />
          <p>
            {meetings.length === 0
              ? 'No meeting requests yet.'
              : 'Nothing here in this tab.'}
          </p>
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
                  <span><FiUser size={11} /> {m.parent.name} · {m.parent.relationship || 'Guardian'}</span>
                  <span><FiClock size={11} /> Received {m.createdAt.split('T')[0]}</span>
                </div>
              </div>

              <div className="meeting-card__body">
                <div className="meeting-card__row">
                  <span className="meeting-card__label">Student</span>
                  <span><strong>{m.student.name}</strong> · {m.student.className}</span>
                </div>
                <div className="meeting-card__row">
                  <span className="meeting-card__label">Parent contact</span>
                  <span className="meeting-card__contacts">
                    <a href={`mailto:${m.parent.email}`}><FiMail size={11} /> {m.parent.email}</a>
                    {m.parent.phone && <span><FiPhone size={11} /> {m.parent.phone}</span>}
                  </span>
                </div>
                <div className="meeting-card__row">
                  <span className="meeting-card__label">Requested for</span>
                  <span>{m.preferredDate} · {m.preferredTime} ({m.durationMinutes} min)</span>
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
                    <span className="meeting-card__label">Parent's message</span>
                    <p className="meeting-card__note">{m.message}</p>
                  </div>
                )}
                {m.teacherResponse && (
                  <div className="meeting-card__row meeting-card__row--stack">
                    <span className="meeting-card__label">Your response</span>
                    <p className="meeting-card__note meeting-card__note--reply">
                      <FiCornerDownRight size={11} /> {m.teacherResponse}
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

              {m.status === 'pending' && (
                <div className="meeting-card__actions">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setAction({ type: 'decline', meeting: m })}
                  >
                    <FiX size={14} /> Decline
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setAction({ type: 'reschedule', meeting: m })}
                  >
                    <FiEdit3 size={14} /> Reschedule
                  </button>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => setAction({ type: 'accept', meeting: m })}
                  >
                    <FiCheck size={14} /> Accept
                  </button>
                </div>
              )}

              {['accepted', 'rescheduled'].includes(m.status) && (
                <div className="meeting-card__actions">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => setAction({ type: 'reschedule', meeting: m })}
                  >
                    <FiEdit3 size={14} /> Reschedule
                  </button>
                  <button
                    className="btn btn--primary btn--sm"
                    onClick={() => setAction({ type: 'complete', meeting: m })}
                  >
                    <FiCheckCircle size={14} /> Mark Complete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {action && (
        <MeetingActionModal
          action={action}
          onClose={() => setAction(null)}
          onDone={async (msg) => {
            toast.success(msg);
            setAction(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function MeetingActionModal({ action, onClose, onDone }) {
  const { type, meeting } = action;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const [scheduledDate, setScheduledDate] = useState(
    meeting.scheduledDate || meeting.preferredDate
  );
  const [scheduledTime, setScheduledTime] = useState(
    meeting.scheduledTime || meeting.preferredTime
  );
  const [response, setResponse] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (type === 'accept') {
        await api(`/teachers/me/meetings/${meeting.id}/accept`, {
          method: 'PATCH',
          body: JSON.stringify({ scheduledDate, scheduledTime, teacherResponse: response }),
        });
        await onDone('Meeting accepted');
      } else if (type === 'decline') {
        await api(`/teachers/me/meetings/${meeting.id}/decline`, {
          method: 'PATCH',
          body: JSON.stringify({ teacherResponse: response }),
        });
        await onDone('Meeting declined');
      } else if (type === 'reschedule') {
        await api(`/teachers/me/meetings/${meeting.id}/reschedule`, {
          method: 'PATCH',
          body: JSON.stringify({ scheduledDate, scheduledTime, teacherResponse: response }),
        });
        await onDone('Meeting rescheduled');
      } else if (type === 'complete') {
        await api(`/teachers/me/meetings/${meeting.id}/complete`, {
          method: 'PATCH',
          body: JSON.stringify({ completedNotes: notes }),
        });
        await onDone('Meeting marked complete');
      }
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  const titles = {
    accept: { title: 'Accept Meeting', icon: FiCheck },
    decline: { title: 'Decline Meeting', icon: FiX },
    reschedule: { title: 'Reschedule Meeting', icon: FiEdit3 },
    complete: { title: 'Complete Meeting', icon: FiCheckCircle },
  };
  const meta = titles[type];
  const Icon = meta.icon;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3><Icon size={18} /> {meta.title}</h3>
            <p className="muted">
              {meeting.parent.name} · {meeting.student.name}
            </p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            <FiX size={16} />
          </button>
        </div>

        {err && <div className="alert alert--error">{err}</div>}

        <div className="meeting-action-summary">
          <div><span>Topic:</span> <strong>{meeting.topic}</strong></div>
          <div><span>Requested:</span> {meeting.preferredDate} · {meeting.preferredTime}</div>
        </div>

        <form onSubmit={submit}>
          {(type === 'accept' || type === 'reschedule') && (
            <div className="form-grid">
              <label>
                Date *
                <input
                  type="date"
                  value={scheduledDate}
                  min={todayISO()}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                  disabled={busy}
                />
              </label>
              <label>
                Time *
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                  disabled={busy}
                />
              </label>
            </div>
          )}

          {(type === 'accept' || type === 'decline' || type === 'reschedule') && (
            <label>
              {type === 'decline' ? 'Reason' : 'Message to parent (optional)'}
              <textarea
                rows="3"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder={
                  type === 'decline'
                    ? "I'm unavailable at this time, please try another slot…"
                    : "See you then!"
                }
                disabled={busy}
              />
            </label>
          )}

          {type === 'complete' && (
            <label>
              Meeting notes (visible to parent)
              <textarea
                rows="4"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was discussed? Any follow-up actions?"
                disabled={busy}
              />
            </label>
          )}

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              className={`btn ${type === 'decline' ? 'btn--danger' : 'btn--primary'}`}
              disabled={busy}
            >
              <Icon size={16} /> {busy ? 'Saving…' : meta.title}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}