import { useEffect, useState } from 'react';
import {
  FiFileText, FiDownload, FiPrinter, FiX, FiAlertCircle,
} from 'react-icons/fi';
import { api } from '../api/api';

const formatNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');

export default function ReceiptModal({ receiptUrl, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api(receiptUrl)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [receiptUrl]);

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
          <div className="loader" style={{ padding: 60 }}>Loading receipt…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3><FiAlertCircle size={18} /> Error</h3>
            <button className="btn btn--ghost" onClick={onClose}>
              <FiX size={16} />
            </button>
          </div>
          <div className="alert alert--error">{error || 'Could not load receipt'}</div>
        </div>
      </div>
    );
  }

  const printReceipt = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    w.document.write(buildReceiptHTML(data));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const downloadTxt = () => {
    const text = buildReceiptText(data);
    const blob = new Blob([text], { type: 'text/plain' });
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
            <h3><FiFileText size={18} /> Receipt {data.receiptNo}</h3>
            <p className="muted">{data.session} · {data.term}</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose}>
            <FiX size={16} />
          </button>
        </div>

        <div className="receipt-preview">
          <div className="receipt-preview__school">
            <h2>{data.school.name}</h2>
            <p>{data.school.address}</p>
            <p>{data.school.phone} · {data.school.email}</p>
            <em>{data.school.motto}</em>
          </div>

          <div className="receipt-preview__meta">
            <div><span>Receipt No:</span> <strong>{data.receiptNo}</strong></div>
            <div><span>Date Paid:</span> <strong>{data.paidOn || '—'}</strong></div>
          </div>

          <div className="receipt-preview__student">
            <div><span>Student:</span> {data.student.name}</div>
            <div><span>Admission No:</span> {data.student.admissionNo}</div>
            <div><span>Class:</span> {data.student.className}</div>
            <div><span>Guardian:</span> {data.student.guardianName || '—'}</div>
          </div>

          <table className="table">
            <thead>
              <tr><th>Description</th><th className="right">Amount</th></tr>
            </thead>
            <tbody>
              {data.items.map((i, idx) => (
                <tr key={idx}>
                  <td>{i.name}</td>
                  <td className="right">{formatNaira(i.amount)}</td>
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
            <div><span>Method:</span> {data.method || '—'}</div>
            <div className="receipt-preview__stamp">
              <span className="stamp">{data.status}</span>
            </div>
          </div>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={downloadTxt}>
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
    `Invoice No:  ${r.invoiceNo || ''}`,
    `Date Paid:   ${r.paidOn || '—'}`,
    '',
    `Student:     ${r.student.name}`,
    `Adm. No:     ${r.student.admissionNo}`,
    `Class:       ${r.student.className}`,
    `Guardian:    ${r.student.guardianName || '—'}`,
    '',
    `${r.session}  (${r.term})`,
    '-----------------------------------------------',
    ...r.items.map((i) => `  ${i.name.padEnd(28)}  ${formatNaira(i.amount)}`),
    '-----------------------------------------------',
    `  ${'Total'.padEnd(28)}  ${formatNaira(r.total)}`,
    `  ${'Paid'.padEnd(28)}  ${formatNaira(r.amountPaid)}`,
    `  ${'Balance'.padEnd(28)}  ${formatNaira(r.balance)}`,
    `  ${'Method'.padEnd(28)}  ${r.method || '—'}`,
    `  ${'Status'.padEnd(28)}  ${r.status}`,
    '===============================================',
    '',
    '  This is a computer-generated receipt.',
  ];
  return lines.join('\n');
}

function buildReceiptHTML(r) {
  const items = r.items
    .map((i) => `<tr><td>${i.name}</td><td class="right">${formatNaira(i.amount)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${r.receiptNo}</title>
<style>
body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #0b1220; }
.head { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #0b1220; margin-bottom: 24px; }
.head h1 { font-size: 22px; margin: 0 0 6px; }
.head p { margin: 2px 0; font-size: 13px; color: #475569; }
.head em { font-size: 12px; color: #64748b; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; font-size: 13px; }
.grid div { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #cbd5e1; }
.grid span { color: #64748b; }
table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
th, td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
th { font-size: 11px; text-transform: uppercase; color: #64748b; text-align: left; }
.right { text-align: right; }
.total { font-weight: 700; background: #f1f5f9; }
.footer { display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 2px solid #0b1220; font-size: 13px; }
.stamp { display: inline-block; padding: 8px 20px; border: 3px solid #16a34a; color: #16a34a; font-weight: 800; letter-spacing: 2px; transform: rotate(-4deg); border-radius: 6px; }
</style></head><body>
<div class="head"><h1>${r.school.name.toUpperCase()}</h1><p>${r.school.address}</p><p>${r.school.phone}</p><em>${r.school.motto}</em></div>
<div class="grid">
<div><span>Receipt No:</span><strong>${r.receiptNo}</strong></div>
<div><span>Date Paid:</span><strong>${r.paidOn || '—'}</strong></div>
<div><span>Student:</span><strong>${r.student.name}</strong></div>
<div><span>Admission:</span><strong>${r.student.admissionNo}</strong></div>
<div><span>Class:</span><strong>${r.student.className}</strong></div>
<div><span>Method:</span><strong>${r.method || '—'}</strong></div>
</div>
<table><thead><tr><th>Description</th><th class="right">Amount</th></tr></thead><tbody>
${items}
<tr class="total"><td>Total</td><td class="right">${formatNaira(r.total)}</td></tr>
<tr><td>Amount Paid</td><td class="right">${formatNaira(r.amountPaid)}</td></tr>
<tr class="total"><td>Balance</td><td class="right">${formatNaira(r.balance)}</td></tr>
</tbody></table>
<div class="footer"><div><p>Issued: ${new Date().toLocaleDateString()}</p><p style="font-size: 11px; color: #64748b;">Computer-generated receipt</p></div><div class="stamp">${r.status}</div></div>
</body></html>`;
}