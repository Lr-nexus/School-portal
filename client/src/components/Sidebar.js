import { NavLink, useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { navConfig } from '../config/navConfig';

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navConfig[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className={`sidebar ${open ? 'sidebar--open' : ''}`}>
      <div className="sidebar__brand">
        <div className="sidebar__logo">BF</div>
        <div>
          <h2>Bright Future</h2>
          <span>Secondary School</span>
        </div>
      </div>

      <div className="sidebar__user">
        <div className="avatar">{user?.name?.charAt(0) || 'U'}</div>
        <div>
          <p>{user?.name}</p>
          <span className="badge">{user?.role}</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
            >
              <span className="nav-item__icon"><Icon size={18} /></span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <button className="logout-btn" onClick={handleLogout}>
        <FiLogOut size={16} />
        <span>Logout</span>
      </button>
    </aside>
  );
}