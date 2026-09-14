import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiCheckCircle, FiTrash2 } from 'react-icons/fi';
import { api } from '../api/api';

const POLL_MS = 20000;

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = () =>
    api('/notifications/me').then(setItems).catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const openItem = async (n) => {
    try {
      if (!n.read) {
        await api(`/notifications/${n.id}/read`, { method: 'PATCH' });
      }
    } catch {}
    setOpen(false);
    if (n.link) navigate(n.link);
    load();
  };

  const markAllRead = async (e) => {
    e.stopPropagation();
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      load();
    } catch {}
  };

  const remove = async (e, id) => {
    e.stopPropagation();
    try {
      await api(`/notifications/${id}`, { method: 'DELETE' });
      load();
    } catch {}
  };

  return (
    <div className="notif" ref={ref}>
      <button
        className="notif__btn"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
      >
        <FiBell size={20} />
        {unread > 0 && <span className="notif__dot">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif__panel">
          <div className="notif__head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="notif__mark" onClick={markAllRead}>
                <FiCheckCircle size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="notif__list">
            {items.length === 0 && (
              <p className="notif__empty">You're all caught up.</p>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`notif__item ${n.read ? '' : 'notif__item--unread'}`}
                onClick={() => openItem(n)}
              >
                <div className="notif__item-body">
                  <div className="notif__item-title">{n.title}</div>
                  <div className="notif__item-text">{n.body}</div>
                  <div className="notif__item-date">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  className="notif__item-del"
                  onClick={(e) => remove(e, n.id)}
                  title="Remove"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}