import { useEffect, useMemo, useState } from 'react';
import {
  FiBell, FiPlus, FiEdit2, FiTrash2, FiSearch,
  FiAlertCircle, FiCheck, FiChevronDown, FiChevronUp
} from 'react-icons/fi';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import Loader from '../components/Loader';

const CATEGORIES = ['General', 'Urgent', 'Event', 'Holiday', 'Academic'];

const CATEGORY_CLASS = {
  General: 'pill',
  Urgent: 'pill pill--unpaid',
  Event: 'pill pill--partial',
  Holiday: 'pill pill--paid',
  Academic: 'pill',
};

export default function Announcements() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', category: 'General' });
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    try {
      const data = await api('/announcements');
      setItems(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      const matchesCat = categoryFilter === 'all' || a.category === categoryFilter;
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [items, search, categoryFilter]);

  const startCreate = () => {
    setEditing(null);
    setForm({ title: '', body: '', category: 'General' });
    setShowForm(true);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const startEdit = (a) => {
    setEditing(a);
    setForm({ title: a.title, body: a.body, category: a.category || 'General' });
    setShowForm(true);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ title: '', body: '', category: 'General' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (editing) {
        await api(`/announcements/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        setSuccessMsg('Announcement updated');
      } else {
        await api('/announcements', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setSuccessMsg('Announcement posted — all users notified');
      }
      cancelForm();
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api(`/announcements/${id}`, { method: 'DELETE' });
      setSuccessMsg('Announcement deleted');
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const toggle = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle={
          isAdmin
            ? 'Post and manage school announcements'
            : 'Stay up to date with the latest school news'
        }
      >
        {isAdmin && !showForm && (
          <button className="btn btn--primary" onClick={startCreate}>
            <FiPlus size={16} /> New Announcement
          </button>
        )}
      </PageHeader>

      {successMsg && (
        <div className="alert alert--info">
          <FiCheck size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {showForm && isAdmin && (
        <div className="card">
          <h3>
            {editing
              ? <><FiEdit2 size={16} /> Edit Announcement</>
              : <><FiPlus size={16} /> New Announcement</>}
          </h3>
          <form onSubmit={submit}>
            <div className="form-grid">
              <label className="form-grid__full">
                Title *
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="form-grid__full">
                Message *
                <textarea
                  rows="4"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required
                />
              </label>
            </div>

            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={cancelForm}>
                Cancel
              </button>
              <button className="btn btn--primary">
                {editing ? 'Save Changes' : 'Post Announcement'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="filters-bar">
        <div className="filters-bar__search">
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Search announcements…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filters-bar__select">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {!filtered.length && (
        <div className="card empty-state">
          <FiBell size={32} />
          <p>
            {items.length === 0
              ? 'No announcements yet.'
              : 'No announcements match your search.'}
          </p>
        </div>
      )}

      <div className="announcement-list">
        {filtered.map((a) => {
          const isOpen = !!expanded[a.id];
          return (
            <div key={a.id} className="card announcement-card">
              <div className="announcement-card__head">
                <div className="announcement-card__title">
                  <span className={CATEGORY_CLASS[a.category] || 'pill'}>
                    {a.category || 'General'}
                  </span>
                  <h3>{a.title}</h3>
                </div>
                <span className="muted" style={{ fontSize: 12 }}>
                  {new Date(a.date).toLocaleDateString()}
                </span>
              </div>

              <p
                className={`announcement-card__body ${isOpen ? '' : 'announcement-card__body--clamp'}`}
              >
                {a.body}
              </p>

              <div className="announcement-card__actions">
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => toggle(a.id)}
                >
                  {isOpen
                    ? <><FiChevronUp size={14} /> Show less</>
                    : <><FiChevronDown size={14} /> Read more</>}
                </button>

                {isAdmin && (
                  <>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => startEdit(a)}
                    >
                      <FiEdit2 size={14} /> Edit
                    </button>
                    <button
                      className="btn btn--danger btn--sm"
                      onClick={() => remove(a.id)}
                    >
                      <FiTrash2 size={14} /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}