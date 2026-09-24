import { useEffect, useMemo, useState } from 'react';
import {
  FiUsers, FiUserCheck, FiTrash2, FiX, FiAlertTriangle,
  FiSearch, FiCheckSquare, FiSquare, FiMinusSquare,
  FiChevronDown, FiChevronUp, FiMail, FiLayers,
  FiPlus, FiSettings, FiCheck, FiDownload, FiFilter, FiPrinter,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science',
  'Social Studies', 'Computer Studies', 'Further Mathematics',
  'Biology', 'Literature',
];

const ROLE_OPTIONS = [
  { value: 'all',             label: 'Everyone' },
  { value: 'admin',           label: 'Admins only' },
  { value: 'teacher-class',   label: 'Class teachers' },
  { value: 'teacher-subject', label: 'Subject teachers' },
  { value: 'teacher',         label: 'All teachers' },
  { value: 'student',         label: 'Students' },
  { value: 'parent',          label: 'Parents' },
];

/* ==================================================================
   CSV helpers
   ================================================================== */
function escapeCSV(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes(';')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCredentialsCSV(data) {
  const header = ['#', 'Role', 'Name', 'Email (login)', 'Password', 'Detail', 'Reference'];
  const lines = [header.map(escapeCSV).join(',')];

  data.rows.forEach((r, i) => {
    lines.push([
      i + 1, r.role, r.name, r.email, r.password, r.detail, r.reference,
    ].map(escapeCSV).join(','));
  });

  lines.push('');
  lines.push([escapeCSV(`Generated: ${new Date(data.generatedAt).toLocaleString()}`)]);
  lines.push([escapeCSV(`Filter: ${data.filters.role}${data.filters.className ? ` · Class: ${data.filters.className}` : ''}`)]);
  lines.push([escapeCSV(`Total users: ${data.total}`)]);
  lines.push([escapeCSV(
    `Admins: ${data.summary.admins} · Class teachers: ${data.summary.classTeachers} · ` +
    `Subject teachers: ${data.summary.subjectTeachers} · Students: ${data.summary.students} · ` +
    `Parents: ${data.summary.parents}`
  )]);

  return lines.join('\n');
}

function downloadCSVFile(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/* ==================================================================
   PRINTABLE HTML
   ================================================================== */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildCredentialsPrintHTML(data) {
  const groups = {};
  data.rows.forEach((r) => {
    if (!groups[r.role]) groups[r.role] = [];
    groups[r.role].push(r);
  });

  const ROLE_ORDER = [
    'Admin',
    'Teacher (Class)',
    'Teacher (Subject)',
    'Student',
    'Parent',
  ];
  const orderedRoles = [
    ...ROLE_ORDER.filter((r) => groups[r]),
    ...Object.keys(groups).filter((r) => !ROLE_ORDER.includes(r)),
  ];

  const sectionHTML = orderedRoles.map((role) => {
    const rows = groups[role];

    let subtitle = '';
    if (role === 'Student' && data.filters.className) {
      subtitle = `Class ${data.filters.className} · ${rows.length} student${rows.length === 1 ? '' : 's'}`;
    } else {
      subtitle = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
    }

    const rowsHTML = rows.map((r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="name">${escapeHtml(r.name)}</td>
        <td class="email">${escapeHtml(r.email)}</td>
        <td class="pw">${escapeHtml(r.password)}</td>
        <td class="detail">${escapeHtml(r.detail)}</td>
      </tr>
    `).join('');

    return `
      <section class="block">
        <header class="block__head">
          <h2>${escapeHtml(role.toUpperCase())}${role.endsWith('s') ? '' : 'S'}</h2>
          <span class="block__sub">${escapeHtml(subtitle)}</span>
        </header>
        <table>
          <thead>
            <tr>
              <th class="num">#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Password</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </section>
    `;
  }).join('');

  const filterLabel =
    data.filters.role === 'all'
      ? 'Everyone'
      : data.filters.role.charAt(0).toUpperCase() + data.filters.role.slice(1).replace('-', ' ');

  const classLabel = data.filters.className ? ` · Class ${data.filters.className}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Credentials — ${escapeHtml(filterLabel)}${escapeHtml(classLabel)}</title>
<style>
  @page { size: A4 portrait; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #0b1220;
    font-size: 11px;
    line-height: 1.4;
    padding: 0;
    background: #fff;
  }

  .sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    padding-bottom: 12px;
    margin-bottom: 18px;
    border-bottom: 3px double #0b1220;
  }
  .sheet-head__brand { display: flex; align-items: center; gap: 12px; }
  .sheet-head__logo {
    width: 46px; height: 46px;
    border-radius: 10px;
    background: linear-gradient(135deg, #1d4ed8, #2563eb);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 15px;
    letter-spacing: .5px;
  }
  .sheet-head h1 {
    font-size: 18px;
    letter-spacing: .3px;
    margin-bottom: 2px;
  }
  .sheet-head .sub {
    font-size: 11px;
    color: #475569;
  }
  .sheet-head__meta {
    text-align: right;
    font-size: 10.5px;
    color: #475569;
    line-height: 1.55;
  }
  .sheet-head__meta strong { color: #0b1220; }

  .block {
    page-break-inside: avoid;
    margin-bottom: 18px;
  }
  .block__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 6px 10px;
    background: #f1f5f9;
    border-left: 4px solid #2563eb;
    border-radius: 4px;
    margin-bottom: 8px;
  }
  .block__head h2 {
    font-size: 12.5px;
    letter-spacing: 1px;
    color: #1e293b;
  }
  .block__sub {
    font-size: 10px;
    color: #64748b;
    font-weight: 500;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
  }
  th, td {
    text-align: left;
    padding: 5px 8px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  thead th {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: .5px;
    color: #64748b;
    border-bottom: 1.5px solid #0b1220;
    padding-bottom: 4px;
  }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .num     { width: 22px;  text-align: right; color: #94a3b8; }
  .name    { width: 22%;   font-weight: 600; color: #0b1220; }
  .email   { width: 30%;   font-family: 'Courier New', monospace; font-size: 10px; color: #1d4ed8; }
  .pw      { width: 16%;   font-family: 'Courier New', monospace; font-size: 10px; color: #b45309; font-weight: 700; }
  .detail  { width: auto;  color: #475569; }

  .sheet-foot {
    margin-top: 22px;
    padding-top: 12px;
    border-top: 1.5px solid #0b1220;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    font-size: 9.5px;
    color: #475569;
  }
  .sheet-foot strong { color: #0b1220; }
</style>
</head>
<body>

  <div class="sheet-head">
    <div class="sheet-head__brand">
      <div class="sheet-head__logo">BF</div>
      <div>
        <h1>Bright Future Secondary School</h1>
        <div class="sub">Portal Login Credentials — Session 2024/2025</div>
      </div>
    </div>
    <div class="sheet-head__meta">
      <div><strong>Filter:</strong> ${escapeHtml(filterLabel)}${escapeHtml(classLabel)}</div>
      <div><strong>Total users:</strong> ${data.total}</div>
      <div><strong>Generated:</strong> ${escapeHtml(new Date(data.generatedAt).toLocaleString())}</div>
    </div>
  </div>

  ${sectionHTML}

  <div class="sheet-foot">
    <div>
      <strong>Admins:</strong> ${data.summary.admins} ·
      <strong>Class teachers:</strong> ${data.summary.classTeachers} ·
      <strong>Subject teachers:</strong> ${data.summary.subjectTeachers} ·
      <strong>Students:</strong> ${data.summary.students} ·
      <strong>Parents:</strong> ${data.summary.parents}
    </div>
    <div>Confidential — handle with care.</div>
  </div>

</body>
</html>`;
}

/* --------------------------------------------------------------
   Print via hidden iframe — no popup, no new tab.
   Works inside any browser (Chrome, Firefox, Safari, Edge).
   The iframe is removed from the DOM after printing.
-------------------------------------------------------------- */
function printViaIframe(html) {
  // Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Print preview');

  document.body.appendChild(iframe);

  // Write the HTML inside the iframe
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Wait for images/fonts (none in our case, but be safe) then print
  const triggerPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print failed:', e);
    }

    // Clean up after the print dialog closes (or immediately on cancel)
    // 800ms is a safe delay — long enough for the dialog to open,
    // short enough that we don't leak iframes.
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 800);
  };

  // The document is fully available synchronously after doc.close(),
  // but wait one tick to be extra safe in Safari.
  setTimeout(triggerPrint, 50);
}

/* ==================================================================
   MAIN COMPONENT
   ================================================================== */
export default function AdminUsers() {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('teachers');

  const [teacherSearch, setTeacherSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [manageTeacher, setManageTeacher] = useState(null);

  const [showExport, setShowExport] = useState(false);

  const [expanded, setExpanded] = useState({});

  const load = async () => {
    try {
      const [t, s, c] = await Promise.all([
        api('/admin/teachers'),
        api('/admin/students'),
        api('/admin/classes'),
      ]);
      setTeachers(t);
      setStudents(s);
      setClasses(c);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.staffNo || '').toLowerCase().includes(q) ||
        (t.formClass || '').toLowerCase().includes(q) ||
        t.subjects.join(' ').toLowerCase().includes(q)
    );
  }, [teachers, teacherSearch]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.className || '').toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const studentsByClass = useMemo(() => {
    const hasSearch = studentSearch.trim().length > 0;
    const map = {};

    if (!hasSearch) classes.forEach((c) => { map[c.name] = []; });

    filteredStudents.forEach((s) => {
      const cls = s.className || 'Unassigned';
      if (!map[cls]) map[cls] = [];
      map[cls].push(s);
    });

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([className, list]) => {
        const classRow = classes.find((c) => c.name === className);
        const teacher =
          classRow?.teacher ||
          teachers.find((t) => t.formClass === className) ||
          null;
        return { className, students: list, teacher };
      });
  }, [filteredStudents, teachers, classes, studentSearch]);

  const toggleExpanded = (cls) =>
    setExpanded((prev) => ({ ...prev, [cls]: !prev[cls] }));

  const expandAllClasses = () =>
    setExpanded(
      studentsByClass.reduce((acc, c) => ({ ...acc, [c.className]: true }), {})
    );

  const collapseAllClasses = () => setExpanded({});

  const isTeachersTab = tab === 'teachers';
  const currentList = isTeachersTab ? filteredTeachers : filteredStudents;

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const allSelected =
    currentList.length > 0 &&
    currentList.every((x) => selected.includes(x.id));
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(currentList.map((x) => x.id));
  };

  const clearSelection = () => setSelected([]);

  const performDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.mode === 'single') {
        const item = confirmDelete.items[0];
        const path = isTeachersTab
          ? `/admin/teachers/${item.id}`
          : `/admin/students/${item.id}`;
        await api(path, { method: 'DELETE' });
        setMessage(`Removed ${item.name}`);
      } else {
        const ids = confirmDelete.items.map((i) => i.id);
        const path = isTeachersTab
          ? '/admin/teachers/bulk-delete'
          : '/admin/students/bulk-delete';
        const res = await api(path, {
          method: 'POST',
          body: JSON.stringify({ ids }),
        });
        setMessage(res.message);
        clearSelection();
      }
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <Loader />;

  const selectedItems = currentList.filter((x) => selected.includes(x.id));

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Browse and manage every teacher and student in the school"
      >
        <button
          className="btn btn--ghost"
          onClick={() => setShowExport(true)}
          title="Download or print login credentials"
        >
          <FiDownload size={16} /> Export / Print Credentials
        </button>
      </PageHeader>

      {message && <div className="alert alert--info">{message}</div>}

      <div className="stats-grid">
        <StatCard label="Teachers" value={teachers.length} color="#7c3aed" />
        <StatCard label="Students" value={students.length} color="#2563eb" />
        <StatCard label="Classes"  value={classes.length}  color="#0d9488" />
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'teachers' ? 'tab--active' : ''}`}
          onClick={() => { setTab('teachers'); clearSelection(); }}
        >
          <FiUserCheck size={16} /> Teachers ({teachers.length})
        </button>
        <button
          type="button"
          className={`tab ${tab === 'students' ? 'tab--active' : ''}`}
          onClick={() => { setTab('students'); clearSelection(); }}
        >
          <FiUsers size={16} /> Students ({students.length})
        </button>
      </div>

      {selected.length > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar__count">{selected.length} selected</span>
          <div className="bulk-bar__actions">
            <button className="btn btn--ghost btn--sm" onClick={clearSelection}>
              Clear
            </button>
            <button
              className="btn btn--danger btn--sm"
              onClick={() => setConfirmDelete({ mode: 'bulk', items: selectedItems })}
            >
              <FiTrash2 size={14} /> Remove {selected.length}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          TEACHERS TAB
      ============================================================ */}
      {tab === 'teachers' && (
        <div className="card">
          <div className="filters-bar">
            <div className="filters-bar__search">
              <FiSearch size={16} />
              <input
                type="text"
                placeholder="Search teachers by name, email, staff no, or class…"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
              />
            </div>
          </div>

          <table className="table table--striped">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <button className="checkbox-btn" onClick={toggleAll}>
                    {allSelected ? <FiCheckSquare size={18} /> :
                     someSelected ? <FiMinusSquare size={18} /> :
                     <FiSquare size={18} />}
                  </button>
                </th>
                <th>#</th>
                <th>Name</th>
                <th>Staff No</th>
                <th>Type</th>
                <th>Form Class</th>
                <th>Assignments</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((t, i) => {
                const isChecked = selected.includes(t.id);
                const isClassTeacher = t.teacherType === 'class_teacher';
                return (
                  <tr key={t.id} className={isChecked ? 'row--selected' : ''}>
                    <td>
                      <button className="checkbox-btn" onClick={() => toggle(t.id)}>
                        {isChecked ? <FiCheckSquare size={18} /> : <FiSquare size={18} />}
                      </button>
                    </td>
                    <td>{i + 1}</td>
                    <td>
                      <div><strong>{t.name}</strong></div>
                      <div className="muted" style={{ fontSize: 12 }}>{t.email}</div>
                    </td>
                    <td>{t.staffNo}</td>
                    <td>
                      {isClassTeacher ? (
                        <span className="pill pill--partial">Class</span>
                      ) : (
                        <span className="pill">Subject</span>
                      )}
                    </td>
                    <td>{t.formClass || <span className="muted">—</span>}</td>
                    <td>
                      {t.assignments?.length
                        ? `${t.assignments.length} target${t.assignments.length === 1 ? '' : 's'}`
                        : <span className="muted">None</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => setManageTeacher(t)}
                          title="Manage class / subject assignments"
                        >
                          <FiSettings size={14} /> Manage
                        </button>
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => setConfirmDelete({ mode: 'single', items: [t] })}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredTeachers.length && (
                <tr>
                  <td colSpan="8" className="muted" style={{ textAlign: 'center' }}>
                    {teachers.length === 0
                      ? 'No teachers enrolled yet.'
                      : 'No teachers match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================
          STUDENTS TAB
      ============================================================ */}
      {tab === 'students' && (
        <>
          <div className="filters-bar">
            <div className="filters-bar__search">
              <FiSearch size={16} />
              <input
                type="text"
                placeholder="Search students by name, admission no, email, or class…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <div className="filters-bar__select" style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--ghost btn--sm" onClick={expandAllClasses}>
                Expand all
              </button>
              <button className="btn btn--ghost btn--sm" onClick={collapseAllClasses}>
                Collapse all
              </button>
            </div>
          </div>

          {studentsByClass.length === 0 && (
            <div className="card empty-state">
              <FiLayers size={32} />
              <p>
                {classes.length === 0
                  ? 'No classes created yet.'
                  : 'No classes match your search.'}
              </p>
            </div>
          )}

          {studentsByClass.map((cls) => {
            const isOpen = !!expanded[cls.className];
            const totalInClass = cls.students.length;
            return (
              <div
                key={cls.className}
                className={`class-card ${isOpen ? 'class-card--open' : ''}`}
              >
                <button
                  className="class-card__head"
                  onClick={() => toggleExpanded(cls.className)}
                >
                  <div className="class-card__title">
                    <div className="class-card__badge">{cls.className}</div>
                    <div className="class-card__meta">
                      <span>
                        <FiUsers size={13} /> {totalInClass} student
                        {totalInClass === 1 ? '' : 's'}
                      </span>
                      {cls.teacher ? (
                        <span className="muted">
                          <FiUserCheck size={13} /> {cls.teacher.name}
                        </span>
                      ) : (
                        <span className="muted">No form teacher</span>
                      )}
                    </div>
                  </div>
                  <span className="class-card__chevron">
                    {isOpen ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                  </span>
                </button>

                {isOpen && (
                  <div className="class-card__body class-card__body--flat">
                    {cls.teacher && (
                      <div className="class-teacher-compact">
                        <div className="avatar avatar--sm">
                          {cls.teacher.name.charAt(0)}
                        </div>
                        <div className="class-teacher-compact__info">
                          <strong>{cls.teacher.name}</strong>
                          <a
                            href={`mailto:${cls.teacher.email}`}
                            className="class-teacher__contact"
                          >
                            <FiMail size={12} /> {cls.teacher.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {totalInClass === 0 ? (
                      <p className="muted" style={{ fontSize: 13, padding: '10px 4px' }}>
                        No students in this class yet.
                      </p>
                    ) : (
                      <table className="table table--striped">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>
                              <button
                                className="checkbox-btn"
                                onClick={() =>
                                  setSelected((prev) => {
                                    const classIds = cls.students.map((s) => s.id);
                                    const allInClassSelected = classIds.every((id) =>
                                      prev.includes(id)
                                    );
                                    if (allInClassSelected) {
                                      return prev.filter((id) => !classIds.includes(id));
                                    }
                                    const merged = new Set([...prev, ...classIds]);
                                    return Array.from(merged);
                                  })
                                }
                              >
                                {cls.students.every((s) => selected.includes(s.id)) ? (
                                  <FiCheckSquare size={18} />
                                ) : cls.students.some((s) => selected.includes(s.id)) ? (
                                  <FiMinusSquare size={18} />
                                ) : (
                                  <FiSquare size={18} />
                                )}
                              </button>
                            </th>
                            <th>#</th>
                            <th>Name</th>
                            <th>Admission No</th>
                            <th>Email</th>
                            <th>Gender</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cls.students.map((s, i) => {
                            const isChecked = selected.includes(s.id);
                            return (
                              <tr key={s.id} className={isChecked ? 'row--selected' : ''}>
                                <td>
                                  <button
                                    className="checkbox-btn"
                                    onClick={() => toggle(s.id)}
                                  >
                                    {isChecked ? (
                                      <FiCheckSquare size={18} />
                                    ) : (
                                      <FiSquare size={18} />
                                    )}
                                  </button>
                                </td>
                                <td>{i + 1}</td>
                                <td>{s.name}</td>
                                <td>{s.admissionNo}</td>
                                <td>{s.email || '—'}</td>
                                <td>{s.gender}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="btn btn--danger btn--sm"
                                    onClick={() =>
                                      setConfirmDelete({ mode: 'single', items: [s] })
                                    }
                                  >
                                    <FiTrash2 size={14} /> Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ---------- DELETE MODAL ---------- */}
      {confirmDelete && (
        <div
          className="modal-backdrop"
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>
                <FiAlertTriangle size={18} />{' '}
                {confirmDelete.mode === 'bulk'
                  ? `Remove ${confirmDelete.items.length} ${isTeachersTab ? 'Teachers' : 'Students'}?`
                  : `Remove ${isTeachersTab ? 'Teacher' : 'Student'}?`}
              </h3>
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                <FiX size={16} />
              </button>
            </div>

            {confirmDelete.mode === 'single' ? (
              <p style={{ marginBottom: 12 }}>
                Permanently remove <strong>{confirmDelete.items[0].name}</strong>?
              </p>
            ) : (
              <>
                <p style={{ marginBottom: 8 }}>
                  Permanently remove <strong>{confirmDelete.items.length}</strong>{' '}
                  {isTeachersTab ? 'teachers' : 'students'}?
                </p>
                <div className="confirm-list">
                  {confirmDelete.items.map((it) => (
                    <div key={it.id} className="confirm-list__row">
                      <strong>{it.name}</strong>
                      {it.staffNo && <> · {it.staffNo}</>}
                      {it.admissionNo && <> · {it.className} · {it.admissionNo}</>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <p
              className="muted"
              style={{ fontSize: 12, color: 'var(--red)', marginTop: 12 }}
            >
              {isTeachersTab
                ? "Their login, notes, assignments, quizzes and class sessions will be deleted. Classes they managed stay in the system with no teacher."
                : "Each student's login, results, fees, submissions, and comments will be deleted."}{' '}
              This cannot be undone.
            </p>

            <div className="modal__actions">
              <button
                className="btn btn--ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn--danger"
                onClick={performDelete}
                disabled={deleting}
              >
                <FiTrash2 size={14} />{' '}
                {deleting
                  ? 'Removing…'
                  : confirmDelete.mode === 'bulk'
                    ? `Yes, Remove ${confirmDelete.items.length}`
                    : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- MANAGE ASSIGNMENTS MODAL ---------- */}
      {manageTeacher && (
        <ManageAssignmentsModal
          teacher={manageTeacher}
          classes={classes}
          onClose={() => setManageTeacher(null)}
          onSaved={async (msg) => {
            setMessage(msg || 'Assignments updated');
            setManageTeacher(null);
            await load();
          }}
        />
      )}

      {/* ---------- EXPORT / PRINT MODAL ---------- */}
      {showExport && (
        <ExportCredentialsModal
          classes={classes}
          onClose={() => setShowExport(false)}
          onDone={(msg) => {
            setShowExport(false);
            setMessage(msg);
          }}
        />
      )}
    </div>
  );
}

/* ==================================================================
   MANAGE ASSIGNMENTS MODAL (unchanged)
   ================================================================== */
function ManageAssignmentsModal({ teacher, classes, onClose, onSaved }) {
  const [teacherType, setTeacherType] = useState(
    teacher.teacherType || 'class_teacher'
  );
  const [formClass, setFormClass] = useState(teacher.formClass || '');
  const [assignments, setAssignments] = useState(
    teacher.assignments?.length
      ? teacher.assignments.map((a) => ({ ...a }))
      : [{ className: '', subject: 'Mathematics' }]
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const addAssignment = () =>
    setAssignments((prev) => [...prev, { className: '', subject: 'Mathematics' }]);

  const updateAssignment = (i, patch) =>
    setAssignments((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const removeAssignment = (i) => {
    if (assignments.length === 1) return;
    setAssignments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    setErr('');
    if (teacherType === 'class_teacher' && !formClass.trim()) {
      return setErr('Class teachers must have a form class');
    }
    const cleaned = assignments
      .filter((a) => a.className?.trim() && a.subject?.trim())
      .map((a) => ({ className: a.className.trim(), subject: a.subject.trim() }));

    if (teacherType === 'subject_teacher' && cleaned.length === 0) {
      return setErr('Add at least one class + subject pair for a subject teacher');
    }

    setSaving(true);
    try {
      await api(`/admin/teachers/${teacher.id}/assignments`, {
        method: 'PATCH',
        body: JSON.stringify({
          teacherType,
          formClass: teacherType === 'class_teacher' ? formClass.trim() : null,
          assignments: cleaned,
        }),
      });
      await onSaved(`Assignments updated for ${teacher.name}`);
    } catch (ex) {
      setErr(ex.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const isClassTeacher = teacherType === 'class_teacher';

  return (
    <div className="modal-backdrop" onClick={() => !saving && onClose()}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3><FiSettings size={18} /> Manage Assignments</h3>
            <p className="muted">{teacher.name} · {teacher.staffNo}</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>
            <FiX size={16} />
          </button>
        </div>

        {err && (
          <div className="alert alert--error">
            <FiAlertTriangle size={16} /> {err}
          </div>
        )}

        <h4 className="enroll-section-title">Teacher Type</h4>
        <div className="teacher-type-toggle">
          <button
            type="button"
            className={`teacher-type-tile ${isClassTeacher ? 'teacher-type-tile--active' : ''}`}
            onClick={() => setTeacherType('class_teacher')}
            disabled={saving}
          >
            <FiUserCheck size={20} />
            <strong>Class Teacher</strong>
            <span className="muted">Owns one form class — any subject inside it</span>
          </button>
          <button
            type="button"
            className={`teacher-type-tile ${!isClassTeacher ? 'teacher-type-tile--active' : ''}`}
            onClick={() => setTeacherType('subject_teacher')}
            disabled={saving}
          >
            <FiLayers size={20} />
            <strong>Subject Teacher</strong>
            <span className="muted">Teaches specific subjects across multiple classes</span>
          </button>
        </div>

        {isClassTeacher && (
          <>
            <h4 className="enroll-section-title">Form Class</h4>
            <label style={{ marginBottom: 20 }}>
              Class they own
              <input
                value={formClass}
                onChange={(e) => setFormClass(e.target.value)}
                placeholder="JSS 2A"
                disabled={saving}
                list="classes-list"
              />
              <datalist id="classes-list">
                {classes.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
          </>
        )}

        <h4 className="enroll-section-title">
          <FiLayers size={12} style={{ marginRight: 6 }} />
          {isClassTeacher ? 'Subjects taught (optional)' : 'Class + Subject assignments'}
        </h4>

        <div className="assignments-editor">
          {assignments.map((a, i) => (
            <div className="assignment-row" key={i}>
              <input
                placeholder="Class name (e.g. JSS 1A)"
                value={a.className}
                onChange={(e) => updateAssignment(i, { className: e.target.value })}
                disabled={saving}
                list="classes-list"
              />
              <select
                value={a.subject}
                onChange={(e) => updateAssignment(i, { subject: e.target.value })}
                disabled={saving}
              >
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => removeAssignment(i)}
                disabled={assignments.length === 1 || saving}
              >
                <FiX size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={addAssignment}
            disabled={saving}
          >
            <FiPlus size={14} /> Add another
          </button>
        </div>

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            <FiCheck size={16} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================
   EXPORT / PRINT CREDENTIALS MODAL
   ================================================================== */
function ExportCredentialsModal({ classes, onClose, onDone }) {
  const [role, setRole] = useState('all');
  const [className, setClassName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const showClassFilter = role === 'all' || role === 'student';

  const fetchData = async (overrideRole) => {
    const useRole = overrideRole || role;
    const params = new URLSearchParams();
    params.set('role', useRole);
    if (showClassFilter && className) params.set('className', className);
    return api(`/admin/credentials?${params.toString()}`);
  };

  const downloadCSV = async (overrideRole) => {
    setErr('');
    setBusy(true);
    try {
      const data = await fetchData(overrideRole);
      if (!data.rows?.length) {
        setErr('No matching users to export');
        setBusy(false);
        return;
      }
      const csv = buildCredentialsCSV(data);
      const stamp = new Date().toISOString().slice(0, 10);
      const label = (overrideRole || role) === 'all' ? 'all' : (overrideRole || role);
      const cls = (showClassFilter && className) ? `-${className.replace(/\s+/g, '')}` : '';
      downloadCSVFile(csv, `credentials-${label}${cls}-${stamp}.csv`);
      onDone(`Downloaded ${data.total} credential${data.total === 1 ? '' : 's'} as CSV`);
    } catch (ex) {
      setErr(ex.message || 'Download failed');
      setBusy(false);
    }
  };

  const printSheet = async (overrideRole) => {
    setErr('');
    setBusy(true);
    try {
      const data = await fetchData(overrideRole);
      if (!data.rows?.length) {
        setErr('No matching users to print');
        setBusy(false);
        return;
      }
      const html = buildCredentialsPrintHTML(data);
      printViaIframe(html);
      onDone(
        `Print sheet opened for ${data.total} credential${data.total === 1 ? '' : 's'} — use your browser's Print dialog`
      );
    } catch (ex) {
      setErr(ex.message || 'Print failed');
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3><FiFilter size={18} /> Export / Print Credentials</h3>
            <p className="muted">Choose who to include, then download a CSV or print an A4 sheet</p>
          </div>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy}>
            <FiX size={16} />
          </button>
        </div>

        {err && (
          <div className="alert alert--error">
            <FiAlertTriangle size={16} /> {err}
          </div>
        )}

        <label>
          Who do you want?
          <select value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {showClassFilter && (
          <label>
            Class (optional)
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              disabled={busy}
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
        )}

        <div
          className="alert alert--info"
          style={{ fontSize: 12, marginTop: 4, flexDirection: 'column', alignItems: 'flex-start' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FiDownload size={14} /> <strong>CSV</strong> — opens in Excel / Google Sheets
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <FiPrinter size={14} /> <strong>Print</strong> — opens your browser's print dialog directly
          </div>
        </div>

        <div className="modal__actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => printSheet('all')}
            disabled={busy}
          >
            <FiPrinter size={14} /> Print Everyone
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => downloadCSV('all')}
            disabled={busy}
          >
            <FiDownload size={14} /> CSV Everyone
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => printSheet()}
            disabled={busy}
          >
            <FiPrinter size={14} /> Print
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => downloadCSV()}
            disabled={busy}
          >
            <FiDownload size={14} /> {busy ? 'Preparing…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}