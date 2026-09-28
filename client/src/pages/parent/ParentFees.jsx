import { useEffect, useMemo, useState } from 'react';
import {
  FiCreditCard, FiDownload, FiPrinter, FiCheck, FiX, FiFileText,
  FiAlertCircle, FiRefreshCw, FiDollarSign, FiClock,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { api } from '../../api/api';
import { useParentContext } from '../../hooks/useParentContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';
import ChildSelector from '../../components/ChildSelector';
import ReceiptModal from '../../components/ReceiptModal';

const formatNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
const statusClass = (s) =>
  ({ Paid: 'pill--paid', Partial: 'pill--partial', Unpaid: 'pill--unpaid' }[s] || '');

export default function ParentFees() {
  const {
    children, activeChild, activeChildId, setActiveChildId, loading,
  } = useParentContext();

  const [fees, setFees] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [payModal, setPayModal] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(null);

  const load = async (childId) => {
    if (!childId) return;
    setLoadingData(true);
    try {
      const data = await api(`/parents/me/children/${childId}/fees`);
      setFees(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (activeChildId) load(activeChildId);
    // eslint-disable-next-line
  }, [activeChildId]);

  const summary = useMemo(() => {
    const total = fees.reduce((s, f) => s + Number(f.total), 0);
    const paid = fees.reduce((s, f) => s + Number(f.amountPaid), 0);
    return { total, paid, outstanding: total - paid };
  }, [fees]);

  const handlePayment = async ({ feeId, amount, method }) => {
    const res = await api(`/parents/me/children/${activeChildId}/fees/${feeId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ amount, method }),
    });
    setMessage('Payment successful — receipt available below');
    setPayModal(null);
    await load(activeChildId);
    return res.fee;
  };

  const openReceipt = (feeId) => {
    setReceiptUrl(`/parents/me/children/${activeChildId}/fees/${feeId}/receipt`);
  };

  if (loading) return <Loader />;
  if (!activeChild) {
    return (
      <div>
        <PageHeader title="Fees & Receipts" />
        <div className="card empty-state"><p>No child linked to your account.</p></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Fees & Receipts"
        subtitle={`Fee records for ${activeChild.name}`}
      >
        <ChildSelector
          children={children}
          value={activeChildId}
          onChange={setActiveChildId}
        />
        <button className="btn btn--ghost" onClick={() => load(activeChildId)}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

      {message && <div className="alert alert--info"><FiCheck size={16} /> {message}</div>}
      {errorMsg && <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>}

      <div className="stats-grid">
        <StatCard label="Total Billed" value={formatNaira(summary.total)} color="#2563eb" />
        <StatCard label="Total Paid" value={formatNaira(summary.paid)} color="#16a34a" />
        <StatCard
          label="Outstanding"
          value={formatNaira(summary.outstanding)}
          color={summary.outstanding > 0 ? '#dc2626' : '#16a34a'}
        />
      </div>

      {summary.outstanding > 0 && (
        <div className="card fee-action-banner">
          <div>
            <strong>You have an outstanding balance</strong>
            <p className="muted">Pay now to keep your child's account current.</p>
          </div>
          <Link to="/parent/payments" className="btn btn--ghost">
            <FiClock size={16} /> Full History
          </Link>
        </div>
      )}

      {loadingData && !fees.length && <Loader />}

      {!loadingData && fees.length === 0 && (
        <div className="card empty-state">
          <FiDollarSign size={32} />
          <p>No fee records yet.</p>
        </div>
      )}

      {fees.map((fee) => {
        const pct = fee.total ? Math.min((fee.amountPaid / fee.total) * 100, 100) : 0;
        return (
          <div className="card fee-card" key={fee.id}>
            <div className="fee-card__head">
              <div>
                <h3>{fee.session} — {fee.term}</h3>
                <small>Ref: {fee.reference} · Last update {fee.date || '—'}</small>
              </div>
              <span className={`pill ${statusClass(fee.status)}`}>{fee.status}</span>
            </div>

            <table className="table">
              <tbody>
                {fee.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td className="right">{formatNaira(item.amount)}</td>
                  </tr>
                ))}
                <tr className="table__total"><td>Total</td><td className="right">{formatNaira(fee.total)}</td></tr>
                <tr><td>Amount Paid</td><td className="right">{formatNaira(fee.amountPaid)}</td></tr>
                <tr className="table__total"><td>Balance</td><td className="right">{formatNaira(fee.balance)}</td></tr>
              </tbody>
            </table>

            <div className="fee-progress">
              <div className="fee-progress__track">
                <div className="fee-progress__fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="fee-progress__label">{Math.round(pct)}% paid</div>
            </div>

            <div className="fee-card__actions">
              {fee.balance > 0 && (
                <button className="btn btn--primary" onClick={() => setPayModal({ fee })}>
                  <FiCreditCard size={16} /> Pay Now
                </button>
              )}
              <button className="btn btn--ghost" onClick={() => openReceipt(fee.id)}>
                <FiFileText size={16} /> View Receipt
              </button>
            </div>
          </div>
        );
      })}

      {payModal && (
        <PayModal
          fee={payModal.fee}
          onClose={() => setPayModal(null)}
          onSubmit={handlePayment}
        />
      )}

      {receiptUrl && (
        <ReceiptModal
          receiptUrl={receiptUrl}
          onClose={() => setReceiptUrl(null)}
        />
      )}
    </div>
  );
}

/* Pay modal */
function PayModal({ fee, onClose, onSubmit }) {
  const [amount, setAmount] = useState(fee.balance);
  const [method, setMethod] = useState('Card');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    const value = Number(amount);
    if (!value || value <= 0) return setError('Enter a valid amount');
    if (value > fee.balance) return setError('Amount cannot exceed balance');
    setProcessing(true);
    try {
      await onSubmit({ feeId: fee.id, amount: value, method });
    } catch (err) {
      setError(err.message);
      setProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !processing && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3><FiCreditCard size={18} /> Make Payment</h3>
            <p className="muted">{fee.session} · {fee.term}</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} disabled={processing}>
            <FiX size={16} />
          </button>
        </div>

        <div className="pay-summary">
          <span className="pay-summary__label">Outstanding Balance</span>
          <strong className="pay-summary__value">{formatNaira(fee.balance)}</strong>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <form onSubmit={handle}>
          <label>
            Amount to Pay
            <input
              type="number" min="1" max={fee.balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required disabled={processing} autoFocus
            />
          </label>
          <label>
            Payment Method
            <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={processing}>
              <option>Card</option>
              <option>Bank Transfer</option>
              <option>USSD</option>
              <option>Cash</option>
            </select>
          </label>
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={processing}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={processing}>
              {processing ? 'Processing…' : <>Pay {formatNaira(amount || 0)}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}