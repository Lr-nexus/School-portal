import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiBarChart2, FiTrendingUp, FiUsers, FiUserCheck } from 'react-icons/fi';
import { api } from '../../api/api';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function AdminHome() {
  const [stats, setStats] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const load = () => api('/admin/stats').then(setStats);
  useEffect(() => { load(); }, []);

  const postAnnouncement = async (e) => {
    e.preventDefault();
    await api('/admin/announcements', { method: 'POST', body: JSON.stringify({ title, body }) });
    setTitle(''); setBody('');
    await load();
  };

  if (!stats) return <Loader />;

  return (
    <div>
      <div className="welcome-banner">
        <div>
          <h2>Principal’s Dashboard</h2>
          <p>School-wide overview for the current term</p>
        </div>
        <div className="welcome-banner__term">2024/2025 · First Term</div>
      </div>

      <div className="stats-grid">
        <StatCard label="Students"    value={stats.totalStudents}    color="#2563eb" />
        <StatCard label="Teachers"    value={stats.totalTeachers}    color="#7c3aed" />
        <StatCard label="Quizzes"     value={stats.totalQuizzes}     color="#f59e0b" />
        <StatCard label="Submissions" value={stats.totalSubmissions} color="#0891b2" />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Post Announcement</h3>
          <form onSubmit={postAnnouncement}>
            <label>Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>Message
              <textarea rows="3" value={body} onChange={(e) => setBody(e.target.value)} required />
            </label>
            <button className="btn btn--primary">Publish</button>
          </form>
        </div>

        <div className="card">
          <h3>Quick Links</h3>
          <div className="quick-actions">
            <Link to="/admin/results"  className="quick-action"><FiBarChart2 /> View Student Results</Link>
            <Link to="/admin/lms"      className="quick-action"><FiTrendingUp /> Check Performance</Link>
            <Link to="/admin/students" className="quick-action"><FiUsers /> Manage Students</Link>
            <Link to="/admin/teachers" className="quick-action"><FiUserCheck /> Manage Teachers</Link>
          </div>

          <h3 style={{ marginTop: 20 }}>Recent Announcements</h3>
          {stats.announcements.map((a) => (
            <div className="announcement" key={a.id}>
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