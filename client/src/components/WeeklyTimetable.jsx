import { useMemo } from 'react';
import { FiClock, FiUser, FiCalendar, FiBook } from 'react-icons/fi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function WeeklyTimetable({ className, slots }) {
  /* Build a lookup: { "Monday-1": slot } */
  const byDayPeriod = useMemo(() => {
    const map = {};
    (slots || []).forEach((s) => {
      map[`${s.day}-${s.period}`] = s;
    });
    return map;
  }, [slots]);

  /* Unique sorted periods */
  const periods = useMemo(
    () => [...new Set((slots || []).map((s) => s.period))].sort((a, b) => a - b),
    [slots]
  );

  /* First slot per period → gives us the time for the row label */
  const periodTimes = useMemo(() => {
    const map = {};
    (slots || []).forEach((s) => {
      if (!map[s.period]) {
        map[s.period] = { start: s.startTime, end: s.endTime };
      }
    });
    return map;
  }, [slots]);

  const subjectCount = useMemo(
    () => new Set((slots || []).map((s) => s.subject)).size,
    [slots]
  );

  if (!slots?.length) return null;

  return (
    <div className="timetable-wrap">
      {/* Meta bar */}
      <div className="timetable-meta">
        <span className="timetable-meta__label">Class</span>
        <span className="timetable-meta__class">
          <FiBook size={13} /> {className || '—'}
        </span>
        <div className="timetable-meta__stats">
          <span className="timetable-meta__stat">
            <FiCalendar size={12} /> {slots.length} period{slots.length === 1 ? '' : 's'}
          </span>
          <span className="timetable-meta__stat">
            <FiBook size={12} /> {subjectCount} subject{subjectCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* ---------- Desktop: weekly grid ---------- */}
      <div className="timetable-grid">
        <div className="timetable-grid__corner" />
        {DAYS.map((day) => (
          <div key={day} className="timetable-grid__head">
            {day.slice(0, 3)}
          </div>
        ))}

        {periods.map((period) => {
          const time = periodTimes[period] || {};
          return (
            <div key={period} style={{ display: 'contents' }}>
              <div className="timetable-grid__time">
                <span className="timetable-grid__time-range">
                  {time.start} – {time.end}
                </span>
                <span className="timetable-grid__time-period">
                  P{period}
                </span>
              </div>

              {DAYS.map((day) => {
                const slot = byDayPeriod[`${day}-${period}`];
                return (
                  <div
                    key={day}
                    className={`timetable-grid__cell ${
                      !slot ? 'timetable-grid__cell--empty' : ''
                    }`}
                  >
                    {slot ? (
                      <>
                        <span className="timetable-grid__subject">
                          {slot.subject}
                        </span>
                        <span className="timetable-grid__teacher">
                          <FiUser size={10} /> {slot.teacherName || '—'}
                        </span>
                      </>
                    ) : (
                      <span className="timetable-grid__free">Free</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ---------- Mobile: stacked days ---------- */}
      <div className="timetable-stack">
        {DAYS.map((day) => {
          const daySlots = (slots || [])
            .filter((s) => s.day === day)
            .sort((a, b) => a.period - b.period);
          if (!daySlots.length) return null;
          return (
            <div key={day} className="timetable-stack__day">
              <div className="timetable-stack__day-label">{day}</div>
              {daySlots.map((s) => (
                <div key={s.id} className="timetable-stack__slot">
                  <div className="timetable-stack__time">
                    <FiClock size={11} /> {s.startTime}
                    <br />
                    {s.endTime}
                  </div>
                  <div className="timetable-stack__body">
                    <div className="timetable-stack__subject">{s.subject}</div>
                    <div className="timetable-stack__teacher">
                      <FiUser size={11} /> {s.teacherName || '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}