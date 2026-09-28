import { useEffect, useRef, useState } from 'react';
import {
  FiSend, FiSearch, FiUser, FiUserCheck, FiShield,
  FiHeart, FiMessageCircle, FiPlus, FiX, FiAlertCircle,
  FiCheck, FiUsers,
} from 'react-icons/fi';
import { api } from '../api/api';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';

const ROLE_ICON = {
  student: FiUser,
  teacher: FiUserCheck,
  admin:   FiShield,
  parent:  FiHeart,
};

/* ✓ single = sent, ✓✓ blue = read */
function Ticks({ read }) {
  return (
    <span className={`msg__ticks ${read ? 'msg__ticks--read' : ''}`} title={read ? 'Read' : 'Sent'}>
      {read ? (
        <><FiCheck size={11} /><FiCheck size={11} style={{ marginLeft: -5 }} /></>
      ) : (
        <FiCheck size={11} />
      )}
    </span>
  );
}

export default function Messages() {
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [convSearch, setConvSearch] = useState('');
  const [myClassGroupId, setMyClassGroupId] = useState(null);
  const messagesEndRef = useRef(null);

  const loadConversations = async () => {
    try {
      const [convos, cts] = await Promise.all([
        api('/messages/conversations'),
        api('/messages/contacts'),
      ]);
      setConversations(convos);
      setContacts(cts);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  /* Try to fetch the class-group info (if the user has one) */
  useEffect(() => {
    api('/messages/groups/class')
      .then((r) => setMyClassGroupId(r.groupId))
      .catch(() => setMyClassGroupId(null));
  }, []);

  /* Parse the composite "direct-3" / "group-7" id */
  const openConversation = async (compositeId) => {
    const [kind, rawId] = compositeId.split('-');
    const id = Number(rawId);

    setActiveId(compositeId);
    setMessagesLoading(true);
    try {
      const data = await api(
        kind === 'group'
          ? `/messages/groups/${id}`
          : `/messages/conversations/${id}`
      );
      setActive(data);
      const c = await api('/messages/conversations');
      setConversations(c);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setMessagesLoading(false);
    }
  };

  const startWith = async (userId) => {
    try {
      const res = await api('/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({ otherUserId: userId }),
      });
      setShowContacts(false);
      await loadConversations();
      await openConversation(`direct-${res.conversationId}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openClassChat = () => {
    if (myClassGroupId) {
      openConversation(`group-${myClassGroupId}`);
    } else {
      toast.error('No class chat available yet');
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !activeId) return;

    const [kind, rawId] = activeId.split('-');
    const id = Number(rawId);

    setSending(true);
    try {
      const res = await api(
        kind === 'group'
          ? `/messages/groups/${id}/send`
          : `/messages/conversations/${id}/send`,
        { method: 'POST', body: JSON.stringify({ body: text }) }
      );
      setActive((prev) => ({
        ...prev,
        messages: [...(prev?.messages || []), res.message],
      }));
      setInput('');
      const c = await api('/messages/conversations');
      setConversations(c);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [active?.messages?.length]);

  const filteredConversations = conversations.filter((c) => {
    const q = convSearch.trim().toLowerCase();
    if (!q) return true;
    const name = c.kind === 'group' ? c.name : c.otherName;
    return name.toLowerCase().includes(q);
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
        {myClassGroupId && (
          <button className="btn btn--ghost" onClick={openClassChat}>
            <FiUsers size={16} /> Class Chat
          </button>
        )}
        <button className="btn btn--primary" onClick={() => setShowContacts(true)}>
          <FiPlus size={16} /> New Chat
        </button>
      </PageHeader>

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
                No chats yet.
              </p>
            )}

            {filteredConversations.map((c) => {
              const isGroup = c.kind === 'group';
              const Icon = isGroup ? FiUsers : (ROLE_ICON[c.otherRole] || FiUser);
              const name = isGroup ? c.name : c.otherName;
              return (
                <button
                  key={c.id}
                  className={`messages-conv ${activeId === c.id ? 'messages-conv--active' : ''} ${isGroup ? 'messages-conv--group' : ''}`}
                  onClick={() => openConversation(c.id)}
                >
                  <div className={`avatar avatar--sm ${isGroup ? 'avatar--group' : ''}`}>
                    {isGroup ? <FiUsers size={14} /> : name.charAt(0)}
                  </div>
                  <div className="messages-conv__body">
                    <div className="messages-conv__row">
                      <strong>{name}</strong>
                      {c.unreadCount > 0 && (
                        <span className="messages-conv__badge">{c.unreadCount}</span>
                      )}
                    </div>
                    <div className="messages-conv__preview">
                      {isGroup ? (
                        <><FiUsers size={11} /> {c.memberCount} members</>
                      ) : (
                        <><Icon size={11} /> {c.otherRole}</>
                      )}
                    </div>
                    {c.lastMessage && (
                      <p className="messages-conv__msg">
                        {isGroup && c.lastSender ? `${c.lastSender}: ` : ''}
                        {c.lastMessage}
                      </p>
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
                <div className={`avatar avatar--sm ${active.kind === 'group' ? 'avatar--group' : ''}`}>
                  {active.kind === 'group'
                    ? <FiUsers size={14} />
                    : active.otherName.charAt(0)}
                </div>
                <div>
                  <strong>{active.kind === 'group' ? active.name : active.otherName}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {active.kind === 'group'
                      ? `${active.members.length} members · ${active.className || ''}`
                      : active.otherRole}
                  </div>
                </div>
              </div>

              <div className="messages-chat__body">
                {active.messages.map((m) => (
                  <div key={m.id} className={`msg ${m.mine ? 'msg--mine' : ''}`}>
                    {active.kind === 'group' && !m.mine && (
                      <div className="msg__sender">{m.senderName}</div>
                    )}
                    <div className="msg__bubble">
                      {m.body}
                      {m.mine && (
                        <Ticks
                          read={
                            active.kind === 'group'
                              ? m.readCount > 0
                              : !!m.readAt
                          }
                        />
                      )}
                    </div>
                    <div className="msg__time">
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit',
                      })}
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