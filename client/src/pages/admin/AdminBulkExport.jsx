import { useEffect, useMemo, useState } from 'react';
import {
  FiDownload, FiFileText, FiCreditCard, FiAlertCircle,
  FiLoader, FiUsers,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { downloadBatchAsPdf } from '../../utils/pdfHelpers';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

const SESSIONS = ['2024/2025', '2025/2026', '2023/2024'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];

const formatNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/* ---------- HTML templates for bulk PDFs ---------- */

const RECEIPT_CSS = `
  .receipt { page-break-after: always; padding: 12mm 12mm 6mm; font-family: 'Segoe UI', system-ui, sans-serif; color: #0b1220; }
  .receipt:last-child { page-break-after: auto; }
  .receipt__head { text-align: center; padding-bottom: 14px; border-bottom: 2px solid #0b1220; margin-bottom: 20px; }
  .receipt__head h1 { font-size: 20px; letter-spacing: .5px; margin: 0 0 4px; }
  .receipt__head p { font-size: 11.5px; color: #475569; margin: 2px 0; }
  .receipt__head em { font-size: 11px; color: #64748b; }
  .receipt__meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 20px; font-size: 12px; }
  .receipt__meta > div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #cbd5e1; }
  .receipt__meta span { color: #64748b; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 16px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { font-size: 10.5px; text-transform: uppercase; color: #64748b; border-bottom: 1.5px solid #0b1220; }
  .right { text-align: right; }
  .total { font-weight: 700; background: #f1f5f9; }
  .receipt__footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 2px solid #0b1220; font-size: 12px; }
  .stamp { display: inline-block; padding: 6px 16px; border: 3px solid #16a34a; color: #16a34a; font-weight: 800; letter-spacing: 2px; transform: rotate(-4deg); border-radius: 6px; font-size: 12px; }
  .stamp--part { border-color: #f59e0b; color: #b45309; }
`;

function receiptHtml(r) {
  const items = r.items.map((i) =>
    `<tr><td>${escapeHtml(i.name)}</td><td class="right">${formatNaira(i.amount)}</td></tr>`
  ).join('');

  return `
    <section class="receipt pdf-page">
      <div class="receipt__head">
        <h1>${escapeHtml(r.school.name.toUpperCase())}</h1>
        <p>${escapeHtml(r.school.address)}</p>
        <p>${escapeHtml(r.school.phone)} · ${escapeHtml(r.school.email)}</p>
        <em>${escapeHtml(r.school.motto)}</em>
      </div>

      <div class="receipt__meta">
        <div><span>Receipt No:</span><strong>${escapeHtml(r.receiptNo)}</strong></div>
        <div><span>Date Paid:</span><strong>${escapeHtml(r.paidOn || '—')}</strong></div>
        <div><span>Student:</span><strong>${escapeHtml(r.student.name)}</strong></div>
        <div><span>Admission No:</span><strong>${escapeHtml(r.student.admissionNo)}</strong></div>
        <div><span>Class:</span><strong>${escapeHtml(r.student.className)}</strong></div>
        <div><span>Method:</span><strong>${escapeHtml(r.method)}</strong></div>
      </div>

      <table>
        <thead><tr><th>Description</th><th class="right">Amount</th></tr></thead>
        <tbody>
          ${items}
          <tr class="total"><td>Total</td><td class="right">${formatNaira(r.total)}</td></tr>
          <tr><td>Amount Paid</td><td class="right">${formatNaira(r.amountPaid)}</td></tr>
          <tr class="total"><td>Balance</td><td class="right">${formatNaira(r.balance)}</td></tr>
        </tbody>
      </table>

      <div class="receipt__footer">
        <div>
          <div>${escapeHtml(r.session)} · ${escapeHtml(r.term)}</div>
          <div style="font-size:10px;color:#64748b">Computer-generated receipt</div>
        </div>
        <div class="stamp ${r.status !== 'PAID IN FULL' ? 'stamp--part' : ''}">${escapeHtml(r.status)}</div>
      </div>
    </section>
  `;
}

const ID_CARD_CSS = `
  .id-sheet-page { page-break-after: always; padding: 10mm; }
  .id-sheet-page:last-child { page-break-after: auto; }
  .id-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .id-card { width: 340px; height: 215px; background: linear-gradient(135deg, #1e3a8a, #2563eb); border-radius: 14px; color: #fff; padding: 14px; display: flex; flex-direction: column; box-shadow: 0 8px 24px rgba(0,0,0,.25); font-size: 12px; position: relative; overflow: hidden; }
  .id-card__head { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,.25); margin-bottom: 10px; }
  .id-card__logo { width: 32px; height: 32px; border-radius: 8px; background: #fff; padding: 3px; }
  .id-card__logo img { width: 100%; height: 100%; object-fit: contain; }
  .id-card__school strong { display: block; font-size: 13px; line-height: 1.2; }
  .id-card__school span { font-size: 10px; opacity: .8; }
  .id-card__body { display: flex; gap: 14px; flex: 1; align-items: center; }
  .id-card__photo { width: 72px; height: 72px; border-radius: 10px; background: rgba(255,255,255,.2); display: grid; place-items: center; overflow: hidden; font-size: 30px; font-weight: 700; flex-shrink: 0; }
  .id-card__photo img { width: 100%; height: 100%; object-fit: cover; }
  .id-card__info { flex: 1; min-width: 0; }
  .id-card__info h3 { font-size: 14px; margin-bottom: 6px; }
  .id-card__row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; font-size: 11px; }
  .id-card__row span { opacity: .75; }
  .id-card__footer { padding-top: 6px; border-top: 1px solid rgba(255,255,255,.25); font-size: 10px; opacity: .9; display: flex; justify-content: space-between; }
`;

function idCardBlock(card, school, validThrough) {
  const photo = card.photo
    ? (card.photo.startsWith('http') ? card.photo : `${window.location.origin}${card.photo}`)
    : null;

  return `
    <div class="id-card">
      <div class="id-card__head">
        <div class="id-card__logo">
          <img src="${window.location.origin}/school-logo.png" alt="" />
        </div>
        <div class="id-card__school">
          <strong>${escapeHtml(school.name)}</strong>
          <span>${escapeHtml(school.address)}</span>
        </div>
      </div>
      <div class="id-card__body">
        <div class="id-card__photo">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="" />` : escapeHtml(card.name.charAt(0))}
        </div>
        <div class="id-card__info">
          <h3>${escapeHtml(card.name)}</h3>
          <div class="id-card__row"><span>Class</span><strong>${escapeHtml(card.className)}</strong></div>
          <div class="id-card__row"><span>Adm. No</span><strong>${escapeHtml(card.admissionNo)}</strong></div>
          <div class="id-card__row"><span>House</span><strong>${escapeHtml(card.house || '—')}</strong></div>
          <div class="id-card__row"><span>DOB</span><strong>${escapeHtml(card.dob || '—')}</strong></div>
        </div>
      </div>
      <div class="id-card__footer">
        <div>Guardian: ${escapeHtml(card.guardianName || '—')}</div>
        <div>Valid until ${escapeHtml(validThrough)}</div>
      </div>
    </div>
  `;
}

/* ---------- Page ---------- */

export default function AdminBulkExport() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [receiptForm, setReceiptForm] = useState({
    className: '',
    session: SESSIONS[0],
    term: TERMS[0],
  });
  const [idForm, setIdForm] = useState({ className: '' });

  const [working, setWorking] = useState(null); // 'receipts' | 'ids' | null

  useEffect(() => {
    api('/bulk/classes')
      .then((c) => {
        setClasses(c);
        if (c.length) {
          setReceiptForm((f) => ({ ...f, className: c[0].className }));
          setIdForm({ className: c[0].className });
        }
      })
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

  const generateReceipts = async () => {
    if (!receiptForm.className) return;
    setWorking('receipts');
    try {
      const qs = new URLSearchParams();
      if (receiptForm.session) qs.set('session', receiptForm.session);
      if (receiptForm.term) qs.set('term', receiptForm.term);
      const data = await api(
        `/bulk/fee-receipts/${encodeURIComponent(receiptForm.className)}?${qs}`
      );

      if (!data.receipts.length) {
        toast.error('No receipts found for this class/session/term');
        setWorking(null);
        return;
      }

      const pages = data.receipts.map(receiptHtml);
      const filename =
        `fee-receipts-${data.className}-${data.session}-${data.term}.pdf`
          .replace(/\s+/g, '-');

      await downloadBatchAsPdf(pages, filename, RECEIPT_CSS);
      toast.success(`Generated ${pages.length} receipt(s)`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'PDF generation failed');
    } finally {
      setWorking(null);
    }
  };

  const generateIdCards = async () => {
    if (!idForm.className) return;
    setWorking('ids');
    try {
      const data = await api(`/bulk/id-cards/${encodeURIComponent(idForm.className)}`);

      if (!data.students.length) {
        toast.error('No students in this class');
        setWorking(null);
        return;
      }

      // Pack 2 per page
      const pages = [];
      for (let i = 0; i < data.students.length; i += 2) {
        const pair = data.students.slice(i, i + 2);
        pages.push(`
          <div class="id-sheet-page pdf-page">
            <div class="id-grid">
              ${pair.map((s) => idCardBlock(s, data.school, data.validThrough)).join('')}
            </div>
          </div>
        `);
      }

      const filename =
        `id-cards-${data.className}-${new Date().toISOString().slice(0, 10)}.pdf`;

      await downloadBatchAsPdf(pages, filename, ID_CARD_CSS);
      toast.success(`Generated ID cards for ${data.students.length} student(s)`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'PDF generation failed');
    } finally {
      setWorking(null);
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Bulk PDF Export"
        subtitle="Download every student's document for a class as one multi-page PDF"
      />

      {errorMsg && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {!classes.length ? (
        <div className="card empty-state">
          <FiUsers size={32} />
          <p>No classes available yet.</p>
        </div>
      ) : (
        <div className="grid-2">
          {/* ---------- Fee receipts ---------- */}
          <div className="card bulk-pdf-card">
            <div className="bulk-pdf-card__icon">
              <FiFileText size={22} />
            </div>
            <h3>Bulk fee receipts</h3>
            <p className="muted">
              One receipt per student in the class. Perfect for end-of-term
              handouts.
            </p>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <label>
                Class
                <select
                  value={receiptForm.className}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, className: e.target.value })
                  }
                >
                  {classes.map((c) => (
                    <option key={c.className} value={c.className}>
                      {c.className} ({c.studentCount} students)
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Session
                <select
                  value={receiptForm.session}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, session: e.target.value })
                  }
                >
                  {SESSIONS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Term
                <select
                  value={receiptForm.term}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, term: e.target.value })
                  }
                >
                  {TERMS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
            </div>

            <button
              className="btn btn--primary btn--full"
              style={{ marginTop: 18 }}
              onClick={generateReceipts}
              disabled={working === 'receipts'}
            >
              {working === 'receipts' ? (
                <><FiLoader className="spin" size={16} /> Generating…</>
              ) : (
                <><FiDownload size={16} /> Download receipts PDF</>
              )}
            </button>
          </div>

          {/* ---------- ID cards ---------- */}
          <div className="card bulk-pdf-card">
            <div className="bulk-pdf-card__icon">
              <FiCreditCard size={22} />
            </div>
            <h3>Bulk ID cards</h3>
            <p className="muted">
              Two ID cards per page, print-ready. Cut along the border and
              laminate.
            </p>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <label className="form-grid__full">
                Class
                <select
                  value={idForm.className}
                  onChange={(e) => setIdForm({ className: e.target.value })}
                >
                  {classes.map((c) => (
                    <option key={c.className} value={c.className}>
                      {c.className} ({c.studentCount} students)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              className="btn btn--primary btn--full"
              style={{ marginTop: 18 }}
              onClick={generateIdCards}
              disabled={working === 'ids'}
            >
              {working === 'ids' ? (
                <><FiLoader className="spin" size={16} /> Generating…</>
              ) : (
                <><FiDownload size={16} /> Download ID cards PDF</>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <h3><FiAlertCircle size={16} /> Tips</h3>
        <ul className="bulk-pdf-tips">
          <li>
            Large batches (200+ students) may take 20–60 seconds to render. Don't
            close the tab while the spinner is up.
          </li>
          <li>
            On the print dialog, choose <strong>Fit to printable area</strong> so
            nothing gets clipped.
          </li>
          <li>
            Report cards can be exported from <strong>Results</strong> →{' '}
            <strong>Print / Download Class Reports</strong>.
          </li>
        </ul>
      </div>
    </div>
  );
}