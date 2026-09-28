import { useEffect, useMemo, useState } from 'react';
import {
  FiDollarSign, FiSearch, FiDownload, FiAlertCircle, FiRefreshCw,
  FiCheckCircle, FiClock, FiFileText, FiPrinter,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useParentContext } from '../../hooks/useParentContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';
import ChildSelector from '../../components/ChildSelector';

const formatNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
const statusClass = (s) =>
  ({ Paid: 'pill--paid', Partial: 'pill--partial', Unpaid: 'pill--unpaid' }[s] || '');

export default function ParentPayments() {
  const {
    children, activeChild, activeChildId, setActiveChildId, loading,
  } = useParentContext();

  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async (childId) => {
    if (!childId) return;
    setLoadingData(true);
    setErrorMsg('');
    try {
      const res = await api(`/parents/me/children/${childId}/payments`);
      setData(res);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (activeChildId) load(activeChildId);
    // eslint-disable-next-line
  }, [activeChildId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.payments.filter((p) => {
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesSearch =
        !q ||
        p.reference.toLowerCase().includes(q) ||
        p.session.toLowerCase().includes(q) ||
        p.term.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [data, search, statusFilter]);

  const downloadCSV = () => {
    if (!data) return;
    const rows = [['#', 'Date', 'Session', 'Term', 'Reference', 'Method', 'Amount Paid', 'Balance', 'Status']];
    data.payments.forEach((p, i) => {
      rows.push([i + 1, p.date || '', p.session, p.term, p.reference, p.method,
        p.amountPaid, p.balance, p.status]);
    });
    const csv = rows.map((r) => r.map((c) => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${activeChild.admissionNo}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loader />;
  if (!activeChild) {
    return (
      <div>
        <PageHeader title="Payment History" />
        <div className="card empty-state"><p>No child linked.</p></div>
      </div>
    );
  }

  const s = data?.summary || { totalBilled: 0, totalPaid: 0, outstanding: 0, paymentCount: 0 };

  return (
    <div>
      <PageHeader
        title="Payment History"
        subtitle={`Every fee and payment for ${activeChild.name}`}
      >
        <ChildSelector
          children={children}
          value={activeChildId}
          onChange={setActiveChildId}
        />
        <button className="btn btn--ghost" onClick={downloadCSV} disabled={!data?.payments?.length}>
          <FiDownload size={16} /> Export CSV
        </button>
        <button className="btn btn--ghost" onClick={() => load(activeChildId)}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      )}

      {loadingData && !data && <Loader />}

      {data && (
        <>
          <div className="stats-grid">
            <StatCard label="Total Billed" value={formatNaira(s.totalBilled)} color="#2563eb" />
            <StatCard label="Total Paid" value={formatNaira(s.totalPaid)} color="#16a34a" />
            <StatCard
              label="Outstanding"
              value={formatNaira(s.outstanding)}
              color={s.outstanding > 0 ? '#dc2626' : '#16a34a'}
            />
            <StatCard label="Payments Made" value={s.paymentCount} color="#7c3aed" />
          </div>

          <div className="card">
            <div className="table-head">
              <h3><FiFileText size={16} /> All Fee Records ({data.payments.length})</h3>
            </div>

            <div className="filters-bar">
              <div className="filters-bar__search">
                <FiSearch size={16} />
                <input
                  type="text"
                  placeholder="Search by reference, session or term…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="filters-bar__select">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  <option value="Unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state">
                <FiDollarSign size={32} />
                <p>No payments to show.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table--striped">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Session</th>
                      <th>Term</th>
                      <th>Reference</th>
                      <th>Method</th>
                      <th className="right">Paid</th>
                      <th className="right">Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr key={p.id}>
                        <td>{i + 1}</td>
                        <td>{p.date || '—'}</td>
                        <td>{p.session}</td>
                        <td>{p.term}</td>
                        <td><code>{p.reference}</code></td>
                        <td>{p.method}</td>
                        <td className="right"><strong>{formatNaira(p.amountPaid)}</strong></td>
                        <td className="right">{formatNaira(p.balance)}</td>
                        <td><span className={`pill ${statusClass(p.status)}`}>{p.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}