import { useEffect, useMemo, useState } from 'react';
import {
  FiUsers, FiUserCheck, FiTrash2, FiX, FiAlertTriangle,
  FiSearch, FiCheckSquare, FiSquare, FiMinusSquare,
  FiChevronDown, FiChevronUp, FiMail, FiLayers,
  FiPlus, FiSettings, FiCheck,
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

  const [expanded, setExpanded] = useState({});

  /* ---------- load ---------- */
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

  /* ---------- filtering ---------- */
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

  /* ---------- group students by class ---------- */
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
      />

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
    </div>
  );
}

/* ==================================================================
   MANAGE ASSIGNMENTS MODAL
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
            <p className="muted">
              {teacher.name} · {teacher.staffNo}
            </p>
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

        {/* ---------- TYPE TOGGLE ---------- */}
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

        {/* ---------- FORM CLASS for class teachers ---------- */}
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
            <p className="muted" style={{ fontSize: 12, marginTop: -10, marginBottom: 16 }}>
              Class teachers can post any subject inside their own form class.
              Their <code>teacher_assignments</code> list below is optional —
              used to display the subjects they teach.
            </p>
          </>
        )}

        {/* ---------- ASSIGNMENTS EDITOR ---------- */}
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
                title="Remove"
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