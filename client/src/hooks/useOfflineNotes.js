import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/api';

const CACHE_KEY = 'offline-notes-cache';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(notes) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      notes,
    }));
  } catch {}
}

/**
 * Loads the notes list, serving from cache when offline.
 * Exposes:
 *   notes       — list
 *   loading
 *   fromCache   — true when rendered from cache
 *   lastSynced  — timestamp of last successful fetch
 *   refresh     — force refetch
 */
export function useOfflineNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    // Offline — read from cache immediately
    if (!navigator.onLine) {
      const cached = readCache();
      if (cached) {
        setNotes(cached.notes);
        setFromCache(true);
        setLastSynced(new Date(cached.savedAt));
      }
      setLoading(false);
      return;
    }

    // Online — fetch fresh
    try {
      const data = await api('/notes');
      setNotes(data);
      setFromCache(false);
      setLastSynced(new Date());
      writeCache(data);
    } catch (err) {
      setError(err.message);
      // Fallback to cache on network error
      const cached = readCache();
      if (cached) {
        setNotes(cached.notes);
        setFromCache(true);
        setLastSynced(new Date(cached.savedAt));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const goOnline = () => load();
    window.addEventListener('online', goOnline);
    return () => window.removeEventListener('online', goOnline);
  }, [load]);

  /* Cache a single note's detail when the user opens it */
  const cacheNote = useCallback((note) => {
    if (!note || !note.id) return;
    const existing = readCache();
    if (!existing) return;
    const idx = existing.notes.findIndex((n) => n.id === note.id);
    if (idx === -1) return;
    existing.notes[idx] = { ...existing.notes[idx], ...note, _cachedContent: true };
    writeCache(existing.notes);
    // Silently update local list
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, ...note, _cachedContent: true } : n))
    );
  }, []);

  const clearCache = useCallback(() => {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    setFromCache(false);
  }, []);

  return { notes, loading, error, fromCache, lastSynced, refresh: load, cacheNote, clearCache };
}