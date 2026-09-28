import { useEffect, useMemo, useState } from 'react';
import {
  FiPlus, FiTrash2, FiAlertCircle, FiCheck,
  FiThumbsUp, FiThumbsDown, FiX, FiUser, FiCalendar,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const TYPES = [
  { key: 'positive', label: 'Positive', icon: FiThumbsUp,    class: 'behaviour-pill--positive' },
  { key: 'negative', label: 'Negative', icon: FiThumbsDown,  class: 'behaviour-pill--negative' },
  { key: 'neutral',  label: 'Neutral',  icon: FiUser,        class: 'behaviour-pill--neutral'  },
];

export default function TeacherBehaviour() {
  const { className, loading: profileLoading } = useTeacherProfile();
  const toast = useToast();

  const [reports, setReports] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    studentId: '',
    type: 'positive',
    title: '',
    note: '',
    date: new Date().toISOString().split('T')[0],
  });

  const load = async () => {
    try {
      const [r, s] = await Promise.all([
        api('/behaviour/mine'),
        api('/behaviour/students'),
      ]);
      setReports(r);
      setStudents(s);
      if (s.length && !form.studentId) {
        setForm((prev) => ({ ...prev, studentId: String(s[0].id) }));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const matchesType = filter === 'all' || r.type === filter;
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.student.name.toLowerCase().includes(q) ||
        (r.note || '').toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [reports, filter, search]);

  const summary = useMemo(() => ({
    total: reports.length,
    positive: reports.filter((r) => r.type === 'positive').length,
    negative: reports.filter((r) => r.type === 'negative').length,
  }), [reports]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.studentId) return toast.error('Pick a student');
    if (!form.title.trim()) return toast.error('Add a title');

    setSaving(true);
    try {
      await api('/behaviour', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          studentId: Number(form.studentId),
        }),
      });
      toast.success('Note logged');
      setForm({
        studentId: students[0] ? String(students[0].id) : '',
        type: 'positive',
        title: '',
        note: '',
        date: new Date().toISOString().split('T')[0],
      });
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api(`/behaviour/${id}`, { method: 'DELETE' });
      toast.success('Note deleted');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading || profileLoading) return <Loader />;

  const noStudents = !students.length;

  return (
    <div>
      <PageHeader
        title="Behaviour Log"
        subtitle={noStudents ? 'No students assigned' : `Notes for ${className || 'your students'}`}
      >
        <button
          className="btn btn--primary"
          onClick={() => setShowForm((v) => !v)}
          disabled={noStudents}
        >
          {showForm
            ? <><FiX size={16} /> Cancel</>
            : <><FiPlus size={16} /> Log Note</>}
        </button>
      </PageHeader>

      <div className="stats-grid">
        <StatCard label="Total Notes" value={summary.total}      color="#2563eb" />
        <StatCard label="Positive"    value={summary.positive}   color="#16a34a" />
        <StatCard label="Negative"    value={summary.negative}   color="#dc2626" />
      </div>

      {showForm && !noStudents && (
        <div className="card">
          <h3><FiPlus size={16} /> Log a Behaviour Note</h3>
          <form onSubmit={submit}>
            <div className="form-grid">
              <label>Student *
                <select
                  value={form.studentId}
                  onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                  required
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.className} · {s.admissionNo}
                    </option>
                  ))}
                </select>
              </label>

              <label>Type
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label>Date
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>

              <label className="form-grid__full">Title *
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Helped a classmate during maths"
                  required
                />
              </label>

              <label className="form-grid__full">Note (optional)
                <textarea
                  rows="3"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="More detail…"
                />
              </label>
            </div>

            <div className="profile-form__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button className="btn btn--primary" disabled={saving}>
                <FiCheck size={16} /> {saving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!noStudents && (
        <>
          <div className="filters-bar">
            <div className="filters-bar__search">
              <input
                type="text"
                placeholder="Search notes by student or title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 12 }}
              />
            </div>
            <div className="filters-bar__select">
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All types</option>
                {TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="card empty-state">
              <FiAlertCircle size={32} />
              <p>
                {reports.length === 0
                  ? 'No behaviour notes logged yet.'
                  : 'No notes match your filters.'}
              </p>
            </div>
          )}

          <div className="behaviour-timeline">
            {filtered.map((r) => {
              const meta = TYPES.find((t) => t.key === r.type) || TYPES[0];
              const Icon = meta.icon;
              return (
                <div className="behaviour-card" key={r.id}>
                  <div className={`behaviour-card__icon behaviour-card__icon--${r.type}`}>
                    <Icon size={16} />
                  </div>
                  <div className="behaviour-card__body">
                    <div className="behaviour-card__head">
                      <strong>{r.title}</strong>
                      <span className={`behaviour-pill ${meta.class}`}>{meta.label}</span>
                    </div>
                    <div className="behaviour-card__meta">
                      <span><FiUser size={11} /> {r.student.name} · {r.student.className}</span>
                      <span><FiCalendar size={11} /> {r.date}</span>
                    </div>
                    {r.note && <p className="behaviour-card__note">{r.note}</p>}
                  </div>
                  <button
                    className="behaviour-card__del"
                    onClick={() => remove(r.id)}
                    title="Delete note"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}