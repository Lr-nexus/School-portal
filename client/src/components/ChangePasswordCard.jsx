import { useState } from 'react';
import { FiLock, FiSave, FiCheck, FiEye, FiEyeOff } from 'react-icons/fi';
import { api } from '../api/api';

export default function ChangePasswordCard() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const toggle = (field) =>
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));

  const reset = () =>
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setError('New password must be different from the current one');
      return;
    }

    setSaving(true);
    try {
      await api('/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });
      setMessage('Password updated successfully');
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h3><FiLock size={16} /> Change Password</h3>

      {message && (
        <div className="alert alert--info">
          <FiCheck size={16} /> {message}
        </div>
      )}
      {error && <div className="alert alert--error">{error}</div>}

      <form onSubmit={submit}>
        <label>
          Current Password *
          <div className="password-field">
            <input
              type={show.current ? 'text' : 'password'}
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              placeholder="Enter your current password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => toggle('current')}
              tabIndex={-1}
              aria-label={show.current ? 'Hide password' : 'Show password'}
            >
              {show.current ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </label>

        <label>
          New Password *
          <div className="password-field">
            <input
              type={show.next ? 'text' : 'password'}
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => toggle('next')}
              tabIndex={-1}
              aria-label={show.next ? 'Hide password' : 'Show password'}
            >
              {show.next ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </label>

        <label>
          Confirm New Password *
          <div className="password-field">
            <input
              type={show.confirm ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter the new password"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => toggle('confirm')}
              tabIndex={-1}
              aria-label={show.confirm ? 'Hide password' : 'Show password'}
            >
              {show.confirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </label>

        <div className="profile-form__actions">
          <button type="button" className="btn btn--ghost" onClick={reset} disabled={saving}>
            Clear
          </button>
          <button className="btn btn--primary" disabled={saving}>
            <FiSave size={16} /> {saving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}