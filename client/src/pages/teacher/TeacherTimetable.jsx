import { useEffect, useMemo, useState } from 'react';
import {
  FiPlus, FiTrash2, FiSave, FiAlertCircle, FiCheck,
  FiClock, FiX, FiUser,
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

/* Fixed period template — used when a new slot is created.
   Teacher can override the times per slot in the editor modal. */
const PERIOD_TEMPLATE = [
  { period: 1, startTime: '08:00', endTime: '08:45' },
  { period: 2, startTime: '08:45', endTime: '09:30' },
  { period: 3, startTime: '09:50', endTime: '10:35' },
  { period: 4, startTime: '10:35', endTime: '11:20' },
  { period: 5, startTime: '11:40', endTime: '12:25' },
  { period: 6, startTime: '12:25', endTime: '13:10' },
  { period: 7, startTime: '13:30', endTime: '14:15' },
];

export default function TeacherTimetable() {
  const { className, loading: profileLoading } = useTeacherProfile();

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  /* Modal state — null when closed, else { day, period, slot? } */
  const [editCell, setEditCell] = useState(null);

  /* ---------- load ---------- */
  const load = async () => {
    if (!className) {
      setLoading(false);
      return;
    }
    try {
      const data = await api(`/timetable/class/${encodeURIComponent(className)}`);
      setSlots(data.slots || []);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [className]);

  /* ---------- lookup helper ---------- */
  const slotAt = useMemo(() => {
    const map = {};
    slots.forEach((s) => {
      map[`${s.day}-${s.period}`] = s;
    });
    return map;
  }, [slots]);

  /* ---------- open editor for a cell ---------- */
  const openCell = (day, period) => {
    const existing = slotAt[`${day}-${period}`];
    const template = PERIOD_TEMPLATE.find((p) => p.period === period) || {
      period,
      startTime: '08:00',
      endTime: '08:45',
    };
    setEditCell({
      day,
      period,
      slot: existing || {
        day,
        period,
        subject: SUBJECTS[0],
        startTime: template.startTime,
        endTime: template.endTime,
      },
      isNew: !existing,
    });
  };

  /* ---------- save a cell from the modal ---------- */
  const saveCell = (updated) => {
    setSlots((prev) => {
      const idx = prev.findIndex(
        (s) => s.day === updated.day && s.period === updated.period
      );
      if (idx === -1) return [...prev, updated];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setEditCell(null);
  };

  /* ---------- delete a cell ---------- */
  const deleteCell = (day, period) => {
    setSlots((prev) =>
      prev.filter((s) => !(s.day === day && s.period === period))
    );
    setEditCell(null);
  };

  /* ---------- persist to backend ---------- */
  const save = async () => {
    setSaving(true);
    setMessage('');
    setErrorMsg('');
    try {
      const res = await api(`/timetable/class/${encodeURIComponent(className)}`, {
        method: 'POST',
        body: JSON.stringify({ slots }),
      });
      setMessage(res.message || 'Timetable saved');
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- clear all ---------- */
  const clearAll = () => {
    if (!window.confirm('Clear every slot from the timetable? You still need to click Save.')) return;
    setSlots([]);
    setMessage('Timetable cleared in the editor — click Save to persist.');
  };

  /* ---------- render guards ---------- */
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

  const filledCount = slots.length;
  const filledCells = new Set(slots.map((s) => `${s.day}-${s.period}`));

  return (
    <div>
      <PageHeader
        title="Timetable"
        subtitle={`Weekly schedule for ${className} — click any cell to add or edit`}
      >
        <button className="btn btn--ghost" onClick={clearAll}>
          <FiTrash2 size={16} /> Clear All
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

      {/* Meta */}
      <div className="timetable-meta" style={{ marginBottom: 16 }}>
        <span className="timetable-meta__label">Editing</span>
        <span className="timetable-meta__class">{className}</span>
        <div className="timetable-meta__stats">
          <span className="timetable-meta__stat">
            {filledCount} / {DAYS.length * PERIOD_TEMPLATE.length} slots filled
          </span>
        </div>
      </div>

      {/* ---------- Editable grid ---------- */}
      <div className="timetable-editor-grid">
        {/* Header row */}
        <div className="timetable-editor-grid__corner">
          <FiClock size={14} />
        </div>
        {DAYS.map((day) => (
          <div key={day} className="timetable-editor-grid__head">
            {day}
          </div>
        ))}

        {/* Rows per period */}
        {PERIOD_TEMPLATE.map((p) => (
          <div key={p.period} style={{ display: 'contents' }}>
            <div className="timetable-editor-grid__time">
              <span className="timetable-editor-grid__period">
                P{p.period}
              </span>
              <span className="timetable-editor-grid__range">
                {p.startTime} – {p.endTime}
              </span>
            </div>

            {DAYS.map((day) => {
              const cellKey = `${day}-${p.period}`;
              const slot = slotAt[cellKey];
              const filled = filledCells.has(cellKey);

              return (
                <button
                  key={cellKey}
                  type="button"
                  className={`timetable-editor-grid__cell ${
                    filled ? 'timetable-editor-grid__cell--filled' : ''
                  }`}
                  onClick={() => openCell(day, p.period)}
                  title={filled ? 'Click to edit' : 'Click to add'}
                >
                  {filled ? (
                    <>
                      <span className="timetable-editor-grid__subject">
                        {slot.subject}
                      </span>
                      <span className="timetable-editor-grid__meta">
                        <FiUser size={10} /> {slot.teacherName || 'You'}
                      </span>
                    </>
                  ) : (
                    <span className="timetable-editor-grid__add">
                      <FiPlus size={14} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ---------- Edit modal ---------- */}
      {editCell && (
        <EditCellModal
          cell={editCell}
          onClose={() => setEditCell(null)}
          onSave={saveCell}
          onDelete={
            editCell.isNew
              ? null
              : () => deleteCell(editCell.day, editCell.period)
          }
        />
      )}
    </div>
  );
}

/* ==================================================================
   EDIT CELL MODAL
   ================================================================== */
function EditCellModal({ cell, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...cell.slot });
  const [err, setErr] = useState('');

  const submit = (e) => {
    e.preventDefault();
    setErr('');
    if (!form.subject) return setErr('Pick a subject');
    if (!form.startTime || !form.endTime) return setErr('Set start and end times');
    if (form.startTime >= form.endTime) {
      return setErr('End time must be after start time');
    }
    onSave({
      day: cell.day,
      period: cell.period,
      subject: form.subject,
      startTime: form.startTime,
      endTime: form.endTime,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3>
              {cell.isNew ? 'Add slot' : 'Edit slot'}
            </h3>
            <p className="muted">
              {cell.day} · Period {cell.period}
            </p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} title="Close">
            <FiX size={16} />
          </button>
        </div>

        {err && <div className="alert alert--error">{err}</div>}

        <form onSubmit={submit}>
          <label>
            Subject
            <select
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              autoFocus
            >
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <div className="form-grid">
            <label>
              Start time
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
            </label>
            <label>
              End time
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </label>
          </div>

          <div className="modal__actions">
            {onDelete && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={onDelete}
                style={{ marginRight: 'auto' }}
              >
                <FiTrash2 size={14} /> Remove
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--primary">
              <FiCheck size={14} /> {cell.isNew ? 'Add to timetable' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}