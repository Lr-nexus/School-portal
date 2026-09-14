import { useEffect, useState } from 'react';
import { FiArrowLeft } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function AdminResults() {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <Loader />;

  // ---------- STEP 2: single student's results ----------
  if (selected) {
    if (!data) return <Loader text="Loading results..." />;

    return (
      <div>
        <PageHeader
          title={`${data.student.name}'s Results`}
          subtitle={`${data.student.className} · ${data.student.admissionNo} · ${data.session} (${data.term})`}
        >
          <button className="btn btn--ghost" onClick={backToList}>
            <FiArrowLeft size={16} /> Back to Students
          </button>
        </PageHeader>

        <div className="stats-grid">
          <StatCard label="Average"       value={`${data.average}%`}   color="#2563eb" />
          <StatCard label="Overall Grade" value={data.overallGrade}    color="#16a34a" />
          <StatCard label="Subjects"      value={data.subjects.length} color="#7c3aed" />
        </div>

        <div className="card">
          <h3>Subject Breakdown</h3>
          <table className="table table--striped">
            <thead>
              <tr>
                <th>Subject</th>
                <th>CA (30)</th>
                <th>Exam (70)</th>
                <th>Total</th>
                <th>Grade</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {data.subjects.map((r) => (
                <tr key={r.id}>
                  <td>{r.subject}</td>
                  <td>{r.ca}</td>
                  <td>{r.exam}</td>
                  <td><strong>{r.total}</strong></td>
                  <td><span className={`grade grade--${r.grade}`}>{r.grade}</span></td>
                  <td>{r.remark}</td>
                </tr>
              ))}
              {!data.subjects.length && (
                <tr><td colSpan="6">No results recorded for this student yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ---------- STEP 1: list of students ----------
  return (
    <div>
      <PageHeader
        title="Student Results"
        subtitle="Click on any student to view their full result sheet"
      />

      <div className="grid-3">
        {students.map((s) => (
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
        {!students.length && <p>No students enrolled yet.</p>}
      </div>
    </div>
  );
}