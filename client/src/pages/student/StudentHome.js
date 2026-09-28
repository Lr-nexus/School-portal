import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiCreditCard, FiBarChart2, FiEdit3, FiBook,
  FiPrinter, FiAlertCircle, FiClock, FiChevronRight,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

function DueSoonCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api('/assignments').catch(() => []),
      api('/lms/quizzes').catch(() => []),
    ])
      .then(([assignments, quizzes]) => {
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const merged = [
          ...assignments
            .filter((a) => !a.mySubmission)
            .map((a) => ({
              type: 'assignment',
              id: a.id,
              title: a.title,
              subject: a.subject,
              dueDate: a.dueDate,
              link: '/student/assignments',
            })),
          ...quizzes
            .filter((q) => !q.completed)
            .map((q) => ({
              type: 'quiz',
              id: q.id,
              title: q.title,
              subject: q.subject,
              dueDate: q.dueDate,
              link: '/student/lms',
            })),
        ].filter((i) => {
          if (!i.dueDate) return false;
          const d = new Date(i.dueDate);
          return d >= now && d <= in7Days;
        });

        merged.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        setItems(merged);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const overdueCount = items.filter((i) => new Date(i.dueDate) < new Date()).length;

  return (
    <div className="card due-soon-card">
      <div className="due-soon-card__head">
        <h3>
          <FiClock size={16} /> Due this week
          {overdueCount > 0 && (
            <span className="pill pill--unpaid" style={{ marginLeft: 8 }}>
              {overdueCount} overdue
            </span>
          )}
        </h3>
        <Link to="/student/assignments" className="btn btn--ghost btn--sm">
          See all <FiChevronRight size={12} />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          🎉 Nothing due this week — you're all caught up.
        </p>
      ) : (
        <div className="due-soon-list">
          {items.slice(0, 6).map((i) => {
            const d = new Date(i.dueDate);
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const isTomorrow = d >= now && d <= tomorrow;
            const isOverdue = d < now;
            const daysUntil = Math.ceil((d - now) / (1000 * 60 * 60 * 24));

            return (
              <button
                type="button"
                key={`${i.type}-${i.id}`}
                className="due-soon-item"
                onClick={() => navigate(i.link)}
              >
                <div
                  className={`due-soon-item__badge due-soon-item__badge--${i.type}`}
                >
                  {i.type === 'quiz' ? 'Quiz' : 'Task'}
                </div>
                <div className="due-soon-item__info">
                  <strong>{i.title}</strong>
                  <span className="muted">{i.subject}</span>
                </div>
                <div
                  className={`due-soon-item__due ${
                    isOverdue ? 'due-soon-item__due--overdue' :
                    isTomorrow ? 'due-soon-item__due--urgent' : ''
                  }`}
                >
                  {isOverdue ? (
                    <><FiAlertCircle size={11} /> Overdue</>
                  ) : isTomorrow ? (
                    <><FiAlertCircle size={11} /> Tomorrow</>
                  ) : (
                    <>{daysUntil} day{daysUntil === 1 ? '' : 's'}</>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StudentHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [results, setResults] = useState(null);
  const [fees, setFees] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    Promise.all([
      api('/students/me'),
      api('/students/me/results'),
      api('/students/me/fees'),
      api('/students/me/announcements'),
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
        <StatCard label="Average Score" value={`${results?.average ?? 0}%`} hint={`Grade ${results?.overallGrade ?? '-'}`} color="#2563eb" />
        <StatCard label="Subjects" value={results?.subjects.length ?? 0} hint="This term" color="#7c3aed" />
        <StatCard label="Outstanding Fees" value={`₦${outstanding.toLocaleString()}`} hint={outstanding > 0 ? 'Payment due' : 'All cleared'} color={outstanding > 0 ? '#dc2626' : '#16a34a'} />
        <StatCard label="Class" value={profile.className} hint={profile.house} color="#0891b2" />
      </div>

      <DueSoonCard />

      <div className="grid-2">
        <div className="card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <Link to="/student/fees"    className="quick-action"><FiCreditCard /> Pay Fees / Receipt</Link>
            <Link to="/student/results" className="quick-action"><FiBarChart2 /> Check Results</Link>
            <Link to="/student/lms"     className="quick-action"><FiEdit3 />     Take a Quiz</Link>
            <Link to="/student/classes" className="quick-action"><FiBook />      View Timetable</Link>
            <button
              type="button"
              className="quick-action"
              onClick={() => navigate(`/print/id-card/${profile.id}`)}
            >
              <FiCreditCard /> My ID Card
            </button>
            <button
              type="button"
              className="quick-action"
              onClick={() => navigate(`/print/report-card/${profile.id}`)}
            >
              <FiPrinter /> Print My Report Card
            </button>
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