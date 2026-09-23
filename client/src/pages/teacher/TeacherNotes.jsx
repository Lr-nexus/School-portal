import { useEffect, useState, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  FiUploadCloud, FiFileText, FiTrash2, FiDownload,
  FiMessageCircle, FiSend, FiX, FiEdit3, FiAlertCircle, FiUsers
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import { useTeacherProfile } from '../../hooks/useTeacherProfile';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const BASE_URL =
  (process.env.REACT_APP_API_URL || 'http://localhost:5000/api')
    .replace(/\/api\/?$/, '');

const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies'
];

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean']
  ]
};

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'blockquote', 'code-block', 'link', 'image'
];

export default function TeacherNotes() {
  const { user } = useAuth();
  const { className, loading: profileLoading } = useTeacherProfile();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState(null);
  const [commentText, setCommentText] = useState('');
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('richtext');

  const [form, setForm] = useState({
    title: '', subject: 'Mathematics',
    description: '', file: null, content: ''
  });

  const load = () =>
    api('/notes')
      .then(setNotes)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({
      title: '', subject: 'Mathematics',
      description: '', file: null, content: ''
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

  const submitPdf = async (e) => {
    e.preventDefault();
    if (!className) return setMessage('You have no class assigned');
    if (!form.file) return setMessage('Please choose a PDF file');

    const fd = new FormData();
    fd.append('file', form.file);
    fd.append('title', form.title);
    fd.append('subject', form.subject);
    fd.append('className', className);
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

      setMessage('PDF note uploaded');
      resetForm();
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submitRich = async (e) => {
    e.preventDefault();
    const plain = form.content.replace(/<[^>]*>/g, '').trim();
    if (!plain) return setMessage('Write something in the editor first');
    if (!form.title) return setMessage('Give your note a title');
    if (!className) return setMessage('You have no class assigned');

    setUploading(true);
    try {
      await api('/notes/rich', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          subject: form.subject,
          className,
          description: form.description,
          content: form.content
        })
      });
      setMessage('Rich text note posted');
      resetForm();
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
    if (note.type === 'pdf' && note.fileUrl) {
      try {
        const res = await fetch(`${BASE_URL}${note.fileUrl}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = note.originalName || 'note.pdf';
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        setMessage('Download failed');
      }
      return;
    }

    const html = `
<!doctype html>
<html><head><meta charset="utf-8"><title>${note.title}</title>
<style>body{font-family:system-ui;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.6;color:#111}</style>
</head><body>
<h1>${note.title}</h1>
<p><em>${note.subject} · ${note.className} · ${note.teacherName}</em></p>
${note.content}
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]+/gi, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
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

  if (loading || profileLoading) return <Loader />;

  const noClass = !className;

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle={noClass ? 'No class assigned' : `Posting to ${className}`}
      />

      {message && <div className="alert alert--info">{message}</div>}

      {noClass && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} />
          You have no class assigned. Ask the admin to assign you a form class before posting notes.
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <button
            className={`tab ${mode === 'richtext' ? 'tab--active' : ''}`}
            onClick={() => setMode('richtext')}
            type="button"
          >
            <FiEdit3 size={16} /> Write Rich Text
          </button>
          <button
            className={`tab ${mode === 'pdf' ? 'tab--active' : ''}`}
            onClick={() => setMode('pdf')}
            type="button"
          >
            <FiUploadCloud size={16} /> Upload PDF
          </button>
        </div>

        {mode === 'richtext' ? (
          <form onSubmit={submitRich}>
            <div className="form-grid">
              <label className="form-grid__full">
                Title *
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  disabled={noClass}
                />
              </label>
              <label>
                Subject
                <select name="subject" value={form.subject} onChange={handleChange} disabled={noClass}>
                  {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>

              <div className="form-field-readonly">
                <span className="form-field-readonly__label">Class</span>
                <div className="form-field-readonly__value">
                  <FiUsers size={14} />
                  {noClass ? 'No class assigned' : className}
                </div>
              </div>

              <label className="form-grid__full">
                Short description (optional)
                <input
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="One-line summary"
                  disabled={noClass}
                />
              </label>
            </div>

            <label className="editor-label">Note content *</label>
            <ReactQuill
              theme="snow"
              value={form.content}
              onChange={(content) => setForm((prev) => ({ ...prev, content }))}
              modules={QUILL_MODULES}
              formats={QUILL_FORMATS}
              placeholder="Write your note here…"
              className="editor"
            />

            <div className="form-grid__actions">
              <button type="button" className="btn btn--ghost" onClick={resetForm}>
                Clear
              </button>
              <button className="btn btn--primary" disabled={uploading || noClass}>
                <FiSend size={16} /> {uploading ? 'Posting…' : 'Post Note'}
              </button>
            </div>
          </form>
        ) : (
          <form className="form-grid" onSubmit={submitPdf}>
            <label className="form-grid__full">
              PDF File *
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFile}
                required
                disabled={noClass}
              />
            </label>
            <label className="form-grid__full">
              Title *
              <input name="title" value={form.title} onChange={handleChange} required disabled={noClass} />
            </label>
            <label>
              Subject
              <select name="subject" value={form.subject} onChange={handleChange} disabled={noClass}>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>

            <div className="form-field-readonly">
              <span className="form-field-readonly__label">Class</span>
              <div className="form-field-readonly__value">
                <FiUsers size={14} />
                {noClass ? 'No class assigned' : className}
              </div>
            </div>

            <label className="form-grid__full">
              Description
              <textarea
                rows="2"
                name="description"
                value={form.description}
                onChange={handleChange}
                disabled={noClass}
              />
            </label>
            <div className="form-grid__full form-grid__actions">
              <button type="button" className="btn btn--ghost" onClick={resetForm}>
                Clear
              </button>
              <button className="btn btn--primary" disabled={uploading || noClass}>
                <FiUploadCloud size={16} /> {uploading ? 'Uploading…' : 'Upload PDF'}
              </button>
            </div>
          </form>
        )}
      </div>

      <h3 className="section-title"><FiFileText /> My Notes ({notes.length})</h3>
      <div className="grid-3">
        {notes.map((n) => (
          <div className="card note-card" key={n.id}>
            <div className="note-card__icon">
              {n.type === 'pdf' ? <FiFileText size={20} /> : <FiEdit3 size={20} />}
            </div>
            <span className={`chip ${n.type === 'pdf' ? 'chip--pdf' : 'chip--rich'}`}>
              {n.type === 'pdf' ? 'PDF' : 'Rich Text'}
            </span>
            <h3>{n.title}</h3>
            <p className="muted">{n.subject} · {n.className}</p>
            {n.description && <p>{n.description}</p>}
            <p className="muted" style={{ fontSize: 12 }}>
              {new Date(n.uploadedAt).toLocaleDateString()}
              {n.type === 'pdf' && n.fileSize && <> · {(n.fileSize / 1024).toFixed(0)} KB</>}
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
        {!notes.length && <p className="muted">No notes yet.</p>}
      </div>

      {active && (
        <div className="modal-backdrop" onClick={() => setActive(null)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h3>{active.title}</h3>
                <p className="muted">
                  {active.subject} · {active.className} · {active.teacherName}
                </p>
              </div>
              <button className="btn btn--ghost" onClick={() => setActive(null)}>
                <FiX size={16} />
              </button>
            </div>

            {active.type === 'richtext' ? (
              <div
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: active.content }}
              />
            ) : (
              <iframe
                title={active.title}
                src={`${BASE_URL}${active.fileUrl}`}
                className="pdf-viewer"
              />
            )}

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
                      <span className="muted">{new Date(c.date).toLocaleString()}</span>
                    </div>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
              {!active.comments.length && <p className="muted">No comments yet.</p>}

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