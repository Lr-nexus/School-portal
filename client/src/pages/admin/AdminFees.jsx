import { useEffect, useMemo, useState } from 'react';
import {
  FiPlus, FiTrash2, FiX, FiEye, FiAlertCircle, FiCheck,
  FiDollarSign, FiSearch, FiUsers, FiFileText, FiRefreshCw
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

/* ==================================================================
   Helpers
================================================================== */
const formatNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');

const statusClass = (status) =>
  ({
    Paid: 'pill--paid',
    Partial: 'pill--partial',
    Unpaid: 'pill--unpaid',
  }[status] || '');

const SESSIONS = ['2024/2025', '2025/2026', '2023/2024'];
const TERMS = ['First Term', 'Second Term', 'Third Term'];

/* ==================================================================
   MAIN PAGE
================================================================== */
export default function AdminFees() {
  const [fees, setFees] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');

  const [showPublish, setShowPublish] = useState(false);
  const [viewBatch, setViewBatch] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    try {
      setErrorMsg('');
      const [feeData, classData] = await Promise.all([
        api('/admin/fees'),
        api('/admin/classes'),
      ]);
      setFees(feeData);
      setClasses(classData);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const totalBilled = fees.reduce((s, f) => s + Number(f.totalBilled), 0);
    const totalCollected = fees.reduce((s, f) => s + Number(f.totalCollected), 0);
    const outstanding = totalBilled - totalCollected;
    return {
      batches: fees.length,
      totalBilled,
      totalCollected,
      outstanding,
    };
  }, [fees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fees;
    return fees.filter(
      (f) =>
        f.reference.toLowerCase().includes(q) ||
        f.session.toLowerCase().includes(q) ||
        f.term.toLowerCase().includes(q) ||
        f.items.some((i) => i.name.toLowerCase().includes(q))
    );
  }, [fees, search]);

  const performDelete = async () => {
    if (!confirmDelete) return;
    try {
      const res = await api(`/admin/fees/${confirmDelete.reference}`, {
        method: 'DELETE',
      });
      setMessage(res.message);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setErrorMsg(err.message);
      setConfirmDelete(null);
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader
        title="Fees & Finance"
        subtitle="Publish fees to classes and track collection"
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={load}>
            <FiRefreshCw size={16} /> Refresh
          </button>
          <button
            className="btn btn--primary"
            onClick={() => setShowPublish(true)}
          >
            <FiPlus size={16} /> Publish Fee
          </button>
        </div>
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

      <div className="stats-grid">
        <StatCard
          label="Fee Batches"
          value={summary.batches}
          hint="Published to classes"
          color="#2563eb"
        />
        <StatCard
          label="Total Billed"
          value={formatNaira(summary.totalBilled)}
          hint="Across all students"
          color="#7c3aed"
        />
        <StatCard
          label="Collected"
          value={formatNaira(summary.totalCollected)}
          hint={
            summary.totalBilled > 0
              ? `${Math.round((summary.totalCollected / summary.totalBilled) * 100)}% of billed`
              : '—'
          }
          color="#16a34a"
        />
        <StatCard
          label="Outstanding"
          value={formatNaira(summary.outstanding)}
          hint="Still to collect"
          color={summary.outstanding > 0 ? '#dc2626' : '#16a34a'}
        />
      </div>

      <div className="filters-bar">
        <div className="filters-bar__search">
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Search by reference, session, term, or item…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!filtered.length && (
        <div className="card empty-state">
          <FiDollarSign size={32} />
          <p>
            {fees.length === 0
              ? 'No fees published yet.'
              : 'No fees match your search.'}
          </p>
          {fees.length === 0 && (
            <button
              className="btn btn--primary"
              style={{ marginTop: 12 }}
              onClick={() => setShowPublish(true)}
            >
              <FiPlus size={16} /> Publish Your First Fee
            </button>
          )}
        </div>
      )}

      {filtered.map((fee) => {
        const collected = Number(fee.totalCollected);
        const billed = Number(fee.totalBilled);
        const pct = billed > 0 ? Math.round((collected / billed) * 100) : 0;

        return (
          <div className="card fee-batch" key={fee.reference}>
            <div className="fee-batch__head">
              <div>
                <div className="fee-batch__title">
                  <h3>{fee.session} · {fee.term}</h3>
                  <span className="chip">
                    {fee.studentCount} student{fee.studentCount === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="muted fee-batch__ref">
                  Reference: <code>{fee.reference}</code> · Due {fee.date}
                </p>
              </div>
              <div className="fee-batch__amounts">
                <div>
                  <span className="muted">Per Student</span>
                  <strong>{formatNaira(fee.totalPerStudent)}</strong>
                </div>
                <div>
                  <span className="muted">Total Billed</span>
                  <strong>{formatNaira(billed)}</strong>
                </div>
              </div>
            </div>

            <div className="fee-batch__items">
              {fee.items.map((item, i) => (
                <span className="chip" key={i}>
                  {item.name} · {formatNaira(item.amount)}
                </span>
              ))}
            </div>

            <div className="fee-progress">
              <div className="fee-progress__track">
                <div
                  className="fee-progress__fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="fee-progress__label">
                {pct}% collected · {formatNaira(collected)} / {formatNaira(billed)}
              </div>
            </div>

            <div className="fee-batch__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setViewBatch(fee.reference)}
              >
                <FiEye size={14} /> View Students
              </button>
              <button
                className="btn btn--danger btn--sm"
                onClick={() =>
                  setConfirmDelete({
                    reference: fee.reference,
                    studentCount: fee.studentCount,
                  })
                }
              >
                <FiTrash2 size={14} /> Delete
              </button>
            </div>
          </div>
        );
      })}

      {showPublish && (
        <PublishFeeModal
          classes={classes}
          onClose={() => setShowPublish(false)}
          onPublished={async (msg) => {
            setMessage(msg);
            setShowPublish(false);
            await load();
          }}
          onError={setErrorMsg}
        />
      )}

      {viewBatch && (
        <ViewBatchModal
          reference={viewBatch}
          onClose={() => setViewBatch(null)}
        />
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>
                <FiAlertCircle size={18} /> Delete Fee Batch?
              </h3>
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmDelete(null)}
              >
                <FiX size={16} />
              </button>
            </div>
            <p style={{ marginBottom: 8 }}>
              This will remove the fee from{' '}
              <strong>
                {confirmDelete.studentCount} student
                {confirmDelete.studentCount === 1 ? '' : 's'}
              </strong>{' '}
              and their portals.
            </p>
            <p className="muted" style={{ fontSize: 12, color: 'var(--red)' }}>
              Batches with any payment made cannot be deleted.
            </p>
            <div className="modal__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button className="btn btn--danger" onClick={performDelete}>
                <FiTrash2 size={14} /> Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================================================================
   PUBLISH FEE MODAL
   ================================================================== */
function PublishFeeModal({ classes, onClose, onPublished, onError }) {
  const [form, setForm] = useState({
    session: '2024/2025',
    term: 'First Term',
    className: '',
    dueDate: '',
  });
  const [items, setItems] = useState([{ name: '', amount: '' }]);
  const [preview, setPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!form.className) {
      setPreview([]);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);

    api(`/admin/fees/preview/${encodeURIComponent(form.className)}`)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setPreview([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => { cancelled = true; };
  }, [form.className]);

  const addItem = () =>
    setItems((prev) => [...prev, { name: '', amount: '' }]);

  const updateItem = (i, field, value) =>
    setItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });

  const removeItem = (i) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const totalPerStudent = items.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );
  const totalBilled = totalPerStudent * preview.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.className) return setFormError('Select a class');
    if (items.some((i) => !i.name.trim() || !i.amount || Number(i.amount) <= 0)) {
      return setFormError('Every fee item needs a name and a positive amount');
    }
    if (!preview.length) {
      return setFormError('No students to publish to for this class');
    }

    setSubmitting(true);
    try {
      const res = await api('/admin/fees', {
        method: 'POST',
        body: JSON.stringify({
          session: form.session,
          term: form.term,
          className: form.className,
          dueDate: form.dueDate,
          items: items.map((i) => ({
            name: i.name.trim(),
            amount: Number(i.amount),
          })),
        }),
      });
      await onPublished(res.message);
    } catch (err) {
      setFormError(err.message);
      onError?.(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3>
              <FiDollarSign size={18} /> Publish a New Fee
            </h3>
            <p className="muted">
              Students receive it instantly in their Fees & Receipts page.
            </p>
          </div>
          <button
            className="btn btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            <FiX size={16} />
          </button>
        </div>

        {formError && (
          <div className="alert alert--error">
            <FiAlertCircle size={16} /> {formError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <h4 className="enroll-section-title">Fee Details</h4>
          <div className="form-grid">
            <label>
              Session
              <select
                value={form.session}
                onChange={(e) => setForm({ ...form, session: e.target.value })}
                disabled={submitting}
              >
                {SESSIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Term
              <select
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                disabled={submitting}
              >
                {TERMS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>
              Target Class
              <select
                value={form.className}
                onChange={(e) => setForm({ ...form, className: e.target.value })}
                disabled={submitting}
                required
              >
                <option value="">— Select a class —</option>
                <option value="ALL">🌐 All Classes (school-wide)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name} ({c.students.length} students)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due Date
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                disabled={submitting}
              />
            </label>
          </div>

          <h4 className="enroll-section-title">Fee Items</h4>
          <div className="fee-items-editor">
            {items.map((item, i) => (
              <div className="fee-item-row" key={i}>
                <input
                  placeholder="Item name (e.g. Tuition Fee)"
                  value={item.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  disabled={submitting}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  value={item.amount}
                  onChange={(e) => updateItem(i, 'amount', e.target.value)}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => removeItem(i)}
                  disabled={items.length === 1 || submitting}
                  title="Remove item"
                >
                  <FiX size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={addItem}
              disabled={submitting}
            >
              <FiPlus size={14} /> Add Item
            </button>
          </div>

          {form.className && (
            <>
              <h4 className="enroll-section-title">
                Preview — Who Will Receive This?
              </h4>
              <div className="fee-preview-panel">
                {loadingPreview ? (
                  <p className="muted" style={{ fontSize: 13 }}>Loading students…</p>
                ) : preview.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>
                    No students found in this class.
                  </p>
                ) : (
                  <>
                    <div className="fee-preview-stats">
                      <div>
                        <span className="muted">Students</span>
                        <strong>{preview.length}</strong>
                      </div>
                      <div>
                        <span className="muted">Per Student</span>
                        <strong>{formatNaira(totalPerStudent)}</strong>
                      </div>
                      <div>
                        <span className="muted">Total Billed</span>
                        <strong>{formatNaira(totalBilled)}</strong>
                      </div>
                    </div>

                    <details className="fee-preview-list">
                      <summary>
                        <FiUsers size={14} /> View student list ({preview.length})
                      </summary>
                      <ul>
                        {preview.map((s) => (
                          <li key={s.id}>
                            {s.name} · {s.className} · {s.admissionNo}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
              </div>
            </>
          )}

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={submitting || !form.className || preview.length === 0}
            >
              {submitting ? 'Publishing…' : (
                <>
                  <FiCheck size={16} /> Publish to {preview.length} student
                  {preview.length === 1 ? '' : 's'}
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
   VIEW BATCH MODAL
   ================================================================== */
function ViewBatchModal({ reference, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api(`/admin/fees/${reference}`)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [reference]);

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
          <div className="loader" style={{ padding: 60 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3>Error</h3>
            <button className="btn btn--ghost" onClick={onClose}>
              <FiX size={16} />
            </button>
          </div>
          <div className="alert alert--error">{err}</div>
        </div>
      </div>
    );
  }

  const collected = data.students.reduce((s, x) => s + x.amountPaid, 0);
  const billed = data.totalPerStudent * data.students.length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3>
              <FiFileText size={18} /> {data.session} · {data.term}
            </h3>
            <p className="muted">
              Ref <code>{data.reference}</code> · Due {data.date}
            </p>
          </div>
          <button className="btn btn--ghost" onClick={onClose}>
            <FiX size={16} />
          </button>
        </div>

        <div className="fee-preview-stats" style={{ marginBottom: 18 }}>
          <div>
            <span className="muted">Students</span>
            <strong>{data.students.length}</strong>
          </div>
          <div>
            <span className="muted">Per Student</span>
            <strong>{formatNaira(data.totalPerStudent)}</strong>
          </div>
          <div>
            <span className="muted">Collected</span>
            <strong style={{ color: 'var(--green)' }}>{formatNaira(collected)}</strong>
          </div>
          <div>
            <span className="muted">Outstanding</span>
            <strong style={{ color: 'var(--red)' }}>{formatNaira(billed - collected)}</strong>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table table--striped">
            <thead>
              <tr>
                <th>#</th>
                <th>Student</th>
                <th>Class</th>
                <th>Admission No</th>
                <th className="right">Paid</th>
                <th className="right">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={s.feeId}>
                  <td>{i + 1}</td>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.className}</td>
                  <td>{s.admissionNo}</td>
                  <td className="right">{formatNaira(s.amountPaid)}</td>
                  <td className="right">{formatNaira(s.balance)}</td>
                  <td>
                    <span className={`pill ${statusClass(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}