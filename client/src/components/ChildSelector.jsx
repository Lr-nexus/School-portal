import { useEffect, useRef, useState } from 'react';
import { FiChevronDown, FiUser, FiCheck } from 'react-icons/fi';

export default function ChildSelector({ children, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!children || children.length === 0) return null;

  const active = children.find((c) => c.id === value) || children[0];

  // Single child → no dropdown needed
  if (children.length === 1) {
    return (
      <div className="child-selector child-selector--single">
        <div className="avatar avatar--sm">{active.name.charAt(0)}</div>
        <div className="child-selector__info">
          <strong>{active.name}</strong>
          <span className="muted">{active.className}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="child-selector" ref={ref}>
      <button
        type="button"
        className="child-selector__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="avatar avatar--sm">{active.name.charAt(0)}</div>
        <div className="child-selector__info">
          <strong>{active.name}</strong>
          <span className="muted">{active.className}</span>
        </div>
        <FiChevronDown
          size={14}
          className={`child-selector__caret ${open ? 'child-selector__caret--up' : ''}`}
        />
      </button>

      {open && (
        <div className="child-selector__dropdown" role="listbox">
          <div className="child-selector__head">
            <FiUser size={12} />
            <span>Switch child ({children.length})</span>
          </div>
          {children.map((c) => {
            const isActive = c.id === active.id;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`child-selector__item ${isActive ? 'child-selector__item--active' : ''}`}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <div className="avatar avatar--sm">{c.name.charAt(0)}</div>
                <div className="child-selector__item-info">
                  <strong>{c.name}</strong>
                  <span className="muted">{c.className} · {c.admissionNo}</span>
                </div>
                {isActive && <FiCheck size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}