import { useEffect, useState } from 'react';
import {
  FiMessageCircle, FiSend, FiTrash2, FiAlertCircle, FiCornerDownRight
} from 'react-icons/fi';
import { api } from '../api/api';
import Loader from './Loader';

export default function DiscussionPanel({ assignmentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);

  const load = async () => {
    try {
      const res = await api(`/discussions/${assignmentId}`);
      setData(res);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [assignmentId]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;

    setSending(true);
    try {
      const res = await api(`/discussions/${assignmentId}`, {
        method: 'POST',
        body: JSON.stringify({ text: body, parentId: replyTo?.id || null }),
      });
      setData((prev) => ({ ...prev, comments: [...prev.comments, res.comment] }));
      setText('');
      setReplyTo(null);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api(`/discussions/${assignmentId}/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  if (loading) return <Loader text="Loading discussion…" />;
  if (!data) return null;

  const rootComments = data.comments.filter((c) => !c.parentId);
  const repliesFor = (id) => data.comments.filter((c) => c.parentId === id);

  const CommentItem = ({ c, isReply }) => (
    <div className={`discuss-comment ${isReply ? 'discuss-comment--reply' : ''}`}>
      <div className="avatar avatar--sm">{c.userName.charAt(0)}</div>
      <div className="discuss-comment__body">
        <div className="discuss-comment__head">
          <strong>{c.userName}</strong>
          <span className={`badge badge--${c.role}`}>{c.role}</span>
          <span className="muted" style={{ fontSize: 11 }}>
            {new Date(c.createdAt).toLocaleString()}
          </span>
        </div>
        <p>{c.text}</p>
        <div className="discuss-comment__actions">
          {!isReply && (
            <button
              className="btn-link"
              onClick={() => setReplyTo(replyTo?.id === c.id ? null : c)}
            >
              <FiCornerDownRight size={12} /> Reply
            </button>
          )}
          {c.mine && (
            <button className="btn-link btn-link--danger" onClick={() => remove(c.id)}>
              <FiTrash2 size={12} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="discussion">
      <h4 className="discussion__title">
        <FiMessageCircle size={14} /> Discussion ({data.comments.length})
      </h4>

      {errorMsg && <div className="alert alert--error"><FiAlertCircle size={14} /> {errorMsg}</div>}

      <div className="discussion__list">
        {rootComments.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            No questions yet. Ask the teacher anything about this assignment.
          </p>
        )}
        {rootComments.map((c) => (
          <div key={c.id}>
            <CommentItem c={c} />
            {repliesFor(c.id).map((r) => (
              <CommentItem key={r.id} c={r} isReply />
            ))}
          </div>
        ))}
      </div>

      <form className="discussion__form" onSubmit={send}>
        {replyTo && (
          <div className="discussion__replying">
            Replying to <strong>{replyTo.userName}</strong>
            <button type="button" className="btn-link" onClick={() => setReplyTo(null)}>
              cancel
            </button>
          </div>
        )}
        <div className="discussion__row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.userName}…` : 'Ask a question or leave a comment…'}
            disabled={sending}
          />
          <button className="btn btn--primary" disabled={sending || !text.trim()}>
            <FiSend size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}