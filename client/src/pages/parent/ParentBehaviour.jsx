import { useEffect, useState } from 'react';
import {
  FiAlertCircle, FiThumbsUp, FiThumbsDown, FiUser, FiCalendar,
} from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';

const TYPE_META = {
  positive: { label: 'Positive', icon: FiThumbsUp,   class: 'behaviour-pill--positive', dot: 'positive' },
  negative: { label: 'Negative', icon: FiThumbsDown, class: 'behaviour-pill--negative', dot: 'negative' },
  neutral:  { label: 'Neutral',  icon: FiUser,       class: 'behaviour-pill--neutral',  dot: 'neutral'  },
};

export default function ParentBehaviour() {
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api('/parents/me/child/behaviour')
      .then(setData)
      .catch((e) => setErrorMsg(e.message));
  }, []);

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Child Behaviour" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const s = data.summary;

  return (
    <div>
      <PageHeader
        title={`${data.child.name}'s Behaviour`}
        subtitle={`Notes from teachers · ${data.child.className}`}
      />

      <div className="stats-grid">
        <StatCard label="Total Notes" value={s.total}    color="#2563eb" />
        <StatCard label="Positive"    value={s.positive} color="#16a34a" />
        <StatCard label="Negative"    value={s.negative} color="#dc2626" />
      </div>

      {data.reports.length === 0 && (
        <div className="card empty-state">
          <FiAlertCircle size={32} />
          <p>No behaviour notes yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Notes appear here as teachers log them.
          </p>
        </div>
      )}

      <div className="behaviour-timeline">
        {data.reports.map((r) => {
          const meta = TYPE_META[r.type] || TYPE_META.neutral;
          const Icon = meta.icon;
          return (
            <div className="behaviour-card" key={r.id}>
              <div className={`behaviour-card__icon behaviour-card__icon--${r.type}`}>
                <Icon size={16} />
              </div>
              <div className="behaviour-card__body">
                <div className="behaviour-card__head">
                  <strong>{r.title}</strong>
                  <span className={`behaviour-pill ${meta.class}`}>{meta.label}</span>
                </div>
                <div className="behaviour-card__meta">
                  <span><FiUser size={11} /> {r.teacherName}</span>
                  <span><FiCalendar size={11} /> {r.date}</span>
                </div>
                {r.note && <p className="behaviour-card__note">{r.note}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}