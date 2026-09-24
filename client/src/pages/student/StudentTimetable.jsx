import { useEffect, useState } from 'react';
import { FiClock, FiAlertCircle, FiUser } from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function StudentTimetable() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // First get the student's class
        const profile = await api('/students/me');
        const cls = profile.className;
        if (!cls) {
          setData({ className: null, slots: [] });
          return;
        }
        const res = await api(`/timetable/class/${encodeURIComponent(cls)}`);
        setData(res);
      } catch (err) {
        setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  if (loading) return <Loader />;

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Timetable" />
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      </div>
    );
  }

  const grouped = DAYS.map((day) => ({
    day,
    slots: (data?.slots || [])
      .filter((s) => s.day === day)
      .sort((a, b) => a.period - b.period),
  }));

  const hasSlots = (data?.slots?.length || 0) > 0;

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={data?.className ? `Weekly schedule for ${data.className}` : 'No class assigned'}
      />

      {!hasSlots && (
        <div className="card empty-state">
          <FiClock size={32} />
          <p>No timetable has been published for your class yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Your teacher will add it soon.
          </p>
        </div>
      )}

      {hasSlots && (
        <div className="timetable-view">
          {grouped.map(({ day, slots }) => {
            if (!slots.length) return null;
            return (
              <div className="card timetable-day" key={day}>
                <h3>{day}</h3>
                <div className="timetable-slots">
                  {slots.map((s) => (
                    <div className="timetable-slot" key={s.id}>
                      <div className="timetable-slot__time">
                        <FiClock size={12} /> {s.startTime} – {s.endTime}
                      </div>
                      <div className="timetable-slot__subject">
                        <strong>{s.subject}</strong>
                        <span className="muted">
                          <FiUser size={11} /> {s.teacherName}
                        </span>
                      </div>
                      <span className="timetable-slot__period">Period {s.period}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}