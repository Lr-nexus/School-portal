import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity, FiSearch, FiAlertCircle, FiRefreshCw,
  FiChevronLeft, FiChevronRight, FiUser, FiTrash2,
  FiEye, FiX,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const METHOD_COLORS = {
  POST:   { bg: 'rgba(22,163,74,.12)',  fg: 'var(--green)' },
  PUT:    { bg: 'rgba(37,99,235,.12)',  fg: 'var(--accent)' },
  PATCH:  { bg: 'rgba(245,158,11,.14)', fg: '#b45309' },
  DELETE: { bg: 'rgba(220,38,38,.12)',  fg: 'var(--red)' },
};

function statusTone(status) {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client';
  return 'server';
}

export default function AdminAuditLog() {
  const toast = useToast();

  const [summary, setSummary] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [detail, setDetail] = useState(null);

  const [filters, setFilters] = useState({
    q: '',
    resource: 'all',
    role: 'all',
    method: 'all',
    status: 'all',
    from: '',
    to: '',
    page: 1,
    limit: 50,
  });

  const loadSummary = () =>
    api('/audit/summary').then(setSummary).catch(() => {});

  const load = async (override = {}) => {
    const f = { ...filters, ...override };
    setLoading(true);
    setErrorMsg('');
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => {
        if (v !== '' && v !== 'all' && v !== null && v !== undefined) {
          params.set(k, String(v));
        }
      });
      const [res] = await Promise.all([
        api(`/audit?${params.toString()}`),
        loadSummary(),
      ]);
      setData(res);
      setFilters(f);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load({ page: 1 }); /* eslint-disable-next-line */ }, []);

  const change = (patch) => load({ ...patch });

  const clearFilters = () => load({
    q: '', resource: 'all', role: 'all', method: 'all',
    status: 'all', from: '', to: '', page: 1,
  });

  const purge = async () => {
    const days = window.prompt('Delete audit entries older than how many days?', '90');
    if (!days) return;
    if (!window.confirm(`Permanently delete entries older than ${days} days?`)) return;
    try {
      const res = await api(`/audit/purge?days=${days}`, { method: 'DELETE' });
      toast.success(res.message);
      await load({ page: 1 });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const hasFilters = useMemo(() => (
    filters.q || filters.resource !== 'all' || filters.role !== 'all' ||
    filters.method !== 'all' || filters.status !== 'all' ||
    filters.from || filters.to
  ), [filters]);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Every mutating action by an admin or teacher, in chronological order"
      >
        <button className="btn btn--ghost" onClick={() => load({ page: 1 })}>
          <FiRefreshCw size={16} /> Refresh
        </button>
        <button className="btn btn--danger" onClick={purge}>
          <FiTrash2 size={16} /> Purge old
        </button>
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {summary && (
        <>
          <div className="stats-grid">
            <StatCard label="Total entries" value={summary.totals.allTime} color="#2563eb" />
            <StatCard label="Today" value={summary.totals.today} color="#16a34a" />
            <StatCard label="Last 7 days" value={summary.totals.last7Days} color="#7c3aed" />
            <StatCard
              label="Client errors"
              value={summary.totals.clientErrors}
              color={summary.totals.clientErrors > 0 ? '#dc2626' : '#16a34a'}
            />
          </div>

          {summary.byResource.length > 0 && (
            <div className="card">
              <h3><FiActivity size={16} /> Activity in the last 30 days</h3>
              <div className="audit-summary-grid">
                <div className="audit-summary-section">
                  <div className="audit-summary-label">By resource</div>
                  {summary.byResource.map((r) => (
                    <div className="audit-summary-row" key={r.resource}>
                      <span className="audit-summary-row__name">{r.resource}</span>
                      <span className="audit-summary-row__count">{r.count}</span>
                    </div>
                  ))}
                </div>
                <div className="audit-summary-section">
                  <div className="audit-summary-label">By user</div>
                  {summary.byUser.map((u) => (
                    <div className="audit-summary-row" key={u.name}>
                      <span className="audit-summary-row__name">
                        {u.name} <span className={`badge badge--${u.role}`}>{u.role}</span>
                      </span>
                      <span className="audit-summary-row__count">{u.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------- Filters ---------- */}
      <div className="card">
        <div className="filters-bar" style={{ marginBottom: 0 }}>
          <div className="filters-bar__search">
            <FiSearch size={16} />
            <input
              type="text"
              placeholder="Search by user, path, or content…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && load({ page: 1 })}
            />
          </div>

          <div className="filters-bar__select">
            <select
              value={filters.resource}
              onChange={(e) => load({ resource: e.target.value, page: 1 })}
            >
              <option value="all">All resources</option>
              {data?.resources?.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="filters-bar__select">
            <select
              value={filters.method}
              onChange={(e) => load({ method: e.target.value, page: 1 })}
            >
              <option value="all">Any method</option>
              <option value="POST">POST (create)</option>
              <option value="PUT">PUT (replace)</option>
              <option value="PATCH">PATCH (update)</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div className="filters-bar__select">
            <select
              value={filters.role}
              onChange={(e) => load({ role: e.target.value, page: 1 })}
            >
              <option value="all">Any role</option>
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>

          <div className="filters-bar__select">
            <select
              value={filters.status}
              onChange={(e) => load({ status: e.target.value, page: 1 })}
            >
              <option value="all">Any status</option>
              <option value="success">Success (2xx)</option>
              <option value="client">Client error (4xx)</option>
            </select>
          </div>

          <input
            type="date"
            className="audit-date"
            value={filters.from}
            onChange={(e) => load({ from: e.target.value, page: 1 })}
            title="From date"
          />
          <input
            type="date"
            className="audit-date"
            value={filters.to}
            onChange={(e) => load({ to: e.target.value, page: 1 })}
            title="To date"
          />

          {hasFilters && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={clearFilters}
            >
              <FiX size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ---------- Table ---------- */}
      {loading && !data ? (
        <Loader />
      ) : data && (
        <div className="card" style={{ padding: 0 }}>
          <div className="audit-table-head">
            <span className="muted" style={{ fontSize: 13 }}>
              {data.total.toLocaleString()} entr{data.total === 1 ? 'y' : 'ies'} · page {data.page} of {data.totalPages}
            </span>
            <div className="audit-pagination">
              <button
                className="btn btn--ghost btn--sm"
                disabled={data.page <= 1}
                onClick={() => load({ page: data.page - 1 })}
              >
                <FiChevronLeft size={14} /> Prev
              </button>
              <button
                className="btn btn--ghost btn--sm"
                disabled={data.page >= data.totalPages}
                onClick={() => load({ page: data.page + 1 })}
              >
                Next <FiChevronRight size={14} />
              </button>
            </div>
          </div>

          {data.rows.length === 0 ? (
            <div className="empty-state">
              <FiActivity size={32} />
              <p>No matching audit entries.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--striped audit-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => {
                    const color = METHOD_COLORS[r.method] || {};
                    const tone = statusTone(r.status);
                    return (
                      <tr key={r.id}>
                        <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {new Date(r.createdAt).toLocaleString('en-GB', {
                            day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td>
                          <strong style={{ fontSize: 13 }}>{r.userName || '—'}</strong>
                          {r.userRole && (
                            <div>
                              <span className={`badge badge--${r.userRole}`} style={{ fontSize: 10 }}>
                                {r.userRole}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className="audit-method"
                            style={{ background: color.bg, color: color.fg }}
                          >
                            {r.method}
                          </span>
                        </td>
                        <td className="audit-path">
                          <code>{r.path}</code>
                        </td>
                        <td>
                          <span className={`audit-status audit-status--${tone}`}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn--ghost btn--sm"
                            onClick={() => setDetail(r)}
                          >
                            <FiEye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {detail && (
        <AuditDetailModal entry={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function AuditDetailModal({ entry, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3><FiActivity size={18} /> Audit entry #{entry.id}</h3>
            <p className="muted">
              {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
          <button className="btn btn--ghost" onClick={onClose}>
            <FiX size={16} />
          </button>
        </div>

        <table className="table">
          <tbody>
            <tr><td className="table__label">User</td><td>{entry.userName || '—'} {entry.userRole && <span className={`badge badge--${entry.userRole}`}>{entry.userRole}</span>}</td></tr>
            <tr><td className="table__label">Method</td><td>{entry.method}</td></tr>
            <tr><td className="table__label">Path</td><td><code>{entry.path}</code></td></tr>
            <tr><td className="table__label">Resource</td><td>{entry.resource || '—'}{entry.entityId ? ` #${entry.entityId}` : ''}</td></tr>
            <tr><td className="table__label">Status</td><td>{entry.status}</td></tr>
            <tr><td className="table__label">IP</td><td>{entry.ip || '—'}</td></tr>
            <tr><td className="table__label">Device</td><td style={{ fontSize: 12 }}>{entry.userAgent || '—'}</td></tr>
          </tbody>
        </table>

        {entry.meta && (
          <>
            <h4 className="modal__section-title">Request payload</h4>
            <pre className="audit-meta">
              {JSON.stringify(entry.meta, null, 2)}
            </pre>
          </>
        )}

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}