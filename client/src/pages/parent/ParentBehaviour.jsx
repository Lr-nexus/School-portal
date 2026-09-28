import { useEffect, useState } from 'react';
import {
  FiAlertCircle, FiThumbsUp, FiThumbsDown, FiUser, FiCalendar,
} from 'react-icons/fi';
import { api } from '../../api/api';
import { useParentContext } from '../../hooks/useParentContext';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import Loader from '../../components/Loader';
import ChildSelector from '../../components/ChildSelector';

const TYPE_META = {
  positive: { label: 'Positive', icon: FiThumbsUp, class: 'behaviour-pill--positive' },
  negative: { label: 'Negative', icon: FiThumbsDown, class: 'behaviour-pill--negative' },
  neutral:  { label: 'Neutral',  icon: FiUser, class: 'behaviour-pill--neutral' },
};

export default function ParentBehaviour() {
  const {
    children, activeChild, activeChildId, setActiveChildId, loading,
  } = useParentContext();

  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!activeChildId) return;
    setLoadingData(true);
    setErrorMsg('');
    api(`/parents/me/children/${activeChildId}/behaviour`)
      .then(setData)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoadingData(false));
  }, [activeChildId]);

  if (loading) return <Loader />;
  if (!activeChild) {
    return (
      <div>
        <PageHeader title="Child Behaviour" />
        <div className="card empty-state"><p>No child linked.</p></div>
      </div>
    );
  }

  const s = data?.summary || { total: 0, positive: 0, negative: 0 };

  return (
    <div>
      <PageHeader
        title={`${activeChild.name}'s Behaviour`}
        subtitle={`Notes from teachers · ${activeChild.className}`}
      >
        <ChildSelector
          children={children}
          value={activeChildId}
          onChange={setActiveChildId}
        />
      </PageHeader>

      {errorMsg && (
        <div className="alert alert--error"><FiAlertCircle size={16} /> {errorMsg}</div>
      )}

      <div className="stats-grid">
        <StatCard label="Total Notes" value={s.total} color="#2563eb" />
        <StatCard label="Positive" value={s.positive} color="#16a34a" />
        <StatCard label="Negative" value={s.negative} color="#dc2626" />
      </div>

      {loadingData && !data && <Loader />}

      {data && data.reports.length === 0 && (
        <div className="card empty-state">
          <FiAlertCircle size={32} />
          <p>No behaviour notes yet.</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Notes appear here as teachers log them.
          </p>
        </div>
      )}

      {data && data.reports.length > 0 && (
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
      )}
    </div>
  );
}