import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiLogIn, FiUser, FiUsers, FiShield, FiHeart,
  FiBookOpen, FiVideo, FiFileText, FiClipboard,
  FiAward, FiTrendingUp, FiCheckCircle,
  FiEye, FiEyeOff,
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

const DEMO_ACCOUNTS = {
  student: { email: 'ada@school.com',     password: 'Student@123', label: 'Student' },
  teacher: { email: 'teacher@school.com', password: 'Teacher@123', label: 'Teacher' },
  admin:   { email: 'admin@school.com',   password: 'admin123',    label: 'Admin'   },
  parent:  { email: 'parent@school.com',  password: 'Parent@123',  label: 'Parent'  },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setError(err.message || 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (role) => {
    const a = DEMO_ACCOUNTS[role];
    if (!a) return;
    setEmail(a.email);
    setPassword(a.password);
    setError('');
  };

  return (
    <div className="login-split">
      {/* ---------------- LEFT: hero ---------------- */}
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
                <span className="login-hero__feature-icon"><Icon size={16} /></span>
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

      {/* ---------------- RIGHT: form ---------------- */}
      <div className="login-form-panel">
        <div className="login-form-panel__inner">
          <div className="login-form-panel__head">
            <div className="login-form-panel__eyebrow">
              <span className="login-form-panel__eyebrow-dot" />
              Secure portal access
            </div>
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
                autoFocus
                required
              />
            </label>

            <label>
              <span className="login-form__label">Password</span>
              <div className="login-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </label>

            <div className="login-form__row">
              <label className="login-form__remember">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="login-form__forgot">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--full login-form__submit"
              disabled={loading}
            >
              <FiLogIn size={16} />
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* ---------- Demo accounts ---------- */}
          <div className="login-demo">
            <div className="login-demo__head">
              <span>Try a demo account</span>
            </div>

            <div className="login-demo__btns login-demo__btns--grid">
              <button type="button" onClick={() => quickFill('student')}>
                <FiUser size={15} />
                <div>
                  <strong>Student</strong>
                  <span>{DEMO_ACCOUNTS.student.email}</span>
                </div>
              </button>

              <button type="button" onClick={() => quickFill('teacher')}>
                <FiUsers size={15} />
                <div>
                  <strong>Teacher</strong>
                  <span>{DEMO_ACCOUNTS.teacher.email}</span>
                </div>
              </button>

              <button type="button" onClick={() => quickFill('admin')}>
                <FiShield size={15} />
                <div>
                  <strong>Admin</strong>
                  <span>{DEMO_ACCOUNTS.admin.email}</span>
                </div>
              </button>

              <button type="button" onClick={() => quickFill('parent')}>
                <FiHeart size={15} />
                <div>
                  <strong>Parent</strong>
                  <span>{DEMO_ACCOUNTS.parent.email}</span>
                </div>
              </button>
            </div>

            <p className="login-demo__hint">
              Click any button to auto-fill the credentials
            </p>
          </div>

          {/* ---------- Trust badges ---------- */}
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