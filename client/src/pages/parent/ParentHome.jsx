import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiUser, FiBarChart2, FiCreditCard, FiCheckSquare,
  FiCalendar, FiMail, FiPhone, FiAlertCircle, FiPrinter,
  FiClock, FiDollarSign, FiUsers,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useParentContext } from '../../hooks/useParentContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';
import ChildSelector from '../../components/ChildSelector';

const formatNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');

export default function ParentHome() {
  const {
    parent, children, activeChild, activeChildId, setActiveChildId,
    loading, errorMsg,
  } = useParentContext();

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeChildId) return;
    setLoadingStats(true);
    Promise.all([
      api(`/parents/me/children/${activeChildId}/attendance`).catch(() => null),
      api(`/parents/me/children/${activeChildId}/results`).catch(() => null),
      api(`/parents/me/children/${activeChildId}/fees`).catch(() => []),
    ])
      .then(([att, res, fees]) => {
        setStats({
          attendance: att?.summary || { percentage: 0, present: 0, total: 0 },
          results: res ? {
            average: res.average, overallGrade: res.overallGrade,
          } : { average: 0, overallGrade: '—' },
          fees: (fees || []).reduce(
            (acc, f) => {
              acc.total += Number(f.total);
              acc.paid += Number(f.amountPaid);
              acc.outstanding += Number(f.balance);
              return acc;
            },
            { total: 0, paid: 0, outstanding: 0 }
          ),
        });
      })
      .finally(() => setLoadingStats(false));
  }, [activeChildId]);

  if (loading) return <Loader />;

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Parent Dashboard" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      </div>
    );
  }

  if (!parent) return null;

  const noChildren = !children.length;

  return (
    <div>
      <div className="welcome-banner">
        <div className="welcome-banner__left">
          <h2>Welcome, {parent.name}</h2>
          <p>
            {children.length > 1
              ? `Parent/Guardian of ${children.length} children`
              : activeChild
                ? `Parent/Guardian of ${activeChild.name} · ${activeChild.className}`
                : 'No children linked yet'}
          </p>
          {children.length > 1 && (
            <div className="welcome-banner__subjects">
              {children.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`welcome-banner__chip welcome-banner__chip--clickable ${
                    c.id === activeChildId ? 'welcome-banner__chip--active' : ''
                  }`}
                  onClick={() => setActiveChildId(c.id)}
                >
                  {c.name.split(' ')[0]} · {c.className}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="welcome-banner__term">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {noChildren && (
        <div className="card empty-state">
          <FiUser size={32} />
          <p>No students linked to your account yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Ask the school office to link your account to your child.
          </p>
        </div>
      )}

      {!noChildren && activeChild && (
        <>
          <PageHeader
            title="Child overview"
            subtitle={`${activeChild.name} · ${activeChild.className}`}
          >
            {children.length > 1 && (
              <ChildSelector
                children={children}
                value={activeChildId}
                onChange={setActiveChildId}
              />
            )}
          </PageHeader>

          {loadingStats && !stats ? (
            <Loader />
          ) : stats ? (
            <>
              <div className="stats-grid">
                <StatCard
                  label="Child"
                  value={activeChild.name.split(' ')[0]}
                  hint={`${activeChild.className} · ${activeChild.admissionNo}`}
                  color="#d97706"
                />
                <StatCard
                  label="Attendance"
                  value={`${stats.attendance.percentage}%`}
                  hint={`${stats.attendance.present} / ${stats.attendance.total} days`}
                  color={
                    stats.attendance.percentage >= 80 ? '#16a34a' :
                    stats.attendance.percentage >= 60 ? '#f59e0b' : '#dc2626'
                  }
                />
                <StatCard
                  label="Latest Average"
                  value={`${stats.results.average}%`}
                  hint={stats.results.overallGrade !== '—'
                    ? `Grade ${stats.results.overallGrade}` : 'No results yet'}
                  color="#2563eb"
                />
                <StatCard
                  label="Outstanding Fees"
                  value={formatNaira(stats.fees.outstanding)}
                  hint={stats.fees.outstanding > 0 ? 'Payment due' : 'All cleared'}
                  color={stats.fees.outstanding > 0 ? '#dc2626' : '#16a34a'}
                />
              </div>

              <div className="grid-2">
                <div className="card">
                  <h3>Quick Actions</h3>
                  <div className="quick-actions">
                    <Link to="/parent/fees"       className="quick-action">
                      <FiCreditCard /> Pay Fees
                    </Link>
                    <Link to="/parent/payments"   className="quick-action">
                      <FiDollarSign /> Payment History
                    </Link>
                    <Link to="/parent/results"    className="quick-action">
                      <FiBarChart2 /> View Results
                    </Link>
                    <Link to="/parent/attendance" className="quick-action">
                      <FiCheckSquare /> View Attendance
                    </Link>
                    <Link to="/parent/timetable"  className="quick-action">
                      <FiCalendar /> View Timetable
                    </Link>
                    <Link to="/parent/meetings"   className="quick-action">
                      <FiClock /> Request Teacher Meeting
                    </Link>
                    <button
                      type="button"
                      className="quick-action"
                      onClick={() => navigate(`/print/report-card/${activeChild.id}`)}
                    >
                      <FiPrinter /> Print Report Card
                    </button>
                  </div>
                </div>

                <div className="card">
                  <h3>Child Details</h3>
                  <table className="table table--striped">
                    <tbody>
                      <tr><td className="table__label">Name</td><td>{activeChild.name}</td></tr>
                      <tr><td className="table__label">Class</td><td>{activeChild.className}</td></tr>
                      <tr><td className="table__label">Admission No</td><td>{activeChild.admissionNo}</td></tr>
                      <tr><td className="table__label">House</td><td>{activeChild.house || '—'}</td></tr>
                      <tr><td className="table__label">Gender</td><td>{activeChild.gender || '—'}</td></tr>
                    </tbody>
                  </table>

                  <div className="teacher-contact">
                    <h4>Your Contact Info</h4>
                    <div className="teacher-contact__row">
                      <FiMail size={14} /> <span>{parent.email}</span>
                    </div>
                    <div className="teacher-contact__row">
                      <FiPhone size={14} /> <span>{parent.phone || '—'}</span>
                    </div>
                    {children.length > 1 && (
                      <div className="teacher-contact__row" style={{ marginTop: 8 }}>
                        <FiUsers size={14} />
                        <span>{children.length} children linked</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}