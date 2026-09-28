import { useEffect, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/ToastContainer';
import CommandPalette from './components/CommandPalette';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import OnboardingTour from './components/OnboardingTour';
import OfflineBadge from './components/OfflineBadge';
import AppRoutes from './routes/AppRoutes';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { api } from './api/api';

function GlobalShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  /* Check tour status on login (once per session) */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api('/onboarding')
      .then((state) => {
        if (cancelled) return;
        if (!state.tourCompleted) setTourOpen(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  /* Global keyboard shortcuts */
  useKeyboardShortcuts({
    'mod+k': () => setPaletteOpen((v) => !v),
    'shift+?': () => setShortcutsOpen((v) => !v),
    '?': () => setShortcutsOpen((v) => !v),
    'g d': () => user && navigate(`/${user.role}/home`),
    'g l': () => user && navigate('/library'),
    'g p': () => user && navigate(`/${user.role}/profile`),
  }, [user?.role]);

  /* Close overlays on route change */
  useEffect(() => {
    setPaletteOpen(false);
    setShortcutsOpen(false);
  }, [location.pathname]);

  const completeTour = async () => {
    try {
      await api('/onboarding/complete', { method: 'POST' });
    } catch {}
    setTourOpen(false);
  };

  return (
    <>
      <AppRoutes />
      <ToastContainer />
      <OfflineBadge />

      {user && (
        <>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
          <KeyboardShortcutsModal
            open={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />
          {tourOpen && (
            <OnboardingTour
              role={user.role}
              onComplete={completeTour}
            />
          )}
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <GlobalShell />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}