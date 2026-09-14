import { useEffect, useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

export default function StudentFees() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [payId, setPayId] = useState(null);
  const [amount, setAmount] = useState('');

  const loadFees = () => api('/students/me/fees').then(setFees);

  useEffect(() => {
    loadFees().finally(() => setLoading(false));
  }, []);

  const handlePay = async (e) => {
    e.preventDefault();
    try {
      await api(`/students/me/fees/${payId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount, method: 'Card' })
      });
      setMessage('Payment successful');
      setPayId(null);
      setAmount('');
      await loadFees();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const downloadReceipt = async (feeId) => {
    const r = await api(`/students/me/fees/${feeId}/receipt`);

    const lines = [
      '========================================',
      `   ${r.school.toUpperCase()}`,
      `   ${r.address}`,
      '========================================',
      `Receipt No : ${r.receiptNo}`,
      `Date       : ${r.date}`,
      '----------------------------------------',
      `Student    : ${r.studentName}`,
      `Adm. No    : ${r.admissionNo}`,
      `Class      : ${r.className}`,
      `Session    : ${r.session}  (${r.term})`,
      '----------------------------------------',
      'ITEMS',
      ...r.items.map((i) => `  ${i.name.padEnd(24)} ₦${i.amount.toLocaleString()}`),
      '----------------------------------------',
      `Total      : ₦${r.total.toLocaleString()}`,
      `Paid       : ₦${r.amountPaid.toLocaleString()}`,
      `Balance    : ₦${r.balance.toLocaleString()}`,
      `Method     : ${r.method}`,
      `Status     : ${r.status}`,
      '========================================',
      '   Thank you. Computer generated receipt.'
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${r.receiptNo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader title="Fees & Receipts" subtitle="View your fee breakdown, make payments and download receipts" />

      {message && <div className="alert alert--info">{message}</div>}

      {fees.map((fee) => (
        <div className="card fee-card" key={fee.id}>
          <div className="fee-card__head">
            <div>
              <h3>{fee.session} — {fee.term}</h3>
              <small>Ref: {fee.reference}</small>
            </div>
            <span className={`pill pill--${fee.status.toLowerCase()}`}>{fee.status}</span>
          </div>

          <table className="table">
            <tbody>
              {fee.items.map((i, idx) => (
                <tr key={idx}>
                  <td>{i.name}</td>
                  <td className="right">₦{i.amount.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="table__total">
                <td>Total</td>
                <td className="right">₦{fee.total.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Amount Paid</td>
                <td className="right">₦{fee.amountPaid.toLocaleString()}</td>
              </tr>
              <tr className="table__total">
                <td>Balance</td>
                <td className="right">₦{fee.balance.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="fee-card__actions">
            {fee.balance > 0 && (
              <button className="btn btn--primary" onClick={() => setPayId(fee.id)}>
                Pay Now
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => downloadReceipt(fee.id)}>
              <FiDownload size={16} /> Download Receipt
            </button>
          </div>
        </div>
      ))}

      {payId && (
        <div className="modal-backdrop" onClick={() => setPayId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Make Payment</h3>
            <form onSubmit={handlePay}>
              <label>
                Amount (₦)
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  required
                />
              </label>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setPayId(null)}>Cancel</button>
                <button className="btn btn--primary">Pay</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}