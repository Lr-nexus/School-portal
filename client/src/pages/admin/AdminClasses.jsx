import { useEffect, useState } from 'react';
import {
  FiLayers, FiUsers, FiUserCheck, FiChevronDown, FiChevronUp,
  FiMail, FiPhone, FiBook, FiSearch, FiAlertCircle
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function AdminClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    api('/admin/classes')
      .then(setClasses)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const expandAll = () =>
    setExpanded(classes.reduce((acc, c) => ({ ...acc, [c.id]: true }), {}));

  const collapseAll = () => setExpanded({});

  if (loading) return <Loader />;

  const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);
  const assignedTeachers = classes.filter((c) => c.teacher).length;

  const q = search.trim().toLowerCase();
  const filtered = !q
    ? classes
    : classes.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.teacher?.name || '').toLowerCase().includes(q) ||
          c.students.some((s) => s.name.toLowerCase().includes(q))
      );

  return (
    <div>
      <PageHeader
        title="Classes"
        subtitle="Every class with its form teacher and student roster"
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={expandAll}>
            Expand all
          </button>
          <button className="btn btn--ghost btn--sm" onClick={collapseAll}>
            Collapse all
          </button>
        </div>
      </PageHeader>

      {message && (
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {message}
        </div>
      )}

      <div className="stats-grid">
        <StatCard label="Classes" value={classes.length} color="#2563eb" />
        <StatCard label="Students" value={totalStudents} color="#7c3aed" />
        <StatCard
          label="Assigned Teachers"
          value={`${assignedTeachers} / ${classes.length}`}
          color="#0d9488"
        />
      </div>

      <div className="filters-bar">
        <div className="filters-bar__search">
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Search by class, teacher, or student name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!filtered.length && (
        <div className="card empty-state">
          <FiLayers size={32} />
          <p>
            {classes.length === 0
              ? 'No classes created yet.'
              : 'No classes match your search.'}
          </p>
        </div>
      )}

      <div className="class-list">
        {filtered.map((c) => {
          const isOpen = !!expanded[c.id];
          return (
            <div key={c.id} className={`class-card ${isOpen ? 'class-card--open' : ''}`}>
              <button
                className="class-card__head"
                onClick={() => toggle(c.id)}
              >
                <div className="class-card__title">
                  <div className="class-card__badge">{c.name}</div>
                  <div className="class-card__meta">
                    {c.teacher ? (
                      <span>
                        <FiUserCheck size={13} /> {c.teacher.name}
                      </span>
                    ) : (
                      <span className="muted">
                        <FiUserCheck size={13} /> No form teacher assigned
                      </span>
                    )}
                    <span className="muted">
                      <FiUsers size={13} /> {c.students.length} student
                      {c.students.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <span className="class-card__chevron">
                  {isOpen ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                </span>
              </button>

              {isOpen && (
                <div className="class-card__body">
                  <div className="class-teacher">
                    <h4>Form Teacher</h4>
                    {c.teacher ? (
                      <div className="class-teacher__row">
                        <div className="avatar avatar--sm">
                          {c.teacher.name.charAt(0)}
                        </div>
                        <div className="class-teacher__info">
                          <strong>{c.teacher.name}</strong>
                          <span className="muted" style={{ fontSize: 12 }}>
                            {c.teacher.staffNo}
                          </span>
                        </div>
                        <div className="class-teacher__contacts">
                          <a
                            href={`mailto:${c.teacher.email}`}
                            className="class-teacher__contact"
                          >
                            <FiMail size={13} /> {c.teacher.email}
                          </a>
                          {c.teacher.phone && (
                            <span className="class-teacher__contact">
                              <FiPhone size={13} /> {c.teacher.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="muted" style={{ fontSize: 13 }}>
                        No form teacher assigned to this class yet.
                      </p>
                    )}
                    {c.teacher?.subjects?.length > 0 && (
                      <div className="class-teacher__subjects">
                        <FiBook size={13} />
                        {c.teacher.subjects.map((s) => (
                          <span className="chip" key={s}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="class-roster">
                    <h4>Students ({c.students.length})</h4>
                    {c.students.length === 0 ? (
                      <p className="muted" style={{ fontSize: 13 }}>
                        No students in this class yet.
                      </p>
                    ) : (
                      <table className="table table--striped">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Admission No</th>
                            <th>Gender</th>
                            <th>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.students.map((s, i) => (
                            <tr key={s.id}>
                              <td>{i + 1}</td>
                              <td>{s.name}</td>
                              <td>{s.admissionNo}</td>
                              <td>{s.gender || '—'}</td>
                              <td>{s.email || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}