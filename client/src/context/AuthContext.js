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

  /* On startup, refresh the user's info from the server */
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
          photo: data.profile?.photo || null,
        };
        writeUser(fresh);
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

  const login = async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Fetch full profile (includes photo)
    let fullUser = data.user;
    try {
      const me = await api('/auth/me');
      fullUser = {
        ...data.user,
        photo: me.profile?.photo || null,
      };
    } catch {
      // Non-fatal
    }

    writeUser(fullUser);
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