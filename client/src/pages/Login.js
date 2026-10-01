import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiLogIn, FiUser, FiUsers, FiShield, FiHeart,
  FiBookOpen, FiVideo, FiFileText, FiClipboard,
  FiAward, FiTrendingUp, FiCheckCircle,
  FiEye, FiEyeOff, FiSun, FiMoon,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1600&q=80';

const LOGIN_THEME_KEY = 'login-theme-pref';

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

/* ------------------------------------------------------------------
   Demo accounts — grouped so it's obvious who teaches what.
   Order: Student → Class Teacher → Subject Teacher → Admin → Parent
------------------------------------------------------------------ */
const DEMO_ACCOUNTS = {
  student: {
    email: 'ada@school.com',
    password: 'Student@123',
    label: 'Student',
    hint: 'JSS 2A',
  },
  classTeacher: {
    email: 'teacher@school.com',
    password: 'Teacher@123',
    label: 'Class Teacher',
    hint: 'Adewale Johnson · JSS 2A',
  },
  subjectTeacher: {
    email: 'emeka@school.com',
    password: 'Teacher@123',
    label: 'Subject Teacher',
    hint: 'Emeka Nwosu · English',
  },
  admin: {
    email: 'admin@school.com',
    password: 'admin123',
    label: 'Admin',
    hint: 'Principal',
  },
  parent: {
    email: 'parent@school.com',
    password: 'Parent@123',
    label: 'Parent',
    hint: 'Mr. Peter Obi',
  },
};

function readLoginTheme() {
  try {
    const v = localStorage.getItem(LOGIN_THEME_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginTheme, setLoginTheme] = useState(readLoginTheme);

  useEffect(() => {
    try { localStorage.setItem(LOGIN_THEME_KEY, loginTheme); } catch {}
  }, [loginTheme]);

  const toggleLoginTheme = () =>
    setLoginTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password, remember);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(`/${user.role}/home`, { replace: true });
    } catch (err) {
      const msg = err.message || 'Sign-in failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (key) => {
    const a = DEMO_ACCOUNTS[key];
    if (!a) return;
    setEmail(a.email);
    setPassword(a.password);
    setError('');
  };

  return (
    <div className="login-split" data-login-theme={loginTheme}>
      <button
        type="button"
        className="login-theme-toggle"
        onClick={toggleLoginTheme}
        title={loginTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        aria-label="Toggle login theme"
      >
        {loginTheme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
      </button>

      <div className="login-hero">
        <div className="login-hero__bg" style={{ backgroundImage: `url(${HERO_IMAGE})` }} />
        <div className="login-hero__overlay" />
        <div className="login-hero__content">
          <div className="login-hero__brand">
            <div className="login-hero__logo">
              <img
                src={`${process.env.PUBLIC_URL}/school-logo.png`}
                alt="Bright Future"
              />
          </div>
            <div>
              <h1>Bright Future</h1>
              <p>Secondary School</p>
            </div>
        </div>

          <div className="login-hero__tagline">
            <h2>Where Learning Meets&nbsp;Innovation</h2>
            <p>A complete digital platform for students, teachers and administrators — everything the school needs, in one place.</p>
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

      <div className="login-form-panel">
        <div className="login-form-panel__inner">
          <div className="login-form-panel__head">
            <div className="login-form-panel__eyebrow">
              <span className="login-form-panel__eyebrow-dot" />
              Secure portal access
            </div>
            <div className="login-form-panel__logo-mobile">
              <img
                src={`${process.env.PUBLIC_URL}/school-logo.png`}
                alt="Bright Future"
              />
            </div>
            <h2>Welcome back</h2>
            <p>Sign in to access your school portal</p>
          </div>

          {error && <div className="alert alert--error">{error}</div>}

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
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Keep me signed in</span>
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

          {/* ============================================================
              DEMO ACCOUNTS
              Each button now shows the person's name and role so it's
              obvious which is a class teacher vs subject teacher.
          ============================================================ */}
          <div className="login-demo">
            <div className="login-demo__head">
              <span>Try a demo account</span>
            </div>

            <div className="login-demo__btns login-demo__btns--grid">
              {/* STUDENT */}
              <button type="button" onClick={() => quickFill('student')}>
                <FiUser size={15} />
                <div>
                  <strong>{DEMO_ACCOUNTS.student.label}</strong>
                  <span>{DEMO_ACCOUNTS.student.hint}</span>
                </div>
              </button>

              {/* CLASS TEACHER */}
              <button type="button" onClick={() => quickFill('classTeacher')}>
                <FiUsers size={15} />
                <div>
                  <strong>{DEMO_ACCOUNTS.classTeacher.label}</strong>
                  <span>{DEMO_ACCOUNTS.classTeacher.hint}</span>
                </div>
              </button>

              {/* SUBJECT TEACHER */}
              <button type="button" onClick={() => quickFill('subjectTeacher')}>
                <FiBookOpen size={15} />
                <div>
                  <strong>{DEMO_ACCOUNTS.subjectTeacher.label}</strong>
                  <span>{DEMO_ACCOUNTS.subjectTeacher.hint}</span>
                </div>
              </button>

              {/* ADMIN */}
              <button type="button" onClick={() => quickFill('admin')}>
                <FiShield size={15} />
                <div>
                  <strong>{DEMO_ACCOUNTS.admin.label}</strong>
                  <span>{DEMO_ACCOUNTS.admin.hint}</span>
                </div>
              </button>

              {/* PARENT */}
              <button type="button" onClick={() => quickFill('parent')}>
                <FiHeart size={15} />
                <div>
                  <strong>{DEMO_ACCOUNTS.parent.label}</strong>
                  <span>{DEMO_ACCOUNTS.parent.hint}</span>
                </div>
              </button>
            </div>

            <p className="login-demo__hint">
              Click any button to auto-fill the credentials
            </p>
          </div>

          <div className="login-trust">
            <div className="login-trust__item"><FiAward size={16} /><span>Accredited</span></div>
            <div className="login-trust__item"><FiTrendingUp size={16} /><span>Modern Curriculum</span></div>
            <div className="login-trust__item"><FiCheckCircle size={16} /><span>Safe & Secure</span></div>
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