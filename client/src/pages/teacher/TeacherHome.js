import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiEdit3, FiBook } from 'react-icons/fi';
import { api } from '../../api/api';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function TeacherHome() {
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    Promise.all([
      api('/teachers/me'),
      api('/teachers/me/classes'),
      api('/lms/my-quizzes')
    ]).then(([p, c, q]) => { setProfile(p); setClasses(c); setQuizzes(q); });
  }, []);

  if (!profile) return <Loader />;

  const totalStudents = classes.reduce((sum, c) => sum + c.students.length, 0);

  return (
    <div>
      <div className="welcome-banner">
        <div>
          <h2>Good day, {profile.name}</h2>
          <p>{profile.formClass} Form Teacher · {profile.staffNo}</p>
        </div>
        <div className="welcome-banner__term">{profile.subjects.join(' · ')}</div>
      </div>

      <div className="stats-grid">
        <StatCard label="My Classes"       value={classes.length}    color="#2563eb" />
        <StatCard label="My Students"      value={totalStudents}     color="#7c3aed" />
        <StatCard label="Quizzes Created"  value={quizzes.length}    color="#0891b2" />
        <StatCard label="Form Class"       value={profile.formClass} color="#16a34a" />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <Link to="/teacher/lms"     className="quick-action"><FiEdit3 /> Create a Quiz / Test</Link>
            <Link to="/teacher/classes" className="quick-action"><FiBook />  View My Classes</Link>
          </div>
        </div>

        <div className="card">
          <h3>Class Overview</h3>
          <table className="table table--striped">
            <thead><tr><th>Class</th><th>Subjects</th><th>Students</th></tr></thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.subjects.join(', ')}</td>
                  <td>{c.students.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}