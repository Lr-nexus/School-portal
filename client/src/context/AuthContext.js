import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'user';

function readUser() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeUser(user, remember = false) {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}

  if (!user) return;

  const target = remember ? localStorage : sessionStorage;
  try { target.setItem(STORAGE_KEY, JSON.stringify(user)); } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  useEffect(() => {
    const stored = readUser();
    if (!stored) return;

    let cancelled = false;

    api('/auth/me')
      .then((data) => {
        if (cancelled) return;
        const fresh = {
          id: data.id, name: data.name, email: data.email,
          role: data.role, photo: data.profile?.photo || null,
        };
        const remember = !!localStorage.getItem(STORAGE_KEY);
        writeUser(fresh, remember);
        setUser(fresh);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('Session refresh failed:', err.message);
        if (err.message.toLowerCase().includes('authoriz')) {
          writeUser(null);
          setUser(null);
        }
      });

    return () => { cancelled = true; };
  }, []);

  const login = async (email, password, remember = false) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    let fullUser = data.user;
    try {
      const me = await api('/auth/me');
      fullUser = { ...data.user, photo: me.profile?.photo || null };
    } catch {}

    writeUser(fullUser, remember);
    setUser(fullUser);
    return fullUser;
  };

  const logout = () => {
    writeUser(null);
    setUser(null);
  };

  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const remember = !!localStorage.getItem(STORAGE_KEY);
      writeUser(next, remember);
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