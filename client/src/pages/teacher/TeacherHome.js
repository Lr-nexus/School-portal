import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiEdit3, FiUsers, FiClipboard, FiMail, FiPhone, FiVideo
} from 'react-icons/fi';
import { api } from '../../api/api';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function TeacherHome() {
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [studentsData, setStudentsData] = useState({ students: [] });

  useEffect(() => {
    Promise.all([
      api('/teachers/me'),
      api('/teachers/me/classes'),
      api('/lms/my-quizzes'),
      api('/teachers/me/students')
    ])
      .then(([p, c, q, s]) => {
        setProfile(p);
        setClasses(c);
        setQuizzes(q);
        setStudentsData(s || { students: [] });
      })
      .catch((e) => console.error('Dashboard load failed:', e));
  }, []);

  if (!profile) return <Loader />;

  const teacherSubjects = Array.isArray(profile.subjects) ? profile.subjects : [];
  const totalStudents = studentsData.students?.length || 0;

  return (
    <div>
      {/* WELCOME BANNER */}
      <div className="welcome-banner">
        <div className="welcome-banner__left">
          <h2>Good day, {profile.name}</h2>
          <p>
            {profile.formClass ? `${profile.formClass} Form Teacher` : 'Teacher'}
            {profile.staffNo && <> · {profile.staffNo}</>}
          </p>
          {teacherSubjects.length > 0 ? (
            <div className="welcome-banner__subjects">
              {teacherSubjects.map((s) => (
                <span className="welcome-banner__chip" key={s}>{s}</span>
              ))}
            </div>
          ) : (
            <p className="welcome-banner__empty">No subjects assigned yet</p>
          )}
        </div>
        <div className="welcome-banner__term">2024/2025 · First Term</div>
      </div>

      {/* STAT CARDS */}
      <div className="stats-grid">
        <StatCard label="My Class"         value={profile.formClass || '—'} color="#7c3aed" />
        <StatCard label="My Students"      value={totalStudents}             color="#2563eb" />
        <StatCard label="Quizzes Created"  value={quizzes.length}            color="#0891b2" />
        <StatCard label="Subjects"         value={teacherSubjects.length}    color="#16a34a" />
      </div>

      <div className="grid-2">
        {/* QUICK ACTIONS */}
        <div className="card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <Link to="/teacher/students"    className="quick-action">
              <FiUsers /> View My Students ({totalStudents})
            </Link>
            <Link to="/teacher/lms"         className="quick-action">
              <FiEdit3 /> Create a Quiz / Test
            </Link>
            <Link to="/teacher/assignments" className="quick-action">
              <FiClipboard /> Post an Assignment
            </Link>
            <Link to="/teacher/classroom"   className="quick-action">
              <FiVideo /> Plan a Live Class
            </Link>
          </div>

          <div className="teacher-contact">
            <h4>Your Contact Info</h4>
            <div className="teacher-contact__row">
              <FiMail size={14} />
              <span>{profile.email || '—'}</span>
            </div>
            <div className="teacher-contact__row">
              <FiPhone size={14} />
              <span>{profile.phone || '—'}</span>
            </div>
          </div>
        </div>

        {/* CLASS OVERVIEW */}
        <div className="card">
          <h3>Class Overview</h3>
          {classes.length === 0 ? (
            <p className="muted">You are not assigned to any classes yet.</p>
          ) : (
            <table className="table table--striped">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Subjects</th>
                  <th className="right">Students</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const subjectList =
                    Array.isArray(c.subjects) && c.subjects.length > 0
                      ? c.subjects
                      : teacherSubjects;

                  return (
                    <tr key={c.id}>
                      <td><strong>{c.name}</strong></td>
                      <td>
                        {subjectList && subjectList.length > 0 ? (
                          <span className="class-subject-list">
                            {subjectList.map((s, i) => (
                              <span className="chip" key={i}>{s}</span>
                            ))}
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>
                            No subjects
                          </span>
                        )}
                      </td>
                      <td className="right">
                        <span className="pill">{c.students.length}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}