import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiBookOpen, FiCalendar, FiCheck, FiClipboard, FiPlus,
  FiSave, FiTrash2, FiTrendingUp, FiSearch, FiX,
  FiAlertCircle, FiEdit3, FiUsers,
} from 'react-icons/fi';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api } from '../../api/api';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

/* ==========================================================================
   Constants & helpers
   ========================================================================== */

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function currentSession() {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() >= 8 ? year : year - 1;
  return `${start}/${start + 1}`;
}

function gradeFor(total) {
  if (total >= 75) return { grade: 'A', remark: 'Excellent' };
  if (total >= 65) return { grade: 'B', remark: 'Very Good' };
  if (total >= 55) return { grade: 'C', remark: 'Good' };
  if (total >= 45) return { grade: 'D', remark: 'Fair' };
  if (total >= 40) return { grade: 'E', remark: 'Pass' };
  return { grade: 'F', remark: 'Fail' };
}

/* ==========================================================================
   Gradebook tab
   ========================================================================== */

function GradebookTab({ target, session, term, onSessionChange, onTermChange }) {
  const [rows, setRows] = useState([]);
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCA, setBulkCA] = useState('');
  const [bulkExam, setBulkExam] = useState('');

  const load = useCallback(async () => {
    if (!target.className || !target.subject) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const qs = new URLSearchParams({
        className: target.className,
        subject: target.subject,
        session,
        term,
      });
      const data = await api(`/teachers/me/academic/gradebook?${qs}`);
      const normalized = data.map((r) => ({
        ...r,
        ca: r.ca ?? '',
        exam: r.exam ?? '',
      }));
      setRows(normalized);
      const snap = {};
      normalized.forEach((r) => {
        snap[r.studentId] = { ca: r.ca, exam: r.exam };
      });
      setOriginal(snap);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [target.className, target.subject, session, term]);

  useEffect(() => { load(); }, [load]);

  const isDirty = useCallback(
    (row) => {
      const orig = original[row.studentId];
      if (!orig) return true;
      return String(orig.ca) !== String(row.ca) || String(orig.exam) !== String(row.exam);
    },
    [original]
  );

  const dirtyRows = useMemo(() => rows.filter(isDirty), [rows, isDirty]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.admissionNo || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const updateField = (studentId, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, [field]: value } : r))
    );
  };

  const save = async () => {
    const entries = dirtyRows.map((r) => ({
      studentId: r.studentId,
      ca: r.ca === '' ? 0 : Number(r.ca),
      exam: r.exam === '' ? 0 : Number(r.exam),
    }));
    if (!entries.length) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await api('/teachers/me/academic/gradebook', {
        method: 'PUT',
        body: JSON.stringify({
          className: target.className,
          subject: target.subject,
          session, term, entries,
        }),
      });
      setMessage(res.message || `Saved ${entries.length} student(s)`);
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const applyBulk = () => {
    const caVal = bulkCA === '' ? null : Number(bulkCA);
    const examVal = bulkExam === '' ? null : Number(bulkExam);
    if (caVal === null && examVal === null) { setBulkOpen(false); return; }
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        ca: caVal !== null ? caVal : r.ca,
        exam: examVal !== null ? examVal : r.exam,
      }))
    );
    setBulkOpen(false);
    setBulkCA('');
    setBulkExam('');
  };

  const handleKeyDown = (e, rowIdx, col) => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nextIdx = e.key === 'Enter' || e.key === 'ArrowDown' ? rowIdx + 1 : rowIdx - 1;
    const selector = `input[data-row="${nextIdx}"][data-col="${col}"]`;
    const el = document.querySelector(selector);
    if (el) el.focus();
  };

  const stats = useMemo(() => {
    const withScores = rows.filter((r) => r.ca !== '' || r.exam !== '');
    if (!withScores.length) return { avg: 0, passRate: 0, top: null, count: 0 };
    const totals = withScores.map((r) => (Number(r.ca) || 0) + (Number(r.exam) || 0));
    const avg = Math.round(totals.reduce((s, x) => s + x, 0) / totals.length);
    const passCount = totals.filter((t) => t >= 40).length;
    const top = withScores.reduce((best, r) => {
      const t = (Number(r.ca) || 0) + (Number(r.exam) || 0);
      const bestT = best ? (Number(best.ca) || 0) + (Number(best.exam) || 0) : -1;
      return t > bestT ? r : best;
    }, null);
    return {
      avg,
      passRate: Math.round((passCount / withScores.length) * 100),
      top,
      count: withScores.length,
    };
  }, [rows]);

  return (
    <>
      {message && (
        <div className="alert alert--info"><FiCheck size={16} /> {message}</div>
      )}
      {errorMsg && (
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      )}

      <div className="card gradebook-toolbar">
        <div className="gradebook-toolbar__left">
          <h3>{target.className} · {target.subject}</h3>
          <p className="muted">CA out of 30 · Exam out of 70 · Total 100</p>
        </div>

        <div className="gradebook-toolbar__right">
          <div className="filters-bar__search gradebook-search">
            <FiSearch size={14} />
            <input
              placeholder="Search student…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <input
            className="gradebook-toolbar__session"
            value={session}
            onChange={(e) => onSessionChange(e.target.value)}
            placeholder="2024/2025"
            title="Academic session"
          />

          <select value={term} onChange={(e) => onTermChange(e.target.value)} title="Term">
            {TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>

          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setBulkOpen((v) => !v)}
          >
            <FiEdit3 size={14} /> Bulk Fill
          </button>

          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={save}
            disabled={saving || !dirtyRows.length}
          >
            <FiSave size={14} />
            {saving ? 'Saving…' : dirtyRows.length ? `Save ${dirtyRows.length}` : 'Save'}
          </button>
        </div>
      </div>

      {bulkOpen && (
        <div className="card gradebook-bulk">
          <h4>Bulk fill all students</h4>
          <p className="muted">
            Applies to every student in this class. Leave a field blank to skip it.
          </p>
          <div className="gradebook-bulk__row">
            <label>
              CA (0 – 30)
              <input
                type="number" min="0" max="30"
                value={bulkCA}
                onChange={(e) => setBulkCA(e.target.value)}
                placeholder="e.g. 20"
              />
            </label>
            <label>
              Exam (0 – 70)
              <input
                type="number" min="0" max="70"
                value={bulkExam}
                onChange={(e) => setBulkExam(e.target.value)}
                placeholder="e.g. 45"
              />
            </label>
            <div className="gradebook-bulk__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setBulkOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={applyBulk}>
                <FiCheck size={14} /> Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="gradebook-stats">
        <div className="gradebook-stat">
          <span className="gradebook-stat__label">Students</span>
          <strong className="gradebook-stat__value">{rows.length}</strong>
        </div>
        <div className="gradebook-stat">
          <span className="gradebook-stat__label">Entered</span>
          <strong className="gradebook-stat__value">{stats.count}</strong>
        </div>
        <div className="gradebook-stat">
          <span className="gradebook-stat__label">Class Avg</span>
          <strong className="gradebook-stat__value">
            {stats.count ? stats.avg : '—'}
          </strong>
        </div>
        <div className="gradebook-stat">
          <span className="gradebook-stat__label">Pass Rate</span>
          <strong className="gradebook-stat__value">
            {stats.count ? `${stats.passRate}%` : '—'}
          </strong>
        </div>
        <div className="gradebook-stat">
          <span className="gradebook-stat__label">Top Student</span>
          <strong className="gradebook-stat__value">
            {stats.top ? stats.top.name : '—'}
          </strong>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="card gradebook-card">
          {!rows.length ? (
            <div className="empty-state">
              <FiUsers size={32} />
              <p>No students enrolled in this class.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="gradebook-table">
                <thead>
                  <tr>
                    <th className="gradebook-table__num">#</th>
                    <th>Student</th>
                    <th>Admission No.</th>
                    <th className="gradebook-table__input">CA (30)</th>
                    <th className="gradebook-table__input">Exam (70)</th>
                    <th className="right">Total</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => {
                    const ca = Number(row.ca) || 0;
                    const exam = Number(row.exam) || 0;
                    const total = ca + exam;
                    const { grade } = gradeFor(total);
                    const dirty = isDirty(row);
                    const hasScore = row.ca !== '' || row.exam !== '';

                    return (
                      <tr key={row.studentId} className={dirty ? 'gradebook-row--dirty' : ''}>
                        <td className="gradebook-table__num">{idx + 1}</td>
                        <td>
                          <div className="gradebook-student">
                            <div className="avatar avatar--sm">{row.name.charAt(0)}</div>
                            <strong>{row.name}</strong>
                          </div>
                        </td>
                        <td className="muted">{row.admissionNo}</td>
                        <td>
                          <input
                            type="number" min="0" max="30" step="1"
                            className="gradebook-input"
                            value={row.ca}
                            data-row={idx}
                            data-col="ca"
                            onChange={(e) => updateField(row.studentId, 'ca', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'ca')}
                            onFocus={(e) => e.target.select()}
                            placeholder="—"
                          />
                        </td>
                        <td>
                          <input
                            type="number" min="0" max="70" step="1"
                            className="gradebook-input"
                            value={row.exam}
                            data-row={idx}
                            data-col="exam"
                            onChange={(e) => updateField(row.studentId, 'exam', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'exam')}
                            onFocus={(e) => e.target.select()}
                            placeholder="—"
                          />
                        </td>
                        <td className="right">
                          <strong className={hasScore ? '' : 'muted'}>
                            {hasScore ? total : '—'}
                          </strong>
                        </td>
                        <td>
                          {hasScore
                            ? <span className={`grade grade--${grade}`}>{grade}</span>
                            : <span className="muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredRows.length && (
                    <tr>
                      <td colSpan="7" className="muted" style={{ textAlign: 'center', padding: 30 }}>
                        No students match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {dirtyRows.length > 0 && (
            <div className="gradebook-foot">
              <span className="muted">
                {dirtyRows.length} unsaved change{dirtyRows.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ==========================================================================
   Question bank tab
   ========================================================================== */

function QuestionBankTab({ target }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    question: '',
    options: ['', '', '', ''],
    answer: 0,
  });

  const load = useCallback(async () => {
    if (!target.className || !target.subject) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const qs = new URLSearchParams({
        className: target.className,
        subject: target.subject,
      });
      const data = await api(`/teachers/me/academic/questions?${qs}`);
      setQuestions(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [target.className, target.subject]);

  useEffect(() => { load(); }, [load]);

  const saveQuestion = async (e) => {
    e.preventDefault();
    const options = form.options.map((o) => o.trim());
    while (options.length && !options[options.length - 1]) options.pop();

    if (!form.question.trim() || options.length < 2) {
      setErrorMsg('Add a question and at least two options.');
      return;
    }
    if (form.answer >= options.length) {
      setErrorMsg('Pick the correct answer from the options.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    try {
      await api('/teachers/me/academic/questions', {
        method: 'POST',
        body: JSON.stringify({
          className: target.className,
          subject: target.subject,
          question: form.question.trim(),
          options,
          answer: form.answer,
        }),
      });
      setForm({ question: '', options: ['', '', '', ''], answer: 0 });
      setMessage('Question added to the bank');
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await api(`/teachers/me/academic/questions/${id}`, { method: 'DELETE' });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (!q) return true;
      if (item.question.toLowerCase().includes(q)) return true;
      return item.options.some((o) => o.toLowerCase().includes(q));
    });
  }, [questions, search]);

  return (
    <>
      {message && (
        <div className="alert alert--info"><FiCheck size={16} /> {message}</div>
      )}
      {errorMsg && (
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      )}

      <div className="academic-columns">
        <form className="card academic-panel academic-form" onSubmit={saveQuestion}>
          <h3><FiPlus size={16} /> New question</h3>
          <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
            Saved to <strong>{target.className}</strong> · <strong>{target.subject}</strong>
          </p>

          <label>
            Question text *
            <textarea
              rows="3"
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="What is the capital of Nigeria?"
              required
            />
          </label>

          <div className="question-options-grid">
            {form.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const isCorrect = form.answer === i;
              return (
                <label
                  key={i}
                  className={`question-option-input ${isCorrect ? 'question-option-input--correct' : ''}`}
                >
                  <button
                    type="button"
                    className={`question-option-input__mark ${isCorrect ? 'question-option-input__mark--on' : ''}`}
                    onClick={() => setForm({ ...form, answer: i })}
                    title={isCorrect ? 'Correct answer' : 'Set as correct'}
                  >
                    {letter}
                  </button>
                  <input
                    value={opt}
                    placeholder={`Option ${letter}`}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        options: form.options.map((v, idx) => (idx === i ? e.target.value : v)),
                      })
                    }
                    required={i < 2}
                  />
                </label>
              );
            })}
          </div>

          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Click the letter to mark the correct answer.
          </p>

          <div className="form-grid__actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setForm({ question: '', options: ['', '', '', ''], answer: 0 })}
            >
              Clear
            </button>
            <button className="btn btn--primary" disabled={busy}>
              <FiPlus size={15} /> {busy ? 'Saving…' : 'Add to bank'}
            </button>
          </div>
        </form>

        <section className="card academic-panel">
          <div className="academic-panel__heading">
            <div>
              <h3><FiBookOpen size={16} /> {target.subject} bank</h3>
              <p className="muted">
                {questions.length} question{questions.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {questions.length > 0 && (
            <div className="filters-bar" style={{ marginBottom: 12 }}>
              <div className="filters-bar__search">
                <FiSearch size={14} />
                <input
                  placeholder="Search questions…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}

          {loading ? (
            <Loader />
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <FiBookOpen size={32} />
              <p>
                {questions.length === 0
                  ? 'No saved questions yet. Add your first one on the left.'
                  : 'No questions match your search.'}
              </p>
            </div>
          ) : (
            <div className="question-list">
              {filtered.map((item, idx) => (
                <QuestionItem
                  key={item.id}
                  item={item}
                  index={idx}
                  onDelete={remove}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function QuestionItem({ item, index, onDelete }) {
  return (
    <article className="question-item">
      <div className="question-item__head">
        <span className="question-item__num">Q{index + 1}</span>
        <span className="question-item__text">{item.question}</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(item.id)}
          title="Delete question"
          aria-label="Delete question"
        >
          <FiTrash2 size={14} />
        </button>
      </div>

      <div className="question-item__options">
        {item.options.map((opt, i) => {
          const isCorrect = i === item.answer;
          return (
            <div
              key={i}
              className={`question-item__option ${isCorrect ? 'question-item__option--correct' : ''}`}
            >
              <span className="question-item__letter">{String.fromCharCode(65 + i)}.</span>
              <span>{opt}</span>
              {isCorrect && <FiCheck size={12} style={{ marginLeft: 'auto' }} />}
            </div>
          );
        })}
      </div>
    </article>
  );
}

/* ==========================================================================
   Lesson plans tab
   ========================================================================== */

function LessonPlansTab({ target }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const emptyForm = {
    title: '',
    lessonDate: new Date().toISOString().slice(0, 10),
    objectives: '',
    activities: '',
    resources: '',
  };

  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/teachers/me/academic/lessons');
      setLessons(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.objectives.trim()) {
      setErrorMsg('Title and objectives are required.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await api('/teachers/me/academic/lessons', {
        method: 'POST',
        body: JSON.stringify({
          className: target.className,
          subject: target.subject,
          ...form,
        }),
      });
      setForm(emptyForm);
      setMessage('Lesson plan saved');
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this lesson plan?')) return;
    try {
      await api(`/teachers/me/academic/lessons/${id}`, { method: 'DELETE' });
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const filtered = lessons.filter(
    (l) => l.class_name === target.className && l.subject === target.subject
  );

  return (
    <>
      {message && (
        <div className="alert alert--info"><FiCheck size={16} /> {message}</div>
      )}
      {errorMsg && (
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      )}

      <div className="academic-columns">
        <form className="card academic-panel academic-form" onSubmit={save}>
          <h3><FiPlus size={16} /> New lesson plan</h3>

          <label>
            Title *
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Introduction to Quadratic Equations"
              required
            />
          </label>

          <label>
            Date *
            <input
              type="date"
              value={form.lessonDate}
              onChange={(e) => setForm({ ...form, lessonDate: e.target.value })}
              required
            />
          </label>

          <label>
            Learning objectives *
            <textarea
              rows="3"
              value={form.objectives}
              onChange={(e) => setForm({ ...form, objectives: e.target.value })}
              placeholder="By the end of the lesson students should be able to…"
              required
            />
          </label>

          <label>
            Activities
            <textarea
              rows="3"
              value={form.activities}
              onChange={(e) => setForm({ ...form, activities: e.target.value })}
              placeholder="Introduction · Group work · Practice questions · Summary"
            />
          </label>

          <label>
            Resources
            <input
              value={form.resources}
              onChange={(e) => setForm({ ...form, resources: e.target.value })}
              placeholder="Textbook page 45, whiteboard, markers"
            />
          </label>

          <div className="form-grid__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setForm(emptyForm)}>
              Clear
            </button>
            <button className="btn btn--primary" disabled={busy}>
              <FiCheck size={15} /> {busy ? 'Saving…' : 'Save plan'}
            </button>
          </div>
        </form>

        <section className="card academic-panel">
          <div className="academic-panel__heading">
            <div>
              <h3><FiCalendar size={16} /> {target.subject} · {target.className}</h3>
              <p className="muted">
                {filtered.length} planned lesson{filtered.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {loading ? (
            <Loader />
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <FiCalendar size={32} />
              <p>No lesson plans for this class and subject yet.</p>
            </div>
          ) : (
            <div className="lesson-list">
              {filtered.map((lesson) => {
                const d = new Date(`${lesson.lesson_date}T00:00:00`);
                return (
                  <article className="lesson-card" key={lesson.id}>
                    <div className="lesson-card__date">
                      <span className="lesson-card__day">{d.getDate()}</span>
                      <span className="lesson-card__month">
                        {d.toLocaleString('en-GB', { month: 'short' })}
                      </span>
                    </div>
                    <div className="lesson-card__body">
                      <h4>{lesson.title}</h4>
                      <p><strong>Objectives:</strong> {lesson.objectives}</p>
                      {lesson.activities && <p><strong>Activities:</strong> {lesson.activities}</p>}
                      {lesson.resources && <p><strong>Resources:</strong> {lesson.resources}</p>}
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => remove(lesson.id)}
                      title="Delete lesson plan"
                      aria-label="Delete lesson plan"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* ==========================================================================
   Progress tab — Recharts area chart
   ========================================================================== */

function ProgressTab({ target }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    if (!target.className || !target.subject) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const qs = new URLSearchParams({
        className: target.className,
        subject: target.subject,
      });
      const data = await api(`/teachers/me/academic/progress?${qs}`);
      setPoints(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [target.className, target.subject]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;

  if (errorMsg) {
    return (
      <div className="card">
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      </div>
    );
  }

  if (!points.length) {
    return (
      <div className="card empty-state">
        <FiTrendingUp size={32} />
        <p>No grade history for {target.className} · {target.subject} yet.</p>
        <p className="muted" style={{ fontSize: 13 }}>
          Saved gradebook entries appear here by session and term.
        </p>
      </div>
    );
  }

  return <ProgressChart points={points} subject={target.subject} />;
}

function ProgressChart({ points, subject }) {
  const data = points.map((p) => ({
    session: p.session,
    term: p.term,
    label: `${p.session.slice(2, 4)}/${p.session.slice(7, 9)} ${p.term.split(' ')[0]}`,
    average: Number(p.average) || 0,
    studentCount: Number(p.studentCount) || 0,
  }));

  const totalEntries = points.reduce(
    (sum, p) => sum + Number(p.studentCount || 0),
    0
  );

  return (
    <section className="card progress-chart">
      <div className="progress-chart__heading">
        <div>
          <h3>
            <FiTrendingUp size={16} /> {subject} progress
          </h3>
          <p className="muted" style={{ fontSize: 12 }}>
            Class average across terms · {totalEntries} recorded grade entries
          </p>
        </div>
      </div>

      <div className="recharts-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
            <defs>
              <linearGradient id="teacherProgressFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

            <XAxis
              dataKey="label"
              stroke="var(--muted)"
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="var(--muted)"
              tick={{ fontSize: 11 }}
              tickLine={false}
              width={40}
            />

            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 12,
                color: 'var(--text)',
                boxShadow: '0 8px 24px rgba(15,23,42,.12)',
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload.length) {
                  const p = payload[0].payload;
                  return `${p.session} · ${p.term}`;
                }
                return '';
              }}
              formatter={(value, name, payload) => {
                const count = payload?.payload?.studentCount;
                return [
                  `${value}%${count ? ` (${count} students)` : ''}`,
                  'Average',
                ];
              }}
            />

            <Area
              type="monotone"
              dataKey="average"
              stroke="var(--accent)"
              strokeWidth={3}
              fill="url(#teacherProgressFill)"
              dot={{
                r: 5,
                fill: 'var(--surface)',
                stroke: 'var(--accent)',
                strokeWidth: 2,
              }}
              activeDot={{ r: 7 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/* ==========================================================================
   MAIN component
   ========================================================================== */

export default function AcademicTools() {
  const { targets, loading: profileLoading } = useTeacherProfile();

  const [tab, setTab] = useState('gradebook');
  const [target, setTarget] = useState({ className: '', subject: '' });
  const [session, setSession] = useState(currentSession);
  const [term, setTerm] = useState(TERMS[0]);

  useEffect(() => {
    if (!target.className && targets.length) {
      setTarget({
        className: targets[0].className,
        subject: targets[0].subject,
      });
    }
  }, [targets, target.className]);

  const changeTarget = (value) => {
    const [className, subject] = value.split('||');
    setTarget({ className, subject });
  };

  const targetValue = `${target.className}||${target.subject}`;

  if (profileLoading) return <Loader />;

  return (
    <div className="academic-tools">
      <PageHeader
        title="Academic Tools"
        subtitle="Enter grades, curate a question bank, plan lessons, and track progress"
      />

      {!targets.length ? (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> No teaching assignments are linked to your
          account. Ask the admin to assign you a class / subject.
        </div>
      ) : (
        <>
          <div className="academic-toolbar">
            <label className="academic-toolbar__target">
              Class &amp; subject
              <select value={targetValue} onChange={(e) => changeTarget(e.target.value)}>
                {targets.map((item) => (
                  <option
                    key={`${item.className}-${item.subject}`}
                    value={`${item.className}||${item.subject}`}
                  >
                    {item.className} · {item.subject}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="tabs academic-tabs" role="tablist" aria-label="Academic tools">
            {[
              { key: 'gradebook', label: 'Gradebook', icon: FiClipboard },
              { key: 'questions', label: 'Question Bank', icon: FiBookOpen },
              { key: 'lessons', label: 'Lesson Plans', icon: FiCalendar },
              { key: 'progress', label: 'Progress', icon: FiTrendingUp },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`tab ${tab === key ? 'tab--active' : ''}`}
                onClick={() => setTab(key)}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          {tab === 'gradebook' && (
            <GradebookTab
              target={target}
              session={session}
              term={term}
              onSessionChange={setSession}
              onTermChange={setTerm}
            />
          )}
          {tab === 'questions' && <QuestionBankTab target={target} />}
          {tab === 'lessons' && <LessonPlansTab target={target} />}
          {tab === 'progress' && <ProgressTab target={target} />}
        </>
      )}
    </div>
  );
}