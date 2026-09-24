import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiLogIn, FiUser, FiUsers, FiShield,
  FiBookOpen, FiVideo, FiFileText, FiClipboard,
  FiAward, FiTrendingUp, FiCheckCircle
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80';

const FEATURES = [
  { icon: FiBookOpen, text: 'Digital notes & study materials' },
  { icon: FiVideo,    text: 'Live video classrooms' },
  { icon: FiClipboard,text: 'Assignments & grading' },
  { icon: FiFileText, text: 'Tests, quizzes & results' },
];

const STATS = [
  { value: '500+', label: 'Students' },
  { value: '40+',  label: 'Teachers' },
  { value: '25',   label: 'Subjects' },
  { value: '98%',  label: 'Pass Rate' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(`/${user.role}/home`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (role) => {
    const map = {
      student: ['student@school.com', 'student123'],
      teacher: ['teacher@school.com', 'teacher123'],
      admin:   ['admin@school.com', 'admin123'],
    };
    setEmail(map[role][0]);
    setPassword(map[role][1]);
    setError('');
  };

  return (
    <div className="login-split">
      {/* LEFT PANEL — Hero */}
      <div className="login-hero">
        <div
          className="login-hero__bg"
          style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        />
        <div className="login-hero__overlay" />

        <div className="login-hero__content">
          <div className="login-hero__brand">
            <div className="login-hero__logo">BF</div>
            <div>
              <h1>Bright Future</h1>
              <p>Secondary School</p>
            </div>
          </div>

          <div className="login-hero__tagline">
            <h2>Where Learning Meets&nbsp;Innovation</h2>
            <p>
              A complete digital platform for students, teachers and administrators —
              everything the school needs, in one place.
            </p>
          </div>

          <ul className="login-hero__features">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="login-hero__feature-icon">
                  <Icon size={16} />
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="login-hero__stats">
            {STATS.map((s) => (
              <div key={s.label} className="login-hero__stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="login-hero__footer">
            <FiCheckCircle size={14} />
            <span>Trusted by parents, teachers & students since 2015</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL — Form */}
      <div className="login-form-panel">
        <div className="login-form-panel__inner">
          <div className="login-form-panel__head">
            <div className="login-form-panel__logo-mobile">BF</div>
            <h2>Welcome back</h2>
            <p>Sign in to access your school portal</p>
          </div>

          {error && (
            <div className="alert alert--error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              <span className="login-form__label">Email Address</span>
              <input
                type="email"
                value={email}
                placeholder="you@school.com"
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label>
              <span className="login-form__label">Password</span>
              <input
                type="password"
                value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button
              type="submit"
              className="btn btn--primary btn--full login-form__submit"
              disabled={loading}
            >
              <FiLogIn size={16} />
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: 12, color: 'var(--muted)' }}
              >
                Forgot password?
              </Link>
            </div>
          </form>

          {/* Demo accounts */}
          <div className="login-demo">
            <div className="login-demo__head">
              <span>Try a demo account</span>
            </div>

            <div className="login-demo__btns">
              <button type="button" onClick={() => quickFill('student')}>
                <FiUser size={15} />
                <div>
                  <strong>Student</strong>
                  <span>student@school.com</span>
                </div>
              </button>

              <button type="button" onClick={() => quickFill('teacher')}>
                <FiUsers size={15} />
                <div>
                  <strong>Teacher</strong>
                  <span>teacher@school.com</span>
                </div>
              </button>

              <button type="button" onClick={() => quickFill('admin')}>
                <FiShield size={15} />
                <div>
                  <strong>Admin</strong>
                  <span>admin@school.com</span>
                </div>
              </button>
            </div>

            <p className="login-demo__hint">
              Click any button to auto-fill the credentials
            </p>
          </div>

          {/* Trust badges */}
          <div className="login-trust">
            <div className="login-trust__item">
              <FiAward size={16} />
              <span>Accredited</span>
            </div>
            <div className="login-trust__item">
              <FiTrendingUp size={16} />
              <span>Modern Curriculum</span>
            </div>
            <div className="login-trust__item">
              <FiCheckCircle size={16} />
              <span>Safe & Secure</span>
            </div>
          </div>

          <p className="login-form-panel__footer">
            © {new Date().getFullYear()} Bright Future Secondary School.
            <br />
            All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}