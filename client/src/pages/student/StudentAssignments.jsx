import { useEffect, useState, useRef } from 'react';
import {
  FiUploadCloud, FiDownload, FiCheckCircle,
  FiClock, FiX, FiAlertCircle
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const BASE_URL = 'https://nexus-nexus-1876.vercel.app';

export default function StudentAssignments() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const load = () =>
    api('/assignments')
      .then(setItems)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const open = async (id) => {
    const data = await api(`/assignments/${id}`);
    setActive(data);
    setText(data.mySubmission?.text || '');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    setActive(null);
    setText('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !file) {
      setMessage('Write something or attach a file');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('text', text);
      if (file) fd.append('file', file);

      const res = await fetch(`${BASE_URL}/api/assignments/${active.id}/submit`, {
        method: 'POST',
        headers: { 'X-User-Id': String(user.id) },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');

      setMessage(
        active.mySubmission
          ? 'Submission updated successfully'
          : 'Assignment submitted successfully'
      );
      await load();
      close();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;

  const now = new Date();

  return (
    <div>
      <PageHeader title="Assignments" subtitle="View, submit, and track your class assignments" />

      {message && <div className="alert alert--info">{message}</div>}

      <div className="grid-3">
        {items.map((a) => {
          const due = new Date(a.dueDate);
          const overdue = due < now && !a.mySubmission;
          const submitted = !!a.mySubmission;
          const graded = a.mySubmission?.score !== null && a.mySubmission?.score !== undefined;

          return (
            <div
              key={a.id}
              className={`card assignment-card ${overdue ? 'assignment-card--overdue' : ''}`}
            >
              <div className="assignment-card__head">
                {submitted ? (
                  <span className="pill pill--paid">
                    <FiCheckCircle size={12} /> {graded ? 'Graded' : 'Submitted'}
                  </span>
                ) : overdue ? (
                  <span className="pill pill--unpaid">
                    <FiAlertCircle size={12} /> Overdue
                  </span>
                ) : (
                  <span className="pill pill--partial">
                    <FiClock size={12} /> Pending
                  </span>
                )}
                <span className="muted" style={{ fontSize: 12 }}>{a.totalMarks} marks</span>
              </div>

              <h3>{a.title}</h3>
              <p className="muted">{a.subject} · {a.teacherName}</p>
              <p>{a.description}</p>
              <p className="session-card__time">
                <FiClock /> Due {a.dueDate}
              </p>

              {graded && (
                <div className="assignment-card__grade">
                  Score: <strong>{a.mySubmission.score} / {a.totalMarks}</strong>
                </div>
              )}

              <button className="btn btn--primary btn--full" onClick={() => open(a.id)}>
                {submitted ? 'View / Update' : 'Open & Submit'}
              </button>
            </div>
          );
        })}
        {!items.length && (
          <div className="card">
            <p className="muted">No assignments for your class yet.</p>
          </div>
        )}
      </div>

      {active && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h3>{active.title}</h3>
                <p className="muted">
                  {active.subject} · Due {active.dueDate} · {active.totalMarks} marks
                </p>
              </div>
              <button className="btn btn--ghost" onClick={close}>
                <FiX size={16} />
              </button>
            </div>

            {active.description && <p style={{ marginBottom: 14 }}>{active.description}</p>}

            {active.mySubmission?.score !== null && active.mySubmission?.score !== undefined && (
              <div className="alert alert--info">
                <FiCheckCircle size={16} />
                Graded: <strong>{active.mySubmission.score}/{active.totalMarks}</strong>
                {active.mySubmission.feedback && <> — “{active.mySubmission.feedback}”</>}
              </div>
            )}

            <form onSubmit={submit}>
              <label>
                Your answer
                <textarea
                  rows="5"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type your answer here…"
                />
              </label>

              <label>
                Attach a file (optional)
                <input
                  ref={fileRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                />
              </label>

              {active.mySubmission?.fileUrl && (
                <p className="muted" style={{ fontSize: 12 }}>
                  Previously uploaded:{' '}
                  <a
                    href={`${BASE_URL}${active.mySubmission.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FiDownload size={12} /> {active.mySubmission.originalName}
                  </a>
                </p>
              )}

              <div className="profile-form__actions">
                <button type="button" className="btn btn--ghost" onClick={close}>
                  Cancel
                </button>
                <button className="btn btn--primary" disabled={submitting}>
                  <FiUploadCloud size={16} />{' '}
                  {submitting
                    ? 'Submitting…'
                    : active.mySubmission
                      ? 'Update Submission'
                      : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}