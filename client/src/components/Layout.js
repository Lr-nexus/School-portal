import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-role', user?.role || 'guest');
  }, [user?.role]);

  return (
    <div className="layout">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="layout__main">
        <Topbar onMenuClick={() => setOpen(true)} />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
    </div>
  );
}