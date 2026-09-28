import { useEffect, useState } from 'react';
import {
  FiBell, FiMail, FiCheck, FiAlertCircle, FiLoader,
  FiSmartphone, FiClock, FiSend,
} from 'react-icons/fi';
import { api } from '../api/api';
import { useToast } from '../context/ToastContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function NotificationSettings() {
  const toast = useToast();
  const push = usePushNotifications();

  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/notifications/me/preferences')
      .then(setPrefs)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const save = async (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      await api('/notifications/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify(next),
      });
      toast.success('Preferences saved');
    } catch (err) {
      toast.error(err.message);
      // Revert on failure
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async () => {
    try {
      if (push.subscribed) {
        await push.unsubscribe();
        toast.success('Push notifications disabled');
      } else {
        await push.subscribe();
        toast.success('Push notifications enabled');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const testPush = async () => {
    try {
      const res = await push.sendTest();
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loader" style={{ padding: 24 }}>
          <FiLoader className="spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="card notification-settings">
      <h3><FiBell size={16} /> Notifications</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
        Choose how you want to hear from us.
      </p>

      {/* ---------- Push ---------- */}
      <div className="settings-block">
        <div className="settings-block__head">
          <div className="settings-block__icon">
            <FiSmartphone size={16} />
          </div>
          <div className="settings-block__info">
            <strong>Browser push notifications</strong>
            <p className="muted">
              Get instant alerts for deadlines, grades, and messages — even when the
              site is in another tab.
            </p>
          </div>
          <div className="settings-block__action">
            {!push.supported ? (
              <span className="pill">Not supported</span>
            ) : push.subscribed ? (
              <div className="settings-block__buttons">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={testPush}
                  disabled={push.busy}
                >
                  <FiSend size={12} /> Test
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={handlePushToggle}
                  disabled={push.busy}
                >
                  Disable
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handlePushToggle}
                disabled={push.busy}
              >
                {push.busy ? 'Enabling…' : 'Enable'}
              </button>
            )}
          </div>
        </div>
        {push.permission === 'denied' && (
          <div className="alert alert--error" style={{ marginTop: 10, fontSize: 12 }}>
            <FiAlertCircle size={14} />
            Notifications are blocked in your browser. Click the lock icon in the
            address bar → Site settings → Notifications → Allow.
          </div>
        )}
      </div>

      {/* ---------- Deadline reminders ---------- */}
      <div className="settings-block">
        <div className="settings-block__head">
          <div className="settings-block__icon">
            <FiClock size={16} />
          </div>
          <div className="settings-block__info">
            <strong>Deadline reminders</strong>
            <p className="muted">
              Get reminded 24 hours before an assignment or quiz is due.
            </p>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!prefs.deadlineReminders}
              onChange={(e) => save({ deadlineReminders: e.target.checked })}
              disabled={saving}
            />
            <span className="toggle__slider" />
          </label>
        </div>
      </div>

      {/* ---------- Email digests ---------- */}
      <div className="settings-block">
        <div className="settings-block__head">
          <div className="settings-block__icon">
            <FiMail size={16} />
          </div>
          <div className="settings-block__info">
            <strong>Email digest</strong>
            <p className="muted">
              A summary of what's due, plus important school news.
            </p>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!prefs.emailDigestEnabled}
              onChange={(e) => save({ emailDigestEnabled: e.target.checked })}
              disabled={saving}
            />
            <span className="toggle__slider" />
          </label>
        </div>

        {prefs.emailDigestEnabled && (
          <div className="settings-block__sub">
            <label>
              Frequency
              <select
                value={prefs.digestFrequency}
                onChange={(e) => save({ digestFrequency: e.target.value })}
                disabled={saving}
              >
                <option value="daily">Daily (7am)</option>
                <option value="weekly">Weekly (Monday 8am)</option>
                <option value="off">Off</option>
              </select>
            </label>
          </div>
        )}
      </div>

      {saving && (
        <p className="muted" style={{ fontSize: 12, marginTop: 12, textAlign: 'right' }}>
          <FiLoader className="spin" size={12} /> Saving…
        </p>
      )}
    </div>
  );
}