import { useEffect, useMemo, useState } from 'react';
import {
  FiSend, FiUsers, FiAlertCircle, FiCheck, FiRefreshCw, FiClock
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const SAMPLE = `Dear {student}'s guardian, please note that school resumes on Monday 6th January. - Bright Future School`;

export default function AdminSMS() {
  const [audience, setAudience] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState('ALL');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const load = async () => {
    try {
      const [a, l] = await Promise.all([
        api('/sms/audience'),
        api('/sms/log'),
      ]);
      setAudience(a);
      setLog(l);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const recipientCount = useMemo(() => {
    if (!audience) return 0;
    if (className === 'ALL') return audience.totalWithPhone;
    const c = audience.classes.find((x) => x.className === className);
    return c ? c.withPhone : 0;
  }, [audience, className]);

  const submit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!message.trim() || message.trim().length < 5) {
      return setErrorMsg('Message must be at least 5 characters');
    }

    if (!window.confirm(`Send this SMS to ${recipientCount} guardian(s)?`)) return;

    setSending(true);
    try {
      const res = await api('/sms/send', {
        method: 'POST',
        body: JSON.stringify({ className, message }),
      });
      setSuccessMsg(res.message);
      setMessage('');
      await load();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Loader />;

  const charCount = message.length;
  const smsPages = Math.ceil(charCount / 160) || 1;

  return (
    <div>
      <PageHeader
        title="Bulk SMS to Parents"
        subtitle="Send text messages to guardians"
      >
        <button className="btn btn--ghost" onClick={load}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {successMsg && <div className="alert alert--info"><FiCheck size={16} /> {successMsg}</div>}
      {errorMsg && <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>}

      <div className="stats-grid">
        <StatCard label="Total Students"       value={audience.total}           color="#2563eb" />
        <StatCard label="Guardians with Phone" value={audience.totalWithPhone}  color="#16a34a" />
        <StatCard label="Recent SMS Sent"      value={log.length}               color="#7c3aed" />
      </div>

      <div className="card">
        <h3><FiSend size={16} /> Compose Message</h3>

        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Recipients
              <select value={className} onChange={(e) => setClassName(e.target.value)}>
                <option value="ALL">
                  🌐 All Students ({audience.totalWithPhone} guardians with phone)
                </option>
                {audience.classes.map((c) => (
                  <option key={c.className} value={c.className}>
                    {c.className} ({c.withPhone} guardians with phone)
                  </option>
                ))}
              </select>
            </label>

            <div className="form-field-readonly">
              <span className="form-field-readonly__label">Will be sent to</span>
              <div className="form-field-readonly__value">
                <FiUsers size={14} /> {recipientCount} guardian(s)
              </div>
            </div>
          </div>

          <label>
            Message
            <textarea
              rows="5"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={SAMPLE}
              required
            />
          </label>

          <div className="sms-meta">
            <span>{charCount} characters</span>
            <span>·</span>
            <span>{smsPages} SMS page{smsPages === 1 ? '' : 's'}</span>
            <span>·</span>
            <button
              type="button"
              className="btn-link"
              onClick={() => setMessage(SAMPLE)}
            >
              Use sample
            </button>
          </div>

          <div className="modal__actions">
            <button
              className="btn btn--primary"
              disabled={sending || recipientCount === 0}
            >
              <FiSend size={16} /> {sending ? 'Sending…' : `Send to ${recipientCount}`}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3><FiClock size={16} /> Recent SMS Log</h3>
        {log.length === 0 && <p className="muted">No SMS sent yet.</p>}
        {log.length > 0 && (
          <div className="table-wrap">
            <table className="table table--striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Phone</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Provider</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>{row.phone}</td>
                    <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.message}
                    </td>
                    <td>
                      <span className={`pill ${row.status === 'sent' ? 'pill--paid' : 'pill--unpaid'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}