import { useEffect, useState } from 'react';
import { FiClock, FiUser, FiAlertCircle } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function ParentTimetable() {
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api('/parents/me/child/timetable')
      .then(setData)
      .catch((e) => setErrorMsg(e.message));
  }, []);

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Child Timetable" />
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const grouped = DAYS.map((day) => ({
    day,
    slots: data.slots.filter((s) => s.day === day).sort((a, b) => a.period - b.period),
  }));

  const hasSlots = data.slots.length > 0;

  return (
    <div>
      <PageHeader
        title="Child Timetable"
        subtitle={`Weekly schedule for ${data.className}`}
      />

      {!hasSlots && (
        <div className="card empty-state">
          <FiClock size={32} />
          <p>No timetable published for this class yet.</p>
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
                        <span className="muted"><FiUser size={11} /> {s.teacherName}</span>
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