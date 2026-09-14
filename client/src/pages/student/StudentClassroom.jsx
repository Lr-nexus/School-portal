import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiVideo, FiClock, FiCalendar, FiRefreshCw, FiAlertCircle
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const POLL_MS = 5000; // refresh every 5 seconds

export default function StudentClassroom() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [joiningId, setJoiningId] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await api('/classroom/sessions');
      setSessions(data);
      setLastUpdate(new Date());
      setMessage('');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const join = async (session) => {
    setJoiningId(session.id);
    try {
      await api(`/classroom/rooms/${session.roomId}`); // verify still live
      navigate(`/classroom/room/${session.roomId}`);
    } catch (err) {
      setMessage(err.message);
      await load();
    } finally {
      setJoiningId(null);
    }
  };

  if (loading && sessions.length === 0) return <Loader />;

  const live     = sessions.filter((s) => s.status === 'live');
  const upcoming = sessions.filter((s) => s.status === 'scheduled');
  const ended    = sessions.filter((s) => s.status === 'ended');

  const fmt = (iso) => new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div>
      <PageHeader
        title="Live Classroom"
        subtitle="Join your ongoing lessons and see upcoming classes"
      >
        <button className="btn btn--ghost" onClick={() => { setLoading(true); load(); }}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {message && (
        <div className="alert alert--info">
          <FiAlertCircle size={16} /> {message}
        </div>
      )}

      <p className="muted" style={{ marginBottom: 14 }}>
        Last updated: {lastUpdate.toLocaleTimeString()} — auto-refreshes every {POLL_MS / 1000}s
      </p>

      {/* ---------- LIVE ---------- */}
      <h3 className="section-title">
        <span className="dot dot--live" /> Ongoing Classes
      </h3>
      <div className="grid-3">
        {live.map((s) => (
          <div key={s.id} className="card session-card session-card--live">
            <div className="session-card__head">
              <span className="pill pill--live">● LIVE</span>
              {s.participants?.length > 0 && (
                <span className="pill">{s.participants.length} in room</span>
              )}
            </div>
            <h3>{s.title}</h3>
            <p className="muted">{s.subject} · {s.className}</p>
            <p>{s.description}</p>
            <p className="muted">Teacher: {s.teacherName}</p>
            <button
              className="btn btn--primary btn--full"
              onClick={() => join(s)}
              disabled={joiningId === s.id}
            >
              <FiVideo /> {joiningId === s.id ? 'Joining…' : 'Join Now'}
            </button>
          </div>
        ))}
        {!live.length && (
          <div className="card">
            <p className="muted">
              No live classes right now. This page refreshes automatically —
              keep it open and a class will appear here the moment your teacher starts one.
            </p>
          </div>
        )}
      </div>

      {/* ---------- UPCOMING ---------- */}
      <h3 className="section-title" style={{ marginTop: 28 }}>
        <FiCalendar /> Upcoming Classes
      </h3>
      <div className="grid-3">
        {upcoming.map((s) => (
          <div key={s.id} className="card session-card">
            <h3>{s.title}</h3>
            <p className="muted">{s.subject} · {s.className}</p>
            <p>{s.description}</p>
            <p className="session-card__time">
              <FiClock /> {fmt(s.startTime)}
            </p>
            <button className="btn btn--ghost btn--full" disabled>
              Not started yet
            </button>
          </div>
        ))}
        {!upcoming.length && (
          <p className="muted">No upcoming classes scheduled.</p>
        )}
      </div>

      {/* ---------- ENDED ---------- */}
      {ended.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: 28 }}>Past Classes</h3>
          <div className="grid-3">
            {ended.map((s) => (
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