import { useEffect, useState } from 'react';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';

export default function TeacherClasses() {
  const [classes, setClasses] = useState(null);

  useEffect(() => { api('/teachers/me/classes').then(setClasses); }, []);
  if (!classes) return <Loader />;

  return (
    <div>
      <PageHeader title="My Classes" subtitle="Classes you teach and the students in them" />

      {classes.map((c) => (
        <div className="card" key={c.id}>
          <h3>{c.name}</h3>
          <div className="chips">
            {c.subjects.map((s) => <span className="chip" key={s}>{s}</span>)}
          </div>

          <table className="table table--striped">
            <thead><tr><th>#</th><th>Student</th><th>Admission No</th></tr></thead>
            <tbody>
              {c.students.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>{s.name}</td>
                  <td>{s.admissionNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}