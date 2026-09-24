import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  FiMenu, FiUser, FiLogOut, FiChevronDown,
  FiSun, FiMoon
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';
import GlobalSearch from './GlobalSearch';

const BASE_URL =
  (process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_URL ||
    'https://school-portal-1-xaio.onrender.com/api'
  ).replace(/\/api\/?$/, '');

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const page = pathname.split('/').pop() || 'home';

  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  const avatarInitial = user?.name?.charAt(0) || 'U';
  const photoSrc = user?.photo
    ? (user.photo.startsWith('http') ? user.photo : `${BASE_URL}${user.photo}`)
    : null;

  return (
    <header className="topbar">
      <button className="menu-btn" onClick={onMenuClick} title="Menu">
        <FiMenu size={22} />
      </button>

      <h1 className="topbar__title">
        {page.charAt(0).toUpperCase() + page.slice(1)}
      </h1>

      <div className="topbar__right">
        <span className="topbar__date">
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long'
          })}
        </span>

        <GlobalSearch />

        <button
          className="topbar__icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
        </button>

        <NotificationBell />

        <div className="user-menu" ref={menuRef}>
          <button
            className="user-menu__trigger"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={open}
          >
            <div className="avatar avatar--sm">
              {photoSrc ? (
                <img src={photoSrc} alt={user?.name} />
              ) : (
                avatarInitial
              )}
            </div>
            <span className="user-menu__name">{user?.name}</span>
            <FiChevronDown
              size={14}
              className={`user-menu__caret ${open ? 'user-menu__caret--up' : ''}`}
            />
          </button>

          {open && (
            <div className="user-menu__dropdown">
              <div className="user-menu__header">
                <div className="avatar">
                  {photoSrc ? (
                    <img src={photoSrc} alt={user?.name} />
                  ) : (
                    avatarInitial
                  )}
                </div>
                <div>
                  <strong>{user?.name}</strong>
                  <span className="badge">{user?.role}</span>
                </div>
              </div>

              <Link
                to={`/${user?.role}/profile`}
                className="user-menu__item"
                onClick={() => setOpen(false)}
              >
                <FiUser size={16} /> My Profile
              </Link>

              <button
                className="user-menu__item user-menu__item--danger"
                onClick={handleLogout}
              >
                <FiLogOut size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}