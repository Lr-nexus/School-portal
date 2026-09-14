import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

export default function StudentClasses() {
  const [data, setData] = useState(null);

  useEffect(() => { api('/students/me/classes').then(setData); }, []);

  if (!data) return <Loader />;

  return (
    <div>
      <PageHeader title="My Classes" subtitle={`${data.name || '—'} · Class timetable and subjects`} />

      <div className="card">
        <h3>Subjects Offered</h3>
        <div className="chips">
          {data.subjects?.map((s) => <span className="chip" key={s}>{s}</span>)}
        </div>
      </div>

      <div className="card">
        <h3>Weekly Timetable</h3>
        <table className="table table--striped">
          <thead>
            <tr><th>Day</th><th>Subject</th><th>Time</th><th>Teacher</th></tr>
          </thead>
          <tbody>
            {data.schedule?.map((s, i) => (
              <tr key={i}>
                <td>{s.day}</td>
                <td>{s.subject}</td>
                <td>{s.time}</td>
                <td>{s.teacher}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Classmates</h3>
        <table className="table table--striped">
          <thead><tr><th>#</th><th>Name</th><th>Admission No</th></tr></thead>
          <tbody>
            {data.classmates?.map((c, i) => (
              <tr key={c.id}>
                <td>{i + 1}</td>
                <td>{c.name}</td>
                <td>{c.admissionNo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}