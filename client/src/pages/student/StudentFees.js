import { useEffect, useMemo, useState } from 'react';
import {
  FiCreditCard, FiDownload, FiPrinter, FiCheck, FiX, FiInfo,
  FiDollarSign, FiAlertCircle, FiClock, FiRefreshCw, FiFileText
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */
const formatNaira = (n) =>
  '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0 });

const statusClass = (status) =>
  ({
    Paid: 'pill--paid',
    Partial: 'pill--partial',
    Unpaid: 'pill--unpaid',
  }[status] || '');

const methodLabel = (m) => {
  if (!m || m === '-') return '—';
  return m;
};

/* ---------------------------------------------------------------
   Main component
--------------------------------------------------------------- */
export default function StudentFees() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [payModal, setPayModal] = useState(null); // { fee } when open
  const [receiptModal, setReceiptModal] = useState(null); // { data } when open

  /* ---------- fetch ---------- */
  const load = async () => {
    try {
      setErrorMsg('');
      const data = await api('/students/me/fees');
      setFees(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ---------- summary ---------- */
  const summary = useMemo(() => {
    const totalBilled = fees.reduce((s, f) => s + Number(f.total), 0);
    const totalPaid = fees.reduce((s, f) => s + Number(f.amountPaid), 0);
    const outstanding = fees.reduce((s, f) => s + Number(f.balance), 0);
    const status =
      outstanding === 0
        ? 'Cleared'
        : totalPaid > 0
        ? 'Partial'
        : 'Pending';
    return { totalBilled, totalPaid, outstanding, status };
  }, [fees]);

  /* ---------- pay ---------- */
  const handlePayment = async ({ feeId, amount, method }) => {
    const res = await api(`/students/me/fees/${feeId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ amount, method }),
    });
    setMessage('Payment successful — receipt is available below');
    setPayModal(null);
    await load();
    return res.fee;
  };

  /* ---------- receipt ---------- */
  const openReceipt = async (feeId) => {
    setReceiptModal({ loading: true });
    try {
      const data = await api(`/students/me/fees/${feeId}/receipt`);
      setReceiptModal({ data });
    } catch (err) {
      setReceiptModal(null);
      setErrorMsg(err.message);
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Fees & Receipts"
        subtitle="View your fee breakdown, make payments and download receipts"
      >
        <button className="btn btn--ghost" onClick={load}>
          <FiRefreshCw size={16} /> Refresh
        </button>
      </PageHeader>

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

      {/* ============================================================
          SUMMARY
      ============================================================ */}
      <div className="stats-grid">
        <StatCard
          label="Total Billed"
          value={formatNaira(summary.totalBilled)}
          hint={`${fees.length} record${fees.length === 1 ? '' : 's'}`}
          color="#2563eb"
        />
        <StatCard
          label="Total Paid"
          value={formatNaira(summary.totalPaid)}
          hint={summary.status === 'Cleared' ? 'You are fully paid' : 'Keep going'}
          color="#16a34a"
        />
        <StatCard
          label="Outstanding"
          value={formatNaira(summary.outstanding)}
          hint={summary.outstanding > 0 ? 'Payment due' : 'All cleared'}
          color={summary.outstanding > 0 ? '#dc2626' : '#16a34a'}
        />
        <StatCard
          label="Status"
          value={summary.status}
          hint="Across all terms"
          color={
            summary.status === 'Cleared'
              ? '#16a34a'
              : summary.status === 'Partial'
              ? '#f59e0b'
              : '#dc2626'
          }
        />
      </div>

      {/* ============================================================
          EMPTY STATE
      ============================================================ */}
      {fees.length === 0 && (
        <div className="card empty-state">
          <FiDollarSign size={32} />
          <p>No fee records yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Once the school office publishes your fees, they'll appear here.
          </p>
        </div>
      )}

      {/* ============================================================
          FEE RECORDS
      ============================================================ */}
      {fees.map((fee) => (
        <div className="card fee-card" key={fee.id}>
          <div className="fee-card__head">
            <div>
              <h3>
                {fee.session} — {fee.term}
              </h3>
              <small>
                Ref: {fee.reference} · Last update {fee.date || '—'}
              </small>
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
              <tr className="table__total">
                <td>Total</td>
                <td className="right">{formatNaira(fee.total)}</td>
              </tr>
              <tr>
                <td>Amount Paid</td>
                <td className="right">{formatNaira(fee.amountPaid)}</td>
              </tr>
              <tr className="table__total">
                <td>Balance</td>
                <td className="right">{formatNaira(fee.balance)}</td>
              </tr>
            </tbody>
          </table>

          {/* Progress bar */}
          <div className="fee-progress">
            <div className="fee-progress__track">
              <div
                className="fee-progress__fill"
                style={{
                  width: `${Math.min(
                    (fee.amountPaid / fee.total) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
            <div className="fee-progress__label">
              {Math.round((fee.amountPaid / fee.total) * 100)}% paid
            </div>
          </div>

          <div className="fee-card__actions">
            {fee.balance > 0 && (
              <button
                className="btn btn--primary"
                onClick={() => setPayModal({ fee })}
              >
                <FiCreditCard size={16} /> Pay Now
              </button>
            )}
            <button
              className="btn btn--ghost"
              onClick={() => openReceipt(fee.id)}
            >
              <FiFileText size={16} /> View Receipt
            </button>
          </div>
        </div>
      ))}

      {/* ============================================================
          PAYMENT HISTORY (flatten all records into a timeline)
      ============================================================ */}
      {fees.some((f) => f.amountPaid > 0) && (
        <div className="card">
          <h3>
            <FiClock size={16} /> Payment History
          </h3>
          <table className="table table--striped">
            <thead>
              <tr>
                <th>Date</th>
                <th>Session / Term</th>
                <th>Reference</th>
                <th>Method</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {fees
                .filter((f) => f.amountPaid > 0)
                .map((f) => (
                  <tr key={f.id}>
                    <td>{f.date || '—'}</td>
                    <td>
                      {f.session} — {f.term}
                    </td>
                    <td>
                      <code>{f.reference}</code>
                    </td>
                    <td>{methodLabel(f.method)}</td>
                    <td className="right">
                      <strong>{formatNaira(f.amountPaid)}</strong>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================
          PAY MODAL
      ============================================================ */}
      {payModal && (
        <PayModal
          fee={payModal.fee}
          onClose={() => setPayModal(null)}
          onSubmit={handlePayment}
        />
      )}

      {/* ============================================================
          RECEIPT MODAL
      ============================================================ */}
      {receiptModal && (
        <ReceiptModal
          loading={receiptModal.loading}
          data={receiptModal.data}
          onClose={() => setReceiptModal(null)}
        />
      )}
    </div>
  );
}

/* ==================================================================
   PAY MODAL
   ================================================================== */
function PayModal({ fee, onClose, onSubmit }) {
  const [amount, setAmount] = useState(fee.balance);
  const [method, setMethod] = useState('Card');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const quickAmounts = useMemo(() => {
    const half = Math.floor(fee.balance / 2);
    return [fee.balance, half].filter(
      (v, i, arr) => v > 0 && arr.indexOf(v) === i
    );
  }, [fee.balance]);

  const handle = async (e) => {
    e.preventDefault();
    setError('');

    const value = Number(amount);
    if (!value || value <= 0) return setError('Enter a valid amount');
    if (value > fee.balance) {
      return setError(`Amount cannot exceed balance (${formatNaira(fee.balance)})`);
    }

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
            <h3>
              <FiCreditCard size={18} /> Make Payment
            </h3>
            <p className="muted">
              {fee.session} · {fee.term}
            </p>
          </div>
          <button
            className="btn btn--ghost"
            onClick={onClose}
            disabled={processing}
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="pay-summary">
          <div>
            <span className="pay-summary__label">Outstanding Balance</span>
            <strong className="pay-summary__value">
              {formatNaira(fee.balance)}
            </strong>
          </div>
        </div>

        {error && (
          <div className="alert alert--error">
            <FiAlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handle}>
          <label>
            Amount to Pay
            <input
              type="number"
              min="1"
              max={fee.balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={processing}
              autoFocus
            />
          </label>

          {quickAmounts.length > 0 && (
            <div className="pay-quick">
              <span className="muted" style={{ fontSize: 12 }}>
                Quick select:
              </span>
              {quickAmounts.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="chip"
                  onClick={() => setAmount(v)}
                  disabled={processing}
                >
                  {v === fee.balance ? 'Full balance' : formatNaira(v)}
                </button>
              ))}
            </div>
          )}

          <label>
            Payment Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={processing}
            >
              <option>Card</option>
              <option>Bank Transfer</option>
              <option>USSD</option>
              <option>Cash</option>
            </select>
          </label>

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={processing}
            >
              Cancel
            </button>
            <button className="btn btn--primary" disabled={processing}>
              {processing ? (
                'Processing…'
              ) : (
                <>
                  <FiCheck size={16} /> Pay {formatNaira(amount || 0)}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================================================================
   RECEIPT MODAL
   ================================================================== */
function ReceiptModal({ loading, data, onClose }) {
  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
          <div className="loader" style={{ padding: 60 }}>Loading receipt…</div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const printReceipt = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(buildReceiptHTML(data));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const downloadReceipt = () => {
    const txt = buildReceiptText(data);
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.receiptNo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3>
              <FiFileText size={18} /> Receipt {data.receiptNo}
            </h3>
            <p className="muted">
              {data.session} · {data.term}
            </p>
          </div>
          <button className="btn btn--ghost" onClick={onClose}>
            <FiX size={16} />
          </button>
        </div>

        <div className="receipt-preview">
          <div className="receipt-preview__school">
            <h2>{data.school.name}</h2>
            <p>{data.school.address}</p>
            <p>
              {data.school.phone} · {data.school.email}
            </p>
            <em>{data.school.motto}</em>
          </div>

          <div className="receipt-preview__meta">
            <div>
              <span>Receipt No:</span> <strong>{data.receiptNo}</strong>
            </div>
            <div>
              <span>Date Paid:</span> <strong>{data.paidOn || '—'}</strong>
            </div>
          </div>

          <div className="receipt-preview__student">
            <div>
              <span>Student:</span> {data.student.name}
            </div>
            <div>
              <span>Admission No:</span> {data.student.admissionNo}
            </div>
            <div>
              <span>Class:</span> {data.student.className}
            </div>
            <div>
              <span>Guardian:</span> {data.student.guardianName || '—'}
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.name}</td>
                  <td className="right">{formatNaira(item.amount)}</td>
                </tr>
              ))}
              <tr className="table__total">
                <td>Total</td>
                <td className="right">{formatNaira(data.total)}</td>
              </tr>
              <tr>
                <td>Amount Paid</td>
                <td className="right">{formatNaira(data.amountPaid)}</td>
              </tr>
              <tr className="table__total">
                <td>Balance</td>
                <td className="right">{formatNaira(data.balance)}</td>
              </tr>
            </tbody>
          </table>

          <div className="receipt-preview__footer">
            <div>
              <span>Method:</span> {data.method || '—'}
            </div>
            <div>
              <span>Status:</span> <strong>{data.status}</strong>
            </div>
            <div className="receipt-preview__stamp">
              <span className="stamp">
                {data.status === 'PAID IN FULL' ? 'PAID' : 'PART PAYMENT'}
              </span>
            </div>
          </div>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={downloadReceipt}>
            <FiDownload size={16} /> Download .txt
          </button>
          <button className="btn btn--primary" onClick={printReceipt}>
            <FiPrinter size={16} /> Print / Save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================
   RECEIPT BUILDERS
   ================================================================== */

function buildReceiptText(r) {
  const lines = [
    '===============================================',
    `        ${r.school.name.toUpperCase()}`,
    `        ${r.school.address}`,
    `        ${r.school.phone} · ${r.school.email}`,
    `        ${r.school.motto}`,
    '===============================================',
    '',
    `Receipt No:  ${r.receiptNo}`,
    `Invoice No:  ${r.invoiceNo}`,
    `Date Paid:   ${r.paidOn || '—'}`,
    '',
    '-----------------------------------------------',
    'STUDENT',
    '-----------------------------------------------',
    `Name:            ${r.student.name}`,
    `Admission No:    ${r.student.admissionNo}`,
    `Class:           ${r.student.className}`,
    `Guardian:        ${r.student.guardianName || '—'}`,
    `Guardian Phone:  ${r.student.guardianPhone || '—'}`,
    '',
    `Session:  ${r.session}  (${r.term})`,
    '',
    '-----------------------------------------------',
    'BREAKDOWN',
    '-----------------------------------------------',
  ];

  r.items.forEach((i) => {
    lines.push(`  ${i.name.padEnd(28)}  ₦${Number(i.amount).toLocaleString()}`);
  });

  lines.push('');
  lines.push('-----------------------------------------------');
  lines.push(`  ${'Total'.padEnd(28)}  ₦${Number(r.total).toLocaleString()}`);
  lines.push(`  ${'Amount Paid'.padEnd(28)}  ₦${Number(r.amountPaid).toLocaleString()}`);
  lines.push(`  ${'Balance'.padEnd(28)}  ₦${Number(r.balance).toLocaleString()}`);
  lines.push('-----------------------------------------------');
  lines.push(`  Payment Method:  ${r.method || '—'}`);
  lines.push(`  Status:          ${r.status}`);
  lines.push('===============================================');
  lines.push('');
  lines.push('  This is a computer-generated receipt.');
  lines.push('  Thank you.');

  return lines.join('\n');
}

function buildReceiptHTML(r) {
  const items = r.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td class="right">₦${Number(
          i.amount
        ).toLocaleString()}</td></tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${r.receiptNo}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #0b1220; }
  h1, h2, h3 { margin: 0 0 6px; }
  .head { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #0b1220; margin-bottom: 24px; }
  .head h1 { font-size: 22px; letter-spacing: 1px; }
  .head p { margin: 2px 0; font-size: 13px; color: #475569; }
  .head em { font-size: 12px; color: #64748b; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; font-size: 13px; }
  .grid div { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1; }
  .grid span { color: #64748b; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
  th, td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
  .right { text-align: right; }
  .total { font-weight: 700; background: #f1f5f9; }
  .footer { display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 2px solid #0b1220; font-size: 13px; }
  .stamp { display: inline-block; padding: 8px 20px; border: 3px solid #16a34a; color: #16a34a; font-weight: 800; letter-spacing: 2px; transform: rotate(-4deg); font-size: 14px; border-radius: 6px; }
  .stamp--part { border-color: #f59e0b; color: #b45309; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <div class="head">
    <h1>${r.school.name.toUpperCase()}</h1>
    <p>${r.school.address}</p>
    <p>${r.school.phone} · ${r.school.email}</p>
    <em>${r.school.motto}</em>
  </div>

  <div class="grid">
    <div><span>Receipt No:</span><strong>${r.receiptNo}</strong></div>
    <div><span>Invoice No:</span><strong>${r.invoiceNo}</strong></div>
    <div><span>Date Paid:</span><strong>${r.paidOn || '—'}</strong></div>
    <div><span>Session:</span><strong>${r.session}</strong></div>
    <div><span>Term:</span><strong>${r.term}</strong></div>
    <div><span>Method:</span><strong>${r.method || '—'}</strong></div>
    <div><span>Student:</span><strong>${r.student.name}</strong></div>
    <div><span>Admission No:</span><strong>${r.student.admissionNo}</strong></div>
    <div><span>Class:</span><strong>${r.student.className}</strong></div>
    <div><span>Guardian:</span><strong>${r.student.guardianName || '—'}</strong></div>
  </div>

  <table>
    <thead>
      <tr><th>Description</th><th class="right">Amount</th></tr>
    </thead>
    <tbody>
      ${items}
      <tr class="total"><td>Total</td><td class="right">₦${Number(r.total).toLocaleString()}</td></tr>
      <tr><td>Amount Paid</td><td class="right">₦${Number(r.amountPaid).toLocaleString()}</td></tr>
      <tr class="total"><td>Balance</td><td class="right">₦${Number(r.balance).toLocaleString()}</td></tr>
    </tbody>
  </table>

  <div class="footer">
    <div>
      <p>Issued: ${new Date().toLocaleDateString()}</p>
      <p style="font-size: 11px; color: #64748b;">This is a computer-generated receipt.</p>
    </div>
    <div class="stamp ${r.status !== 'PAID IN FULL' ? 'stamp--part' : ''}">${r.status}</div>
  </div>
</body>
</html>`;
}