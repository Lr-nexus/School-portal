import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      admin:   ['admin@school.com', 'admin123']
    };
    setEmail(map[role][0]);
    setPassword(map[role][1]);
  };

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <div className="login__logo">BF</div>
          <h1>Bright Future Secondary School</h1>
          <p>School Portal — Sign in to continue</p>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Email Address
            <input
              type="email"
              value={email}
              placeholder="you@school.com"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button className="btn btn--primary btn--full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="login__demo">
          <p>Demo accounts:</p>
          <div className="login__demo-btns">
            <button onClick={() => quickFill('student')}>Student</button>
            <button onClick={() => quickFill('teacher')}>Teacher</button>
            <button onClick={() => quickFill('admin')}>Admin</button>
          </div>
        </div>
      </div>
    </div>
  );
}