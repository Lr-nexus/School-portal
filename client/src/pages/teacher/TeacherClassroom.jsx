import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiVideo, FiClock, FiPlay, FiX, FiTrash2
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const emptyForm = {
  title: '',
  subject: '',
  className: 'JSS 2A',
  description: '',
  startTime: '',
  endTime: ''
};

export default function TeacherClassroom() {
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () =>
    api('/classroom/sessions')
      .then(setSessions)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const planClass = async (e) => {
    e.preventDefault();
    try {
      await api('/classroom/sessions', { method: 'POST', body: JSON.stringify(form) });
      setMessage('Class scheduled');
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) { setMessage(err.message); }
  };

  const startClass = async (session) => {
    try {
      await api(`/classroom/sessions/${session.id}/start`, { method: 'POST' });
      navigate(`/classroom/room/${session.roomId}`);
    } catch (err) { setMessage(err.message); }
  };

  const endClass = async (session) => {
    if (!window.confirm('End this class for everyone?')) return;
    try {
      await api(`/classroom/sessions/${session.id}/end`, { method: 'POST' });
      await load();
    } catch (err) { setMessage(err.message); }
  };

  const deleteSession = async (session) => {
    if (!window.confirm('Delete this scheduled class?')) return;
    try {
      await api(`/classroom/sessions/${session.id}`, { method: 'DELETE' });
      await load();
    } catch (err) { setMessage(err.message); }
  };

  if (loading) return <Loader />;

  const fmt = (iso) => new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div>
      <PageHeader
        title="Live Classroom"
        subtitle="Plan a new class, start a live session, or review past ones"
      >
        <button className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <><FiX size={16} /> Cancel</> : <><FiPlus size={16} /> Plan New Class</>}
        </button>
      </PageHeader>

      {message && <div className="alert alert--info">{message}</div>}

      {showForm && (
        <div className="card">
          <h3>Schedule a New Class</h3>
          <form className="form-grid" onSubmit={planClass}>
            <label>Title *
              <input name="title" value={form.title} onChange={handleChange} required />
            </label>
            <label>Subject
              <input name="subject" value={form.subject} onChange={handleChange}
                     placeholder="Mathematics" />
            </label>
            <label>Class *
              <input name="className" value={form.className} onChange={handleChange} required />
            </label>
            <label>Start Time
              <input type="datetime-local" name="startTime" value={form.startTime}
                     onChange={handleChange} />
            </label>
            <label>End Time
              <input type="datetime-local" name="endTime" value={form.endTime}
                     onChange={handleChange} />
            </label>
            <label className="form-grid__full">Description
              <textarea rows="2" name="description" value={form.description}
                        onChange={handleChange} />
            </label>
            <div className="form-grid__full">
              <button className="btn btn--primary"><FiPlus size={16} /> Schedule Class</button>
            </div>
          </form>
        </div>
      )}

      <h3 className="section-title">
        <span className="dot dot--live" /> Ongoing
      </h3>
      <div className="grid-3">
        {sessions.filter((s) => s.status === 'live').map((s) => (
          <div key={s.id} className="card session-card session-card--live">
            <span className="pill pill--live">● LIVE</span>
            <h3>{s.title}</h3>
            <p className="muted">{s.subject} · {s.className}</p>
            <div className="session-card__actions">
              <button className="btn btn--primary btn--full"
                      onClick={() => navigate(`/classroom/room/${s.roomId}`)}>
                <FiVideo /> Rejoin
              </button>
              <button className="btn btn--danger btn--full" onClick={() => endClass(s)}>
                <FiX /> End Class
              </button>
            </div>
          </div>
        ))}
        {!sessions.some((s) => s.status === 'live') && <p className="muted">No live classes.</p>}
      </div>

      <h3 className="section-title" style={{ marginTop: 28 }}>
        <FiClock /> Scheduled
      </h3>
      <div className="grid-3">
        {sessions.filter((s) => s.status === 'scheduled').map((s) => (
          <div key={s.id} className="card session-card">
            <h3>{s.title}</h3>
            <p className="muted">{s.subject} · {s.className}</p>
            <p>{s.description}</p>
            <p className="session-card__time"><FiClock /> {fmt(s.startTime)}</p>
            <div className="session-card__actions">
              <button className="btn btn--primary btn--full" onClick={() => startClass(s)}>
                <FiPlay /> Start Class
              </button>
              <button className="btn btn--ghost btn--full" onClick={() => deleteSession(s)}>
                <FiTrash2 /> Delete
              </button>
            </div>
          </div>
        ))}
        {!sessions.some((s) => s.status === 'scheduled') && (
          <p className="muted">No upcoming classes scheduled.</p>
        )}
      </div>

      {sessions.some((s) => s.status === 'ended') && (
        <>
          <h3 className="section-title" style={{ marginTop: 28 }}>Past</h3>
          <div className="grid-3">
            {sessions.filter((s) => s.status === 'ended').map((s) => (
              <div key={s.id} className="card session-card session-card--ended">
                <h3>{s.title}</h3>
                <p className="muted">{s.subject} · {fmt(s.startTime)}</p>
                <span className="pill pill--ended">Ended</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}