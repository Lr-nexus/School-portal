import { NavLink, useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { navConfig } from '../config/navConfig';

const BASE_URL =
  (process.env.REACT_APP_BACKEND_URL ||
    process.env.REACT_APP_API_URL ||
    'https://school-portal-1-xaio.onrender.com/api'
  ).replace(/\/api\/?$/, '');

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const groups = navConfig[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const photoSrc = user?.photo
    ? user.photo.startsWith('http')
      ? user.photo
      : `${BASE_URL}${user.photo}`
    : null;

  return (
    <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <img
            src={`${process.env.PUBLIC_URL}/school-logo.png`}
            alt="Bright Future"
          />
        </div>
        <div>
          <h2>Bright Future</h2>
          <span>Secondary School</span>
        </div>
      </div>

      <div className="sidebar__user">
        <div className="avatar">
          {photoSrc ? (
            <img src={photoSrc} alt={user?.name || ''} />
          ) : (
            user?.name?.charAt(0) || 'U'
          )}
        </div>
        <div>
          <p>{user?.name}</p>
          <span className="badge">{user?.role}</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        {groups.map((group) => (
          <div className="sidebar__group" key={group.label}>
            <div className="sidebar__group-label">{group.label}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'nav-item--active' : ''}`
                  }
                >
                  <span className="nav-item__icon">
                    <Icon size={17} />
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <button className="logout-btn" onClick={handleLogout}>
        <FiLogOut size={16} />
        <span>Logout</span>
      </button>
    </aside>
  );
}