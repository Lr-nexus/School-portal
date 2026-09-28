import { useEffect, useRef } from 'react';

/**
 * Register global keyboard shortcuts.
 * Pass a map of combo → handler, e.g.:
 *   useKeyboardShortcuts({ 'mod+k': openPalette, '?': openHelp });
 *
 * Combos:
 *   "mod+k"  → Cmd+K on Mac, Ctrl+K on Windows/Linux
 *   "shift+/" or "?" → help
 *   "esc"   → escape
 *   "g d"   → sequential (press g then d)
 */
export function useKeyboardShortcuts(map, deps = []) {
  const seqRef = useRef({ key: null, timer: null });

  useEffect(() => {
    const handler = (e) => {
      /* Skip when typing in an input, textarea, or contenteditable */
      const tag = (e.target?.tagName || '').toLowerCase();
      const isEditing =
        tag === 'input' || tag === 'textarea' ||
        e.target?.isContentEditable;
      const isModCombo = e.metaKey || e.ctrlKey;

      /* Compose a normalized combo string */
      const parts = [];
      if (e.metaKey || e.ctrlKey) parts.push('mod');
      if (e.shiftKey && e.key !== '?') parts.push('shift');
      if (e.altKey) parts.push('alt');

      const key = e.key.toLowerCase();
      if (!['meta', 'control', 'shift', 'alt'].includes(key)) {
        parts.push(key === ' ' ? 'space' : key);
      }
      const combo = parts.join('+');

      /* Try direct matches first */
      for (const [pattern, fn] of Object.entries(map)) {
        const isMod = pattern.includes('mod+');
        // Never hijack typing unless the shortcut uses mod
        if (isEditing && !isMod) continue;

        if (pattern === combo) {
          e.preventDefault();
          fn(e);
          return;
        }

        /* Simple "?" special case — shift+/ on most layouts */
        if (pattern === '?' && e.key === '?') {
          if (isEditing) continue;
          e.preventDefault();
          fn(e);
          return;
        }

        /* Sequential shortcuts like "g d" */
        if (pattern.includes(' ') && !pattern.includes('+')) {
          const [first, second] = pattern.split(' ');
          // Start a sequence
          if (combo === first && !seqRef.current.key) {
            seqRef.current.key = first;
            seqRef.current.timer = setTimeout(() => {
              seqRef.current = { key: null, timer: null };
            }, 800);
            return;
          }
          // Complete a sequence
          if (seqRef.current.key === first && combo === second) {
            e.preventDefault();
            clearTimeout(seqRef.current.timer);
            seqRef.current = { key: null, timer: null };
            fn(e);
            return;
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line
  }, deps);
}