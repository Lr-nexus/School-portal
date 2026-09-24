import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiSearch, FiX, FiUser, FiUserCheck, FiFileText, FiClipboard,
  FiEdit3, FiBell, FiLayers, FiCreditCard
} from 'react-icons/fi';
import { api } from '../api/api';

const ICONS = {
  user: FiUser,
  'user-check': FiUserCheck,
  file: FiFileText,
  clipboard: FiClipboard,
  edit: FiEdit3,
  bell: FiBell,
  layers: FiLayers,
  'credit-card': FiCreditCard,
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      api(`/search?q=${encodeURIComponent(query)}`)
        .then((data) => setResults(data.results || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const go = (link) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    navigate(link);
  };

  return (
    <div className="global-search" ref={ref}>
      <button
        className="topbar__icon-btn"
        onClick={() => setOpen((v) => !v)}
        title="Search"
      >
        <FiSearch size={20} />
      </button>

      {open && (
        <div className="global-search__panel">
          <div className="global-search__input-wrap">
            <FiSearch size={16} className="global-search__icon" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students, notes, announcements…"
              className="global-search__input"
            />
            {query && (
              <button
                className="global-search__clear"
                onClick={() => setQuery('')}
              >
                <FiX size={14} />
              </button>
            )}
          </div>

          <div className="global-search__results">
            {loading && (
              <p className="global-search__empty">Searching…</p>
            )}

            {!loading && query.trim().length < 2 && (
              <p className="global-search__empty">
                Type at least 2 characters
              </p>
            )}

            {!loading && query.trim().length >= 2 && !results.length && (
              <p className="global-search__empty">No results found</p>
            )}

            {results.map((r, i) => {
              const Icon = ICONS[r.icon] || FiSearch;
              return (
                <button
                  key={i}
                  className="global-search__item"
                  onClick={() => go(r.link)}
                >
                  <span className="global-search__item-icon">
                    <Icon size={14} />
                  </span>
                  <span className="global-search__item-text">
                    <strong>{r.title}</strong>
                    <small>{r.subtitle}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}