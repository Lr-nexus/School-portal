import { useEffect, useMemo, useState } from 'react';
import {
  FiUsers, FiSearch, FiMail, FiPhone, FiAlertCircle,
  FiChevronDown, FiChevronUp, FiUserCheck
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function TeacherStudents() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    api('/teachers/me/students')
      .then(setData)
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
  }, []);

  const students = data?.students || [];
  const classNames = data?.classNames || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesClass =
        classFilter === 'all' || s.className === classFilter;
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.guardianName || '').toLowerCase().includes(q);
      return matchesClass && matchesSearch;
    });
  }, [students, search, classFilter]);

  /* group by class */
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((s) => {
      const cls = s.className || 'Unassigned';
      if (!map[cls]) map[cls] = [];
      map[cls].push(s);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggle = (cls) =>
    setExpanded((prev) => ({ ...prev, [cls]: !prev[cls] }));

  const expandAll = () =>
    setExpanded(grouped.reduce((acc, [cls]) => ({ ...acc, [cls]: true }), {}));
  const collapseAll = () => setExpanded({});

  if (loading) return <Loader />;

  if (!classNames.length) {
    return (
      <div>
        <PageHeader
          title="My Students"
          subtitle="Students in the classes you manage"
        />
        <div className="card empty-state">
          <FiUsers size={32} />
          <p>You are not assigned to any class yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Ask the admin to assign you a form class.
          </p>
        </div>
      </div>
    );
  }

  const maleCount = students.filter((s) => s.gender === 'Male').length;
  const femaleCount = students.filter((s) => s.gender === 'Female').length;

  return (
    <div>
      <PageHeader
        title="My Students"
        subtitle={
          data.formClass
            ? `Students in ${data.formClass}`
            : `${classNames.join(', ')}`
        }
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

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Students" value={students.length} color="#2563eb" />
        <StatCard label="Male" value={maleCount} color="#0891b2" />
        <StatCard label="Female" value={femaleCount} color="#7c3aed" />
        <StatCard
          label="Classes"
          value={classNames.length}
          hint={classNames.join(', ')}
          color="#16a34a"
        />
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filters-bar__search">
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Search by name, admission no, email, or guardian…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {classNames.length > 1 && (
          <div className="filters-bar__select">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="all">All my classes</option>
              {classNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!filtered.length && (
        <div className="card empty-state">
          <FiUsers size={32} />
          <p>
            {students.length === 0
              ? 'No students in your class yet.'
              : 'No students match your search.'}
          </p>
        </div>
      )}

      {/* Grouped by class */}
      {grouped.map(([className, list]) => {
        const isOpen = expanded[className] !== false; // open by default
        return (
          <div key={className} className="class-card class-card--open">
            <button
              className="class-card__head"
              onClick={() => toggle(className)}
            >
              <div className="class-card__title">
                <div className="class-card__badge">{className}</div>
                <div className="class-card__meta">
                  <span>
                    <FiUsers size={13} /> {list.length} student
                    {list.length === 1 ? '' : 's'}
                  </span>
                  <span className="muted">
                    <FiUserCheck size={13} /> You are the form teacher
                  </span>
                </div>
              </div>
              <span className="class-card__chevron">
                {isOpen ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
              </span>
            </button>

            {isOpen && (
              <div className="class-card__body class-card__body--flat">
                <table className="table table--striped">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Admission No</th>
                      <th>Gender</th>
                      <th>Email</th>
                      <th>Guardian</th>
                      <th>Guardian Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s, i) => (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.admissionNo}</td>
                        <td>{s.gender || '—'}</td>
                        <td>
                          {s.email ? (
                            <a href={`mailto:${s.email}`} className="class-teacher__contact">
                              <FiMail size={12} /> {s.email}
                            </a>
                          ) : '—'}
                        </td>
                        <td>{s.guardianName || '—'}</td>
                        <td>
                          {s.guardianPhone ? (
                            <span className="class-teacher__contact">
                              <FiPhone size={12} /> {s.guardianPhone}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}