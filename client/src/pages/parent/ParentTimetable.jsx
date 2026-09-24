import { useEffect, useState } from 'react';
import { FiClock, FiAlertCircle } from 'react-icons/fi';
import { api } from '../../api/api';
import PageHeader from '../../components/PageHeader';
import Loader from '../../components/Loader';
import WeeklyTimetable from '../../components/WeeklyTimetable';

export default function ParentTimetable() {
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    api('/parents/me/child/timetable')
      .then(setData)
      .catch((e) => setErrorMsg(e.message));
  }, []);

  if (errorMsg) {
    return (
      <div>
        <PageHeader title="Child Timetable" />
        <div className="alert alert--error">
          <FiAlertCircle size={16} /> {errorMsg}
        </div>
      </div>
    );
  }
  if (!data) return <Loader />;

  const hasSlots = (data.slots?.length || 0) > 0;

  return (
    <div>
      <PageHeader
        title="Child Timetable"
        subtitle={`Weekly schedule for ${data.className || 'your child'}`}
      />

      {!hasSlots && (
        <div className="card timetable-empty">
          <FiClock size={40} />
          <p>No timetable has been published for this class yet.</p>
        </div>
      )}

      {hasSlots && (
        <WeeklyTimetable className={data.className} slots={data.slots} />
      )}
    </div>
  );
}