import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  FiLock, FiCheck, FiAlertCircle, FiArrowLeft,
  FiEye, FiEyeOff
} from 'react-icons/fi';
import { api } from '../../api/api';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api(`/password-reset/verify/${token}`)
      .then((res) => {
        setUserName(res.name);
        setUserEmail(res.email);
      })
      .catch((err) => setVerifyError(err.message))
      .finally(() => setVerifying(false));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');

    if (password.length < 6) return setErrorMsg('Password must be at least 6 characters');
    if (password !== confirm) return setErrorMsg('Passwords do not match');

    setLoading(true);
    try {
      const res = await api('/password-reset/reset', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      setMessage(res.message);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return <div className="auth-simple"><div className="loader">Verifying link…</div></div>;
  }

  if (verifyError) {
    return (
      <div className="auth-simple">
        <div className="auth-simple__card">
          <div className="alert alert--error">
            <FiAlertCircle size={16} /> {verifyError}
          </div>
          <Link to="/forgot-password" className="btn btn--primary btn--full">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-simple">
      <div className="auth-simple__card">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/login')}>
          <FiArrowLeft size={14} /> Back to login
        </button>

        <h1>Set a New Password</h1>
        <p className="muted">Hi {userName} ({userEmail})</p>

        {message && <div className="alert alert--info"><FiCheck size={16} /> {message}</div>}
        {errorMsg && <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>}

        <form onSubmit={submit}>
          <label>
            New Password
            <div className="password-field">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShow((v) => !v)}
                tabIndex={-1}
              >
                {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </label>

          <label>
            Confirm Password
            <div className="password-field">
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          </label>

          <button className="btn btn--primary btn--full" disabled={loading}>
            <FiLock size={16} /> {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>

        <p className="auth-simple__footer">
          <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}