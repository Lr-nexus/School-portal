import { useEffect, useState } from 'react';
import {
  FiPlus, FiTrash2, FiSave, FiAlertCircle, FiCheck, FiClock,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies', 'Further Mathematics',
  'Biology', 'Literature',
];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const emptySlot = {
  day: 'Monday',
  period: 1,
  startTime: '08:00',
  endTime: '08:45',
  subject: 'Mathematics',
};

export default function TeacherTimetable() {
  const { className, loading: profileLoading } = useTeacherProfile();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const load = async () => {
    if (!className) {
      setLoading(false);
      return;
    }
    try {
      const data = await api(`/timetable/class/${encodeURIComponent(className)}`);
      setSlots(data.slots);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [className]);

  const addSlot = (day) => {
    const d = day || DAYS[0];
    const period =
      Math.max(0, ...slots.filter((s) => s.day === d).map((s) => s.period)) + 1;
    setSlots((prev) => [...prev, { ...emptySlot, day: d, period }]);
  };

  const updateSlot = (i, patch) =>
    setSlots((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const removeSlot = (i) =>
    setSlots((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    setMessage('');
    setErrorMsg('');
    try {
      const res = await api(`/timetable/class/${encodeURIComponent(className)}`, {
        method: 'POST',
        body: JSON.stringify({ slots }),
      });
      setMessage(res.message);
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading || loading) return <Loader />;

  if (!className) {
    return (
      <div>
        <PageHeader title="Timetable" subtitle="No class assigned" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> You have no class assigned. Contact the admin.
        </div>
      </div>
    );
  }

  const grouped = DAYS.map((day) => ({
    day,
    slots: slots
      .map((s, idx) => ({ ...s, _idx: idx }))
      .filter((s) => s.day === day)
      .sort((a, b) => a.period - b.period),
  }));

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={`Class timetable for ${className}`}
      >
        <button className="btn btn--ghost" onClick={() => addSlot()}>
          <FiPlus size={16} /> Add Slot
        </button>
        <button className="btn btn--primary" onClick={save} disabled={saving}>
          <FiSave size={16} /> {saving ? 'Saving…' : 'Save Timetable'}
        </button>
      </PageHeader>

      {message && (
        <div className="alert alert--info">
          <FiCheck size={16} /> {message}
        </div>
      )}
      {errorMsg && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {slots.length === 0 && (
        <div className="card timetable-empty">
          <FiClock size={40} />
          <p>No timetable slots yet.</p>
          <button
            className="btn btn--primary"
            style={{ marginTop: 14 }}
            onClick={() => addSlot()}
          >
            <FiPlus size={16} /> Add First Slot
          </button>
        </div>
      )}

      {slots.length > 0 && (
        <div className="timetable-editor">
          {grouped.map(({ day, slots: daySlots }) => (
            <div className="timetable-editor__day" key={day}>
              <div className="timetable-editor__day-head">
                <h3>{day}</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="timetable-editor__day-count">
                    {daySlots.length} slot{daySlots.length === 1 ? '' : 's'}
                  </span>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => addSlot(day)}
                  >
                    <FiPlus size={12} /> Add
                  </button>
                </div>
              </div>

              {daySlots.length === 0 ? (
                <div style={{ padding: '14px 16px' }}>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    No slots yet for {day}.
                  </p>
                </div>
              ) : (
                <div className="timetable-editor__slots">
                  {daySlots.map((s) => (
                    <div className="timetable-slot-edit" key={s._idx}>
                      <label>
                        Period
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={s.period}
                          onChange={(e) =>
                            updateSlot(s._idx, { period: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label>
                        Subject
                        <select
                          value={s.subject}
                          onChange={(e) =>
                            updateSlot(s._idx, { subject: e.target.value })
                          }
                        >
                          {SUBJECTS.map((sub) => (
                            <option key={sub}>{sub}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Start
                        <input
                          type="time"
                          value={s.startTime}
                          onChange={(e) =>
                            updateSlot(s._idx, { startTime: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        End
                        <input
                          type="time"
                          value={s.endTime}
                          onChange={(e) =>
                            updateSlot(s._idx, { endTime: e.target.value })
                          }
                        />
                      </label>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => removeSlot(s._idx)}
                        title="Remove slot"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}