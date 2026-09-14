import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiVideo, FiRefreshCw, FiUsers, FiClock,
  FiAlertCircle, FiEye
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function AdminClassroom() {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [all, live] = await Promise.all([
        api('/classroom/sessions'),
        api('/classroom/admin/active')
      ]);
      setSessions(all);
      setActive(live);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  const refresh = () => { setLoading(true); load(); };

  if (loading && sessions.length === 0) return <Loader />;

  const liveSessions      = sessions.filter((s) => s.status === 'live');
  const scheduledSessions = sessions.filter((s) => s.status === 'scheduled');
  const endedSessions     = sessions.filter((s) => s.status === 'ended');

  const totalLiveParticipants = active.reduce(
    (sum, s) => sum + (s.participants?.length || 0), 0
  );

  const fmt = (iso) => new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div>
      <PageHeader
        title="Live Classes Monitor"
        subtitle="Watch every classroom in the school — who is live and who is attending"
      >
        <button className="btn btn--ghost" onClick={refresh}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {error && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {error}
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Currently Live" value={liveSessions.length}      color="#dc2626" />
        <StatCard label="Participants"   value={totalLiveParticipants}    color="#16a34a" />
        <StatCard label="Scheduled"      value={scheduledSessions.length} color="#2563eb" />
        <StatCard label="Completed"      value={endedSessions.length}     color="#64748b" />
      </div>

      <p className="muted" style={{ marginBottom: 14 }}>
        Last updated: {lastUpdate.toLocaleTimeString()} — auto-refreshes every 5s
      </p>

      {/* --------- LIVE NOW --------- */}
      <h3 className="section-title">
        <span className="dot dot--live" /> Live Now
      </h3>

      {liveSessions.length === 0 && (
        <div className="card">
          <p className="muted">No live classes right now.</p>
        </div>
      )}

      <div className="grid-2">
        {liveSessions.map((s) => {
          const live = active.find((a) => a.roomId === s.roomId);
          const participants = live?.participants || [];

          return (
            <div key={s.id} className="card session-card session-card--live">
              <div className="session-card__head">
                <span className="pill pill--live">● LIVE</span>
                <span className="pill">
                  <FiUsers size={12} /> {participants.length}
                </span>
              </div>

              <h3>{s.title}</h3>
              <p className="muted">{s.subject} · {s.className}</p>
              <p className="muted">Teacher: {s.teacherName}</p>

              <button
                className="btn btn--primary btn--full"
                style={{ marginTop: 10 }}
                onClick={() => navigate(`/classroom/room/${s.roomId}`)}
              >
                <FiEye size={16} /> Watch Live
              </button>

              <div className="participants-list">
                <h4>In the room</h4>
                {participants.length === 0 && (
                  <p className="muted">Room is empty.</p>
                )}
                {participants.map((p) => (
                  <div key={p.socketId} className="participant">
                    <div className="avatar avatar--sm">
                      {(p.name || '?').charAt(0)}
                    </div>
                    <div className="participant__info">
                      <strong>{p.name}</strong>
                      <span className={`badge badge--${p.role}`}>{p.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* --------- SCHEDULED --------- */}
      {scheduledSessions.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: 28 }}>
            <FiClock /> Upcoming
          </h3>
          <div className="card">
            <table className="table table--striped">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Teacher</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Starts</th>
                </tr>
              </thead>
              <tbody>
                {scheduledSessions.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>{s.title}</td>
                    <td>{s.teacherName}</td>
                    <td>{s.className}</td>
                    <td>{s.subject}</td>
                    <td>{fmt(s.startTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* --------- ENDED --------- */}
      {endedSessions.length > 0 && (
        <>
          <h3 className="section-title" style={{ marginTop: 28 }}>Recently Ended</h3>
          <div className="card">
            <table className="table table--striped">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Teacher</th>
                  <th>Class</th>
                  <th>Ended</th>
                </tr>
              </thead>
              <tbody>
                {endedSessions.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>{s.title}</td>
                    <td>{s.teacherName}</td>
                    <td>{s.className}</td>
                    <td>{s.endedAt ? fmt(s.endedAt) : fmt(s.startTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}