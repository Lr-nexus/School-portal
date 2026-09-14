import { useEffect, useState } from 'react';
import { FiTrendingUp, FiEdit3, FiAward } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function AdminLMS() {
  const [data, setData] = useState(null);

  useEffect(() => { api('/admin/lms/performance').then(setData); }, []);
  if (!data) return <Loader />;

  const classAverage = data.students.length
    ? Math.round(data.students.reduce((s, x) => s + x.average, 0) / data.students.length)
    : 0;

  const totalSubmissions = data.students.reduce((s, x) => s + x.quizzesTaken, 0);

  return (
    <div>
      <PageHeader
        title="Student Performance"
        subtitle="Quiz & test performance across the school"
      />

      <div className="stats-grid">
        <StatCard label="Quizzes"        value={data.quizzes.length}  color="#2563eb" />
        <StatCard label="Submissions"    value={totalSubmissions}     color="#7c3aed" />
        <StatCard label="School Average" value={`${classAverage}%`}   color="#16a34a" />
      </div>

      <div className="card">
        <h3><FiTrendingUp size={16} /> Student Performance (Tabular)</h3>
        <table className="table table--striped">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Class</th>
              <th>Quizzes Taken</th>
              <th>Score</th>
              <th>Average</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s, i) => {
              const remark =
                s.average >= 75 ? 'Excellent' :
                s.average >= 60 ? 'Very Good' :
                s.average >= 50 ? 'Good' :
                s.average > 0  ? 'Needs Improvement' : 'No Attempts';

              return (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{s.name}</td>
                  <td>{s.className}</td>
                  <td>{s.quizzesTaken} / {s.totalQuizzes}</td>
                  <td>{s.score} / {s.totalQuestions}</td>
                  <td><strong>{s.average}%</strong></td>
                  <td>{remark}</td>
                </tr>
              );
            })}
            {!data.students.length && <tr><td colSpan="7">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3><FiEdit3 size={16} /> All Quizzes</h3>
        <table className="table table--striped">
          <thead>
            <tr>
              <th>#</th><th>Title</th><th>Subject</th><th>Class</th>
              <th>Questions</th><th>Submissions</th><th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {data.quizzes.map((q, i) => (
              <tr key={q.id}>
                <td>{i + 1}</td>
                <td>{q.title}</td>
                <td>{q.subject}</td>
                <td>{q.className}</td>
                <td>{q.questionCount}</td>
                <td>{q.submissionCount}</td>
                <td>{q.dueDate}</td>
              </tr>
            ))}
            {!data.quizzes.length && <tr><td colSpan="7">No quizzes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}