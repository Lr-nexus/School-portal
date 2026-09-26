import { useEffect, useMemo, useState } from 'react';
import {
  FiAward, FiTrendingUp, FiEdit3, FiClipboard,
  FiSearch, FiAlertCircle, FiCheckCircle, FiClock,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function StudentGrades() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [tab, setTab] = useState('quizzes');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api('/students/me/grades')
      .then(setData)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredQuizzes = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.quizGrades;
    return data.quizGrades.filter(
      (x) =>
        x.title.toLowerCase().includes(q) ||
        x.subject.toLowerCase().includes(q) ||
        x.teacherName.toLowerCase().includes(q)
    );
  }, [data, search]);

  const filteredAssignments = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.assignmentGrades;
    return data.assignmentGrades.filter(
      (x) =>
        x.title.toLowerCase().includes(q) ||
        x.subject.toLowerCase().includes(q) ||
        x.teacherName.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading) return <Loader />;
  if (errorMsg) {
    return (
      <div>
        <PageHeader title="My Grades" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const s = data.summary;
  const overallColor =
    s.overallAverage >= 75 ? '#16a34a' :
    s.overallAverage >= 55 ? '#2563eb' :
    s.overallAverage >= 40 ? '#f59e0b' : '#dc2626';

  return (
    <div>
      <PageHeader
        title="My Grades"
        subtitle="Every quiz and assignment result in one place"
      />

      {/* ---------- Summary ---------- */}
      <div className="stats-grid">
        <StatCard
          label="Overall Average"
          value={`${s.overallAverage}%`}
          hint={s.totalGraded > 0 ? `Grade ${s.overallGrade}` : 'No grades yet'}
          color={overallColor}
        />
        <StatCard
          label="Quiz Average"
          value={`${s.quizAverage}%`}
          hint={`${s.quizCount} quiz${s.quizCount === 1 ? '' : 'zes'} taken`}
          color="#0891b2"
        />
        <StatCard
          label="Assignment Average"
          value={`${s.assignmentAverage}%`}
          hint={
            s.assignmentCount > 0
              ? `${s.assignmentsGraded} of ${s.assignmentCount} graded`
              : 'No submissions yet'
          }
          color="#7c3aed"
        />
        <StatCard
          label="Total Graded"
          value={s.totalGraded}
          hint="Quizzes + assignments"
          color="#16a34a"
        />
      </div>

      {/* ---------- Tabs + search ---------- */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'quizzes' ? 'tab--active' : ''}`}
          onClick={() => setTab('quizzes')}
        >
          <FiEdit3 size={16} /> Quizzes ({s.quizCount})
        </button>
        <button
          type="button"
          className={`tab ${tab === 'assignments' ? 'tab--active' : ''}`}
          onClick={() => setTab('assignments')}
        >
          <FiClipboard size={16} /> Assignments ({s.assignmentCount})
        </button>
      </div>

      <div className="filters-bar">
        <div className="filters-bar__search">
          <FiSearch size={16} />
          <input
            type="text"
            placeholder={`Search ${tab === 'quizzes' ? 'quizzes' : 'assignments'}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ---------- Quizzes table ---------- */}
      {tab === 'quizzes' && (
        <div className="card">
          {filteredQuizzes.length === 0 ? (
            <div className="empty-state">
              <FiEdit3 size={32} />
              <p>
                {data.quizGrades.length === 0
                  ? 'You have not taken any quizzes yet.'
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
                    <th>Teacher</th>
                    <th className="right">Score</th>
                    <th className="right">%</th>
                    <th>Grade</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuizzes.map((q, i) => (
                    <tr key={q.id}>
                      <td>{i + 1}</td>
                      <td><strong>{q.title}</strong></td>
                      <td>{q.subject}</td>
                      <td className="muted">{q.teacherName}</td>
                      <td className="right">
                        {q.score} / {q.total}
                      </td>
                      <td className="right">
                        <strong>{q.percentage}%</strong>
                      </td>
                      <td>
                        <span className={`grade grade--${q.grade}`}>{q.grade}</span>
                      </td>
                      <td className="muted">{q.date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------- Assignments table ---------- */}
      {tab === 'assignments' && (
        <div className="card">
          {filteredAssignments.length === 0 ? (
            <div className="empty-state">
              <FiClipboard size={32} />
              <p>
                {data.assignmentGrades.length === 0
                  ? 'You have not submitted any assignments yet.'
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
                    <th className="right">Score</th>
                    <th className="right">%</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignments.map((a, i) => (
                    <tr key={a.id}>
                      <td>{i + 1}</td>
                      <td><strong>{a.title}</strong></td>
                      <td>{a.subject}</td>
                      <td className="right">
                        {a.graded ? `${a.score} / ${a.totalMarks}` : '—'}
                      </td>
                      <td className="right">
                        {a.graded ? <strong>{a.percentage}%</strong> : '—'}
                      </td>
                      <td>
                        {a.graded ? (
                          <span className={`grade grade--${a.grade}`}>{a.grade}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        {a.graded ? (
                          <span className="pill pill--paid">
                            <FiCheckCircle size={11} /> Graded
                          </span>
                        ) : (
                          <span className="pill pill--partial">
                            <FiClock size={11} /> Awaiting
                          </span>
                        )}
                      </td>
                      <td className="muted" style={{ maxWidth: 220, fontSize: 12 }}>
                        {a.feedback || '—'}
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