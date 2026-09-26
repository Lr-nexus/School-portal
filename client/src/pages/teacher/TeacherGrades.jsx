import { useEffect, useMemo, useState } from 'react';
import {
  FiUsers, FiEdit3, FiClipboard, FiSearch,
  FiAlertCircle, FiChevronDown, FiChevronUp,
  FiTrendingUp, FiAward, FiCheckCircle, FiClock,
  FiPrinter,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function TeacherGrades() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState('students');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    api('/teachers/me/grades')
      .then(setData)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.students.filter((s) => {
      const matchesClass = classFilter === 'all' || s.className === classFilter;
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q);
      return matchesClass && matchesSearch;
    });
  }, [data, search, classFilter]);

  const filteredQuizzes = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.quizzes;
    return data.quizzes.filter(
      (x) =>
        x.title.toLowerCase().includes(q) ||
        x.subject.toLowerCase().includes(q) ||
        x.className.toLowerCase().includes(q)
    );
  }, [data, search]);

  const filteredAssignments = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.assignments;
    return data.assignments.filter(
      (x) =>
        x.title.toLowerCase().includes(q) ||
        x.subject.toLowerCase().includes(q) ||
        x.className.toLowerCase().includes(q)
    );
  }, [data, search]);

  const toggle = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <Loader />;
  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Student Grades" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const overallAvg =
    data.students.length > 0
      ? Math.round(
          data.students.reduce((sum, s) => sum + s.summary.overallAverage, 0) /
            data.students.length
        )
      : 0;

  const totalSubmissions =
    data.quizzes.reduce((sum, q) => sum + q.submissions, 0) +
    data.assignments.reduce((sum, a) => sum + a.submissions, 0);

  return (
    <div>
      <PageHeader
        title="Student Grades"
        subtitle="Track every quiz and assignment result across your classes"
      />

      {/* ---------- Summary ---------- */}
      <div className="stats-grid">
        <StatCard
          label="Students"
          value={data.students.length}
          hint={data.classNames.join(', ') || 'No classes'}
          color="#2563eb"
        />
        <StatCard
          label="Class Average"
          value={`${overallAvg}%`}
          hint="Across all gradeable work"
          color="#16a34a"
        />
        <StatCard
          label="My Quizzes"
          value={data.quizzes.length}
          hint={`${data.quizzes.reduce((s, q) => s + q.submissions, 0)} submissions`}
          color="#0891b2"
        />
        <StatCard
          label="My Assignments"
          value={data.assignments.length}
          hint={`${totalSubmissions} total submissions`}
          color="#7c3aed"
        />
      </div>

      {/* ---------- Tabs ---------- */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'students' ? 'tab--active' : ''}`}
          onClick={() => setTab('students')}
        >
          <FiUsers size={16} /> Students ({data.students.length})
        </button>
        <button
          type="button"
          className={`tab ${tab === 'quizzes' ? 'tab--active' : ''}`}
          onClick={() => setTab('quizzes')}
        >
          <FiEdit3 size={16} /> My Quizzes ({data.quizzes.length})
        </button>
        <button
          type="button"
          className={`tab ${tab === 'assignments' ? 'tab--active' : ''}`}
          onClick={() => setTab('assignments')}
        >
          <FiClipboard size={16} /> My Assignments ({data.assignments.length})
        </button>
      </div>

      {/* ---------- Filters ---------- */}
      <div className="filters-bar">
        <div className="filters-bar__search">
          <FiSearch size={16} />
          <input
            type="text"
            placeholder={
              tab === 'students'
                ? 'Search students by name or admission no…'
                : `Search ${tab}…`
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {tab === 'students' && data.classNames.length > 1 && (
          <div className="filters-bar__select">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="all">All my classes</option>
              {data.classNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ---------- Students tab ---------- */}
      {tab === 'students' && (
        <>
          {filteredStudents.length === 0 && (
            <div className="card empty-state">
              <FiUsers size={32} />
              <p>
                {data.students.length === 0
                  ? 'No students in your classes yet.'
                  : 'No students match your filters.'}
              </p>
            </div>
          )}

          {filteredStudents.map((s) => {
            const isOpen = !!expanded[s.id];
            return (
              <div
                key={s.id}
                className={`grade-student-card ${isOpen ? 'grade-student-card--open' : ''}`}
              >
                <button
                  type="button"
                  className="grade-student-card__head"
                  onClick={() => toggle(s.id)}
                >
                  <div className="avatar avatar--sm">{s.name.charAt(0)}</div>
                  <div className="grade-student-card__info">
                    <strong>{s.name}</strong>
                    <span className="muted">
                      {s.className} · {s.admissionNo}
                    </span>
                  </div>

                  <div className="grade-student-card__stats">
                    <div>
                      <span className="grade-student-card__stat-label">Quiz</span>
                      <strong>{s.summary.quizAverage}%</strong>
                    </div>
                    <div>
                      <span className="grade-student-card__stat-label">Assign.</span>
                      <strong>{s.summary.assignmentAverage}%</strong>
                    </div>
                    <div>
                      <span className="grade-student-card__stat-label">Overall</span>
                      <strong className="grade-student-card__stat-main">
                        {s.summary.overallAverage}%
                      </strong>
                    </div>
                  </div>

                  <span className="grade-student-card__chevron">
                    {isOpen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                  </span>
                </button>

                {isOpen && (
                  <div className="grade-student-card__body">
                    <div className="grade-student-card__meta">
                      <span>
                        <FiEdit3 size={12} /> {s.summary.quizzesTaken} quizzes taken
                      </span>
                      <span>
                        <FiClipboard size={12} />{' '}
                        {s.summary.assignmentsGraded} of{' '}
                        {s.summary.assignmentsSubmitted} assignments graded
                      </span>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() =>
                          navigate(`/print/report-card/${s.id}`)
                        }
                      >
                        <FiPrinter size={12} /> Report Card
                      </button>
                    </div>

                    {/* Quizzes */}
                    <div className="grade-detail-section">
                      <h4>
                        <FiEdit3 size={13} /> Quiz results
                      </h4>
                      {s.quizGrades.length === 0 ? (
                        <p className="muted" style={{ fontSize: 13 }}>
                          No quizzes taken yet.
                        </p>
                      ) : (
                        <table className="table table--striped">
                          <thead>
                            <tr>
                              <th>Quiz</th>
                              <th>Subject</th>
                              <th className="right">Score</th>
                              <th className="right">%</th>
                              <th>Grade</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.quizGrades.map((q, i) => (
                              <tr key={i}>
                                <td>{q.title}</td>
                                <td className="muted">{q.subject}</td>
                                <td className="right">
                                  {q.score} / {q.total}
                                </td>
                                <td className="right">
                                  <strong>{q.percentage}%</strong>
                                </td>
                                <td>
                                  <span className={`grade grade--${q.grade}`}>
                                    {q.grade}
                                  </span>
                                </td>
                                <td className="muted">{q.date || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Assignments */}
                    <div className="grade-detail-section">
                      <h4>
                        <FiClipboard size={13} /> Assignment results
                      </h4>
                      {s.assignmentGrades.length === 0 ? (
                        <p className="muted" style={{ fontSize: 13 }}>
                          No assignments submitted yet.
                        </p>
                      ) : (
                        <table className="table table--striped">
                          <thead>
                            <tr>
                              <th>Assignment</th>
                              <th>Subject</th>
                              <th className="right">Score</th>
                              <th className="right">%</th>
                              <th>Grade</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.assignmentGrades.map((a, i) => (
                              <tr key={i}>
                                <td>{a.title}</td>
                                <td className="muted">{a.subject}</td>
                                <td className="right">
                                  {a.graded ? `${a.score} / ${a.totalMarks}` : '—'}
                                </td>
                                <td className="right">
                                  {a.graded ? <strong>{a.percentage}%</strong> : '—'}
                                </td>
                                <td>
                                  {a.graded ? (
                                    <span className={`grade grade--${a.grade}`}>
                                      {a.grade}
                                    </span>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                                <td>
                                  {a.graded ? (
                                    <span className="pill pill--paid">
                                      <FiCheckCircle size={10} /> Graded
                                    </span>
                                  ) : (
                                    <span className="pill pill--partial">
                                      <FiClock size={10} /> Awaiting
                                    </span>
                                  )}
                                </td>
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
        </>
      )}

      {/* ---------- Quizzes tab ---------- */}
      {tab === 'quizzes' && (
        <div className="card">
          {filteredQuizzes.length === 0 ? (
            <div className="empty-state">
              <FiEdit3 size={32} />
              <p>
                {data.quizzes.length === 0
                  ? 'You have not created any quizzes yet.'
                  : 'No quizzes match your search.'}
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Quiz</th>
                    <th>Subject</th>
                    <th>Class</th>
                    <th className="right">Submissions</th>
                    <th className="right">Avg Score</th>
                    <th>Due</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuizzes.map((q, i) => (
                    <tr key={q.id}>
                      <td>{i + 1}</td>
                      <td><strong>{q.title}</strong></td>
                      <td>{q.subject}</td>
                      <td>{q.className}</td>
                      <td className="right">{q.submissions}</td>
                      <td className="right">
                        <span
                          className={`grade grade--${
                            q.averageScore >= 75 ? 'A' :
                            q.averageScore >= 65 ? 'B' :
                            q.averageScore >= 55 ? 'C' :
                            q.averageScore >= 45 ? 'D' :
                            q.averageScore >= 40 ? 'E' : 'F'
                          }`}
                        >
                          {q.averageScore}%
                        </span>
                      </td>
                      <td className="muted">{q.dueDate || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => navigate('/teacher/lms')}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------- Assignments tab ---------- */}
      {tab === 'assignments' && (
        <div className="card">
          {filteredAssignments.length === 0 ? (
            <div className="empty-state">
              <FiClipboard size={32} />
              <p>
                {data.assignments.length === 0
                  ? 'You have not created any assignments yet.'
                  : 'No assignments match your search.'}
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--striped">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Assignment</th>
                    <th>Subject</th>
                    <th>Class</th>
                    <th className="right">Submissions</th>
                    <th className="right">Graded</th>
                    <th className="right">Avg Score</th>
                    <th>Due</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a, i) => (
                    <tr key={a.id}>
                      <td>{i + 1}</td>
                      <td><strong>{a.title}</strong></td>
                      <td>{a.subject}</td>
                      <td>{a.className}</td>
                      <td className="right">{a.submissions}</td>
                      <td className="right">
                        <span
                          className={`pill ${
                            a.graded === a.submissions && a.submissions > 0
                              ? 'pill--paid'
                              : a.graded > 0
                                ? 'pill--partial'
                                : 'pill--unpaid'
                          }`}
                        >
                          {a.graded} / {a.submissions}
                        </span>
                      </td>
                      <td className="right">
                        <span
                          className={`grade grade--${
                            a.averageScore >= 75 ? 'A' :
                            a.averageScore >= 65 ? 'B' :
                            a.averageScore >= 55 ? 'C' :
                            a.averageScore >= 45 ? 'D' :
                            a.averageScore >= 40 ? 'E' : 'F'
                          }`}
                        >
                          {a.averageScore}%
                        </span>
                      </td>
                      <td className="muted">{a.dueDate || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={() => navigate('/teacher/assignments')}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}