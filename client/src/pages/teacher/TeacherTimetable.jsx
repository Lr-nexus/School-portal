import { useEffect, useState } from 'react';
import {
  FiPlus, FiTrash2, FiSave, FiAlertCircle, FiCheck, FiClock
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies', 'Further Mathematics',
  'Biology', 'Literature'
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
    if (!className) { setLoading(false); return; }
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

  const addSlot = () => {
    const day = DAYS[0];
    const period = Math.max(1, ...slots.filter((s) => s.day === day).map((s) => s.period)) + 1;
    setSlots((prev) => [...prev, { ...emptySlot, day, period }]);
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

  // Group by day for display
  const grouped = DAYS.map((day) => ({
    day,
    slots: slots
      .filter((s) => s.day === day)
      .sort((a, b) => a.period - b.period),
  }));

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={`Class timetable for ${className}`}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={addSlot}>
            <FiPlus size={16} /> Add Slot
          </button>
          <button
            className="btn btn--primary"
            onClick={save}
            disabled={saving}
          >
            <FiSave size={16} /> {saving ? 'Saving…' : 'Save Timetable'}
          </button>
        </div>
      </PageHeader>

      {message && <div className="alert alert--info"><FiCheck size={16} /> {message}</div>}
      {errorMsg && <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>}

      {slots.length === 0 && (
        <div className="card empty-state">
          <FiClock size={32} />
          <p>No timetable slots yet.</p>
          <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={addSlot}>
            <FiPlus size={16} /> Add First Slot
          </button>
        </div>
      )}

      {slots.length > 0 && (
        <div className="timetable-editor">
          {grouped.map(({ day, slots: daySlots }) => (
            <div className="card timetable-day" key={day}>
              <h3>{day}</h3>
              {daySlots.length === 0 && (
                <p className="muted" style={{ fontSize: 13 }}>No slots.</p>
              )}
              {daySlots.map((s) => {
                const realIdx = slots.findIndex((x) => x === s);
                return (
                  <div className="timetable-slot-edit" key={realIdx}>
                    <label>
                      Period
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={s.period}
                        onChange={(e) => updateSlot(realIdx, { period: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      Subject
                      <select
                        value={s.subject}
                        onChange={(e) => updateSlot(realIdx, { subject: e.target.value })}
                      >
                        {SUBJECTS.map((sub) => <option key={sub}>{sub}</option>)}
                      </select>
                    </label>
                    <label>
                      Start
                      <input
                        type="time"
                        value={s.startTime}
                        onChange={(e) => updateSlot(realIdx, { startTime: e.target.value })}
                      />
                    </label>
                    <label>
                      End
                      <input
                        type="time"
                        value={s.endTime}
                        onChange={(e) => updateSlot(realIdx, { endTime: e.target.value })}
                      />
                    </label>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => removeSlot(realIdx)}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}