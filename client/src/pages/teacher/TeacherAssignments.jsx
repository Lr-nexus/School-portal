import { useEffect, useState } from 'react';
import {
  FiPlus, FiClipboard, FiTrash2, FiEye, FiX,
  FiCheckCircle, FiDownload, FiCheck
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const BASE_URL = 'https://nexus-nexus-1876.vercel.app';
const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies'
];
const CLASSES = ['JSS 2A', 'JSS 2B', 'JSS 3A'];

const emptyForm = {
  title: '',
  subject: 'Mathematics',
  className: 'JSS 2A',
  description: '',
  dueDate: '',
  totalMarks: 10
};

export default function TeacherAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [active, setActive] = useState(null);

  const load = () =>
    api('/assignments')
      .then(setAssignments)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const close = () => {
    setActive(null);
  };

  const closeForm = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/assignments', { method: 'POST', body: JSON.stringify(form) });
      setMessage('Assignment posted successfully');
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this assignment and all submissions?')) return;
    try {
      await api(`/assignments/${id}`, { method: 'DELETE' });
      setMessage('Assignment deleted');
      if (active?.id === id) close();
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const openAssignment = async (id) => {
    const data = await api(`/assignments/${id}`);
    setActive(data);
  };

  const grade = async (studentId, score, feedback) => {
    await api(`/assignments/${active.id}/grade/${studentId}`, {
      method: 'POST',
      body: JSON.stringify({ score, feedback })
    });
    // Refresh the modal data + the list, but keep the modal open
    // so the teacher can grade the next student.
    await openAssignment(active.id);
    await load();
  };

  const downloadFile = (url, name) => {
    const a = document.createElement('a');
    a.href = `${BASE_URL}${url}`;
    a.download = name || 'submission';
    a.click();
  };

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader title="Assignments" subtitle="Post assignments and grade submissions">
        <button
          className="btn btn--primary"
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
        >
          {showForm
            ? <><FiX size={16} /> Cancel</>
            : <><FiPlus size={16} /> New Assignment</>}
        </button>
      </PageHeader>

      {message && <div className="alert alert--info">{message}</div>}

      {showForm && (
        <div className="card">
          <h3><FiClipboard size={16} /> Create Assignment</h3>
          <form className="form-grid" onSubmit={submit}>
            <label className="form-grid__full">Title *
              <input name="title" value={form.title} onChange={handleChange} required />
            </label>
            <label>Subject
              <select name="subject" value={form.subject} onChange={handleChange}>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>Class *
              <select name="className" value={form.className} onChange={handleChange}>
                {CLASSES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Due Date
              <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
            </label>
            <label>Total Marks
              <input
                type="number"
                name="totalMarks"
                min="1"
                value={form.totalMarks}
                onChange={handleChange}
              />
            </label>
            <label className="form-grid__full">Instructions
              <textarea
                rows="3"
                name="description"
                value={form.description}
                onChange={handleChange}
              />
            </label>
            <div className="form-grid__full form-grid__actions">
              <button type="button" className="btn btn--ghost" onClick={closeForm}>
                Cancel
              </button>
              <button className="btn btn--primary">
                <FiPlus size={16} /> Post Assignment
              </button>
            </div>
          </form>
        </div>
      )}

      <h3 className="section-title"><FiClipboard /> Posted ({assignments.length})</h3>
      <div className="grid-3">
        {assignments.map((a) => (
          <div className="card assignment-card" key={a.id}>
            <h3>{a.title}</h3>
            <p className="muted">{a.subject} · {a.className}</p>
            <p>{a.description}</p>
            <p className="muted">Due: {a.dueDate} · {a.totalMarks} marks</p>
            <p className="muted">{a.submissionCount} submission(s)</p>
            <div className="note-card__actions">
              <button className="btn btn--primary" onClick={() => openAssignment(a.id)}>
                <FiEye size={14} /> View Submissions
              </button>
              <button className="btn btn--danger" onClick={() => remove(a.id)}>
                <FiTrash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {!assignments.length && <p className="muted">No assignments posted yet.</p>}
      </div>

      {active && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h3>{active.title}</h3>
                <p className="muted">
                  {active.subject} · {active.className} · Due {active.dueDate} ·{' '}
                  {active.totalMarks} marks
                </p>
              </div>
              <button className="btn btn--ghost" onClick={close} title="Close">
                <FiX size={16} />
              </button>
            </div>

            {active.description && (
              <p style={{ marginBottom: 14 }}>{active.description}</p>
            )}

            <h4 className="modal__section-title">
              Submissions ({active.submissions.length})
            </h4>

            {active.submissions.map((s) => (
              <SubmissionRow
                key={s.id}
                submission={s}
                totalMarks={active.totalMarks}
                onGrade={grade}
                onDownload={downloadFile}
              />
            ))}

            {!active.submissions.length && (
              <p className="muted">No submissions yet.</p>
            )}

            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={close}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ submission, totalMarks, onGrade, onDownload }) {
  const [score, setScore] = useState(submission.score ?? '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await onGrade(submission.studentId, score, feedback);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (ex) {
      setErr(ex.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="submission">
      <div className="submission__head">
        <div className="avatar avatar--sm">{submission.studentName.charAt(0)}</div>
        <div>
          <strong>{submission.studentName}</strong>
          <div className="muted" style={{ fontSize: 12 }}>
            Submitted {new Date(submission.submittedAt).toLocaleString()}
          </div>
        </div>
        {submission.score !== null && submission.score !== undefined && (
          <span className="pill pill--paid" style={{ marginLeft: 'auto' }}>
            {submission.score}/{totalMarks}
          </span>
        )}
      </div>

      {submission.text && <p className="submission__text">{submission.text}</p>}

      {submission.fileUrl && (
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => onDownload(submission.fileUrl, submission.originalName)}
        >
          <FiDownload size={14} /> {submission.originalName}
        </button>
      )}

      <form className="submission__grade" onSubmit={submit}>
        <input
          type="number"
          min="0"
          max={totalMarks}
          placeholder={`Score / ${totalMarks}`}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          required
        />
        <input
          placeholder="Feedback (optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <button className="btn btn--primary" disabled={busy}>
          {saved
            ? <><FiCheck size={14} /> Saved</>
            : <><FiCheckCircle size={14} /> {busy ? 'Saving…' : (submission.score === null ? 'Grade' : 'Update')}</>}
        </button>
      </form>

      {err && <p className="muted" style={{ color: 'var(--red)', fontSize: 12 }}>{err}</p>}
    </div>
  );
}