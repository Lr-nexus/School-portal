import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { api } from '../../api/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await api('/password-reset/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
      setEmail('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-simple">
      <div className="auth-simple__card">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/login')}>
          <FiArrowLeft size={14} /> Back to login
        </button>

        <h1>Forgot Password</h1>
        <p className="muted">
          Enter your email and we'll send you a link to reset it.
        </p>

        {message && (
          <div className="alert alert--info">
            <FiCheck size={16} /> {message}
          </div>
        )}
        {errorMsg && (
          <div className="alert alert--error">
            <FiAlertCircle size={16} /> {errorMsg}
          </div>
        )}

        <form onSubmit={submit}>
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.com"
              required
              autoFocus
            />
          </label>
          <button className="btn btn--primary btn--full" disabled={loading}>
            <FiMail size={16} /> {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <p className="auth-simple__footer">
          Remember your password? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}