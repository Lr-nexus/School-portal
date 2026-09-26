import { useEffect, useState } from 'react';
import {
  FiBook, FiUsers, FiLayers, FiAlertCircle,
  FiClock, FiUser,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

export default function StudentClasses() {
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api('/students/me/classes')
      .then(setData)
      .catch((e) => setErrorMsg(e.message));
  }, []);

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="My Class" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const subjects = data.subjects || [];
  const classmates = data.classmates || [];

  return (
    <div>
      <PageHeader
        title="My Class"
        subtitle={`${data.name || '—'} · Class overview and classmates`}
      />

      {/* Stats */}
      <div className="stats-grid">
        <StatCard
          label="Class"
          value={data.name || '—'}
          hint="Your form class"
          color="#7c3aed"
        />
        <StatCard
          label="Subjects"
          value={subjects.length}
          hint="Offered this session"
          color="#2563eb"
        />
        <StatCard
          label="Classmates"
          value={classmates.length}
          hint="Excluding you"
          color="#16a34a"
        />
      </div>

      {/* Subjects */}
      <div className="card">
        <h3><FiBook size={16} /> Subjects Offered</h3>
        {subjects.length === 0 ? (
          <p className="muted">No subjects recorded for your class yet.</p>
        ) : (
          <div className="subject-grid">
            {subjects.map((s) => (
              <div className="subject-tile" key={s}>
                <div className="subject-tile__icon">
                  <FiBook size={16} />
                </div>
                <span className="subject-tile__name">{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Classmates */}
      <div className="card">
        <h3><FiUsers size={16} /> Classmates ({classmates.length})</h3>
        {classmates.length === 0 ? (
          <p className="muted">You're the only one in this class so far.</p>
        ) : (
          <div className="classmate-grid">
            {classmates.map((c) => (
              <div className="classmate-tile" key={c.id}>
                <div className="avatar avatar--sm">
                  {c.name.charAt(0)}
                </div>
                <div className="classmate-tile__info">
                  <strong>{c.name}</strong>
                  <span>{c.admissionNo}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}