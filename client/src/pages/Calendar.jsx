import { useEffect, useMemo, useState } from 'react';
import {
  FiChevronLeft, FiChevronRight, FiCalendar as FiCal,
  FiAlertCircle, FiPlus, FiX, FiTrash2, FiCheck
} from 'react-icons/fi';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';

const TYPE_COLORS = {
  class: '#dc2626',
  assignment: '#16a34a',
  quiz: '#0891b2',
  announcement: '#7c3aed',
  event: '#f59e0b',
};

const TYPE_LABELS = {
  class: 'Live Class',
  assignment: 'Assignment',
  quiz: 'Quiz',
  announcement: 'Announcement',
  event: 'Event',
};

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const isoDate = (d) => {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().split('T')[0];
};

export default function Calendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', date: '', endDate: '', category: 'Event', audience: 'all',
  });
  const [saving, setSaving] = useState(false);

  const from = isoDate(startOfMonth(cursor));
  const to = isoDate(endOfMonth(cursor));

  const load = async () => {
    setLoading(true);
    try {
      const data = await api(`/calendar?from=${from}&to=${to}`);
      setEvents(data.events);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [from, to]);

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    const startPad = (first.getDay() + 6) % 7; // Monday = 0
    const total = startPad + last.getDate();
    const rows = Math.ceil(total / 7);
    const arr = [];
    for (let i = 0; i < rows * 7; i++) {
      const dayNum = i - startPad + 1;
      if (dayNum < 1 || dayNum > last.getDate()) {
        arr.push(null);
      } else {
        arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), dayNum));
      }
    }
    return arr;
  }, [cursor]);

  const eventsOnDay = (date) => {
    if (!date) return [];
    const key = isoDate(date);
    return events.filter((e) => e.date.startsWith(key));
  };

  const shiftMonth = (dir) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
    setSelectedDay(null);
  };

  const saveEvent = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/calendar/events', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ title: '', description: '', date: '', endDate: '', category: 'Event', audience: 'all' });
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    const numericId = id.replace('event-', '');
    try {
      await api(`/calendar/events/${numericId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Everything happening this month">
        {isAdmin && (
          <button className="btn btn--primary" onClick={() => setShowForm(true)}>
            <FiPlus size={16} /> Add Event
          </button>
        )}
      </PageHeader>

      {errorMsg && <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>}

      {showForm && isAdmin && (
        <div className="card">
          <h3><FiPlus size={16} /> New Calendar Event</h3>
          <form onSubmit={saveEvent}>
            <div className="form-grid">
              <label className="form-grid__full">
                Title *
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </label>
              <label>
                Date *
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </label>
              <label>
                End Date (optional)
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </label>
              <label>
                Category
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {['Event', 'Exam', 'Holiday', 'Meeting', 'Sports'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>
                Audience
                <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                  <option value="all">Everyone</option>
                  <option value="student">Students</option>
                  <option value="teacher">Teachers</option>
                </select>
              </label>
              <label className="form-grid__full">
                Description
                <textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn--primary" disabled={saving}>
                <FiCheck size={14} /> {saving ? 'Saving…' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar header */}
      <div className="card calendar-wrap">
        <div className="calendar-head">
          <button className="btn btn--ghost btn--sm" onClick={() => shiftMonth(-1)}>
            <FiChevronLeft size={14} />
          </button>
          <h3>{monthLabel}</h3>
          <button className="btn btn--ghost btn--sm" onClick={() => shiftMonth(1)}>
            <FiChevronRight size={14} />
          </button>
        </div>

        {loading ? (
          <Loader />
        ) : (
          <>
            <div className="calendar-grid">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="calendar-dow">{d}</div>
              ))}
              {cells.map((date, i) => {
                const dayEvents = eventsOnDay(date);
                const isToday = date && isoDate(date) === isoDate(new Date());
                const isSelected = date && selectedDay && isoDate(date) === isoDate(selectedDay);
                return (
                  <button
                    key={i}
                    className={[
                      'calendar-cell',
                      !date ? 'calendar-cell--empty' : '',
                      isToday ? 'calendar-cell--today' : '',
                      isSelected ? 'calendar-cell--selected' : '',
                    ].join(' ')}
                    onClick={() => date && setSelectedDay(date)}
                    disabled={!date}
                  >
                    {date && (
                      <>
                        <span className="calendar-cell__num">{date.getDate()}</span>
                        <div className="calendar-cell__dots">
                          {dayEvents.slice(0, 3).map((e, idx) => (
                            <span
                              key={idx}
                              className="calendar-dot"
                              style={{ background: TYPE_COLORS[e.type] || '#666' }}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="calendar-cell__more">+{dayEvents.length - 3}</span>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected day panel */}
            {selectedDay && (
              <div className="calendar-day-panel">
                <h4>
                  {selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h4>
                {eventsOnDay(selectedDay).length === 0 && (
                  <p className="muted">Nothing scheduled.</p>
                )}
                {eventsOnDay(selectedDay).map((e) => (
                  <div className="calendar-event" key={e.id}>
                    <span
                      className="calendar-event__dot"
                      style={{ background: TYPE_COLORS[e.type] || '#666' }}
                    />
                    <div className="calendar-event__body">
                      <strong>{e.title}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {TYPE_LABELS[e.type] || e.type} · {e.meta}
                      </div>
                    </div>
                    {e.link && (
                      <a className="btn btn--ghost btn--sm" href={e.link}>Open</a>
                    )}
                    {isAdmin && e.type === 'event' && (
                      <button className="btn btn--danger btn--sm" onClick={() => deleteEvent(e.id)}>
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}