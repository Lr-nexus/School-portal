import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function StudentResults() {
  const [data, setData] = useState(null);

  useEffect(() => { api('/students/me/results').then(setData); }, []);

  if (!data) return <Loader />;

  return (
    <div>
      <PageHeader title="Check Results" subtitle={`${data.session} · ${data.term}`} />

      <div className="stats-grid">
        <StatCard label="Average" value={`${data.average}%`} color="#2563eb" />
        <StatCard label="Overall Grade" value={data.overallGrade} color="#16a34a" />
        <StatCard label="Subjects" value={data.subjects.length} color="#7c3aed" />
      </div>

      <div className="card">
        <table className="table table--striped">
          <thead>
            <tr>
              <th>Subject</th><th>CA (30)</th><th>Exam (70)</th>
              <th>Total</th><th>Grade</th><th>Remark</th>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}