import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'user';

function readUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeUser(user) {
  if (user) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  /* ⭐ On app startup, refresh the user's info from the server.
     This corrects any stale values (e.g. after editing the profile
     in another tab, or after a DB-level fix). */
  useEffect(() => {
    const stored = readUser();
    if (!stored) return;

    let cancelled = false;

    api('/auth/me')
      .then((data) => {
        if (cancelled) return;
        const fresh = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role,
        };
        writeUser(fresh);
        setUser(fresh);
      })
      .catch((err) => {
        if (cancelled) return;
        // Session is bad (user deleted, or backend down)
        console.warn('Session refresh failed:', err.message);
        // Only clear if it's an auth problem
        if (err.message.toLowerCase().includes('authoriz')) {
          writeUser(null);
          setUser(null);
        }
      });

    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    writeUser(data.user);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    writeUser(null);
    setUser(null);
  };

  /* Merge a partial update into the current user, persist it,
     and let every consumer re-render. */
  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      writeUser(next);
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);