import { useEffect, useState } from 'react';
import {
  FiFileText, FiDownload, FiMessageCircle, FiSend,
  FiX, FiEye, FiEdit3
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const BASE_URL = 'https://nexus-nexus-1876.vercel.app';

export default function StudentNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(null);
  const [commentText, setCommentText] = useState('');

  const load = () =>
    api('/notes')
      .then(setNotes)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

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

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="Notes shared by your teachers — view, download, and comment"
      />

      {message && <div className="alert alert--info">{message}</div>}

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
              {n.teacherName} · {new Date(n.uploadedAt).toLocaleDateString()}
            </p>

            <div className="note-card__actions">
              <button className="btn btn--primary" onClick={() => openNote(n.id)}>
                <FiEye size={14} /> View
              </button>
              <button className="btn btn--ghost" onClick={() => downloadFile(n)}>
                <FiDownload size={14} /> Download
              </button>
              <button className="btn btn--ghost" onClick={() => openNote(n.id)}>
                <FiMessageCircle size={14} /> {n.commentCount}
              </button>
            </div>
          </div>
        ))}
        {!notes.length && (
          <div className="card">
            <p className="muted">No notes for your class yet.</p>
          </div>
        )}
      </div>

      {active && (
        <div className="modal-backdrop" onClick={() => setActive(null)}>
          <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h3>{active.title}</h3>
                <p className="muted">
                  {active.subject} · {active.teacherName}
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
                      <span className="muted">
                        {new Date(c.date).toLocaleString()}
                      </span>
                    </div>
                    <p>{c.text}</p>
                  </div>
                </div>
              ))}
              {!active.comments.length && (
                <p className="muted">No comments yet. Be the first!</p>
              )}

              <form className="comment-form" onSubmit={addComment}>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Ask a question or leave a comment…"
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