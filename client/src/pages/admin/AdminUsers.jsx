import { useEffect, useMemo, useState } from 'react';
import {
  FiUsers, FiUserCheck, FiTrash2, FiX, FiAlertTriangle,
  FiSearch, FiCheckSquare, FiSquare, FiMinusSquare,
  FiChevronDown, FiChevronUp, FiMail
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function AdminUsers() {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('teachers'); // 'teachers' | 'students'

  // Filtering
  const [teacherSearch, setTeacherSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Selection + delete
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Expanded class sections (students tab)
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    try {
      const [t, s] = await Promise.all([
        api('/admin/teachers'),
        api('/admin/students')
      ]);
      setTeachers(t);
      setStudents(s);
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ---------- teacher filtering ---------- */
  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.staffNo.toLowerCase().includes(q) ||
        (t.formClass || '').toLowerCase().includes(q) ||
        t.subjects.join(' ').toLowerCase().includes(q)
    );
  }, [teachers, teacherSearch]);

  /* ---------- student filtering + grouping ---------- */
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
    const map = {};
    filteredStudents.forEach((s) => {
      const cls = s.className || 'Unassigned';
      if (!map[cls]) map[cls] = [];
      map[cls].push(s);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([className, list]) => {
        const teacher = teachers.find((t) => t.formClass === className);
        return { className, students: list, teacher };
      });
  }, [filteredStudents, teachers]);

  const toggleExpanded = (cls) =>
    setExpanded((prev) => ({ ...prev, [cls]: !prev[cls] }));

  const expandAllClasses = () =>
    setExpanded(studentsByClass.reduce((acc, c) => ({ ...acc, [c.className]: true }), {}));

  const collapseAllClasses = () => setExpanded({});

  /* ---------- selection ---------- */
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

  /* ---------- delete ---------- */
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
          body: JSON.stringify({ ids })
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
      />

      {message && <div className="alert alert--info">{message}</div>}

      <div className="stats-grid">
        <StatCard label="Teachers" value={teachers.length} color="#7c3aed" />
        <StatCard label="Students" value={students.length} color="#2563eb" />
        <StatCard
          label="Classes"
          value={studentsByClass.length}
          color="#0d9488"
        />
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

      {/* Bulk delete bar */}
      {selected.length > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar__count">
            {selected.length} selected
          </span>
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
                <th>Email</th>
                <th>Subjects</th>
                <th>Form Class</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((t, i) => {
                const isChecked = selected.includes(t.id);
                return (
                  <tr key={t.id} className={isChecked ? 'row--selected' : ''}>
                    <td>
                      <button className="checkbox-btn" onClick={() => toggle(t.id)}>
                        {isChecked ? <FiCheckSquare size={18} /> : <FiSquare size={18} />}
                      </button>
                    </td>
                    <td>{i + 1}</td>
                    <td>{t.name}</td>
                    <td>{t.staffNo}</td>
                    <td>{t.email}</td>
                    <td>{t.subjects.join(', ') || '—'}</td>
                    <td>{t.formClass}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn--danger btn--sm"
                        onClick={() => setConfirmDelete({ mode: 'single', items: [t] })}
                      >
                        <FiTrash2 size={14} /> Remove
                      </button>
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
          STUDENTS TAB — grouped by class
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
              <FiUsers size={32} />
              <p>
                {students.length === 0
                  ? 'No students enrolled yet.'
                  : 'No students match your search.'}
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
                  Permanently remove{' '}
                  <strong>{confirmDelete.items.length}</strong>{' '}
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
                : "Each student's login, results, fees, submissions, and comments will be deleted."}
              {' '}This cannot be undone.
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
    </div>
  );
}