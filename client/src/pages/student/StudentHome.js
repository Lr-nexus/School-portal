import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiBarChart2, FiEdit3, FiBook } from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function StudentHome() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [results, setResults] = useState(null);
  const [fees, setFees] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    Promise.all([
      api('/students/me'),
      api('/students/me/results'),
      api('/students/me/fees'),
      api('/students/me/announcements')
    ])
      .then(([p, r, f, a]) => {
        setProfile(p); setResults(r); setFees(f); setAnnouncements(a);
      })
      .catch((e) => console.error(e));
  }, []);

  if (!profile) return <Loader />;

  const outstanding = fees.reduce((sum, f) => sum + f.balance, 0);

  return (
    <div>
      <div className="welcome-banner">
        <div>
          <h2>Welcome back, {profile.name.split(' ')[0]}</h2>
          <p>{profile.className} • {profile.admissionNo}</p>
        </div>
        <div className="welcome-banner__term">2024/2025 · First Term</div>
      </div>

      <div className="stats-grid">
        <StatCard label="Average Score"     value={`${results?.average ?? 0}%`} hint={`Grade ${results?.overallGrade ?? '-'}`} color="#2563eb" />
        <StatCard label="Subjects"          value={results?.subjects.length ?? 0} hint="This term" color="#7c3aed" />
        <StatCard label="Outstanding Fees"  value={`₦${outstanding.toLocaleString()}`} hint={outstanding > 0 ? 'Payment due' : 'All cleared'} color={outstanding > 0 ? '#dc2626' : '#16a34a'} />
        <StatCard label="Class"             value={profile.className} hint={profile.house} color="#0891b2" />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <Link to="/student/fees"    className="quick-action"><FiCreditCard /> Pay Fees / Receipt</Link>
            <Link to="/student/results" className="quick-action"><FiBarChart2 /> Check Results</Link>
            <Link to="/student/lms"     className="quick-action"><FiEdit3 />     Take a Quiz</Link>
            <Link to="/student/classes" className="quick-action"><FiBook />      View Timetable</Link>
          </div>
        </div>

        <div className="card">
          <h3>Announcements</h3>
          {announcements.map((a) => (
            <div key={a.id} className="announcement">
              <strong>{a.title}</strong>
              <p>{a.body}</p>
              <span>{a.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}