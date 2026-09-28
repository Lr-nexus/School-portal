import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/api';

const ACTIVE_KEY = 'parent-active-child';

/**
 * Loads the parent + all their children.
 * Exposes the active child, with a setter that persists across pages.
 */
export function useParentContext() {
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [activeChildId, setActiveChildIdState] = useState(() => {
    const stored = sessionStorage.getItem(ACTIVE_KEY);
    return stored ? Number(stored) : null;
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    api('/parents/me')
      .then((data) => {
        if (cancelled) return;
        setParent(data.parent);
        const kids = data.children || [];
        setChildren(kids);

        // Pick active child: stored > first
        const stored = activeChildId;
        const found = stored && kids.find((c) => c.id === stored);
        if (!found && kids.length) {
          setActiveChildIdState(kids[0].id);
          sessionStorage.setItem(ACTIVE_KEY, String(kids[0].id));
        }
      })
      .catch((e) => {
        if (!cancelled) setErrorMsg(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, []);

  const setActiveChildId = useCallback((id) => {
    setActiveChildIdState(id);
    try { sessionStorage.setItem(ACTIVE_KEY, String(id)); } catch {}
  }, []);

  const activeChild =
    children.find((c) => c.id === activeChildId) || children[0] || null;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/parents/me');
      setParent(data.parent);
      setChildren(data.children || []);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    parent,
    children,
    activeChild,
    activeChildId: activeChild?.id || null,
    setActiveChildId,
    loading,
    errorMsg,
    refresh,
  };
}