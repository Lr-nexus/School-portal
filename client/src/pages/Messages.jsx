import { useEffect, useRef, useState } from 'react';
import {
  FiSend, FiSearch, FiUser, FiUserCheck, FiShield,
  FiHeart, FiMessageCircle, FiPlus, FiX, FiAlertCircle
} from 'react-icons/fi';
import { api } from '../api/api';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';

const ROLE_ICON = {
  student: FiUser,
  teacher: FiUserCheck,
  admin:   FiShield,
  parent:  FiHeart,
};

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [convSearch, setConvSearch] = useState('');
  const messagesEndRef = useRef(null);

  /* ---------- load conversations + contacts ---------- */
  const loadConversations = async () => {
    try {
      const [c, ct] = await Promise.all([
        api('/messages/conversations'),
        api('/messages/contacts'),
      ]);
      setConversations(c);
      setContacts(ct);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  /* ---------- open a conversation ---------- */
  const openConversation = async (id) => {
    setActiveId(id);
    setMessagesLoading(true);
    try {
      const data = await api(`/messages/conversations/${id}`);
      setActive(data);
      // Refresh conversation list (read counts change)
      const c = await api('/messages/conversations');
      setConversations(c);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setMessagesLoading(false);
    }
  };

  /* ---------- start a conversation with a contact ---------- */
  const startWith = async (userId) => {
    try {
      const res = await api('/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({ otherUserId: userId }),
      });
      setShowContacts(false);
      await loadConversations();
      await openConversation(res.conversationId);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  /* ---------- send a message ---------- */
  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !activeId) return;

    setSending(true);
    try {
      const res = await api(`/messages/conversations/${activeId}/send`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      setActive((prev) => ({
        ...prev,
        messages: [...(prev?.messages || []), res.message],
      }));
      setInput('');
      // Refresh conversations list ordering
      const c = await api('/messages/conversations');
      setConversations(c);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  /* ---------- scroll to bottom on new message ---------- */
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [active?.messages?.length]);

  const filteredConversations = conversations.filter((c) => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return true;
    return c.otherName.toLowerCase().includes(q);
  });

  const filteredContacts = contacts.filter((c) => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q);
  });

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Messages"
        subtitle="Chat with students, teachers, admins and parents"
      >
        <button className="btn btn--primary" onClick={() => setShowContacts(true)}>
          <FiPlus size={16} /> New Chat
        </button>
      </PageHeader>

      {errorMsg && <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>}

      <div className="messages-layout">
        {/* ---------- Sidebar ---------- */}
        <aside className="messages-sidebar">
          <div className="messages-sidebar__search">
            <FiSearch size={14} />
            <input
              value={convSearch}
              onChange={(e) => setConvSearch(e.target.value)}
              placeholder="Search chats…"
            />
          </div>

          <div className="messages-sidebar__list">
            {filteredConversations.length === 0 && (
              <p className="muted" style={{ padding: 16, textAlign: 'center', fontSize: 13 }}>
                No chats yet. Click <strong>New Chat</strong> to start one.
              </p>
            )}

            {filteredConversations.map((c) => {
              const Icon = ROLE_ICON[c.otherRole] || FiUser;
              return (
                <button
                  key={c.id}
                  className={`messages-conv ${activeId === c.id ? 'messages-conv--active' : ''}`}
                  onClick={() => openConversation(c.id)}
                >
                  <div className="avatar avatar--sm">{c.otherName.charAt(0)}</div>
                  <div className="messages-conv__body">
                    <div className="messages-conv__row">
                      <strong>{c.otherName}</strong>
                      {c.unreadCount > 0 && (
                        <span className="messages-conv__badge">{c.unreadCount}</span>
                      )}
                    </div>
                    <div className="messages-conv__preview">
                      <Icon size={11} /> {c.otherRole}
                    </div>
                    {c.lastMessage && (
                      <p className="messages-conv__msg">{c.lastMessage}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ---------- Chat area ---------- */}
        <section className="messages-chat">
          {!activeId && (
            <div className="messages-chat__empty">
              <FiMessageCircle size={48} />
              <p>Select a conversation to start chatting</p>
            </div>
          )}

          {activeId && messagesLoading && <Loader />}

          {activeId && !messagesLoading && active && (
            <>
              <div className="messages-chat__head">
                <div className="avatar avatar--sm">{active.otherName.charAt(0)}</div>
                <div>
                  <strong>{active.otherName}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{active.otherRole}</div>
                </div>
              </div>

              <div className="messages-chat__body">
                {active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`msg ${m.mine ? 'msg--mine' : ''}`}
                  >
                    <div className="msg__bubble">{m.body}</div>
                    <div className="msg__time">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                {active.messages.length === 0 && (
                  <p className="muted" style={{ textAlign: 'center', padding: 40 }}>
                    Say hi 👋
                  </p>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="messages-chat__input" onSubmit={send}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message…"
                  disabled={sending}
                />
                <button className="btn btn--primary" disabled={sending || !input.trim()}>
                  <FiSend size={16} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* ---------- Contacts modal ---------- */}
      {showContacts && (
        <div className="modal-backdrop" onClick={() => setShowContacts(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3><FiPlus size={16} /> New Chat</h3>
              <button className="btn btn--ghost" onClick={() => setShowContacts(false)}>
                <FiX size={16} />
              </button>
            </div>

            <div className="messages-sidebar__search" style={{ marginBottom: 12 }}>
              <FiSearch size={14} />
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search contacts…"
                autoFocus
              />
            </div>

            <div className="messages-contacts">
              {filteredContacts.map((c) => {
                const Icon = ROLE_ICON[c.role] || FiUser;
                return (
                  <button
                    key={c.id}
                    className="messages-contact"
                    onClick={() => startWith(c.id)}
                  >
                    <div className="avatar avatar--sm">{c.name.charAt(0)}</div>
                    <div>
                      <strong>{c.name}</strong>
                      <span className="muted" style={{ fontSize: 12 }}>
                        <Icon size={11} /> {c.role}{c.detail ? ` · ${c.detail}` : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filteredContacts.length === 0 && (
                <p className="muted" style={{ padding: 16, textAlign: 'center' }}>
                  No contacts available.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}