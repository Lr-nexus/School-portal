import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiSearch, FiArrowRight, FiCommand, FiCornerDownLeft,
  FiClock, FiStar, FiX,
} from 'react-icons/fi';
import { navConfigFlat } from '../config/navConfig';
import { useAuth } from '../context/AuthContext';

const RECENT_KEY = 'cmd-recent';

function readRecent() {
  try { return JSON.parse(sessionStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function writeRecent(list) {
  try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); }
  catch {}
}

export default function CommandPalette({ open, onClose, onOpenShortcuts }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [recents, setRecents] = useState(readRecent);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  /* Build the pool of commands from the current user's nav */
  const commands = useMemo(() => {
    const nav = navConfigFlat[user?.role] || [];
    const base = nav.map((item) => ({
      id: `nav:${item.to}`,
      label: item.label,
      hint: item.to,
      icon: item.icon,
      run: () => navigate(item.to),
    }));

    /* Injected universal commands */
    const universal = [
      {
        id: 'act:shortcuts',
        label: 'Show keyboard shortcuts',
        hint: 'Shift + ?',
        icon: FiCommand,
        run: () => { onClose(); onOpenShortcuts?.(); },
      },
      {
        id: 'act:home',
        label: 'Go to my dashboard',
        hint: 'g d',
        icon: FiStar,
        run: () => navigate(`/${user?.role}/home`),
      },
      {
        id: 'act:profile',
        label: 'Open my profile',
        hint: 'My account',
        icon: FiStar,
        run: () => navigate(`/${user?.role}/profile`),
      },
      {
        id: 'act:library',
        label: 'Open digital library',
        hint: 'Books & resources',
        icon: FiStar,
        run: () => navigate('/library'),
      },
    ];

    return [...base, ...universal];
  }, [user?.role, navigate, onClose, onOpenShortcuts]);

  /* Fuzzy-ish filter */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      /* Show recents first, then everything */
      const recentIds = new Set(recents);
      const sorted = [...commands].sort((a, b) => {
        const aR = recentIds.has(a.id) ? 1 : 0;
        const bR = recentIds.has(b.id) ? 1 : 0;
        return bR - aR;
      });
      return sorted;
    }
    const words = q.split(/\s+/);
    return commands
      .map((c) => {
        const hay = `${c.label} ${c.hint}`.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (!hay.includes(w)) return { c, score: -1 };
          const i = hay.indexOf(w);
          score += 100 - i;
          if (c.label.toLowerCase().startsWith(w)) score += 50;
        }
        return { c, score };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }, [commands, query, recents]);

  /* Focus + reset on open */
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 40);
      setRecents(readRecent());
    }
  }, [open]);

  /* Close palette on route change */
  useEffect(() => { if (open) onClose(); /* eslint-disable-next-line */ }, [location.pathname]);

  /* Keyboard nav */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[selected];
        if (!item) return;
        const next = [item.id, ...recents.filter((id) => id !== item.id)].slice(0, 8);
        writeRecent(next);
        item.run();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected, onClose, recents]);

  /* Keep the highlighted item scrolled into view */
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const recentIds = new Set(recents);

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div
        className="cmd-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="cmd-input-row">
          <FiSearch size={16} className="cmd-input-icon" />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
          />
          <button className="cmd-close" onClick={onClose} title="Close">
            <FiX size={14} />
          </button>
        </div>

        <div className="cmd-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="cmd-empty">
              No matches for <strong>{query}</strong>
            </div>
          )}
          {filtered.map((item, i) => {
            const Icon = item.icon;
            const isRecent = recentIds.has(item.id) && !query;
            return (
              <button
                key={item.id}
                type="button"
                data-index={i}
                className={`cmd-item ${i === selected ? 'cmd-item--active' : ''}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  const next = [item.id, ...recents.filter((id) => id !== item.id)].slice(0, 8);
                  writeRecent(next);
                  item.run();
                  onClose();
                }}
              >
                <span className="cmd-item__icon">
                  {isRecent ? <FiClock size={14} /> : <Icon size={14} />}
                </span>
                <span className="cmd-item__label">{item.label}</span>
                {item.hint && (
                  <span className="cmd-item__hint">{item.hint}</span>
                )}
                {i === selected && (
                  <FiCornerDownLeft size={12} className="cmd-item__enter" />
                )}
              </button>
            );
          })}
        </div>

        <div className="cmd-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}