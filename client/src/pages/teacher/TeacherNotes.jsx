import { useEffect, useState, useRef } from 'react';
import {
  FiUploadCloud, FiFileText, FiTrash2, FiDownload,
  FiMessageCircle, FiSend, FiX
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const BASE_URL = 'http://localhost:5000';
const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies'
];
const CLASSES = ['JSS 2A', 'JSS 2B', 'JSS 3A'];

export default function TeacherNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState(null);
  const [commentText, setCommentText] = useState('');
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title: '',
    subject: 'Mathematics',
    className: 'JSS 2A',
    description: '',
    file: null
  });

  const load = () =>
    api('/notes')
      .then(setNotes)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setMessage('Only PDF files are allowed');
      e.target.value = '';
      return;
    }
    setForm((prev) => ({
      ...prev,
      file: f,
      title: prev.title || f.name.replace(/\.pdf$/i, '')
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.file) {
      setMessage('Please choose a PDF file');
      return;
    }

    const fd = new FormData();
    fd.append('file', form.file);
    fd.append('title', form.title);
    fd.append('subject', form.subject);
    fd.append('className', form.className);
    fd.append('description', form.description);

    setUploading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/notes`, {
        method: 'POST',
        headers: { 'X-User-Id': String(user.id) },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');

      setMessage('Note uploaded');
      setForm({ title: '', subject: 'Mathematics', className: 'JSS 2A', description: '', file: null });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this note and its comments?')) return;
    try {
      await api(`/notes/${id}`, { method: 'DELETE' });
      setMessage('Note deleted');
      if (active?.id === id) setActive(null);
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const openNote = async (id) => {
    const data = await api(`/notes/${id}`);
    setActive(data);
    setCommentText('');
  };

  const downloadFile = async (note) => {
    try {
      const res = await fetch(`${BASE_URL}${note.fileUrl}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = note.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage('Download failed');
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    try {
      await api(`/notes/${active.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      setCommentText('');
      await openNote(active.id);
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="Upload PDF notes for your classes and reply to students"
      />

      {message && <div className="alert alert--info">{message}</div>}

      <div className="card">
        <h3><FiUploadCloud size={16} /> Upload PDF Note</h3>
        <form className="form-grid" onSubmit={submit}>
          <label className="form-grid__full">
            PDF File *
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFile}
              required
            />
          </label>
          <label className="form-grid__full">
            Title *
            <input name="title" value={form.title} onChange={handleChange} required />
          </label>
          <label>
            Subject
            <select name="subject" value={form.subject} onChange={handleChange}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>
            Class
            <select name="className" value={form.className} onChange={handleChange}>
              {CLASSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="form-grid__full">
            Description
            <textarea rows="2" name="description" value={form.description} onChange={handleChange} />
          </label>
          <div className="form-grid__full">
            <button className="btn btn--primary" disabled={uploading}>
              <FiUploadCloud size={16} /> {uploading ? 'Uploading…' : 'Upload Note'}
            </button>
          </div>
        </form>
      </div>

      <h3 className="section-title"><FiFileText /> My Uploaded Notes ({notes.length})</h3>
      <div className="grid-3">
        {notes.map((n) => (
          <div className="card note-card" key={n.id}>
            <div className="note-card__icon"><FiFileText size={20} /></div>
            <h3>{n.title}</h3>
            <p className="muted">{n.subject} · {n.className}</p>
            {n.description && <p>{n.description}</p>}
            <p className="muted" style={{ fontSize: 12 }}>
              {new Date(n.uploadedAt).toLocaleDateString()} · {(n.fileSize / 1024).toFixed(0)} KB
            </p>

            <div className="note-card__actions">
              <button className="btn btn--ghost" onClick={() => downloadFile(n)}>
                <FiDownload size={14} /> Download
              </button>
              <button className="btn btn--ghost" onClick={() => openNote(n.id)}>
                <FiMessageCircle size={14} /> {n.commentCount}
              </button>
              <button className="btn btn--danger" onClick={() => remove(n.id)}>
                <FiTrash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {!notes.length && <p className="muted">No notes uploaded yet.</p>}
      </div>

      {active && (
        <div className="modal-backdrop" onClick={() => setActive(null)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h3>{active.title}</h3>
                <p className="muted">{active.subject} · {active.className} · {active.teacherName}</p>
              </div>
              <button className="btn btn--ghost" onClick={() => setActive(null)}>
                <FiX size={16} />
              </button>
            </div>

            <iframe
              title={active.title}
              src={`${BASE_URL}${active.fileUrl}`}
              className="pdf-viewer"
            />

            <div className="modal__actions">
              <button className="btn btn--primary" onClick={() => downloadFile(active)}>
                <FiDownload size={16} /> Download
              </button>
            </div>

            <div className="comments">
              <h4><FiMessageCircle size={14} /> Comments ({active.comments.length})</h4>
              {active.comments.map((c) => (
                <div className="comment" key={c.id}>
                  <div className="avatar avatar--sm">{c.userName.charAt(0)}</div>
                  <div className="comment__body">
                    <div className="comment__head">
                      <strong>{c.userName}</strong>
                      <span className={`badge badge--${c.role}`}>{c.role}</span>
                      <span className="muted">
                        {new Date(c.date).toLocaleString()}
                      </span>
                    </div>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
              {!active.comments.length && (
                <p className="muted">No comments yet.</p>
              )}

              <form className="comment-form" onSubmit={addComment}>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a reply…"
                />
                <button className="btn btn--primary">
                  <FiSend size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}