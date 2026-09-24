import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiPrinter, FiSearch, FiUser,
  FiBookOpen, FiAlertCircle, FiX, FiCheck,
  FiCreditCard,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

/* ================================================================
   Printable HTML — one report card per A4 page
   ================================================================ */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildBatchReportHTML(batch) {
  const { cards } = batch;

  const oneCard = (card, index) => `
    <section class="report-card ${index === cards.length - 1 ? 'report-card--last' : ''}">
      <header class="rc-head">
        <div class="rc-head__left">
          <h1>${escapeHtml(card.school.name)}</h1>
          <p>${escapeHtml(card.school.address)}</p>
          <p>${escapeHtml(card.school.phone)} · ${escapeHtml(card.school.email)}</p>
          <em>${escapeHtml(card.school.motto)}</em>
        </div>
        <div class="rc-head__right">
          <h2>TERMLY REPORT CARD</h2>
          <p>${escapeHtml(card.session)} · ${escapeHtml(card.term)}</p>
        </div>
      </header>

      <div class="rc-student">
        <div><span>Name:</span> <strong>${escapeHtml(card.student.name)}</strong></div>
        <div><span>Admission No:</span> <strong>${escapeHtml(card.student.admissionNo)}</strong></div>
        <div><span>Class:</span> <strong>${escapeHtml(card.student.className)}</strong></div>
        <div><span>House:</span> <strong>${escapeHtml(card.student.house || '—')}</strong></div>
        <div><span>Gender:</span> <strong>${escapeHtml(card.student.gender || '—')}</strong></div>
        <div><span>Form Teacher:</span> <strong>${escapeHtml(card.formTeacher)}</strong></div>
      </div>

      <table class="rc-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th class="right">CA (30)</th>
            <th class="right">Exam (70)</th>
            <th class="right">Total</th>
            <th>Grade</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          ${card.subjects.length
            ? card.subjects.map((s) => `
                <tr>
                  <td>${escapeHtml(s.subject)}</td>
                  <td class="right">${s.ca}</td>
                  <td class="right">${s.exam}</td>
                  <td class="right"><strong>${s.total}</strong></td>
                  <td><span class="grade grade--${escapeHtml(s.grade)}">${escapeHtml(s.grade)}</span></td>
                  <td>${escapeHtml(s.remark)}</td>
                </tr>
              `).join('')
            : `<tr><td colspan="6" class="muted">No results recorded.</td></tr>`}
        </tbody>
      </table>

      <div class="rc-summary">
        <div><span>Average:</span> <strong>${card.average}%</strong></div>
        <div><span>Overall Grade:</span> <strong>${escapeHtml(card.overallGrade)}</strong></div>
        <div><span>Position in Class:</span> <strong>${
          card.position ? `${card.position} of ${card.classSize}` : '—'
        }</strong></div>
        <div><span>Attendance:</span> <strong>${card.attendanceRate}%</strong></div>
      </div>

      <div class="rc-footer">
        <div class="rc-remark">
          <span>Form Teacher's Remark:</span>
          <p>${escapeHtml(card.overallRemark)}</p>
        </div>
        <div class="rc-sig"><div class="sig-line"></div><p>Principal's Signature</p></div>
        <div class="rc-sig"><div class="sig-line"></div><p>Date</p></div>
      </div>

      <div class="rc-meta">Issued ${escapeHtml(card.issuedAt)} · Computer-generated document</div>
    </section>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Report Cards — ${escapeHtml(batch.className)}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0b1220; font-size: 12px; line-height: 1.4; background: #fff; }
  .report-card { page-break-after: always; padding-bottom: 6mm; }
  .report-card--last { page-break-after: auto; }
  .rc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 14px; border-bottom: 3px double #0b1220; margin-bottom: 18px; flex-wrap: wrap; }
  .rc-head h1 { font-size: 19px; letter-spacing: .3px; margin-bottom: 4px; }
  .rc-head p { font-size: 11.5px; color: #475569; margin: 2px 0; }
  .rc-head em { font-size: 10.5px; color: #64748b; font-style: italic; }
  .rc-head__right { text-align: right; }
  .rc-head__right h2 { font-size: 15px; letter-spacing: 1.5px; color: #0b1220; margin-bottom: 4px; }
  .rc-head__right p { font-size: 12.5px; color: #475569; }
  .rc-student { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; margin-bottom: 16px; font-size: 12px; }
  .rc-student > div { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #cbd5e1; }
  .rc-student span { color: #64748b; }
  .rc-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  .rc-table th, .rc-table td { padding: 7px 9px; border-bottom: 1px solid #e2e8f0; text-align: left; color: #334155; }
  .rc-table th { font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; color: #64748b; border-bottom: 2px solid #0b1220; }
  .rc-table .right { text-align: right; }
  .rc-table .muted { color: #94a3b8; font-style: italic; }
  .grade { display: inline-block; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-size: 11px; }
  .grade--A { background: #dcfce7; color: #15803d; }
  .grade--B { background: #dbeafe; color: #1d4ed8; }
  .grade--C { background: #fef3c7; color: #b45309; }
  .grade--D { background: #fed7aa; color: #c2410c; }
  .grade--E { background: #fecaca; color: #b91c1c; }
  .grade--F { background: #e5e7eb; color: #374151; }
  .rc-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 14px; background: #f1f5f9; border-radius: 8px; margin-bottom: 18px; }
  .rc-summary > div { display: flex; flex-direction: column; gap: 3px; }
  .rc-summary span { color: #64748b; font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; }
  .rc-summary strong { font-size: 15px; color: #0b1220; }
  .rc-footer { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 22px; align-items: end; padding-top: 16px; border-top: 2px solid #0b1220; margin-bottom: 14px; }
  .rc-remark span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .3px; color: #64748b; }
  .rc-remark p { font-size: 12px; color: #0b1220; margin-top: 6px; font-style: italic; }
  .rc-sig { text-align: center; }
  .sig-line { border-bottom: 1.5px solid #0b1220; margin-bottom: 5px; height: 28px; }
  .rc-sig p { font-size: 10.5px; color: #64748b; }
  .rc-meta { text-align: center; font-size: 9.5px; color: #94a3b8; }
</style>
</head>
<body>${cards.map(oneCard).join('')}</body>
</html>`;
}

function printViaIframe(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) { console.error('Print failed:', e); }
    setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 800);
  }, 50);
}

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function AdminResults() {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [showClassPrint, setShowClassPrint] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    api('/admin/students')
      .then(setStudents)
      .finally(() => setLoading(false));
  }, []);

  const viewResults = async (student) => {
    setSelected(student);
    setData(null);
    try {
      const res = await api(`/admin/students/${student.id}/results`);
      setData(res);
    } catch (err) { console.error(err); }
  };

  const backToList = () => { setSelected(null); setData(null); };

  const classes = Array.from(
    new Set(students.map((s) => s.className).filter(Boolean))
  ).sort();

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesClass = classFilter === 'all' || s.className === classFilter;
    const matchesSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.admissionNo.toLowerCase().includes(q);
    return matchesClass && matchesSearch;
  });

  if (loading) return <Loader />;

  /* ==================== DETAIL VIEW ==================== */
  if (selected) {
    if (!data) return <Loader text="Loading results..." />;

    const gradeColor =
      data.overallGrade === 'A' ? 'var(--green)' :
      data.overallGrade === 'B' ? 'var(--accent)' :
      data.overallGrade === 'C' ? 'var(--amber)' :
      data.overallGrade === 'F' ? 'var(--red)' : 'var(--muted)';

    return (
      <div>
        {/* Back link — clean, above everything */}
        <button className="back-link" onClick={backToList}>
          <FiArrowLeft size={14} /> Back to all students
        </button>

        <PageHeader
          title="Result Sheet"
          subtitle={`${data.session} · ${data.term}`}
        >
          <button
            className="btn btn--ghost"
            onClick={() => navigate(`/print/id-card/${selected.id}`)}
            title="Open printable ID card"
          >
            <FiCreditCard size={16} /> ID Card
          </button>
          <button
            className="btn btn--primary"
            onClick={() => navigate(`/print/report-card/${selected.id}`)}
            title="Open printable report card"
          >
            <FiPrinter size={16} /> Report Card
          </button>
        </PageHeader>

        <div className="report-head">
          <div className="report-head__student">
            <div className="report-head__avatar">
              {data.student.name.charAt(0)}
            </div>
            <div className="report-head__meta">
              <h2>{data.student.name}</h2>
              <p>{data.student.className} · {data.student.admissionNo}</p>
            </div>
          </div>
          <div className="report-head__grade">
            <div className="label">Overall</div>
            <div className="value" style={{ color: '#fff' }}>{data.overallGrade}</div>
            <div className="sub">{data.average}% average</div>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard
            label="Average Score"
            value={`${data.average}%`}
            hint="Across all subjects"
            color="#2563eb"
          />
          <StatCard
            label="Overall Grade"
            value={data.overallGrade}
            hint={
              data.average >= 75 ? 'Excellent' :
              data.average >= 65 ? 'Very Good' :
              data.average >= 55 ? 'Good' :
              data.average >= 45 ? 'Fair' :
              data.average >= 40 ? 'Pass' : 'Fail'
            }
            color={gradeColor}
          />
          <StatCard
            label="Subjects"
            value={data.subjects.length}
            hint="Recorded this term"
            color="#7c3aed"
          />
        </div>

        <div className="card">
          <h3><FiBookOpen size={16} /> Subject Breakdown</h3>
          <table className="table table--striped">
            <thead>
              <tr>
                <th>Subject</th>
                <th className="right">CA (30)</th>
                <th className="right">Exam (70)</th>
                <th className="right">Total</th>
                <th>Grade</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {data.subjects.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.subject}</strong></td>
                  <td className="right">{r.ca}</td>
                  <td className="right">{r.exam}</td>
                  <td className="right"><strong>{r.total}</strong></td>
                  <td>
                    <span className={`grade grade--${r.grade}`}>{r.grade}</span>
                  </td>
                  <td className="muted">{r.remark}</td>
                </tr>
              ))}
              {!data.subjects.length && (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No results recorded for this student yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ==================== LIST VIEW ==================== */
  return (
    <div>
      <PageHeader
        title="Student Results"
        subtitle={`${students.length} student${students.length === 1 ? '' : 's'} — click to view their result sheet`}
      >
        <button
          className="btn btn--primary"
          onClick={() => setShowClassPrint(true)}
          disabled={!classes.length}
        >
          <FiPrinter size={16} /> Print Class Reports
        </button>
      </PageHeader>

      <div className="filters-bar">
        <div className="filters-bar__search">
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Search by name or admission number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filters-bar__select">
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="all">All classes</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-3">
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            className="student-card"
            onClick={() => viewResults(s)}
          >
            <div className="avatar avatar--sm">{s.name.charAt(0)}</div>
            <div className="student-card__info">
              <strong>{s.name}</strong>
              <span>{s.className} · {s.admissionNo}</span>
            </div>
            <span className="student-card__arrow">›</span>
          </button>
        ))}
      </div>

      {!filtered.length && (
        <div className="card empty-state">
          <FiUser size={32} />
          <p>
            {students.length === 0
              ? 'No students enrolled yet.'
              : 'No students match your search.'}
          </p>
        </div>
      )}

      {showClassPrint && (
        <PrintClassModal
          classes={classes}
          defaultClass={classFilter !== 'all' ? classFilter : (classes[0] || '')}
          onClose={() => setShowClassPrint(false)}
          onDone={() => setShowClassPrint(false)}
        />
      )}
    </div>
  );
}

/* ==================================================================
   PRINT CLASS MODAL (unchanged)
   ================================================================== */
const SESSION_OPTIONS = ['2024/2025', '2025/2026', '2023/2024'];
const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term'];

function PrintClassModal({ classes, defaultClass, onClose, onDone }) {
  const [className, setClassName] = useState(defaultClass || '');
  const [session, setSession] = useState(SESSION_OPTIONS[0]);
  const [term, setTerm] = useState(TERM_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(null);

  const fetchBatch = async () => {
    const params = new URLSearchParams();
    if (session) params.set('session', session);
    if (term) params.set('term', term);
    return api(
      `/reports/class-report-cards/${encodeURIComponent(className)}?${params.toString()}`
    );
  };

  const handlePrint = async () => {
    setErr(''); setBusy(true);
    try {
      const batch = await fetchBatch();
      if (!batch.cards?.length) {
        setErr(`No results recorded for ${className} in ${batch.session || session} ${batch.term || term}`);
        setBusy(false); return;
      }
      printViaIframe(buildBatchReportHTML(batch));
      onDone();
    } catch (ex) {
      setErr(ex.message || 'Print failed');
      setBusy(false);
    }
  };

  const handlePreviewCount = async () => {
    setErr(''); setBusy(true);
    try {
      const batch = await fetchBatch();
      setPreview({ count: batch.count, session: batch.session, term: batch.term });
    } catch (ex) {
      setErr(ex.message || 'Failed to load');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3><FiPrinter size={18} /> Print Class Report Cards</h3>
            <p className="muted">One report card per student, each on its own A4 page</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            <FiX size={16} />
          </button>
        </div>

        {err && <div className="alert alert--error"><FiAlertCircle size={16} /> {err}</div>}

        <label>
          Class
          <select
            value={className}
            onChange={(e) => { setClassName(e.target.value); setPreview(null); }}
            disabled={busy}
          >
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <div className="form-grid">
          <label>Session
            <select value={session}
              onChange={(e) => { setSession(e.target.value); setPreview(null); }}
              disabled={busy}>
              {SESSION_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Term
            <select value={term}
              onChange={(e) => { setTerm(e.target.value); setPreview(null); }}
              disabled={busy}>
              {TERM_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>

        {preview && (
          <div className="alert alert--info" style={{ fontSize: 13 }}>
            <FiCheck size={16} /> Will print <strong>{preview.count}</strong> report card
            {preview.count === 1 ? '' : 's'} for <strong>{className}</strong> — {preview.session} · {preview.term}
          </div>
        )}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost"
            onClick={handlePreviewCount} disabled={busy || !className}>
            Check Count
          </button>
          <button type="button" className="btn btn--ghost"
            onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary"
            onClick={handlePrint} disabled={busy || !className}>
            <FiPrinter size={14} /> {busy ? 'Preparing…' : 'Print All'}
          </button>
        </div>
      </div>
    </div>
  );
}