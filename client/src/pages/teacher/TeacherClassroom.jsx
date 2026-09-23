import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiVideo, FiClock, FiPlay, FiX, FiTrash2,
  FiAlertCircle, FiUsers, FiZap, FiCalendar
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies'
];

export default function TeacherClassroom() {
  const { className, loading: profileLoading } = useTeacherProfile();
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null); // 'now' | 'schedule' | null
  const navigate = useNavigate();

  const load = () =>
    api('/classroom/sessions')
      .then(setSessions)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const closeModal = () => setMode(null);

  const launchNow = async (payload) => {
    try {
      const res = await api('/classroom/sessions/now', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage('Live class started — students have been notified');
      closeModal();
      navigate(`/classroom/room/${res.session.room_id}`);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const schedule = async (payload) => {
    try {
      await api('/classroom/sessions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMessage('Class scheduled');
      closeModal();
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const startScheduled = async (session) => {
    try {
      await api(`/classroom/sessions/${session.id}/start`, { method: 'POST' });
      navigate(`/classroom/room/${session.roomId}`);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const endClass = async (session) => {
    if (!window.confirm('End this class for everyone?')) return;
    try {
      await api(`/classroom/sessions/${session.id}/end`, { method: 'POST' });
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const deleteSession = async (session) => {
    if (!window.confirm('Delete this scheduled class?')) return;
    try {
      await api(`/classroom/sessions/${session.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (loading || profileLoading) return <Loader />;

  const noClass = !className;
  const liveSessions = sessions.filter((s) => s.status === 'live');
  const scheduledSessions = sessions.filter((s) => s.status === 'scheduled');
  const endedSessions = sessions.filter((s) => s.status === 'ended');

  const fmt = (iso) =>
    new Date(iso).toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div>
      <PageHeader
        title="Live Classroom"
        subtitle={noClass ? 'No class assigned' : `Broadcasting to ${className}`}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn--ghost"
            onClick={() => setMode('schedule')}
            disabled={noClass}
          >
            <FiCalendar size={16} /> Plan Class
          </button>
          <button
            className="btn btn--primary"
            onClick={() => setMode('now')}
            disabled={noClass}
          >
            <FiZap size={16} /> Start Now
          </button>
        </div>
      </PageHeader>

      {message && <div className="alert alert--info">{message}</div>}

      {noClass && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} />
          You have no class assigned. Ask the admin to assign you a form class before starting live sessions.
        </div>
      )}

      {/* ======================================================
          LIVE
      ====================================================== */}
      <h3 className="section-title">
        <span className="dot dot--live" /> Ongoing ({liveSessions.length})
      </h3>
      <div className="grid-3">
        {liveSessions.map((s) => (
          <div key={s.id} className="card session-card session-card--live">
            <span className="pill pill--live">● LIVE</span>
            <h3>{s.title}</h3>
            <p className="muted">{s.subject} · {s.className}</p>
            <p className="muted" style={{ fontSize: 13 }}>
              <FiUsers size={12} /> {s.participants?.length || 0} in room
            </p>
            <div className="session-card__actions">
              <button
                className="btn btn--primary btn--full"
                onClick={() => navigate(`/classroom/room/${s.roomId}`)}
              >
                <FiVideo /> Rejoin
              </button>
              <button
                className="btn btn--danger btn--full"
                onClick={() => endClass(s)}
              >
                <FiX /> End Class
              </button>
            </div>
          </div>
        ))}
        {!liveSessions.length && (
          <p className="muted">No live classes right now.</p>
        )}
      </div>

      {/* ======================================================
          SCHEDULED
      ====================================================== */}
      <h3 className="section-title" style={{ marginTop: 28 }}>
        <FiClock /> Scheduled ({scheduledSessions.length})
      </h3>
      <div className="grid-3">
        {scheduledSessions.map((s) => (
          <div key={s.id} className="card session-card">
            <h3>{s.title}</h3>
            <p className="muted">{s.subject} · {s.className}</p>
            <p>{s.description}</p>
            <p className="session-card__time">
              <FiClock /> {fmt(s.startTime)}
            </p>
            <div className="session-card__actions">
              <button
                className="btn btn--primary btn--full"
                onClick={() => startScheduled(s)}
              >
                <FiPlay /> Start Class
              </button>
              <button
                className="btn btn--ghost btn--full"
                onClick={() => deleteSession(s)}
              >
                <FiTrash2 /> Delete
              </button>
            </div>
          </div>
        ))}
        {!scheduledSessions.length && (
          <p className="muted">No upcoming classes scheduled.</p>
        )}
      </div>

      {/* ======================================================
          PAST
      ====================================================== */}
      {endedSessions.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: 28 }}>Past</h3>
          <div className="grid-3">
            {endedSessions.map((s) => (
              <div key={s.id} className="card session-card session-card--ended">
                <h3>{s.title}</h3>
                <p className="muted">{s.subject} · {fmt(s.startTime)}</p>
                <span className="pill pill--ended">Ended</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ======================================================
          MODALS
      ====================================================== */}
      {mode === 'now' && (
        <StartNowModal
          className={className}
          onClose={closeModal}
          onStart={launchNow}
        />
      )}
      {mode === 'schedule' && (
        <ScheduleModal
          className={className}
          onClose={closeModal}
          onSchedule={schedule}
        />
      )}
    </div>
  );
}

/* ==========================================================
   MODAL — Start Now
   ========================================================== */
function StartNowModal({ className, onClose, onStart }) {
  const [form, setForm] = useState({
    title: '',
    subject: 'Mathematics',
    description: '',
    duration: 60,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onStart(form);
    setBusy(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3><FiZap size={18} /> Start a Class Now</h3>
          <button className="btn btn--ghost" onClick={onClose}>
            <FiX size={16} />
          </button>
        </div>

        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Students in <strong>{className}</strong> will be notified immediately
          and can join right away.
        </p>

        <form onSubmit={submit}>
          <label>
            Class Title *
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Algebra Live Review"
              autoFocus
              required
            />
          </label>

          <div className="form-grid">
            <label>
              Subject
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              >
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>

            <div className="form-field-readonly">
              <span className="form-field-readonly__label">Class</span>
              <div className="form-field-readonly__value">
                <FiUsers size={14} />
                {className}
              </div>
            </div>

            <label>
              Planned Duration (minutes)
              <input
                type="number"
                min="5"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
            </label>
          </div>

          <label>
            Description (optional)
            <textarea
              rows="2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What will you cover?"
            />
          </label>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={busy}>
              <FiZap size={16} /> {busy ? 'Starting…' : 'Start Live Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================
   MODAL — Schedule
   ========================================================== */
function ScheduleModal({ className, onClose, onSchedule }) {
  const [form, setForm] = useState({
    title: '',
    subject: 'Mathematics',
    description: '',
    startTime: '',
    endTime: '',
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await onSchedule(form);
    setBusy(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3><FiCalendar size={18} /> Plan a Class</h3>
          <button className="btn btn--ghost" onClick={onClose}>
            <FiX size={16} />
          </button>
        </div>

        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Schedule a class for <strong>{className}</strong>. Students are notified
          when you start it.
        </p>

        <form onSubmit={submit}>
          <label>
            Class Title *
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
              required
            />
          </label>

          <div className="form-grid">
            <label>
              Subject
              <select
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              >
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>

            <div className="form-field-readonly">
              <span className="form-field-readonly__label">Class</span>
              <div className="form-field-readonly__value">
                <FiUsers size={14} />
                {className}
              </div>
            </div>

            <label>
              Start Time
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </label>
            <label>
              End Time
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </label>
          </div>

          <label>
            Description (optional)
            <textarea
              rows="2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={busy}>
              <FiPlus size={16} /> {busy ? 'Scheduling…' : 'Schedule Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}