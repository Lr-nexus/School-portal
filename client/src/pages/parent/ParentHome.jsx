import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiUser, FiBarChart2, FiCreditCard, FiCheckSquare,
  FiCalendar, FiMail, FiPhone, FiAlertCircle, FiPrinter,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function ParentHome() {
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api('/parents/me')
      .then(setData)
      .catch((e) => setErrorMsg(e.message));
  }, []);

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Parent Dashboard" />
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const { parent, child, attendance, results, fees } = data;
  const formatNaira = (n) => '₦' + Number(n || 0).toLocaleString('en-NG');

  return (
    <div>
      <div className="welcome-banner">
        <div className="welcome-banner__left">
          <h2>Welcome, {parent.name}</h2>
          <p>
            {child
              ? `Parent/Guardian of ${child.name} · ${child.className}`
              : 'No child linked yet'}
          </p>
        </div>
        <div className="welcome-banner__term">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {!child && (
        <div className="card empty-state">
          <FiUser size={32} />
          <p>No student linked to your account yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Ask the school office to link your account to your child.
          </p>
        </div>
      )}

      {child && (
        <>
          <div className="stats-grid">
            <StatCard
              label="Child"
              value={child.name.split(' ')[0]}
              hint={`${child.className} · ${child.admissionNo}`}
              color="#d97706"
            />
            <StatCard
              label="Attendance"
              value={`${attendance.percentage}%`}
              hint={`${attendance.present} / ${attendance.total} days`}
              color={attendance.percentage >= 80 ? '#16a34a' : attendance.percentage >= 60 ? '#f59e0b' : '#dc2626'}
            />
            <StatCard
              label="Latest Average"
              value={`${results.average}%`}
              hint={results.overallGrade ? `Grade ${results.overallGrade}` : 'No results yet'}
              color="#2563eb"
            />
            <StatCard
              label="Outstanding Fees"
              value={formatNaira(fees.outstanding)}
              hint={fees.outstanding > 0 ? 'Payment due' : 'All cleared'}
              color={fees.outstanding > 0 ? '#dc2626' : '#16a34a'}
            />
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Quick Actions</h3>
              <div className="quick-actions">
                <Link to="/parent/fees"       className="quick-action"><FiCreditCard /> Pay Fees</Link>
                <Link to="/parent/results"    className="quick-action"><FiBarChart2 /> View Results</Link>
                <Link to="/parent/attendance" className="quick-action"><FiCheckSquare /> View Attendance</Link>
                <Link to="/parent/timetable"  className="quick-action"><FiCalendar /> View Timetable</Link>

                {/* ⭐ NEW: print shortcuts */}
                <button
                  type="button"
                  className="quick-action"
                  onClick={() => navigate(`/print/id-card/${child.id}`)}
                >
                  <FiCreditCard /> Child's ID Card
                </button>
                <button
                  type="button"
                  className="quick-action"
                  onClick={() => navigate(`/print/report-card/${child.id}`)}
                >
                  <FiPrinter /> Print Report Card
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Child Details</h3>
              <table className="table table--striped">
                <tbody>
                  <tr><td className="table__label">Name</td><td>{child.name}</td></tr>
                  <tr><td className="table__label">Class</td><td>{child.className}</td></tr>
                  <tr><td className="table__label">Admission No</td><td>{child.admissionNo}</td></tr>
                  <tr><td className="table__label">House</td><td>{child.house || '—'}</td></tr>
                  <tr><td className="table__label">Gender</td><td>{child.gender || '—'}</td></tr>
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
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}