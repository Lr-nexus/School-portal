import { FiX, FiCommand } from 'react-icons/fi';

const GROUPS = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['mod', 'k'], label: 'Open command palette' },
      { keys: ['shift', '?'], label: 'Show this help' },
      { keys: ['esc'], label: 'Close dialog / palette' },
    ],
  },
  {
    title: 'Navigate',
    shortcuts: [
      { keys: ['g', 'd'], label: 'Go to dashboard' },
      { keys: ['g', 'l'], label: 'Open library' },
      { keys: ['g', 'p'], label: 'Open profile' },
    ],
  },
  {
    title: 'Lists & forms',
    shortcuts: [
      { keys: ['↑'], label: 'Previous item' },
      { keys: ['↓'], label: 'Next item' },
      { keys: ['↵'], label: 'Confirm / submit' },
    ],
  },
];

function KeyCap({ k }) {
  if (k === 'mod') {
    return (
      <>
        <kbd>⌘</kbd>
        <kbd>Ctrl</kbd>
      </>
    );
  }
  return <kbd>{k}</kbd>;
}

export default function KeyboardShortcutsModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3><FiCommand size={18} /> Keyboard shortcuts</h3>
            <p className="muted">Speed up your workflow</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose}>
            <FiX size={16} />
          </button>
        </div>

        <div className="shortcuts-grid">
          {GROUPS.map((g) => (
            <div key={g.title} className="shortcuts-group">
              <h4>{g.title}</h4>
              {g.shortcuts.map((s) => (
                <div className="shortcut-row" key={s.label}>
                  <span className="shortcut-row__label">{s.label}</span>
                  <span className="shortcut-row__keys">
                    {s.keys.map((k, i) => (
                      <KeyCap key={i} k={k} />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="modal__actions">
          <button className="btn btn--primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}