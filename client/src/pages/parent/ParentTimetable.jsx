import { useEffect, useState } from 'react';
import { FiClock, FiAlertCircle } from 'react-icons/fi';
import { api } from '../../api/api';
import { useParentContext } from '../../hooks/useParentContext';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import ChildSelector from '../../components/ChildSelector';
import WeeklyTimetable from '../../components/WeeklyTimetable';

export default function ParentTimetable() {
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
    api(`/parents/me/children/${activeChildId}/timetable`)
      .then(setData)
      .catch((e) => setErrorMsg(e.message))
      .finally(() => setLoadingData(false));
  }, [activeChildId]);

  if (loading) return <Loader />;
  if (!activeChild) {
    return (
      <div>
        <PageHeader title="Child Timetable" />
        <div className="card empty-state"><p>No child linked.</p></div>
      </div>
    );
  }

  const hasSlots = (data?.slots?.length || 0) > 0;

  return (
    <div>
      <PageHeader
        title="Child Timetable"
        subtitle={`Weekly schedule for ${activeChild.name} · ${activeChild.className}`}
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

      {loadingData && !data && <Loader />}

      {data && !hasSlots && (
        <div className="card timetable-empty">
          <FiClock size={40} />
          <p>No timetable has been published for this class yet.</p>
        </div>
      )}

      {data && hasSlots && (
        <WeeklyTimetable className={data.className} slots={data.slots} />
      )}
    </div>
  );
}