import { useEffect, useState } from 'react';
import {
  FiDatabase, FiDownload, FiAlertCircle, FiCheck,
  FiFileText, FiSearch, FiHardDrive,
} from 'react-icons/fi';
import { api, BASE_URL } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function AdminBackup() {
  const toast = useToast();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [dumping, setDumping] = useState(false);
  const [lastDump, setLastDump] = useState(null);
  const [includeSensitive, setIncludeSensitive] = useState(false);

  useEffect(() => {
    api('/backup/tables')
      .then(setTables)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

  const downloadFull = async () => {
    setDumping(true);
    try {
      const url = `${BASE_URL}/backup/full${includeSensitive ? '?includeSensitive=true' : ''}`;
      const res = await fetch(url, {
        headers: { 'X-User-Id': String(JSON.parse(sessionStorage.getItem('user') || '{}').id || '') },
      });
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bright-future-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setLastDump(new Date());
      toast.success('Backup downloaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDumping(false);
    }
  };

  const downloadTable = (name) => {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    const url = `${BASE_URL}/backup/table/${name}`;
    fetch(url, { headers: { 'X-User-Id': String(user.id || '') } })
      .then((r) => {
        if (!r.ok) throw new Error('Download failed');
        return r.blob();
      })
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(`Downloaded ${name}.csv`);
      })
      .catch((e) => toast.error(e.message));
  };

  const filtered = tables.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalRows = tables.reduce((s, t) => s + t.approxRows, 0);

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Backup & Export"
        subtitle="Download a full database snapshot or export individual tables"
      />

      {errorMsg && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Tables" value={tables.length} color="#2563eb" />
        <StatCard label="Approx. rows" value={totalRows.toLocaleString()} color="#7c3aed" />
        <StatCard
          label="Last download"
          value={lastDump ? lastDump.toLocaleTimeString() : '—'}
          hint={lastDump ? lastDump.toLocaleDateString() : 'Never'}
          color="#16a34a"
        />
      </div>

      {/* ---------- Full backup ---------- */}
      <div className="card backup-hero">
        <div className="backup-hero__icon">
          <FiHardDrive size={22} />
        </div>
        <div className="backup-hero__body">
          <h3>Full database snapshot</h3>
          <p className="muted">
            Downloads every table as a single JSON file. Use this to clone your
            demo database or archive a snapshot before major changes.
          </p>
          <label className="backup-hero__option">
            <input
              type="checkbox"
              checked={includeSensitive}
              onChange={(e) => setIncludeSensitive(e.target.checked)}
            />
            <span>
              Include password reset tokens (use only for a full restore)
            </span>
          </label>
        </div>
        <div className="backup-hero__action">
          <button
            className="btn btn--primary"
            onClick={downloadFull}
            disabled={dumping}
          >
            <FiDownload size={16} /> {dumping ? 'Preparing…' : 'Download backup'}
          </button>
        </div>
      </div>

      {/* ---------- Per-table ---------- */}
      <div className="card">
        <div className="table-head">
          <h3><FiDatabase size={16} /> Individual tables ({tables.length})</h3>
          <div className="filters-bar__search" style={{ maxWidth: 260 }}>
            <FiSearch size={16} />
            <input
              placeholder="Filter tables…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table className="table table--striped">
          <thead>
            <tr>
              <th>Table name</th>
              <th className="right">Rows (approx.)</th>
              <th>Notes</th>
              <th style={{ textAlign: 'right' }}>Export</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.name}>
                <td>
                  <code>{t.name}</code>
                </td>
                <td className="right">{t.approxRows.toLocaleString()}</td>
                <td>
                  {t.sensitive
                    ? <span className="pill pill--unpaid">Sensitive</span>
                    : <span className="muted">—</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => downloadTable(t.name)}
                    disabled={t.sensitive}
                  >
                    <FiFileText size={12} /> CSV
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan="4" className="muted" style={{ textAlign: 'center' }}>
                  No tables match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}