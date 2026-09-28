import { useEffect, useMemo, useState } from 'react';
import {
  FiBook, FiSearch, FiPlus, FiX, FiBookmark, FiExternalLink,
  FiTrash2, FiCheck, FiAlertCircle, FiFilm, FiFileText,
  FiLink, FiBookOpen, FiClipboard, FiStar,
} from 'react-icons/fi';
import { api } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import Loader from '../components/Loader';

const TYPE_META = {
  book:          { label: 'Book',          icon: FiBookOpen },
  pdf:           { label: 'PDF',           icon: FiFileText },
  article:       { label: 'Article',       icon: FiFileText },
  video:         { label: 'Video',         icon: FiFilm },
  link:          { label: 'Link',          icon: FiLink },
  past_question: { label: 'Past question', icon: FiClipboard },
};

const LIST_META = {
  reading:   { label: 'Reading',    icon: FiBookOpen },
  favourite: { label: 'Favourite',  icon: FiStar },
  archive:   { label: 'Archive',    icon: FiBookmark },
};

const emptyResource = {
  title: '', type: 'book', subject: '', className: '',
  author: '', description: '', url: '', coverUrl: '',
};

export default function Library() {
  const { user } = useAuth();
  const toast = useToast();
  const canManage = user?.role === 'admin' || user?.role === 'teacher';

  const [tab, setTab] = useState('browse');
  const [resources, setResources] = useState([]);
  const [readingList, setReadingList] = useState([]);
  const [facets, setFacets] = useState({ subjects: [], classes: [], types: [] });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyResource);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null);
  const [bookmarkForm, setBookmarkForm] = useState({
    list: 'reading', progress: 0, notes: '',
  });

  const load = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (subjectFilter !== 'all') params.set('subject', subjectFilter);

      const [res, list, f] = await Promise.all([
        api(`/library?${params.toString()}`),
        api('/library/me/reading-list'),
        api('/library/facets'),
      ]);
      setResources(res);
      setReadingList(list);
      setFacets(f);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter, subjectFilter]);

  const applySearch = () => load();

  const saveResource = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      await api('/library', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      toast.success('Resource added');
      setForm(emptyResource);
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteResource = async (id) => {
    if (!window.confirm('Delete this resource?')) return;
    try {
      await api(`/library/${id}`, { method: 'DELETE' });
      toast.success('Deleted');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const bookmark = async (id, payload) => {
    try {
      await api(`/library/${id}/bookmark`, {
        method: 'POST',
        body: JSON.stringify(payload || { list: 'reading', progress: 0, notes: '' }),
      });
      toast.success('Added to your list');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateBookmark = async (id, patch) => {
    try {
      await api(`/library/${id}/bookmark`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeBookmark = async (id) => {
    try {
      await api(`/library/${id}/bookmark`, { method: 'DELETE' });
      toast.success('Removed');
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openDetail = (r) => {
    setDetail(r);
    setBookmarkForm({
      list: r.bookmarked || 'reading',
      progress: r.progress || 0,
      notes: r.personalNotes || '',
    });
  };

  const summary = useMemo(() => ({
    total: resources.length,
    reading: readingList.filter((r) => r.list === 'reading').length,
    favourites: readingList.filter((r) => r.list === 'favourite').length,
    completed: readingList.filter((r) => r.progress >= 100).length,
  }), [resources, readingList]);

  return (
    <div>
      <PageHeader
        title="Digital Library"
        subtitle="Curated books, past questions, and reference material for your class"
      >
        {canManage && (
          <button
            className="btn btn--primary"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? <><FiX size={16} /> Cancel</> : <><FiPlus size={16} /> Add Resource</>}
          </button>
        )}
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Resources" value={summary.total} color="#2563eb" />
        <StatCard label="On my reading list" value={summary.reading} color="#7c3aed" />
        <StatCard label="Favourites" value={summary.favourites} color="#d97706" />
        <StatCard label="Finished" value={summary.completed} color="#16a34a" />
      </div>

      {/* ---------- Tabs ---------- */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'browse' ? 'tab--active' : ''}`}
          onClick={() => setTab('browse')}
        >
          <FiBook size={16} /> Browse
        </button>
        <button
          type="button"
          className={`tab ${tab === 'mine' ? 'tab--active' : ''}`}
          onClick={() => setTab('mine')}
        >
          <FiBookmark size={16} /> My List ({readingList.length})
        </button>
      </div>

      {/* ---------- Add form ---------- */}
      {showForm && canManage && (
        <div className="card">
          <h3><FiPlus size={16} /> Add a resource</h3>
          <form onSubmit={saveResource}>
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
                Type
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Author
                <input
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="Chinua Achebe"
                />
              </label>
              <label>
                Subject
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="English Language"
                />
              </label>
              <label>
                Class (optional)
                <input
                  value={form.className}
                  onChange={(e) => setForm({ ...form, className: e.target.value })}
                  placeholder="JSS 2A"
                />
              </label>
              <label className="form-grid__full">
                External URL
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://…"
                />
              </label>
              <label className="form-grid__full">
                Cover image URL
                <input
                  value={form.coverUrl}
                  onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                  placeholder="https://…"
                />
              </label>
              <label className="form-grid__full">
                Description
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
            </div>
            <div className="form-grid__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setForm(emptyResource)}>
                Clear
              </button>
              <button className="btn btn--primary" disabled={saving}>
                <FiCheck size={16} /> {saving ? 'Saving…' : 'Add resource'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Browse tab ---------- */}
      {tab === 'browse' && (
        <>
          <div className="card">
            <div className="filters-bar" style={{ marginBottom: 0 }}>
              <div className="filters-bar__search">
                <FiSearch size={16} />
                <input
                  placeholder="Search title, author, description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                />
              </div>
              <div className="filters-bar__select">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">Any type</option>
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="filters-bar__select">
                <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                  <option value="all">Any subject</option>
                  {facets.subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <Loader />
          ) : resources.length === 0 ? (
            <div className="card empty-state">
              <FiBook size={32} />
              <p>No resources yet.</p>
              {canManage && (
                <button
                  className="btn btn--primary"
                  style={{ marginTop: 12 }}
                  onClick={() => setShowForm(true)}
                >
                  <FiPlus size={16} /> Add the first one
                </button>
              )}
            </div>
          ) : (
            <div className="library-grid">
              {resources.map((r) => {
                const meta = TYPE_META[r.type] || TYPE_META.book;
                const Icon = meta.icon;
                return (
                  <div className="library-card" key={r.id}>
                    <div className="library-card__cover">
                      {r.coverUrl ? (
                        <img src={r.coverUrl} alt="" />
                      ) : (
                        <div className="library-card__cover-placeholder">
                          <Icon size={32} />
                        </div>
                      )}
                      <span className="library-card__type">{meta.label}</span>
                    </div>
                    <div className="library-card__body">
                      <h3 className="library-card__title">{r.title}</h3>
                      {r.author && <p className="library-card__author">by {r.author}</p>}
                      {r.subject && (
                        <div className="library-card__chips">
                          <span className="chip">{r.subject}</span>
                          {r.className && <span className="chip">{r.className}</span>}
                        </div>
                      )}
                      {r.description && (
                        <p className="library-card__desc">{r.description}</p>
                      )}
                    </div>
                    <div className="library-card__foot">
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => openDetail(r)}
                      >
                        <FiBookOpen size={12} /> Open
                      </button>
                      {r.bookmarked ? (
                        <span className={`pill ${r.progress >= 100 ? 'pill--paid' : 'pill--partial'}`}>
                          {r.progress >= 100 ? 'Finished' : `${r.progress}%`}
                        </span>
                      ) : (
                        <button
                          className="btn btn--primary btn--sm"
                          onClick={() => bookmark(r.id)}
                        >
                          <FiBookmark size={12} /> Save
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---------- My List tab ---------- */}
      {tab === 'mine' && (
        <>
          {readingList.length === 0 ? (
            <div className="card empty-state">
              <FiBookmark size={32} />
              <p>Your reading list is empty.</p>
              <p className="muted" style={{ fontSize: 13 }}>
                Save resources from the Browse tab to see them here.
              </p>
            </div>
          ) : (
            <div className="card">
              <table className="table table--striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>List</th>
                    <th>Progress</th>
                    <th>Notes</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {readingList.map((r, i) => {
                    const meta = TYPE_META[r.type] || TYPE_META.book;
                    return (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <meta.icon size={14} />
                            <div>
                              <strong>{r.title}</strong>
                              {r.author && (
                                <div className="muted" style={{ fontSize: 11 }}>
                                  {r.author}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="pill">{LIST_META[r.list]?.label || r.list}</span>
                        </td>
                        <td style={{ minWidth: 120 }}>
                          <div className="progress-mini">
                            <div className="progress-mini__track">
                              <div
                                className="progress-mini__fill"
                                style={{ width: `${Math.min(r.progress, 100)}%` }}
                              />
                            </div>
                            <span className="progress-mini__label">{r.progress}%</span>
                          </div>
                        </td>
                        <td className="muted" style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.personalNotes || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => openDetail(r)}
                            >
                              <FiBookOpen size={12} /> Open
                            </button>
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => removeBookmark(r.id)}
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ---------- Detail modal ---------- */}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h3>{detail.title}</h3>
                <p className="muted">
                  {TYPE_META[detail.type]?.label}
                  {detail.author && ` · by ${detail.author}`}
                </p>
              </div>
              <button className="btn btn--ghost" onClick={() => setDetail(null)}>
                <FiX size={16} />
              </button>
            </div>

            {detail.description && (
              <p style={{ marginBottom: 14, lineHeight: 1.6 }}>{detail.description}</p>
            )}

            {detail.url && (
              <a
                href={detail.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn--primary btn--full"
                style={{ marginBottom: 16 }}
              >
                <FiExternalLink size={14} /> Open resource
              </a>
            )}

            {detail.bookmarked ? (
              <>
                <h4 className="modal__section-title">My progress</h4>
                <div className="form-grid">
                  <label>
                    List
                    <select
                      value={bookmarkForm.list}
                      onChange={(e) => {
                        setBookmarkForm({ ...bookmarkForm, list: e.target.value });
                        updateBookmark(detail.id, { list: e.target.value });
                      }}
                    >
                      {Object.entries(LIST_META).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Progress ({bookmarkForm.progress}%)
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={bookmarkForm.progress}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setBookmarkForm({ ...bookmarkForm, progress: v });
                        updateBookmark(detail.id, { progress: v });
                      }}
                    />
                  </label>
                </div>
                <label className="form-grid__full">
                  Personal notes
                  <textarea
                    rows="3"
                    value={bookmarkForm.notes}
                    onChange={(e) => setBookmarkForm({ ...bookmarkForm, notes: e.target.value })}
                    onBlur={() => updateBookmark(detail.id, { notes: bookmarkForm.notes })}
                    placeholder="Jot down anything you want to remember…"
                  />
                </label>
                <div className="modal__actions">
                  <button
                    className="btn btn--ghost"
                    onClick={async () => { await removeBookmark(detail.id); setDetail(null); }}
                  >
                    <FiTrash2 size={14} /> Remove from list
                  </button>
                </div>
              </>
            ) : (
              <div className="modal__actions">
                <button
                  className="btn btn--primary"
                  onClick={async () => { await bookmark(detail.id); setDetail(null); }}
                >
                  <FiBookmark size={14} /> Add to reading list
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}