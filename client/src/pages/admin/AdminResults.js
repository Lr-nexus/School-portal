import { useEffect, useMemo, useState } from 'react';
import {
  FiArrowLeft, FiSearch, FiPrinter, FiUser,
  FiAward, FiTrendingUp, FiBookOpen
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function AdminResults() {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');

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
    } catch (err) {
      console.error(err);
    }
  };

  const backToList = () => {
    setSelected(null);
    setData(null);
  };

  /* ---------- unique class names ---------- */
  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.className).filter(Boolean))).sort(),
    [students]
  );

  /* ---------- filter students ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchesClass = classFilter === 'all' || s.className === classFilter;
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q);
      return matchesClass && matchesSearch;
    });
  }, [students, search, classFilter]);

  if (loading) return <Loader />;

  /* ==================================================================
     STEP 2 — single student's result sheet
  ================================================================== */
  if (selected) {
    if (!data) return <Loader text="Loading results..." />;

    const gradeColor =
      data.overallGrade === 'A' ? 'var(--green)' :
      data.overallGrade === 'B' ? 'var(--accent)' :
      data.overallGrade === 'C' ? 'var(--amber)' :
      data.overallGrade === 'F' ? 'var(--red)' : 'var(--muted)';

    return (
      <div>
        <PageHeader
          title="Result Sheet"
          subtitle={`${data.session} · ${data.term}`}
        >
          <div className="no-print" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn--ghost" onClick={() => window.print()}>
              <FiPrinter size={16} /> Print
            </button>
            <button className="btn btn--ghost" onClick={backToList}>
              <FiArrowLeft size={16} /> Back to Students
            </button>
          </div>
        </PageHeader>

        {/* Student banner */}
        <div className="report-head">
          <div className="report-head__student">
            <div className="report-head__avatar">
              {data.student.name.charAt(0)}
            </div>
            <div className="report-head__meta">
              <h2>{data.student.name}</h2>
              <p>
                {data.student.className} · {data.student.admissionNo}
              </p>
            </div>
          </div>
          <div className="report-head__grade">
            <div className="label">Overall</div>
            <div className="value" style={{ color: '#fff' }}>{data.overallGrade}</div>
            <div className="sub">{data.average}% average</div>
          </div>
        </div>

        {/* Stats */}
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

        {/* Breakdown table */}
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

  /* ==================================================================
     STEP 1 — pick a student
  ================================================================== */
  return (
    <div>
      <PageHeader
        title="Student Results"
        subtitle={`${students.length} student${students.length === 1 ? '' : 's'} — click to view their result sheet`}
      />

      {/* Search + class filter */}
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

      {/* Student cards */}
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
    </div>
  );
}